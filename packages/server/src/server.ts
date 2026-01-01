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

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const workspace = {
    workspaceFolders:
      params.workspaceFolders ?? /** Fallback using deprecated rootUri, then use current working path */ [
        {
          name: "Root",
          uri:
            params.rootUri ??
            pathToFileURL(params.rootPath ?? process.cwd()).toString(),
        },
      ],
  };

  const server = new OpenAPILanguageServer(
    workspace,
    documents,
    new NodeVFS(workspace)
  );

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

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // completionProvider: {
      //   resolveProvider: true,
      //   triggerCharacters: ["/", ":", '"', "'"],
      // },
      hoverProvider: true,
      definitionProvider: true,
    },
  };
});

connection.onInitialized(() => {
  console.info(
    `OpenAPI Language Server initialized${
      typeof process?.versions.node !== "undefined"
        ? ` on node: ${process.versions.node}. `
        : typeof navigator !== "undefined"
        ? ` on ${navigator.userAgent}. `
        : ". "
    }`
  );
});

documents.listen(connection);
connection.listen();
