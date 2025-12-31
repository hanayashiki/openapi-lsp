import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ok, err, Result } from "@openapi-lsp/core/result";
import { VFS, VFSError, GlobEntry, GlobOptions } from "./VFS.js";

export class NodeVFS implements VFS {
  async readFile(filePath: string): Promise<Result<string, VFSError>> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return ok(content);
    } catch (error) {
      return err(this.mapError(filePath, error));
    }
  }

  async glob(
    pattern: string | string[],
    options: GlobOptions
  ): Promise<GlobEntry[]> {
    const results: GlobEntry[] = [];

    for await (const entry of fs.glob(pattern, {
      cwd: options.cwd,
      exclude: options.exclude,
    })) {
      const fullPath = path.resolve(options.cwd, entry);

      // Skip if any ancestor directory is a symlink (don't follow directory symlinks)
      if (await this.hasSymlinkAncestor(fullPath, options.cwd)) {
        continue;
      }

      const result = await this.readFile(fullPath);
      if (result.success) {
        results.push({ path: fullPath, content: result.data });
      }
    }
    return results;
  }

  private async hasSymlinkAncestor(
    filePath: string,
    cwd: string
  ): Promise<boolean> {
    let current = path.dirname(filePath);
    const normalizedCwd = path.resolve(cwd);

    while (current !== normalizedCwd && current !== path.dirname(current)) {
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink()) {
          return true;
        }
      } catch {
        return true;
      }
      current = path.dirname(current);
    }
    return false;
  }

  private mapError(filePath: string, error: unknown): VFSError {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { type: "notFound", path: filePath };
      }
      if (code === "EACCES" || code === "EPERM") {
        return { type: "permissionDenied", path: filePath };
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    return { type: "unknown", path: filePath, message };
  }
}
