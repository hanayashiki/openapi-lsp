import { describe, it, expect } from "vitest";
import { Solver } from "../src/solver/index.js";
import type { LocalShape, JSONType } from "../src/solver/index.js";

describe("Solver", () => {
  it("resolves basic prim and object types", () => {
    const solver = new Solver();

    const result = solver.solve({
      nodes: new Map<string, LocalShape>([
        ["file#/name", { kind: "prim", value: "hello" }],
        ["file#/count", { kind: "prim", value: 42 }],
        ["file#/obj/foo", { kind: "prim", value: "bar" }],
        ["file#/obj/num", { kind: "prim", value: 123 }],
        [
          "file#/obj",
          {
            kind: "object",
            fields: {
              foo: "file#/obj/foo",
              num: "file#/obj/num",
            },
          },
        ],
      ]),
      nominals: new Map(),
    });

    expect(result.ok).toBe(true);

    expect(result.getType("file#/name")).toEqual({
      kind: "prim",
      prim: "string",
    });
    expect(result.getType("file#/count")).toEqual({
      kind: "prim",
      prim: "number",
    });
    expect(result.getType("file#/obj")).toEqual({
      kind: "object",
      fields: {
        foo: { kind: "prim", prim: "string" },
        num: { kind: "prim", prim: "number" },
      },
    });
  });

  it("resolves $ref to same equivalence class", () => {
    const solver = new Solver();

    const result = solver.solve({
      nodes: new Map<string, LocalShape>([
        ["file#/a/x", { kind: "prim", value: 1 }],
        ["file#/a", { kind: "object", fields: { x: "file#/a/x" } }],
        ["file#/b", { kind: "ref", target: "file#/a" }],
      ]),
      nominals: new Map(),
    });

    expect(result.ok).toBe(true);
    expect(result.getClassId("file#/a")).toBe(result.getClassId("file#/b"));
    expect(result.getType("file#/b")).toEqual({
      kind: "object",
      fields: { x: { kind: "prim", prim: "number" } },
    });
  });

  it("resolves $ref chain correctly", () => {
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

    // All three should be in same equivalence class
    expect(result.getClassId("file#/target")).toBe(
      result.getClassId("file#/ref1")
    );
    expect(result.getClassId("file#/ref1")).toBe(
      result.getClassId("file#/ref2")
    );

    // All should have the same type
    expect(result.getType("file#/ref2")).toEqual({
      kind: "prim",
      prim: "string",
    });
  });

  it.for([
    {
      name: "pure ref cycle (no concrete) -> typevar",
      nodes: [
        { id: "file#/a", shape: { kind: "ref" as const, target: "file#/b" } },
        { id: "file#/b", shape: { kind: "ref" as const, target: "file#/c" } },
        { id: "file#/c", shape: { kind: "ref" as const, target: "file#/a" } },
      ],
      expectedType: { kind: "typevar" },
    },
    {
      name: "ref cycle with one concrete -> resolves to concrete type",
      nodes: [
        { id: "file#/a", shape: { kind: "ref" as const, target: "file#/b" } },
        { id: "file#/b", shape: { kind: "prim" as const, value: "hello" } },
        { id: "file#/c", shape: { kind: "ref" as const, target: "file#/a" } },
      ],
      expectedType: { kind: "prim", prim: "string" },
    },
  ])("ring ref: $name", ({ nodes, expectedType }) => {
    const solver = new Solver();

    const result = solver.solve({
      nodes: new Map(nodes.map(({ id, shape }) => [id, shape])),
      nominals: new Map(),
    });

    expect(result.ok).toBe(true);

    // All nodes in the cycle should be in same equivalence class
    const classIds = nodes.map((n) => result.getClassId(n.id));
    expect(new Set(classIds).size).toBe(1);

    // All should have the expected type
    for (const { id } of nodes) {
      expect(result.getType(id)).toEqual(expectedType);
    }
  });

  it("assigns nominal anchor to equivalence class", () => {
    const solver = new Solver();

    const result = solver.solve({
      nodes: new Map<string, LocalShape>([
        [
          "file#/components/schemas/Pet",
          {
            kind: "object",
            fields: { name: "file#/components/schemas/Pet/name" },
          },
        ],
        [
          "file#/components/schemas/Pet/name",
          { kind: "prim", value: "Fluffy" },
        ],
        [
          "file#/paths/pet",
          { kind: "ref", target: "file#/components/schemas/Pet" },
        ],
      ]),
      nominals: new Map([["file#/components/schemas/Pet", "Pet"]]),
    });

    expect(result.ok).toBe(true);

    // Both nodes should have the same nominal
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

  it("throws error when querying node not in input", () => {
    const solver = new Solver();
    const result = solver.solve({
      nodes: new Map<string, LocalShape>([
        ["file#/a", { kind: "prim", value: "hello" }],
      ]),
      nominals: new Map(),
    });

    expect(() => result.getType("file#/missing")).toThrow(
      'Node "file#/missing" was not in the solver input'
    );
    expect(() => result.getClassId("file#/missing")).toThrow(
      'Node "file#/missing" was not in the solver input'
    );
    expect(() => result.getCanonicalNominal("file#/missing")).toThrow(
      'Node "file#/missing" was not in the solver input'
    );
  });

  describe("outgoingTypes", () => {
    it("tracks external refs in outgoingTypes", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "file#/external" }],
        ]),
        nominals: new Map(),
      });

      // External refs are not errors
      expect(result.ok).toBe(true);
      expect(result.diagnostics).toHaveLength(0);

      // External target appears in outgoingTypes
      const outgoing = result.getOutgoingTypes();
      expect(outgoing.has("file#/external")).toBe(true);
      // Type is typevar since no concrete shape exists
      expect(outgoing.get("file#/external")).toEqual({ kind: "typevar" });
    });

    it("multiple refs to same external target produce single outgoing entry", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "external#/schema" }],
          ["file#/b", { kind: "ref", target: "external#/schema" }],
        ]),
        nominals: new Map(),
      });

      expect(result.ok).toBe(true);
      const outgoing = result.getOutgoingTypes();
      expect(outgoing.size).toBe(1);
      expect(outgoing.has("external#/schema")).toBe(true);
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
      expect(result.getOutgoingTypes().size).toBe(0);
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
  });

  describe("incomingTypes", () => {
    it("uses incoming type for node when provided", () => {
      const solver = new Solver();
      const incomingType: JSONType = { kind: "prim", prim: "string" };

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: 42 }], // Would be number
        ]),
        nominals: new Map(),
        incomingTypes: new Map([
          ["file#/a", [incomingType]], // Override to string
        ]),
      });

      expect(result.ok).toBe(false); // STRUCT_CONFLICT between string and number
    });

    it("incoming type unifies with concrete shape when compatible", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
        ]),
        nominals: new Map(),
        incomingTypes: new Map([
          ["file#/a", [{ kind: "prim", prim: "string" }]],
        ]),
      });

      expect(result.ok).toBe(true);
      expect(result.getType("file#/a")).toEqual({ kind: "prim", prim: "string" });
    });

    it("incoming type propagates through refs in same equivalence class", () => {
      const solver = new Solver();
      const incomingType: JSONType = { kind: "prim", prim: "bool" };

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "file#/b" }],
          ["file#/b", { kind: "ref", target: "file#/c" }],
          ["file#/c", { kind: "ref", target: "file#/a" }], // cycle with no concrete
        ]),
        nominals: new Map(),
        incomingTypes: new Map([
          ["file#/a", [incomingType]],
        ]),
      });

      expect(result.ok).toBe(true);
      // All nodes in the class get the incoming type
      expect(result.getType("file#/a")).toEqual(incomingType);
      expect(result.getType("file#/b")).toEqual(incomingType);
      expect(result.getType("file#/c")).toEqual(incomingType);
    });

    it("multiple compatible incoming types unify successfully", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "file#/b" }],
          ["file#/b", { kind: "ref", target: "file#/a" }],
        ]),
        nominals: new Map(),
        incomingTypes: new Map([
          ["file#/a", [{ kind: "prim", prim: "string" }]],
          ["file#/b", [{ kind: "prim", prim: "string" }]],
        ]),
      });

      expect(result.ok).toBe(true);
      expect(result.getType("file#/a")).toEqual({ kind: "prim", prim: "string" });
    });

    it("multiple conflicting incoming types emit STRUCT_CONFLICT", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "ref", target: "file#/b" }],
          ["file#/b", { kind: "ref", target: "file#/a" }],
        ]),
        nominals: new Map(),
        incomingTypes: new Map([
          ["file#/a", [{ kind: "prim", prim: "string" }]],
          ["file#/b", [{ kind: "prim", prim: "number" }]],
        ]),
      });

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "STRUCT_CONFLICT",
        })
      );
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
        incomingNominals: new Map([
          ["file#/a", ["Pet"]],
        ]),
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
        incomingNominals: new Map([
          ["file#/a", ["TypeA", "TypeB"]],
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

    it("incoming nominal conflicts with local nominal", () => {
      const solver = new Solver();

      const result = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["file#/a", { kind: "prim", value: "hello" }],
        ]),
        nominals: new Map([["file#/a", "LocalType"]]),
        incomingNominals: new Map([
          ["file#/a", ["IncomingType"]],
        ]),
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
    it("types flow from referencing doc to referenced doc via outgoing->incoming", () => {
      const solver = new Solver();

      // openapi.yaml refs component.yaml - openapi has the type context
      // Solve openapi first - its outgoingTypes tell us what types it expects
      const openapi = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["openapi#/response", { kind: "ref", target: "component#/Pet" }],
        ]),
        nominals: new Map(),
      });

      // openapi's outgoingTypes = types it expects from external refs
      const outgoing = openapi.getOutgoingTypes();
      expect(outgoing.has("component#/Pet")).toBe(true);

      // Convert outgoing to incoming format (single type -> array)
      const incomingTypes = new Map<string, JSONType[]>();
      for (const [nodeId, type] of outgoing) {
        incomingTypes.set(nodeId, [type]);
      }

      // Solve component.yaml with incoming types from openapi
      const component = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["component#/Pet", { kind: "prim", value: "pet-data" }],
        ]),
        nominals: new Map(),
        incomingTypes,
      });

      expect(component.ok).toBe(true);
      expect(component.getOutgoingTypes().size).toBe(0);
    });

    it("concrete type from referencing doc flows to referenced doc", () => {
      const solver = new Solver();

      // openapi has a concrete object that refs component
      const openapi = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["openapi#/response", { kind: "object", fields: { data: "openapi#/response/data" } }],
          ["openapi#/response/data", { kind: "ref", target: "component#/Pet" }],
        ]),
        nominals: new Map(),
      });

      const outgoing = openapi.getOutgoingTypes();
      expect(outgoing.has("component#/Pet")).toBe(true);
      // The type expected for component#/Pet is typevar (unknown from openapi's perspective)
      expect(outgoing.get("component#/Pet")).toEqual({ kind: "typevar" });

      // Convert to incoming format
      const incomingTypes = new Map<string, JSONType[]>();
      for (const [nodeId, type] of outgoing) {
        incomingTypes.set(nodeId, [type]);
      }

      // When component is solved, it can provide a concrete type
      const component = solver.solve({
        nodes: new Map<string, LocalShape>([
          ["component#/Pet", { kind: "object", fields: { name: "component#/Pet/name" } }],
          ["component#/Pet/name", { kind: "prim", value: "Fluffy" }],
        ]),
        nominals: new Map(),
        incomingTypes,
      });

      expect(component.ok).toBe(true);
      // typevar unifies with concrete type
      expect(component.getType("component#/Pet")).toEqual({
        kind: "object",
        fields: { name: { kind: "prim", prim: "string" } },
      });
    });

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
});
