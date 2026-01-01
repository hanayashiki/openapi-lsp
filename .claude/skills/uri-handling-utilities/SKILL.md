---
name: uri-handling-utilities
description: Use core utilities from @openapi-lsp/core for URI/URL and JSON Pointer handling. Apply when working with refs, URIs, JSON Pointers, URL fragments, or document references.
---

# URI and JSON Pointer Handling

Use the RFC 6901-compliant utilities from `@openapi-lsp/core` for all URI/URL and JSON Pointer operations.

## Import

```typescript
import {
  parseJsonPointer,
  parseUriWithJsonPointer,
  isLocalPointer,
  uriWithJsonPointerLoose,
  isNodeInDocument,
} from "@openapi-lsp/core/json-pointer";
```

## Utilities

### `parseJsonPointer(pointer: string)`
Parse JSON Pointer strings per RFC 6901. Handles raw (`"/foo/bar"`) and URI fragments (`"#/foo/bar"`).

### `parseUriWithJsonPointer(uri: string, baseUri?: string)`
Parse full URI references, separating URL and fragment into `{ url, docUri, jsonPointer }`.

### `isLocalPointer(ref: string)`
Check if a `$ref` is local (starts with `#`).

### `uriWithJsonPointerLoose(uri: string, path: JsonPointerLoose)`
Build URI references with properly encoded JSON Pointer fragments.

### `isNodeInDocument(nodeId: string, documentUri: string)`
Check if a nodeId belongs to a document:
```typescript
isNodeInDocument("file:///foo.yaml", "file:///foo.yaml");       // true (root)
isNodeInDocument("file:///foo.yaml#/User", "file:///foo.yaml"); // true (fragment)
isNodeInDocument("file:///bar.yaml#/User", "file:///foo.yaml"); // false
```

## Key Rules

1. **Always use these utilities** - Never manually parse URI/JSON Pointer strings
2. **Check Result types** - Use `result.success` before accessing `result.data`
3. **Provide baseUri for relative refs** - `parseUriWithJsonPointer(ref, baseUri)`
4. **Use `isNodeInDocument` for membership checks** - Don't use `startsWith(uri + "#")`
