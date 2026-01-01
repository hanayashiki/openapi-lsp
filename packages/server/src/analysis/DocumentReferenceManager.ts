import {
  CacheComputeContext,
  CacheLoader,
  QueryCache,
} from "@openapi-lsp/core/queries";
import { Resolver } from "./Resolver.js";
import { ServerDocumentManager } from "./DocumentManager.js";
import { DocumentRef, DocumentReferences } from "./DocumentReference.js";
import { isPositionInRange } from "./utils.js";
import {
  isLocalPointer,
  parseUriWithJsonPointer,
} from "@openapi-lsp/core/json-pointer";
import { Position } from "vscode-languageserver-textdocument";
import { DefinitionLink } from "vscode-languageserver";

export class DocumentReferenceManager {
  loader: CacheLoader<
    ["serverDocument.documentReferences", string],
    DocumentReferences
  >;

  constructor(
    private documentManager: ServerDocumentManager,
    private resolver: Resolver,
    cache: QueryCache
  ) {
    this.loader = cache.createLoader(
      async ([_, uri], ctx): Promise<DocumentReferences> => {
        const document = await this.documentManager.load(ctx, uri);

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
                  const resolved = await this.resolver.load(ctx, {
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
      }
    );
  }

  getDocumentReferences = async (uri: string): Promise<DocumentReferences> => {
    return await this.loader.use(["serverDocument.documentReferences", uri]);
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

    // Extract fragment using parseUriWithJsonPointer
    const parseResult = parseUriWithJsonPointer(docRef.ref, "file:///");
    if (!parseResult.success) return null;
    const fragment = parseResult.data.url.hash || "#";

    // Jump to JSON pointer location in target file (empty fragment = root = position 0)
    return targetDoc.yaml.getDefinitionLinkByRef(fragment, targetDoc.uri);
  };

  load = (
    ctx: CacheComputeContext,
    uri: string
  ): Promise<DocumentReferences> => {
    return this.loader.load(ctx, ["serverDocument.documentReferences", uri]);
  };
}
