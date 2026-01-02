import { err, none, ok, Option, Result, some } from "../result/result.js";
import { CacheKey, hashCacheKey, HashedCacheKey } from "./CacheKey.js";

export type CacheValue = unknown;

export type LoaderResult<V = CacheValue> = { value: V; hash: string };

export type ComputeFn<T = CacheValue> = (
  ctx: CacheComputeContext
) => Promise<LoaderResult<T>>;

export type CacheEntry = {
  value: Option<CacheValue>;
  hash: Option<string>;
  upstreamHashes: Map<CacheKey, string>;
  invalidated: boolean;
  upstreams: Set<CacheKey>;
  downstreams: Set<CacheKey>;
  computeFn: ComputeFn;
};

export type CacheEntryInput = Pick<CacheEntry, "computeFn">;

export type CacheGetResult = Result<CacheEntry, false>;

export type CacheComputeContext = {
  /**
   * Load the cache entry for the given key.
   */
  load: (key: CacheKey) => Promise<CacheValue>;
};

export type CacheLoader<K, V> = {
  use: (key: K) => Promise<V>;
  load: (ctx: CacheComputeContext, key: K) => Promise<V>;
  invalidate: (key: K) => void;
};

const unwrapGetResult = (result: CacheGetResult): CacheEntry => {
  if (result.success) {
    return result.data;
  }
  throw new Error("Cache entry missing");
};

/**
 * Low-level common caching provider
 */
export class QueryCache {
  private inflight = new Map<HashedCacheKey, Promise<CacheValue>>();
  private store = new Map<HashedCacheKey, CacheEntry>();

  constructor(private debugCache: boolean = false) {}

  private log(message: string, key: CacheKey): void {
    if (this.debugCache) {
      console.info(`[cache] ${message}: ${JSON.stringify(key)}`);
    }
  }

  createLoader = <K extends CacheKey, V extends CacheValue>(
    fn: (k: K, ctx: CacheComputeContext) => Promise<LoaderResult<V>>
  ): CacheLoader<K, V> => {
    const ensureKey = (key: K) => {
      const k = hashCacheKey(key);
      const computeFn: ComputeFn = (ctx) =>
        fn(key, ctx) as Promise<LoaderResult>;
      const entry = this.get(key);
      if (entry.success) {
        entry.data.computeFn = computeFn;
      } else {
        this.store.set(k, {
          computeFn,
          value: none(),
          hash: none(),
          upstreamHashes: new Map(),
          invalidated: false,
          downstreams: new Set(),
          upstreams: new Set(),
        });
      }
    };

    return {
      use: async (key: K): Promise<V> => {
        ensureKey(key);

        return (await this.compute(key)) as V;
      },
      load: async (ctx: CacheComputeContext, key: K): Promise<V> => {
        ensureKey(key);

        return (await ctx.load(key)) as V;
      },
      invalidate: (key: K): void => {
        this.invalidateByKey(key);
      },
    };
  };

  get(key: CacheKey): CacheGetResult {
    const has = this.store.has(hashCacheKey(key));
    if (has) {
      const entry = this.store.get(hashCacheKey(key))!;
      return ok(entry);
    } else {
      return err(false);
    }
  }

  async set(key: CacheKey, entry: CacheEntryInput): Promise<void> {
    const k = hashCacheKey(key);
    this.store.set(k, {
      ...entry,
      value: none(),
      hash: none(),
      upstreamHashes: new Map(),
      invalidated: false,
      downstreams: new Set(),
      upstreams: new Set(),
    });
    return;
  }

  async use<T>(key: CacheKey, computeFn: ComputeFn<T>): Promise<T> {
    const k = hashCacheKey(key);

    const entry = this.get(key);
    if (entry.success) {
      entry.data.computeFn = computeFn;
    } else {
      this.store.set(k, {
        computeFn,
        value: none(),
        hash: none(),
        upstreamHashes: new Map(),
        invalidated: false,
        downstreams: new Set(),
        upstreams: new Set(),
      });
    }

    return (await this.compute(key)) as T;
  }

  async compute(key: CacheKey): Promise<CacheValue> {
    const hashed = hashCacheKey(key);
    /**
     * If we are computing this key already, return the in-flight promise.
     */
    const existing = this.inflight.get(hashed);
    if (existing) return existing;

    const entry = unwrapGetResult(this.get(key));

    // No cached value → must recompute
    if (!entry.value.success) {
      return this.recompute(key, entry, () => "no cached value");
    }

    // Has cached value but marked invalidated → check if we can skip recomputation
    if (entry.invalidated) {
      // First, recursively ensure all upstreams are revalidated
      for (const upstreamKey of entry.upstreams) {
        await this.compute(upstreamKey);
      }

      // Compare upstream hashes with what we recorded
      let mismatchReason: (() => string) | null = null;
      for (const [upstreamKey, oldHash] of entry.upstreamHashes) {
        const upstream = unwrapGetResult(this.get(upstreamKey));
        if (!upstream.hash.success) {
          mismatchReason = () =>
            `upstream ${JSON.stringify(upstreamKey)} has no hash`;
          break;
        }
        if (upstream.hash.data !== oldHash) {
          mismatchReason = () =>
            `upstream ${JSON.stringify(upstreamKey)} hash changed`;
          break;
        }
      }

      if (!mismatchReason) {
        // All upstream hashes match - skip recomputation!
        this.log("skip-recompute", key);
        entry.invalidated = false;
        return entry.value.data;
      }

      // Upstream hashes changed - must recompute
      return this.recompute(key, entry, mismatchReason);
    }

    // Not invalidated and has cached value → return immediately
    this.log("cache-hit", key);
    return entry.value.data;
  }

  private recompute(
    key: CacheKey,
    entry: CacheEntry,
    reason: () => string
  ): Promise<CacheValue> {
    this.log(`recompute (${reason()})`, key);
    const hashed = hashCacheKey(key);

    // Clear old upstream tracking
    const oldUpstreams = entry.upstreams;
    entry.upstreams = new Set();
    entry.upstreamHashes = new Map();

    const ctx: CacheComputeContext = {
      load: async (upstreamKey: CacheKey) => {
        // TODO: if we detect a cycle, we should throw an error here
        const upstream = unwrapGetResult(this.get(upstreamKey));
        upstream.downstreams.add(key);
        entry.upstreams.add(upstreamKey);

        // Ensure upstream is computed
        if (upstream.invalidated || !upstream.value.success) {
          await this.compute(upstreamKey);
        }

        // Record upstream hash
        if (upstream.hash.success) {
          entry.upstreamHashes.set(upstreamKey, upstream.hash.data);
        }

        if (!upstream.value.success) {
          throw new Error("Upstream value not computed");
        }
        return upstream.value.data;
      },
    };

    const p = (async () => {
      try {
        const result = await entry.computeFn(ctx);

        entry.value = some(result.value);
        entry.hash = some(result.hash);
        entry.invalidated = false;
        return result.value;
      } finally {
        // Clean up inflight map
        this.inflight.delete(hashed);

        // For each old upstream that is no longer referenced, remove this entry from its downstreams
        for (const oldUpstreamKey of oldUpstreams) {
          if (!entry.upstreams.has(oldUpstreamKey)) {
            const oldUpstream = unwrapGetResult(this.get(oldUpstreamKey));
            oldUpstream.downstreams.delete(key);
          }
        }
      }
    })();

    this.inflight.set(hashed, p);
    return p;
  }

  invalidateByKey(
    key: CacheKey,
    visited: Set<HashedCacheKey> = new Set()
  ): void {
    const hashed = hashCacheKey(key);
    if (visited.has(hashed)) return; // Prevent re-visiting in diamond DAGs
    visited.add(hashed);

    const entry = this.store.get(hashed);
    if (!entry) return;

    const isRoot = visited.size === 1; // First node in traversal

    if (isRoot) {
      // Root node: clear value to force recomputation
      this.log("invalidate", key);
      entry.value = none();
    } else {
      this.log("mark-invalidated", key);
    }
    // All nodes (root and downstream): mark as invalidated
    entry.invalidated = true;

    // Recursively mark downstreams as invalidated
    for (const downstreamKey of entry.downstreams) {
      this.invalidateByKey(downstreamKey, visited);
    }
  }
}
