import * as fs from "node:fs/promises";
import { ok, err, Result } from "@openapi-lsp/core/result";
import { VFS, VFSError } from "./VFS.js";

export class NodeVFS implements VFS {
  async readFile(path: string): Promise<Result<string, VFSError>> {
    try {
      const content = await fs.readFile(path, "utf-8");
      return ok(content);
    } catch (error) {
      return err(this.mapError(path, error));
    }
  }

  private mapError(path: string, error: unknown): VFSError {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { type: "notFound", path };
      }
      if (code === "EACCES" || code === "EPERM") {
        return { type: "permissionDenied", path };
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    return { type: "unknown", path, message };
  }
}
