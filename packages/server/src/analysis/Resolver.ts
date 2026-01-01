import {
  ModuleResolutionInput,
  ModuleResolutionResult,
} from "./ModuleResolution.js";
import { ServerDocumentManager } from "./DocumentManager.js";
import { err, ok } from "@openapi-lsp/core/result";
import {
  CacheComputeContext,
  CacheLoader,
  QueryCache,
} from "@openapi-lsp/core/queries";
import { parseUriWithJsonPointer } from "@openapi-lsp/core/json-pointer";

export class Resolver {
  loader: CacheLoader<["resolver", ModuleResolutionInput], ModuleResolutionResult>;

  constructor(
    private documentManager: ServerDocumentManager,
    cache: QueryCache
  ) {
    this.loader = cache.createLoader(
      async ([_, input], ctx): Promise<ModuleResolutionResult> => {
        // Use parseUriWithJsonPointer for resolution - handles ../ correctly
        const parseResult = parseUriWithJsonPointer(input.ref, input.baseUri);
        if (!parseResult.success) {
          return err({ type: "invalidUri" });
        }

        const resolvedUrl = parseResult.data.url;

        if (resolvedUrl.protocol !== "file:") {
          return err({
            type: "unsupportedUriScheme",
            scheme: resolvedUrl.protocol.replace(/:$/, ""),
          });
        }

        // Use docUri which has fragment stripped
        const resolvedUri = parseResult.data.docUri;

        // Use documentManager.load for proper dependency tracking
        return ok(await this.documentManager.load(ctx, resolvedUri));
      }
    );
  }

  async resolve(input: ModuleResolutionInput): Promise<ModuleResolutionResult> {
    return await this.loader.use(["resolver", input]);
  }

  load = (
    ctx: CacheComputeContext,
    input: ModuleResolutionInput
  ): Promise<ModuleResolutionResult> => {
    return this.loader.load(ctx, ["resolver", input]);
  };
}