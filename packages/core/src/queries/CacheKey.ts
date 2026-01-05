import { hashPlainObject, PlainObject } from "../hash.js";

export type CacheKey = PlainObject;

export const hashCacheKey = (key: CacheKey): HashedCacheKey => {
  return hashPlainObject(key) as HashedCacheKey;
};

export type HashedCacheKey = string & { __hashed?: true };
