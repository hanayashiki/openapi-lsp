import { Result, ok, err } from "../result/result.js";

export type JsonPointerError =
  | { type: "invalidUrl"; message: string }
  | { type: "invalidSyntax"; message: string }
  | { type: "invalidEscape"; message: string };

export type JsonPointerResult = Result<JsonPointer, JsonPointerError>;

export type URLJsonPointerResult = Result<
  { url: URL; docUri: string; jsonPointer: JsonPointer },
  JsonPointerError
>;

export type JsonPointerLoose = (string | number)[];

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

/**
 * Encode a JSON Pointer reference token per RFC 6901
 * ~ → ~0, / → ~1
 */
function encodeToken(token: string | number): string {
  if (typeof token === "number") {
    return String(token);
  }
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Put a JSON pointer to a URI.
 * Format: `uri#/path/to/node` (fragment is URL-encoded)
 */
export function uriWithJsonPointerLoose(
  uri: string,
  path: JsonPointerLoose
): string {
  if (path.length === 0) {
    return uri;
  }
  const pointer = "/" + path.map(encodeToken).join("/");
  const nextUri = new URL(uri);
  nextUri.hash = pointer;

  return nextUri.toString();
}

/**
 * Check if a nodeId belongs to a document URI.
 * - `file:///foo.yaml` belongs to `file:///foo.yaml` ✓
 * - `file:///foo.yaml#/User` belongs to `file:///foo.yaml` ✓
 * - `file:///foo.yaml#/User` does NOT belong to `file:///bar.yaml` ✗
 */
export function isNodeInDocument(nodeId: string, documentUri: string): boolean {
  return nodeId === documentUri || nodeId.startsWith(documentUri + "#");
}

export function parseUriWithJsonPointer(
  _uri: string,
  baseUri?: string
): URLJsonPointerResult {
  try {
    const url = new URL(_uri, baseUri);

    const jsonPointerComponent = url.hash;

    const jsonPointerResult = parseJsonPointer(jsonPointerComponent);

    if (!jsonPointerResult.success) {
      return jsonPointerResult;
    }

    return ok({
      url,
      get docUri() {
        const docUrl = new URL(url);
        docUrl.hash = "";

        return docUrl.toString();
      },
      jsonPointer: jsonPointerResult.data,
    });
  } catch {
    return {
      success: false,
      error: {
        type: "invalidUrl",
        message: "Invalid URL",
      },
    };
  }
}
