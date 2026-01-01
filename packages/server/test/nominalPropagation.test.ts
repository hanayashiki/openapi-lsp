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
});
