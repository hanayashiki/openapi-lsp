# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenAPI LSP is a VS Code Language Server Protocol implementation providing language support for OpenAPI/Swagger specifications. It currently supports hover (displays schemas as TypeScript types) and go-to-definition features. Only OpenAPI >= 3.0.0 with local `$ref` references is supported.

**Supported files:** `*.openapi.yml`, `openapi.yml`

## Commands

```bash
# Install dependencies
pnpm install

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

### Server Package (@openapi-lsp/server)

- `src/OpenAPILanaguageServer.ts` - Main LSP server with handlers for hover, definition, document lifecycle
- `src/analysis/analyze.ts` - Validates YAML against OpenAPI schema
- `src/analysis/SpecDocument.ts` - YAML AST wrapper with line counting
- `src/analysis/getDefinitions.ts` - Extracts component definitions with source ranges
- `src/analysis/getRefByPosition.ts` - Finds `$ref` at cursor position
- `src/analysis/resolveRef.ts` - Resolves references to definitions
- `src/analysis/serializeSchema.ts` - Converts schemas to markdown for hover display

### Client Package (openapilspclient)

- `src/extension.ts` - VS Code extension entry point, manages LSP client lifecycle

### Data Flow

```
YAML String → yaml parser → AST + LineCounter → Typebox validation → Analysis
                                                                        ↓
VS Code Client ←→ LSP Server ←→ QueryCache ←→ Language Features (hover, definition)
```

## Key Patterns

- **Typebox schemas** with fallback codecs allow graceful handling of partially valid OpenAPI specs
- **QueryCache** tracks dependencies and automatically invalidates downstream results when sources change
- **Result types** (`Ok`/`Err`) used throughout for type-safe error handling - use `andThen` for chaining
- **ESM modules** only - no CommonJS
