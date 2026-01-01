import { describe, it, expect } from "vitest";
import { Solver } from "../src/solver/index.js";
import type { LocalShape } from "../src/solver/index.js";

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

  it("reports MISSING_TARGET for ref to non-existent node", () => {
    const solver = new Solver();

    const result = solver.solve({
      nodes: new Map<string, LocalShape>([
        ["file#/a", { kind: "ref", target: "file#/missing" }],
      ]),
      nominals: new Map(),
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual({
      code: "MISSING_TARGET",
      from: "file#/a",
      to: "file#/missing",
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
});
