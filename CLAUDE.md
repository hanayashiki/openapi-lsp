# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenAPI LSP is a VS Code Language Server Protocol implementation providing language support for OpenAPI/Swagger specifications. It supports hover (displays schemas as TypeScript types) and go-to-definition features, with full cross-file analysis for external `$ref` references.

**Supported OpenAPI files:** `*.openapi.yml`, `*.openapi.yaml`, `openapi.yml`, `openapi.yaml`

**Supported referenced files:** `*.json`, `*.yml`, `*.yaml` (any YAML/JSON referenced via `$ref`)

**Requirements:** OpenAPI >= 3.0.0, `file://` scheme only (no remote URLs)

## Commands

```bash
# Install dependencies
pnpm install (this is buggy in sandbox, please let user do it)

# Build all packages
npm run build

# Watch mode for development
npm run watch

# Run tests (core package only)
npm run test

# Lint
npm run lint
npm run lint:fix

# Bundle extension for distribution
npm run bundle

# Package VS Code extension (.vsix)
npm run package
```

## Development Workflow

1. Run `npm run watch` for continuous compilation
2. Press F5 in VS Code to launch the Extension Development Host
3. Debug configurations available in `.vscode/launch.json`:
   - "Launch Extension" - basic extension testing
   - "Attach to Language Server" - debug server on port 6009
   - "Extension + Server" - combined debugging

## Architecture

### Package Structure

```
packages/
├── core/           # @openapi-lsp/core - shared types and utilities
├── server/         # @openapi-lsp/server - LSP server implementation
└── client/         # openapilspclient - VS Code extension
```

### Core Package (@openapi-lsp/core)

- `src/openapi/types.ts` - Full OpenAPI 3.0.3 schema definitions using Typebox
- `src/openapi/input-codec.ts` - Fallback codecs for lenient parsing of invalid specs
- `src/queries/QueryCache.ts` - Dependency-aware cache with automatic invalidation
- `src/result/result.ts` - Rust-inspired Result/Option types for error handling
- `src/uri/` - URI and JSON Pointer utilities for parsing `$ref` values

### Server Package (@openapi-lsp/server)

**Core LSP:**
- `src/OpenAPILanguageServer.ts` - Main LSP server with handlers for hover, definition, document lifecycle

**Document Management:**
- `src/analysis/DocumentManager.ts` - Unified document loading with caching; handles both editor-open and disk files
- `src/analysis/YamlDocument.ts` - YAML AST wrapper with `collectRefs()` for extracting all `$ref` values
- `src/analysis/NodeVFS.ts` - Workspace-aware virtual file system with boundary enforcement

**Cross-File Analysis:**
- `src/analysis/AnalysisManager.ts` - Workspace-level analysis orchestrator; discovers all OpenAPI roots via glob, builds dependency graph, computes SCCs using Kosaraju's algorithm
- `src/analysis/Resolver.ts` - Resolves external `$ref` URIs (e.g., `./schemas.yaml#/Pet`) to target documents
- `src/analysis/DocumentReferenceManager.ts` - Resolves all refs in a document; provides `getDefinitionLinkAtPosition()` for cross-file go-to-definition

**Analysis Components:**
- `src/analysis/Visitor.ts` - Visitor pattern for traversing OpenAPI documents
- `src/analysis/serializeSchema.ts` - Converts schemas to markdown for hover display

### Client Package (openapilspclient)

- `src/extension.ts` - VS Code extension entry point, manages LSP client lifecycle

### Data Flow

```
Workspace Discovery (glob for *.openapi.yml)
                ↓
DocumentManager (loads & caches YAML documents)
                ↓
YamlDocument.collectRefs() → Resolver (resolves external URIs)
                ↓
AnalysisManager (builds dependency graph, computes SCCs)
                ↓
GroupAnalysis (analyzes files in dependency order)
                ↓
Language Features (hover, go-to-definition across files)
                ↓
VS Code Client ←→ LSP Server
```

## Key Patterns

- **Typebox schemas** with fallback codecs allow graceful handling of partially valid OpenAPI specs
- **TaggedObject** wraps each OpenAPI type to enable runtime type identification via `hasOpenAPITag(obj, tag)`. Tags are stored in a `Set`, allowing objects to accumulate multiple tags when used in different contexts (intersection types). Use `getOpenAPITags(obj)` to retrieve all tags.
- **QueryCache** tracks dependencies and automatically invalidates downstream results when sources change. **Important**: Inside a cache loader function, always use `loader.load(ctx, key)` instead of `loader.use(key)` or direct method calls (e.g., `manager.getX()`). Using `ctx.load` ensures dependencies are properly tracked for cache invalidation.
- **Result types** (`Ok`/`Err`) used throughout for type-safe error handling - use `andThen` for chaining
- **ESM modules** only - no CommonJS

### Cross-File Reference Resolution

External `$ref` values like `./schemas.yaml#/components/schemas/Pet` are parsed into URI + JSON Pointer using `parseUriWithJsonPointer()`. The `Resolver` loads the target document via `DocumentManager`, and `DocumentReferenceManager` tracks all resolved references for a document.

**Document states:** "openapi" (root spec), "component" (external referenced file), "tomb" (unreadable/missing)

**Circular references:** The `AnalysisManager` uses Kosaraju's algorithm to compute Strongly Connected Components (SCCs), enabling proper handling of mutually-referencing files.

### Visitor Pattern

The `Visitor` in `src/analysis/Visitor.ts` traverses paired OpenAPI objects and YAML AST nodes together. Each OpenAPI type has a corresponding visitor callback:

```typescript
visit({ document: openapi, yamlAst: spec.yamlAst }, {
  Schema: ({ openapiNode, ast }) => {
    // openapiNode: the decoded OpenAPI.Schema object
    // ast.path: e.g. ["components", "schemas", "Pet"]
    // ast.astNode: the YAMLMap node
    // ast.keyNode: the Scalar key (when accessed via map)
  },
  Response: ({ openapiNode, ast }) => { ... },
  // ... other types
});
```

Use `ast.path` to determine context (e.g., `isComponentPath()` checks if under `components/`).
