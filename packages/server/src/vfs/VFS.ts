import { Result } from "@openapi-lsp/core/result";

export type VFSError =
  | { type: "notFound"; path: string }
  | { type: "permissionDenied"; path: string }
  | { type: "unknown"; path: string; message: string };

export type ReadFileResult = Result<string, VFSError>;

export type GlobEntry = { path: string; content: string };

export interface GlobOptions {
  cwd: string;
  exclude?: string[];
}

export interface VFS {
  readFile(path: string): Promise<ReadFileResult>;
  glob(pattern: string | string[], options: GlobOptions): Promise<GlobEntry[]>;
}
