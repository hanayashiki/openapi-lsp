import { Result } from "@openapi-lsp/core/result";

export type VFSError =
  | { type: "notFound"; path: string }
  | { type: "permissionDenied"; path: string }
  | { type: "outsideWorkspace"; path: string }
  | { type: "unknown"; path: string; message: string };

export type ReadFileResult = Result<string, VFSError>;
export type WriteFileResult = Result<void, VFSError>;

export type GlobEntry = { path: string; content: string };

export interface GlobOptions {
  cwd: string;
  exclude?: string[];
}

export interface VFS {
  readFile(path: string): Promise<ReadFileResult>;
  writeFile(path: string, content: string): Promise<WriteFileResult>;
  glob(pattern: string | string[], options: GlobOptions): Promise<GlobEntry[]>;
}
