import {
  ModuleResolutionInput,
  ModuleResolutionResult,
} from "./ModuleResolution.js";
import { ServerDocumentManager } from "./DocumentManager.js";
import { fastUri } from "fast-uri";
import { err, ok } from "@openapi-lsp/core/result";

export class Resolver {
  constructor(private documentManager: ServerDocumentManager) {}

  async resolve(input: ModuleResolutionInput): Promise<ModuleResolutionResult> {
    const refComponent = fastUri.parse(input.ref);
    if (refComponent.error) {
      return err({
        type: "invalidUri",
      });
    }
    const baseComponent = fastUri.parse(input.baseUri);
    if (baseComponent.error) {
      throw new Error(
        `Unexpected error when parsing baseUri: ${input.baseUri}`
      );
    }
    const resolvedUriComponent = fastUri.resolveComponent(
      baseComponent,
      refComponent
    );

    if (resolvedUriComponent.scheme !== "file") {
      return err({
        type: "unsupportedUriScheme",
        scheme: resolvedUriComponent.scheme!,
      });
    }

    const resolvedUri = fastUri.serialize(resolvedUriComponent);

    // Currently, the file-resolve method used by stoplight is merely resolving relatively to the importer.
    // We keep this simple method to stay with the ecosystem.
    return ok(await this.documentManager.getServerDocument(resolvedUri));
  }
}
