import { describe, it, expect } from "vitest";
import { createTestServer } from "./utils/testServer.js";

describe("nominalPropagation", () => {
  it("should propagate Schema nominal to external YAML file", async () => {
    const server = createTestServer({
      "/workspace/openapi.yaml": {
        openapi: "3.0.0",
        info: { title: "Nominal Propagation Test", version: "1.0.0" },
        paths: {},
        components: {
          schemas: {
            Pet: { $ref: "./schemas/Pet.yaml" },
          },
        },
      },
      "/workspace/schemas/Pet.yaml": {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
    });

    // Discover roots and compute connectivity
    const dc = await server.analysisManager.discoverRoots();

    // The openapi.yaml references Pet.yaml, so Pet.yaml's group should have incoming edge
    const openapiUri = "file:///workspace/openapi.yaml";
    const petUri = "file:///workspace/schemas/Pet.yaml";

    expect(dc.graph.get(openapiUri)).toContain(petUri);

    // Analyze the openapi group first
    const openapiResult = await server.analysisManager.groupAnalysisLoader.use([
      "groupAnalysis",
      openapiUri,
    ]);

    // The outgoing nominal should be "Schema" for the Pet.yaml target
    const outgoingNominals = openapiResult.solveResult.getOutgoingNominals();
    expect(outgoingNominals.get(petUri)).toBe("Schema");

    // Now analyze the Pet.yaml group - it should receive the nominal
    const petResult = await server.analysisManager.groupAnalysisLoader.use([
      "groupAnalysis",
      petUri,
    ]);

    // The root node of Pet.yaml should have canonical nominal "Schema"
    expect(petResult.solveResult.getCanonicalNominal(petUri)).toBe("Schema");
  });

  it("should propagate Schema nominal through transitive refs (root → user → address)", async () => {
    const server = createTestServer({
      "/workspace/openapi.yaml": {
        openapi: "3.0.0",
        info: { title: "Transitive Nominal Test", version: "1.0.0" },
        paths: {
          "/users": {
            get: {
              responses: {
                "200": {
                  description: "User",
                  content: {
                    "application/json": {
                      schema: { $ref: "./schemas/user.yaml#/User" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/workspace/schemas/user.yaml": {
        User: {
          type: "object",
          properties: {
            name: { type: "string" },
            address: { $ref: "./address.yaml#/Address" },
          },
        },
      },
      "/workspace/schemas/address.yaml": {
        Address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
          },
        },
      },
    });

    const dc = await server.analysisManager.discoverRoots();

    const openapiUri = "file:///workspace/openapi.yaml";
    const userUri = "file:///workspace/schemas/user.yaml";
    const addressUri = "file:///workspace/schemas/address.yaml";

    // Verify graph connectivity: openapi → user → address
    expect(dc.graph.get(openapiUri)).toContain(userUri);
    expect(dc.graph.get(userUri)).toContain(addressUri);

    // Analyze all groups in topological order
    await server.analysisManager.groupAnalysisLoader.use([
      "groupAnalysis",
      openapiUri,
    ]);

    await server.analysisManager.groupAnalysisLoader.use([
      "groupAnalysis",
      userUri,
    ]);

    const addressResult = await server.analysisManager.groupAnalysisLoader.use([
      "groupAnalysis",
      addressUri,
    ]);

    // The Address definition should have canonical nominal "Schema"
    expect(
      addressResult.solveResult.getCanonicalNominal(addressUri + "#/Address")
    ).toBe("Schema");
  });

  it("should propagate Schema nominal through ring references (A → B → C → A)", async () => {
    const server = createTestServer({
      "/workspace/openapi.yaml": {
        openapi: "3.0.0",
        info: { title: "Ring Nominal Test", version: "1.0.0" },
        paths: {
          "/nodes": {
            get: {
              responses: {
                "200": {
                  description: "A list of nodes",
                  content: {
                    "application/json": {
                      schema: {
                        type: "array",
                        items: { $ref: "./schemas/NodeA.yaml" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/workspace/schemas/NodeA.yaml": {
        type: "object",
        properties: {
          id: { type: "string" },
          next: { $ref: "./NodeB.yaml" },
        },
      },
      "/workspace/schemas/NodeB.yaml": {
        type: "object",
        properties: {
          id: { type: "string" },
          next: { $ref: "./NodeC.yaml" },
        },
      },
      "/workspace/schemas/NodeC.yaml": {
        type: "object",
        properties: {
          id: { type: "string" },
          next: { $ref: "./NodeA.yaml" },
        },
      },
    });

    await server.analysisManager.discoverRoots();

    const nodeAUri = "file:///workspace/schemas/NodeA.yaml";
    const nodeBUri = "file:///workspace/schemas/NodeB.yaml";
    const nodeCUri = "file:///workspace/schemas/NodeC.yaml";

    // Get group analysis for the SCC (NodeA is the group ID - alphabetically smallest)
    const result = await server.analysisManager.groupAnalysisLoader.use([
      "groupAnalysis",
      nodeAUri,
    ]);

    // All three should have canonical nominal "Schema"
    expect(result.solveResult.getCanonicalNominal(nodeAUri)).toBe("Schema");
    expect(result.solveResult.getCanonicalNominal(nodeBUri)).toBe("Schema");
    expect(result.solveResult.getCanonicalNominal(nodeCUri)).toBe("Schema");
  });
});
