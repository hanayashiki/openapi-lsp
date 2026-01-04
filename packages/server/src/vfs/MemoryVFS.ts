import { ok, err, Result } from "@openapi-lsp/core/result";
import { VFS, VFSError, GlobOptions } from "./VFS.js";
import { matchPathWithGlob } from "./glob.js";

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

  async writeFile(path: string, content: string): Promise<Result<void, VFSError>> {
    this.files.set(path, content);
    return ok(undefined);
  }

  async glob(
    pattern: string | string[],
    options: GlobOptions
  ): Promise<string[]> {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    const results: string[] = [];

    for (const [filePath] of this.files) {
      if (matchPathWithGlob(filePath, patterns, options)) {
        results.push(filePath);
      }
    }
    return results;
  }
}
