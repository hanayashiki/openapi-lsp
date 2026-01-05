import { z } from "zod";

export const ExtensionConfiguration = z.object({
  "openapi-lsp.discoverRoots.pattern": z
    .string()
    .describe(
      `The minimatch (https://www.npmjs.com/package/minimatch) glob pattern for OpenAPI document discovery`
    )
    .default("**/*"),
  "openapi-lsp.discoverRoots.ignore": z
    .string()
    .describe(
      `The minimatch (https://www.npmjs.com/package/minimatch) glob pattern to ignore during OpenAPI document discovery`
    )
    .default("{**/node_modules/**,**/.git/**,**/.hg/**}"),
  "openapi-lsp.debug.cache": z
    .boolean()
    .describe(`Enable debug logging for cache invalidation and recomputation`)
    .default(false),
});

export type ExtensionConfiguration = z.infer<typeof ExtensionConfiguration>;
