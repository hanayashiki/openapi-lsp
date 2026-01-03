---
name: release
description: Release a new version of the VS Code extension to the marketplace. Runs checks, compares changes, updates changelog/version, commits, and publishes.
user_invocable: true
---

# Release Command

This skill handles the full release workflow for the OpenAPI LSP VS Code extension.

## Workflow Steps

### 1. Run Pre-commit Checks
First, run all pre-commit hooks to ensure code quality:
```bash
npm run lint
npm run test
npm run build
```

If any checks fail, stop and report the errors.

### 2. Get Changes Since Last Release
Find the last git tag and show commits since then:
```bash
# Get the latest tag
git describe --tags --abbrev=0

# Show commits since last tag
git log <last-tag>..HEAD --oneline
```

### 3. Ask User for Changelog and Version
Present the changes to the user and ask:
- Confirm the changelog entries to add
- Choose version bump type: patch (0.0.x), minor (0.x.0), or major (x.0.0)

### 4. Update Files
Update these files in `packages/client/`:

**CHANGELOG.md** - Add new version section at the top:
```markdown
# <new-version>

1. <changelog entry 1>
2. <changelog entry 2>
...

# <previous-version>
...
```

**package.json** - Update the `version` field to the new version.

### 5. Commit Changes
```bash
git add packages/client/CHANGELOG.md packages/client/package.json
git commit -m "chore: release v<new-version>"
git tag v<new-version>
```

### 6. Publish to VS Code Marketplace
```bash
cd packages/client
pnpm publish
```

This runs `vsce publish --no-dependencies` which publishes to the VS Code marketplace.

### 7. Push to Remote
```bash
git push origin HEAD
git push origin v<new-version>
```

## Important Notes

- The extension is published under the name `openapilspclient` by publisher `hanayashiki`
- Current version can be found in `packages/client/package.json`
- Changelog format uses numbered lists under version headers
- Always create a git tag matching the version (e.g., `v0.1.3`)
