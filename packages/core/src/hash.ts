import { md5 } from "js-md5";

export type PlainObject =
  | string
  | number
  | null
  | undefined
  | boolean
  | PlainObject[]
  | { [key: string]: PlainObject };

const isPrimitive = (
  value: unknown
): value is string | number | boolean | null | undefined =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  typeof value === "undefined" ||
  value === null;

const canonicalize = (value: PlainObject): PlainObject => {
  if (isPrimitive(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  // Object: sort keys and recursively canonicalize values
  const sorted: Record<string, PlainObject> = {};
  for (const [key, item] of Object.entries(value).sort()) {
    if (item === undefined) continue;
    sorted[key] = canonicalize(value[key]);
  }
  return sorted;
};

export const hashPlainObject = (value: PlainObject): string => {
  return md5(JSON.stringify(canonicalize(value)));
};
