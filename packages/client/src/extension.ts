import * as path from "node:path";
import {
  type ExtensionContext,
  workspace,
  window,
} from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node.js";

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath(
    path.join("..", "server", "out", "server.js")
  );

  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "openapi" },
      { scheme: "file", pattern: "**/*.openapi.yml" },
      { scheme: "file", pattern: "**/openapi.yml" },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        "**/{*.openapi.yml,openapi.yml}"
      ),
    },
  };

  client = new LanguageClient(
    "openapi-lsp",
    "OpenAPI Language Server",
    serverOptions,
    clientOptions
  );

  try {
    await client.start();
    window.showInformationMessage("OpenAPI Language Server started");
  } catch (error) {
    window.showErrorMessage(`Failed to start OpenAPI Language Server: ${error}`);
  }

  context.subscriptions.push({
    dispose: () => {
      client?.stop();
    },
  });
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
