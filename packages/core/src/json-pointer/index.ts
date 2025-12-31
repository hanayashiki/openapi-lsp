import { Result, ok, err } from "../result/result.js";

export type JsonPointerError =
  | { type: "invalidSyntax"; message: string }
  | { type: "invalidEscape"; message: string };

export type JsonPointerResult = Result<JsonPointer, JsonPointerError>;

export type JsonPointer = string[];

/**
 * Decode a single JSON Pointer reference token per RFC 6901
 * ~1 → /, ~0 → ~ (must decode in this order)
 */
function decodeToken(token: string): Result<string, JsonPointerError> {
  let result = "";
  let i = 0;
  while (i < token.length) {
    if (token[i] === "~") {
      if (i + 1 >= token.length) {
        return err({
          type: "invalidEscape",
          message: `Incomplete escape at position ${i}`,
        });
      }
      const next = token[i + 1];
      if (next === "1") {
        result += "/";
        i += 2;
      } else if (next === "0") {
        result += "~";
        i += 2;
      } else {
        return err({
          type: "invalidEscape",
          message: `Invalid escape ~${next} at position ${i}`,
        });
      }
    } else {
      result += token[i];
      i++;
    }
  }
  return ok(result);
}

/**
 * Parse a JSON Pointer string into path segments per RFC 6901
 * Supports both raw pointers ("/foo/bar") and URI fragments ("#/foo/bar")
 */
export function parseJsonPointer(pointer: string): JsonPointerResult {
  // Handle empty pointer (references whole document)
  if (pointer === "" || pointer === "#") {
    return ok([]);
  }

  let normalized = pointer;

  // Handle URI fragment identifier
  if (pointer.startsWith("#")) {
    normalized = decodeURIComponent(pointer.slice(1));
  }

  // Must start with /
  if (!normalized.startsWith("/")) {
    return err({
      type: "invalidSyntax",
      message: "JSON Pointer must start with '/'",
    });
  }

  // Split and decode each token
  const rawTokens = normalized.slice(1).split("/");
  const tokens: string[] = [];

  for (const raw of rawTokens) {
    const decoded = decodeToken(raw);
    if (!decoded.success) {
      return decoded;
    }
    tokens.push(decoded.data);
  }

  return ok(tokens);
}

/**
 * Check if a string is a local JSON Pointer (starts with #)
 */
export function isLocalPointer(ref: string): boolean {
  return ref.startsWith("#");
}
