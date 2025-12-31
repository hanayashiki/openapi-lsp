import { WorkspaceFolder } from "vscode-languageserver";

/**
 * Basic workspace info from LSP Client
 */
export interface Workspace {
  workspaceFolders: WorkspaceFolder[];
}
