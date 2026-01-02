import {
  ModuleResolutionInput,
  ModuleResolutionResult,
} from "./ModuleResolution.js";
import { ServerDocumentManager } from "./DocumentManager.js";
import { err, ok } from "@openapi-lsp/core/result";
import {
  CacheComputeContext,
  CacheLoader,
  LoaderResult,
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
      async ([_, input], ctx): Promise<LoaderResult<ModuleResolutionResult>> => {
        // Use parseUriWithJsonPointer for resolution - handles ../ correctly
        const parseResult = parseUriWithJsonPointer(input.ref, input.baseUri);
        if (!parseResult.success) {
          return { value: err({ type: "invalidUri" }), hash: "" };
        }

        const resolvedUrl = parseResult.data.url;

        if (resolvedUrl.protocol !== "file:") {
          return {
            value: err({
              type: "unsupportedUriScheme",
              scheme: resolvedUrl.protocol.replace(/:$/, ""),
            }),
            hash: "",
          };
        }

        // Use docUri which has fragment stripped
        const resolvedUri = parseResult.data.docUri;

        // Use documentManager.load for proper dependency tracking
        const doc = await this.documentManager.load(ctx, resolvedUri);
        // Hash based on the resolved document's hash (if it has one)
        const hash =
          doc.type === "openapi" || doc.type === "component"
            ? doc.yaml.getHash()
            : "";
        return { value: ok(doc), hash };
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