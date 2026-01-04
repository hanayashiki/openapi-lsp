import { err, none, ok, Option, Result, some } from "../result/result.js";
import { CacheKey, hashCacheKey, HashedCacheKey } from "./CacheKey.js";

export type CacheValue = unknown;

export type LoaderResult<V = CacheValue> = { value: V; hash: string };

export type ComputeFn<T = CacheValue> = (
  ctx: CacheComputeContext
) => Promise<LoaderResult<T>>;

export type CacheEntry = {
  key: CacheKey;
  value: Option<CacheValue>;
  hash: Option<string>;
  upstreamHashes: Map<HashedCacheKey, string>;
  invalidated: boolean;
  upstreams: Set<HashedCacheKey>;
  downstreams: Set<HashedCacheKey>;
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
  invalidateMatching: (predicate: (key: K) => boolean) => void;
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

  constructor(private debugCache: boolean = true) {}

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
          key,
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

        const v = (await this.compute(key)) as V;

        // console.info("[loader.use]", key);
        // this.logGraphviz();
        return v;
      },
      load: async (ctx: CacheComputeContext, key: K): Promise<V> => {
        ensureKey(key);

        return (await ctx.load(key)) as V;
      },
      invalidate: (key: K): void => {
        this.invalidateByKey(key);
      },
      invalidateMatching: (predicate: (key: K) => boolean): void => {
        this.invalidateMatching((key) => predicate(key as K));
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
      for (const upstreamHashed of entry.upstreams) {
        const upstream = this.store.get(upstreamHashed);
        if (upstream) {
          await this.compute(upstream.key);
        }
      }

      // Compare upstream hashes with what we recorded
      let mismatchReason: (() => string) | null = null;
      for (const [upstreamHashed, oldHash] of entry.upstreamHashes) {
        const upstream = this.store.get(upstreamHashed);
        if (!upstream || !upstream.hash.success) {
          mismatchReason = () => `upstream ${upstreamHashed} has no hash`;
          break;
        }
        if (upstream.hash.data !== oldHash) {
          mismatchReason = () => `upstream ${upstreamHashed} hash changed`;
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
        const upstreamHashed = hashCacheKey(upstreamKey);
        const upstream = unwrapGetResult(this.get(upstreamKey));
        upstream.downstreams.add(hashed);
        entry.upstreams.add(upstreamHashed);

        // Ensure upstream is computed
        if (upstream.invalidated || !upstream.value.success) {
          await this.compute(upstreamKey);
        }

        // Record upstream hash
        if (upstream.hash.success) {
          entry.upstreamHashes.set(upstreamHashed, upstream.hash.data);
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
        for (const oldUpstreamHashed of oldUpstreams) {
          if (!entry.upstreams.has(oldUpstreamHashed)) {
            const oldUpstream = this.store.get(oldUpstreamHashed);
            if (oldUpstream) {
              oldUpstream.downstreams.delete(hashed);
            }
          }
        }
      }
    })();

    this.inflight.set(hashed, p);
    return p;
  }

  invalidateByKey(key: CacheKey): void {
    const hashed = hashCacheKey(key);
    this.invalidateByHashedKey(hashed, new Set());
  }

  /**
   * Invalidate all cache entries whose keys match the predicate.
   */
  invalidateMatching(predicate: (key: CacheKey) => boolean): void {
    for (const [hashed, entry] of this.store) {
      if (predicate(entry.key)) {
        this.invalidateByHashedKey(hashed, new Set());
      }
    }
  }

  private invalidateByHashedKey(
    hashed: HashedCacheKey,
    visited: Set<HashedCacheKey>
  ): void {
    if (visited.has(hashed)) return; // Prevent re-visiting in diamond DAGs
    visited.add(hashed);

    const entry = this.store.get(hashed);
    if (!entry) return;

    const isRoot = visited.size === 1; // First node in traversal

    if (isRoot) {
      // Root node: clear value to force recomputation
      this.log("invalidate", entry.key);
      entry.value = none();
    } else {
      this.log("mark-invalidated", entry.key);
    }
    // All nodes (root and downstream): mark as invalidated
    entry.invalidated = true;

    // Recursively mark downstreams as invalidated
    for (const downstreamHashed of entry.downstreams) {
      this.invalidateByHashedKey(downstreamHashed, visited);
    }
  }

  // ----- Debug Helpers -----

  /**
   * Generate a GraphViz DOT representation of the cache dependency graph.
   * Edges point from each node to its upstreams (direction of data flow).
   * Node colors: green=valid, orange=invalidated, gray=no value
   */
  toGraphviz(): string {
    const lines: string[] = ["digraph QueryCache {", "  rankdir=BT;"];

    // Add nodes with labels and state info
    for (const [hashedKey, entry] of this.store) {
      // Escape quotes and backslashes for DOT format
      const labelStr = JSON.stringify(entry.key);
      const escapedLabel = labelStr.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const color = entry.invalidated
        ? "orange"
        : entry.value.success
        ? "green"
        : "gray";
      lines.push(
        `  "${hashedKey}" [label="${escapedLabel}" color="${color}"];`
      );
    }

    // Add edges from each node to its upstreams (upstreams are now HashedCacheKey)
    for (const [hashedKey, entry] of this.store) {
      for (const upstreamHashed of entry.upstreams) {
        lines.push(`  "${hashedKey}" -> "${upstreamHashed}";`);
      }
    }

    lines.push("}");
    return lines.join("\n");
  }

  logGraphviz(): void {
    const dot = this.toGraphviz();
    const encoded = encodeURIComponent(dot);
    const url = `https://magjac.com/graphviz-visual-editor/?dot=${encoded}`;
    // oxlint-disable-next-line
    console.debug(`QueryCache graph:\n${dot}\n\nVisualize: ${url}`);
  }
}
