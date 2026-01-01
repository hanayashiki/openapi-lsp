import { WorkspaceFolder } from "vscode-languageserver";
import { ExtensionConfiguration } from "@openapi-lsp/core/configuration";

/**
 * Basic workspace info from LSP Client
 */
export interface Workspace {
  configuration: ExtensionConfiguration;
  workspaceFolders: WorkspaceFolder[];
}
