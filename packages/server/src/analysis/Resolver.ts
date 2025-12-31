import { QueryCache } from "@openapi-lsp/core/queries";

export interface ResolverOptions {
  queryCache: QueryCache;
}

export interface Resolver {
  resolve: () => void;
}

export const createResolver = (_options: ResolverOptions) => {
  // TODO
};
