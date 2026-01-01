import { describe, it, expect } from "vitest";
import { createTestServer } from "./utils/testServer.js";

describe("discoverRoots", () => {
  it("should discover ring reference and compute SCCs", async () => {
    const server = createTestServer({
      "/workspace/openapi.yaml": {
        openapi: "3.0.0",
        info: { title: "Ring Reference Test", version: "1.0.0" },
        paths: {},
        components: {
          schemas: {
            Root: { $ref: "./schemas/NodeA.yaml" },
          },
        },
      },
      "/workspace/schemas/NodeA.yaml": {
        type: "object",
        properties: { next: { $ref: "./NodeB.yaml" } },
      },
      "/workspace/schemas/NodeB.yaml": {
        type: "object",
        properties: { next: { $ref: "./NodeC.yaml" } },
      },
      "/workspace/schemas/NodeC.yaml": {
        type: "object",
        properties: { next: { $ref: "./NodeA.yaml" } },
      },
    });

    const dc = await server.analysisManager.discoverRoots();
    expect(dc).toMatchSnapshot();
  });

  it("should handle linear references without SCCs", async () => {
    const server = createTestServer({
      "/workspace/openapi.yaml": {
        openapi: "3.0.0",
        info: { title: "Linear Reference Test", version: "1.0.0" },
        paths: {},
        components: {
          schemas: {
            Root: { $ref: "./schemas/A.yaml" },
          },
        },
      },
      "/workspace/schemas/A.yaml": {
        type: "object",
        properties: { child: { $ref: "./B.yaml" } },
      },
      "/workspace/schemas/B.yaml": {
        type: "object",
        properties: { name: { type: "string" } },
      },
    });

    const dc = await server.analysisManager.discoverRoots();
    expect(dc).toMatchSnapshot();
  });
});
