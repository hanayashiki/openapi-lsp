import { CacheComputeContext, QueryCache } from "@openapi-lsp/core/queries";
import { Resolver } from "./Resolver.js";
import { ServerDocumentManager } from "./DocumentManager.js";
import { DocumentRef, DocumentReferences } from "./DocumentReference.js";
import { isPositionInRange } from "./utils.js";
import { isLocalPointer } from "@openapi-lsp/core/json-pointer";
import { fastUri } from "fast-uri";
import { Position } from "vscode-languageserver-textdocument";
import { DefinitionLink } from "vscode-languageserver";

export class DocumentReferenceManager {
  constructor(
    private documentManager: ServerDocumentManager,
    private resolver: Resolver,
    private cache: QueryCache
  ) {}

  private setCache = (uri: string) => {
    this.cache.set(["serverDocument.documentReferences", uri], {
      computeFn: async (ctx): Promise<DocumentReferences> => {
        const document = await ServerDocumentManager.load(ctx, uri);

        if (document.type === "openapi" || document.type === "component") {
          const yamlRefs = document.yaml.collectRefs();

          return {
            uri,
            references: await Promise.all(
              yamlRefs.map(
                async ({
                  ref,
                  keyRange,
                  pointerRange,
                }): Promise<DocumentRef> => {
                  const resolved = await this.resolver.resolve({
                    baseUri: uri,
                    ref,
                  });

                  return {
                    ref,
                    resolved,
                    keyRange,
                    pointerRange,
                  };
                }
              )
            ),
          };
        } else {
          return {
            uri,
            references: [],
          };
        }
      },
    });
  };

  getDocumentReferences = async (uri: string): Promise<DocumentReferences> => {
    this.setCache(uri);

    return (await this.cache.compute([
      "serverDocument.documentReferences",
      uri,
    ])) as DocumentReferences;
  };

  getDefinitionLinkAtPosition = async (
    uri: string,
    position: Position
  ): Promise<DefinitionLink | null> => {
    const docRefs = await this.getDocumentReferences(uri);

    // Find ref at cursor position
    const docRef = docRefs.references.find((r) =>
      isPositionInRange(position, r.pointerRange)
    );
    if (!docRef) return null;

    // Handle local refs (#/...)
    if (isLocalPointer(docRef.ref)) {
      const sourceDoc = await this.documentManager.getServerDocument(uri);
      if (sourceDoc.type !== "openapi" && sourceDoc.type !== "component")
        return null;
      return sourceDoc.yaml.getDefinitionLinkByRef(docRef.ref, uri);
    }

    // Handle external refs
    if (!docRef.resolved.success) return null;

    const targetDoc = docRef.resolved.data;
    if (targetDoc.type === "tomb") return null;

    // TODO: reorganize this
    // Parse ref with fast-uri to extract fragment properly
    const refComponent = fastUri.parse(docRef.ref);
    const fragment = refComponent.fragment;

    // Create a URI with only the fragment part (empty fragment becomes "#" -> root)
    const fragmentUri = fastUri.serialize({ fragment: fragment ?? "" });
    // Jump to JSON pointer location in target file (empty fragment = root = position 0)
    return targetDoc.yaml.getDefinitionLinkByRef(fragmentUri, targetDoc.uri);
  };

  // todo: make setCache/get/load concise
  static async load(
    ctx: CacheComputeContext,
    uri: string
  ): Promise<DocumentReferences> {
    const document = (await ctx.load([
      "serverDocument.documentReferences",
      uri,
    ])) as DocumentReferences;

    return document;
  }
}
