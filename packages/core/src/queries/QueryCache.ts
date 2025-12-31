import { err, none, ok, Option, Result, some } from "../result/result.js";
import { CacheKey, hashCacheKey, HashedCacheKey } from "./CacheKey.js";

export type CacheValue = unknown;

export type ComputeFn<T = CacheValue> = (
  ctx: CacheComputeContext
) => Promise<T>;

export type CacheEntry = {
  value: Option<CacheValue>;
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

  createLoader = <K extends CacheKey, V extends CacheValue>(
    fn: (k: K, ctx: CacheComputeContext) => Promise<V>
  ): CacheLoader<K, V> => {
    const ensureKey = (key: K) => {
      const k = hashCacheKey(key);
      const computeFn: ComputeFn = (ctx) => fn(key, ctx);
      const entry = this.get(key);
      if (entry.success) {
        entry.data.computeFn = computeFn;
      } else {
        this.store.set(k, {
          computeFn,
          value: none(),
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

    if (entry.value.success) {
      return entry.value.data;
    }

    const oldUpstreams = entry.upstreams;
    entry.upstreams = new Set();

    const ctx: CacheComputeContext = {
      load: async (upstreamKey: CacheKey) => {
        // TODO: if we detect a cycle, we should throw an error here
        const upstream = unwrapGetResult(this.get(upstreamKey));
        upstream.downstreams.add(key);
        entry.upstreams.add(upstreamKey);

        if (upstream.value.success) {
          return upstream.value.data;
        }

        const result = await upstream.computeFn(ctx);

        return result;
      },
    };

    const p = (async () => {
      try {
        const value = await entry.computeFn(ctx);

        entry.value = some(value);
        return value;
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

  invalidateByKey(key: CacheKey): void {
    const hashed = hashCacheKey(key);
    const entry = this.store.get(hashed);
    if (!entry) return;

    // Invalidate downstreams
    for (const downstreamKey of entry.downstreams) {
      this.invalidateByKey(downstreamKey);
    }

    // Remove this entry
    entry.value = none();
  }
}
