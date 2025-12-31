import { Result } from "@openapi-lsp/core/result";

export type VFSError =
  | { type: "notFound"; path: string }
  | { type: "permissionDenied"; path: string }
  | { type: "unknown"; path: string; message: string };

export type ReadFileResult = Result<string, VFSError>;

export interface VFS {
  readFile(path: string): Promise<ReadFileResult>;
}
