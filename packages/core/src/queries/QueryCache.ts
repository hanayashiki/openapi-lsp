import { err, none, ok, Option, Result, some } from "../result/result.js";
import { CacheKey, hashCacheKey, HashedCacheKey } from "./CacheKey.js";

export type CacheValue = unknown;

export type ComputeFn = (ctx: CacheComputeContext) => Promise<CacheValue>;

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

  async get(key: CacheKey): Promise<CacheGetResult> {
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

  async compute(key: CacheKey): Promise<CacheValue> {
    const hashed = hashCacheKey(key);
    /**
     * If we are computing this key already, return the in-flight promise.
     */
    const existing = this.inflight.get(hashed);
    if (existing) return existing;

    const entry = unwrapGetResult(await this.get(key));

    if (entry.value.success) {
      return entry.value.data;
    }

    const oldUpstreams = entry.upstreams;
    entry.upstreams = new Set();

    const ctx: CacheComputeContext = {
      load: async (upstreamKey: CacheKey) => {
        // TODO: if we detect a cycle, we should throw an error here

        const upstream = unwrapGetResult(await this.get(upstreamKey));
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
            const oldUpstream = unwrapGetResult(await this.get(oldUpstreamKey));
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
