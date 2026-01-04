import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { OpenAPILanguageServer } from "./OpenAPILanaguageServer.js";
import { NodeVFS } from "./vfs/NodeVFS.js";
import { pathToFileURL } from "url";
import { ExtensionConfiguration } from "@openapi-lsp/core/configuration";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const workspace = {
    /**
     * Limitation:
     * We cannot respect per-workspace-folder configuration unless:
     * 1. Run a lsp for each workspace-folder.
     * 2. Handle configurations (that we can) on resource-bases.
     */
    configuration: ExtensionConfiguration.parse(params.initializationOptions),
    workspaceFolders: params.workspaceFolders
      ? params.workspaceFolders
      : /** Fallback using deprecated rootUri, then use current working path */
      typeof params.rootUri === "string"
      ? [
          {
            name: "Root",
            uri: params.rootUri,
          },
        ]
      : typeof params.rootPath === "string"
      ? [
          {
            name: "Root",
            uri: pathToFileURL(params.rootPath).toString(),
          },
        ]
      : [],
  };

  const server = new OpenAPILanguageServer(
    workspace,
    documents,
    new NodeVFS(workspace)
  );

  server.setup().then(() => {
    console.info(
      `OpenAPI Language Server initialized${
        typeof process?.versions.node !== "undefined"
          ? ` on node: ${process.versions.node} `
          : typeof navigator !== "undefined"
          ? ` on ${navigator.userAgent} `
          : " "
      }with configuration: \n`,
      JSON.stringify(workspace, null, 2)
    );
  });

  connection.onDefinition(async (params) => {
    return server.onDefinition(params);
  });

  connection.onHover(async (params) => {
    return server.onHover(params);
  });

  documents.onDidOpen((change) => {
    server.onDidOpen(change);
  });

  documents.onDidChangeContent((change) => {
    server.onDidChangeContent(change);
  });

  documents.onDidClose((change) => {
    server.onDidClose(change);
  });

  connection.onDidChangeWatchedFiles((params) => {
    server.onDidChangeWatchedFiles(params);
  });

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      definitionProvider: true,
    },
  };
});

documents.listen(connection);
connection.listen();
