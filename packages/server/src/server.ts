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

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const server = new OpenAPILanguageServer();

connection.onInitialize((_params: InitializeParams): InitializeResult => {
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
  console.log("OpenAPI Language Server initialized");
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

documents.listen(connection);
connection.listen();
