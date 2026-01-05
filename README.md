# OpenAPI LSP

Intelligent language support for OpenAPI/Swagger specifications in VS Code, designed for a great dev experience through deep understanding of your openapi.yml.

## Features

- **Type Inference** — Automatically infers and displays types from your OpenAPI schemas, including referenced files.
- **Hover Information** — View schemas rendered as human-readable types
- **Go to Definition** — Jump to component definitions across files
- **Find All References** — Discover all usages of schemas and components across your workspace
- **Cross-File Analysis** — Full support for external `$ref` references
- **Secure by Default** — Workspace-restricted file access prevents data leaks

### Hover Information

#### Inspect OpenAPI Documents

Hover over schemas to see them rendered as TypeScript types.

<details>
<summary>Screenshot</summary>

![Hover OpenAPI schema](/docs/hover-openapi.png)
</details>

#### Inspect Referenced Files

Hover over `$ref` targets to see how they're used in context.

<details>
<summary>Screenshot</summary>

![Referenced file hover](/docs/ref-hover.png)
</details>

### Go to Definition

Jump directly to component definitions or peek them inline.

<details>
<summary>Screenshot</summary>

![Go to definition](/docs/def.png)
</details>

### Find All References

Find all places where a schema or component is referenced across your workspace.

Use `Shift+F12` or right-click and select "Find All References" on any definition or `$ref`.

<details>
<summary>Screenshot</summary>

![Find All References](/docs/references.png)
</details>

## Installation

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=hanayashiki.openapilspclient) or via command line:

```bash
code --install-extension hanayashiki.openapilspclient
```

## Supported Files

| Pattern                           | Description               |
| --------------------------------- | ------------------------- |
| `*.openapi.yml`, `*.openapi.yaml` | Files with OpenAPI suffix |
| `openapi.yml`, `openapi.yaml`     | Root OpenAPI files        |

**Referenced files** (`$ref` targets): `*.json`, `*.yml`, `*.yaml`

## Workspace Mode vs Single File Mode

OpenAPI LSP operates in two modes depending on how you open files in VS Code:

### Workspace Mode

When you open a **folder** or **workspace** in VS Code (`File > Open Folder`), the extension has full capabilities:

- **Automatic Discovery** — Scans your workspace for OpenAPI files matching the configured patterns
- **Cross-File References** — Resolves `$ref` to any file within the workspace
- **File System Access** — Can read referenced files from disk, even if not currently open

This is the recommended mode for working with OpenAPI specifications that span multiple files.

### Single File Mode

When you open an **individual file** without a workspace (`File > Open File`), the extension runs in a restricted mode:

- **Open Documents Only** — Only analyzes files that are currently open in the editor
- **No Disk Access** — Cannot read files from disk; all referenced files must be opened manually
- **Limited Discovery** — Only discovers OpenAPI roots from open documents

To get full cross-file support in single file mode, manually open all referenced files in VS Code.

> **Tip:** If you're working with a multi-file OpenAPI specification, open the containing folder as a workspace for the best experience.

## Requirements

- OpenAPI 3.0.0 or later

## Settings

| Setting                             | Default                                     | Description                                 |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `openapi-lsp.discoverRoots.pattern` | `**/*`                                      | Glob pattern for OpenAPI document discovery |
| `openapi-lsp.discoverRoots.ignore`  | `{**/node_modules/**,**/.git/**,**/.hg/**}` | Glob pattern to exclude from discovery      |
| `openapi-lsp.debug.cache`           | `false`                                     | Enable debug logging for cache operations   |

**Command:** `OpenAPI: Restart Language Server` — Restart the language server

## Roadmap

- Diagnostics
- Autocomplete
- Remote `$ref` support

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## License

[MIT](./LICENSE.txt)
