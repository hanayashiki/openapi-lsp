import { TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { stringify } from "yaml";
import { OpenAPILanguageServer } from "../../src/OpenAPILanaguageServer.js";
import { MemoryVFS } from "../../src/vfs/MemoryVFS.js";
import { Workspace } from "../../src/workspace/Workspace.js";
import { ExtensionConfiguration } from "@openapi-lsp/core/configuration";

function createMockTextDocuments(): TextDocuments<TextDocument> {
  return {
    get: () => undefined,
    all: () => [],
    keys: () => [],
    listen: () => ({ dispose: () => {} }),
    onDidOpen: () => ({ dispose: () => {} }),
    onDidChangeContent: () => ({ dispose: () => {} }),
    onDidClose: () => ({ dispose: () => {} }),
    onDidSave: () => ({ dispose: () => {} }),
    onWillSave: () => ({ dispose: () => {} }),
    onWillSaveWaitUntil: () => ({ dispose: () => {} }),
  } as unknown as TextDocuments<TextDocument>;
}

/**
 * Create a test server with files specified as JSON objects.
 * Objects are automatically serialized to YAML.
 */
export function createTestServer(
  files: Record<string, object>,
  workspaceUri = "file:///workspace"
): OpenAPILanguageServer {
  // Serialize all file contents to YAML
  const yamlFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    yamlFiles[path] = stringify(content);
  }

  const vfs = new MemoryVFS(yamlFiles);
  const workspace: Workspace = {
    configuration: ExtensionConfiguration.parse({}),
    workspaceFolders: [{ uri: workspaceUri, name: "test-workspace" }],
  };
  return new OpenAPILanguageServer(workspace, createMockTextDocuments(), vfs);
}
