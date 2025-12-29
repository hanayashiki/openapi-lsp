import { md5 } from "js-md5";

export type CacheKey =
  | string
  | number
  | null
  | boolean
  | CacheKey[]
  | {
      [key: string]: CacheKey;
    };

/**
 * Recursively sort object keys for canonical serialization.
 * This ensures {a:1, b:2} and {b:2, a:1} produce the same hash.
 */
const canonicalize = (value: CacheKey): CacheKey => {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  // Object: sort keys and recursively canonicalize values
  const sorted: Record<string, CacheKey> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize(value[key]);
  }
  return sorted;
};

export const hashCacheKey = (key: CacheKey): HashedCacheKey => {
  return md5(JSON.stringify(canonicalize(key)));
};

export type HashedCacheKey = string & { __hashed?: true };
