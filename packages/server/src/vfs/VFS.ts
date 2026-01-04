import { Result } from "@openapi-lsp/core/result";

export type VFSError =
  | { type: "notFound"; path: string }
  | { type: "singleFile"; path: string; message: string }
  | { type: "permissionDenied"; path: string }
  | { type: "outsideWorkspace"; path: string }
  | { type: "unknown"; path: string; message: string };

export type ReadFileResult = Result<string, VFSError>;
export type WriteFileResult = Result<void, VFSError>;

export interface GlobOptions {
  cwd: string;
  exclude?: string[];
}

export interface VFS {
  readFile(path: string): Promise<ReadFileResult>;
  writeFile(path: string, content: string): Promise<WriteFileResult>;
  glob(pattern: string | string[], options: GlobOptions): Promise<string[]>;
}
