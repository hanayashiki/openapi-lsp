import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ok, err, Result } from "@openapi-lsp/core/result";
import { VFS, VFSError, GlobOptions } from "./VFS.js";
import { Workspace } from "../workspace/Workspace.js";

export class NodeVFS implements VFS {
  private workspacePaths: string[];

  constructor(workspace: Workspace) {
    this.workspacePaths = workspace.workspaceFolders.map((folder) =>
      fileURLToPath(folder.uri)
    );
  }

  private isInsideWorkspace(filePath: string): boolean {
    const normalizedPath = path.resolve(filePath);
    return this.workspacePaths.some((wsPath) =>
      normalizedPath.startsWith(path.resolve(wsPath) + path.sep)
    );
  }

  async readFile(filePath: string): Promise<Result<string, VFSError>> {
    if (this.workspacePaths.length === 0) {
      return err({
        type: "singleFile",
        path: filePath,
        message: "In Single File mode, reading unopened file is forbidden",
      });
    }

    if (!this.isInsideWorkspace(filePath)) {
      return err({ type: "outsideWorkspace", path: filePath });
    }

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return ok(content);
    } catch (error) {
      return err(this.mapError(filePath, error));
    }
  }

  async writeFile(
    filePath: string,
    content: string
  ): Promise<Result<void, VFSError>> {
    if (!this.isInsideWorkspace(filePath)) {
      return err({ type: "outsideWorkspace", path: filePath });
    }

    try {
      await fs.writeFile(filePath, content, "utf-8");
      return ok(undefined);
    } catch (error) {
      return err(this.mapError(filePath, error));
    }
  }

  async glob(
    pattern: string | string[],
    options: GlobOptions
  ): Promise<string[]> {
    const results: string[] = [];

    for await (const entry of fs.glob(pattern, {
      cwd: options.cwd,
      exclude: options.exclude,
    })) {
      const fullPath = path.resolve(options.cwd, entry);

      // Skip if any ancestor directory is a symlink (don't follow directory symlinks)
      if (await this.hasSymlinkAncestor(fullPath, options.cwd)) {
        continue;
      }

      // Skip files outside workspace
      if (!this.isInsideWorkspace(fullPath)) {
        continue;
      }

      results.push(fullPath);
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
