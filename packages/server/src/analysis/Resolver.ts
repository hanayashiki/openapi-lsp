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

export class Resolver {
  loader: CacheLoader<["resolver", ModuleResolutionInput], ModuleResolutionResult>;

  constructor(
    private documentManager: ServerDocumentManager,
    cache: QueryCache
  ) {
    this.loader = cache.createLoader(
      async ([_, input], ctx): Promise<ModuleResolutionResult> => {
        let resolvedUrl: URL;
        try {
          // Use native URL for resolution - handles ../ correctly
          resolvedUrl = new URL(input.ref, input.baseUri);
        } catch {
          return err({ type: "invalidUri" });
        }

        // Strip fragment for file resolution
        resolvedUrl.hash = "";

        if (resolvedUrl.protocol !== "file:") {
          return err({
            type: "unsupportedUriScheme",
            scheme: resolvedUrl.protocol.replace(/:$/, ""),
          });
        }

        const resolvedUri = resolvedUrl.href;

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