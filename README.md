# OpenAPI LSP

Intelligent language support for OpenAPI/Swagger specifications in VS Code, designed for a great dev experience through deep understanding of your openapi.yml.

## Features

- **Type Inference** — Automatically infers and displays types from your OpenAPI schemas, including referenced files.
- **Hover Information** — View schemas rendered as human-readable types
- **Go to Definition** — Jump to component definitions across files
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

- Find All References
- Diagnostics
- Autocomplete
- Remote `$ref` support

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## License

[MIT](./LICENSE.txt)
