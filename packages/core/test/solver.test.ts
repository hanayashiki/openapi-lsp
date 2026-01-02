import { describe, it, expect } from "vitest";
import { Solver } from "../src/solver/index.js";
import type { LocalShape } from "../src/solver/index.js";

describe("Solver", () => {
  describe("equivalence classes", () => {
    it("groups $ref-connected nodes into same equivalence class", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
          ["file#/b", { kind: "ref", target: "file#/a" }],
        ]),
        nominals: new Map(),
      });

      expect(result.ok).toBe(true);
      expect(result.getClassId("file#/a")).toBe(result.getClassId("file#/b"));
    });

    it("groups $ref chain into same equivalence class", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/target", { kind: "prim", value: "hello" }],
          ["file#/ref1", { kind: "ref", target: "file#/target" }],
          ["file#/ref2", { kind: "ref", target: "file#/ref1" }],
        ]),
        nominals: new Map(),
      });

      expect(result.ok).toBe(true);
      expect(result.getClassId("file#/target")).toBe(
        result.getClassId("file#/ref1")
      );
      expect(result.getClassId("file#/ref1")).toBe(
        result.getClassId("file#/ref2")
      );
    });

    it("handles ref cycles", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "file#/b" }],
          ["file#/b", { kind: "ref", target: "file#/c" }],
          ["file#/c", { kind: "ref", target: "file#/a" }],
        ]),
        nominals: new Map(),
      });

      expect(result.ok).toBe(true);
      // All nodes in the cycle should be in same equivalence class
      const classA = result.getClassId("file#/a");
      const classB = result.getClassId("file#/b");
      const classC = result.getClassId("file#/c");
      expect(classA).toBe(classB);
      expect(classB).toBe(classC);
    });
  });

  describe("nominals", () => {
    it("assigns nominal to equivalence class", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/components/schemas/Pet", { kind: "prim", value: "pet" }],
          [
            "file#/paths/pet",
            { kind: "ref", target: "file#/components/schemas/Pet" },
          ],
        ]),
        nominals: new Map([["file#/components/schemas/Pet", "Pet"]]),
      });

      expect(result.ok).toBe(true);
      expect(result.getCanonicalNominal("file#/components/schemas/Pet")).toBe(
        "Pet"
      );
      expect(result.getCanonicalNominal("file#/paths/pet")).toBe("Pet");
    });

    it("reports NOMINAL_CONFLICT when two nominals in same equivalence class", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
          ["file#/b", { kind: "ref", target: "file#/a" }],
        ]),
        nominals: new Map([
          ["file#/a", "TypeA"],
          ["file#/b", "TypeB"],
        ]),
      });

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "NOMINAL_CONFLICT",
          a: "TypeA",
          b: "TypeB",
        })
      );
    });
  });

  describe("external refs", () => {
    it("tracks external refs without error", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "external#/Pet" }],
        ]),
        nominals: new Map(),
      });

      expect(result.ok).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("includes outgoing nominals for external refs", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "external#/Pet" }],
        ]),
        nominals: new Map([["file#/a", "Pet"]]),
      });

      expect(result.ok).toBe(true);
      const outgoingNominals = result.getOutgoingNominals();
      expect(outgoingNominals.get("external#/Pet")).toBe("Pet");
    });

    it("multiple refs to same external produce single outgoing nominal", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "external#/schema" }],
          ["file#/b", { kind: "ref", target: "external#/schema" }],
        ]),
        nominals: new Map([["file#/a", "Schema"]]),
      });

      expect(result.ok).toBe(true);
      const outgoing = result.getOutgoingNominals();
      expect(outgoing.size).toBe(1);
      expect(outgoing.get("external#/schema")).toBe("Schema");
    });

    it("returns empty map when no external refs", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
          ["file#/b", { kind: "ref", target: "file#/a" }],
        ]),
        nominals: new Map(),
      });

      expect(result.ok).toBe(true);
      expect(result.getOutgoingNominals().size).toBe(0);
    });
  });

  describe("incomingNominals", () => {
    it("assigns incoming nominal to equivalence class", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
        ]),
        nominals: new Map(),
        incomingNominals: new Map([["file#/a", ["Pet"]]]),
      });

      expect(result.ok).toBe(true);
      expect(result.getCanonicalNominal("file#/a")).toBe("Pet");
    });

    it("conflicting incoming nominals emit NOMINAL_CONFLICT", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
        ]),
        nominals: new Map(),
        incomingNominals: new Map([["file#/a", ["TypeA", "TypeB"]]]),
      });

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "NOMINAL_CONFLICT",
          a: "TypeA",
          b: "TypeB",
        })
      );
    });

    it("incoming nominal conflicts with local nominal", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
        ]),
        nominals: new Map([["file#/a", "LocalType"]]),
        incomingNominals: new Map([["file#/a", ["IncomingType"]]]),
      });

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "NOMINAL_CONFLICT",
          a: "LocalType",
          b: "IncomingType",
        })
      );
    });
  });

  describe("SCC workflow", () => {
    it("nominals flow from referencing doc to referenced doc", () => {
      const solver = new Solver();

      // openapi.yaml refs component.yaml with a nominal
      const openapi = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["openapi#/response", { kind: "ref", target: "component#/Pet" }],
        ]),
        nominals: new Map([["openapi#/response", "Pet"]]),
      });

      const outgoingNominals = openapi.getOutgoingNominals();
      expect(outgoingNominals.get("component#/Pet")).toBe("Pet");

      // Convert to incoming format
      const incomingNominals = new Map<string, string[]>();
      for (const [nodeId, nominal] of outgoingNominals) {
        incomingNominals.set(nodeId, [nominal]);
      }

      // Solve component.yaml with incoming nominals
      const component = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["component#/Pet", { kind: "prim", value: "pet-data" }],
        ]),
        nominals: new Map(),
        incomingNominals,
      });

      expect(component.ok).toBe(true);
      expect(component.getCanonicalNominal("component#/Pet")).toBe("Pet");
    });
  });

  describe("error handling", () => {
    it("throws error when querying node not in input", () => {
      const solver = new Solver();
      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
        ]),
        nominals: new Map(),
      });

      expect(() => result.getClassId("file#/missing")).toThrow(
        'Node "file#/missing" was not in the solver input'
      );
      expect(() => result.getCanonicalNominal("file#/missing")).toThrow(
        'Node "file#/missing" was not in the solver input'
      );
    });
  });
});
