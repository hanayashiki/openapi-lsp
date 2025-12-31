import picomatch from "picomatch";
import { ok, err, Result } from "@openapi-lsp/core/result";
import { VFS, VFSError, GlobEntry, GlobOptions } from "./VFS.js";

export class MemoryVFS implements VFS {
  private files: Map<string, string>;

  constructor(files: Record<string, string> | Map<string, string>) {
    this.files = files instanceof Map ? files : new Map(Object.entries(files));
  }

  async readFile(path: string): Promise<Result<string, VFSError>> {
    const content = this.files.get(path);
    if (content === undefined) {
      return err({ type: "notFound", path });
    }
    return ok(content);
  }

  async glob(
    pattern: string | string[],
    options: GlobOptions
  ): Promise<GlobEntry[]> {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    const isMatch = picomatch(patterns);
    const isExcluded = options.exclude
      ? picomatch(options.exclude)
      : () => false;

    const results: GlobEntry[] = [];
    const cwd = options.cwd.endsWith("/") ? options.cwd : options.cwd + "/";

    for (const [filePath, content] of this.files) {
      if (!filePath.startsWith(cwd)) continue;

      const relativePath = filePath.slice(cwd.length);
      if (isMatch(relativePath) && !isExcluded(relativePath)) {
        results.push({ path: filePath, content });
      }
    }
    return results;
  }
}
