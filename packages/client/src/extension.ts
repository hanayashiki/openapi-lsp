import * as path from "node:path";
import { type ExtensionContext, workspace, window, commands } from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node.js";
import {
  openapiFilePatterns,
  componentFilePatterns,
} from "@openapi-lsp/core/constants";
import { ExtensionConfiguration } from "@openapi-lsp/core/configuration";
import type { z } from "zod";

let client: LanguageClient | undefined;

function readConfiguration():
  | { success: true; data: z.infer<typeof ExtensionConfiguration> }
  | { success: false; error: string } {
  const rawConfig = workspace.getConfiguration();
  const configKeys = Object.keys(ExtensionConfiguration.shape);
  const configObject = Object.fromEntries(
    configKeys.map((key) => [key, rawConfig.get(key)])
  );

  const parseResult = ExtensionConfiguration.safeParse(configObject);

  if (!parseResult.success) {
    const errorMessage = parseResult.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path}: "${issue.message}"`)
      .join("; ");
    return { success: false, error: errorMessage };
  }

  return { success: true, data: parseResult.data };
}

async function showConfigErrorAndRetry(): Promise<
  z.infer<typeof ExtensionConfiguration> | undefined
> {
  let hasRetried = false;

  while (true) {
    const configResult = readConfiguration();

    if (configResult.success) {
      if (hasRetried) {
        window.showInformationMessage("OpenAPI LSP configuration validated");
      }
      return configResult.data;
    }

    hasRetried = true;
    const userSelection = await window.showErrorMessage(
      `OpenAPI LSP configuration error: ${configResult.error}`,
      "Retry",
      "Cancel"
    );

    if (userSelection !== "Retry") {
      return undefined;
    }
  }
}

export async function activate(context: ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

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

  const allPatterns = [...openapiFilePatterns, ...componentFilePatterns];
  const documentSelector = [
    { scheme: "file", language: "openapi" },
    ...allPatterns.map((pattern) => ({
      scheme: "file",
      pattern: `**/${pattern}`,
    })),
  ];
  const fileWatcherPattern = `**/{${allPatterns.join(",")}}`;

  // Read and parse configuration, retry on error
  const config = await showConfigErrorAndRetry();
  if (!config) {
    return;
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(fileWatcherPattern),
    },
    initializationOptions: config,
  };

  client = new LanguageClient(
    "openapi-lsp",
    "OpenAPI Language Server",
    serverOptions,
    clientOptions
  );

  try {
    await client.start();
  } catch (error) {
    window.showErrorMessage(
      `Failed to start OpenAPI Language Server: ${error}`
    );
  }

  context.subscriptions.push({
    dispose: () => {
      client?.stop();
    },
  });

  context.subscriptions.push(
    commands.registerCommand("openapi-lsp.restart", async () => {
      if (client) {
        await client.restart();
        window.showInformationMessage("OpenAPI Language Server restarted");
      }
    })
  );
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
