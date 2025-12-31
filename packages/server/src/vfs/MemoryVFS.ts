import { ok, err, Result } from "@openapi-lsp/core/result";
import { VFS, VFSError } from "./VFS.js";

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
}
