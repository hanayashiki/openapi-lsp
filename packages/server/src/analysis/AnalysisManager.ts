import {
  CacheComputeContext,
  CacheLoader,
  QueryCache,
} from "@openapi-lsp/core/queries";
import { ServerDocumentManager } from "./DocumentManager.js";
import { Analysis } from "./Analysis.js";
import { analyzeSpecDocument } from "./analyze.js";

export class AnalysisManager {
  loader: CacheLoader<["specDocument.analyze", string], Analysis>;

  constructor(
    private documentManager: ServerDocumentManager,
    cache: QueryCache
  ) {
    this.loader = cache.createLoader(
      async ([_, uri], ctx): Promise<Analysis> => {
        const spec = await this.documentManager.load(ctx, uri);

        if (spec.type !== "openapi") {
          throw new Error(`Cannot analyze non-openapi document: ${spec.type}`);
        }

        return analyzeSpecDocument(spec);
      }
    );
  }

  getAnalysis = async (uri: string): Promise<Analysis> => {
    return await this.loader.use(["specDocument.analyze", uri]);
  };

  load = (ctx: CacheComputeContext, uri: string): Promise<Analysis> => {
    return this.loader.load(ctx, ["specDocument.analyze", uri]);
  };
}
