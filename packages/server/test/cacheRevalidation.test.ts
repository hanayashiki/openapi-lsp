import { describe, it, expect } from "vitest";
import { createTestServerWithVFS } from "./utils/testServer.js";
import { stringify } from "yaml";
import { fileURLToPath } from "node:url";
import { OpenAPI } from "@openapi-lsp/core/openapi";

const initDoc: OpenAPI.Document = {
  openapi: "3.0.0",
  info: { title: "Cache Test", version: "1.0.0" },
  paths: {},
  components: {
    schemas: {
      Pet: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
    },
  },
};

const cases: {
  name: string;
  edit: (doc: OpenAPI.Document) => OpenAPI.Document;
  expectSame: boolean
}[] = [
  {
    name: "reuse cache when content unchanged",
    edit: (doc) => doc,
    expectSame: true,
  },
  {
    name: "recompute when content changes",
    edit: (doc) => ({
      ...doc,
      components: {
        schemas: {
          Pet: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "integer" },
            },
          },
        },
      },
    }),
    expectSame: false,
  },
];

describe("cacheRevalidation", () => {
  it.each(cases)("$name", async ({ edit, expectSame }) => {
    const { server, vfs } = createTestServerWithVFS({
      "/workspace/openapi.yaml": initDoc,
    });

    const uri = "file:///workspace/openapi.yaml";
    const path = fileURLToPath(uri);

    // Initial analysis
    await server.analysisManager.discoverRoots();
    const result1 = await server.analysisManager.groupAnalysisLoader.use([
      "groupAnalysis",
      uri,
    ]);

    // Edit and write
    await vfs.writeFile(path, stringify(edit(initDoc)));
    server.documentManager.loader.invalidate(["serverDocument", uri]);

    // Re-analyze
    const result2 = await server.analysisManager.groupAnalysisLoader.use([
      "groupAnalysis",
      uri,
    ]);

    if (expectSame) {
      expect(result2.solveResult).toBe(result1.solveResult);
    } else {
      expect(result2.solveResult).not.toBe(result1.solveResult);
    }
  });
});
