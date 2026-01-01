import { describe, it, expect } from "vitest";
import { Solver } from "../src/solver/index.js";

describe("Solver", () => {
  it("resolves basic prim and object types", () => {
    const solver = new Solver();

    solver.addNode("file#/name", { kind: "prim", value: "hello" });
    solver.addNode("file#/count", { kind: "prim", value: 42 });

    // Object with field nodes registered separately
    solver.addNode("file#/obj/foo", { kind: "prim", value: "bar" });
    solver.addNode("file#/obj/num", { kind: "prim", value: 123 });
    solver.addNode("file#/obj", {
      kind: "object",
      fields: {
        foo: "file#/obj/foo",
        num: "file#/obj/num",
      },
    });

    const result = solver.solve();
    expect(result.ok).toBe(true);

    expect(solver.getType("file#/name")).toEqual({ kind: "prim", prim: "string" });
    expect(solver.getType("file#/count")).toEqual({ kind: "prim", prim: "number" });
    expect(solver.getType("file#/obj")).toEqual({
      kind: "object",
      fields: {
        foo: { kind: "prim", prim: "string" },
        num: { kind: "prim", prim: "number" },
      },
    });
  });

  it("resolves $ref to same equivalence class", () => {
    const solver = new Solver();

    // Register field node first
    solver.addNode("file#/a/x", { kind: "prim", value: 1 });
    solver.addNode("file#/a", {
      kind: "object",
      fields: { x: "file#/a/x" },
    });
    solver.addNode("file#/b", { kind: "ref", target: "file#/a" });

    const result = solver.solve();
    expect(result.ok).toBe(true);
    expect(solver.getClassId("file#/a")).toBe(solver.getClassId("file#/b"));
    expect(solver.getType("file#/b")).toEqual({
      kind: "object",
      fields: { x: { kind: "prim", prim: "number" } },
    });
  });

  it("resolves $ref chain correctly", () => {
    const solver = new Solver();

    solver.addNode("file#/target", { kind: "prim", value: "hello" });
    solver.addNode("file#/ref1", { kind: "ref", target: "file#/target" });
    solver.addNode("file#/ref2", { kind: "ref", target: "file#/ref1" });

    const result = solver.solve();
    expect(result.ok).toBe(true);

    // All three should be in same equivalence class
    expect(solver.getClassId("file#/target")).toBe(solver.getClassId("file#/ref1"));
    expect(solver.getClassId("file#/ref1")).toBe(solver.getClassId("file#/ref2"));

    // All should have the same type
    expect(solver.getType("file#/ref2")).toEqual({ kind: "prim", prim: "string" });
  });

  it("reports MISSING_TARGET for ref to non-existent node", () => {
    const solver = new Solver();

    solver.addNode("file#/a", { kind: "ref", target: "file#/missing" });

    const result = solver.solve();
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

    for (const { id, shape } of nodes) {
      solver.addNode(id, shape);
    }

    const result = solver.solve();
    expect(result.ok).toBe(true);

    // All nodes in the cycle should be in same equivalence class
    const classIds = nodes.map((n) => solver.getClassId(n.id));
    expect(new Set(classIds).size).toBe(1);

    // All should have the expected type
    for (const { id } of nodes) {
      expect(solver.getType(id)).toEqual(expectedType);
    }
  });

  it("assigns nominal anchor to equivalence class", () => {
    const solver = new Solver();

    solver.addNode("file#/components/schemas/Pet", {
      kind: "object",
      fields: { name: "file#/components/schemas/Pet/name" },
    });
    solver.addNode("file#/components/schemas/Pet/name", { kind: "prim", value: "Fluffy" });
    solver.setNominalAnchor("file#/components/schemas/Pet", "Pet");

    solver.addNode("file#/paths/pet", { kind: "ref", target: "file#/components/schemas/Pet" });

    const result = solver.solve();
    expect(result.ok).toBe(true);

    // Both nodes should have the same nominal
    expect(solver.getCanonicalNominal("file#/components/schemas/Pet")).toBe("Pet");
    expect(solver.getCanonicalNominal("file#/paths/pet")).toBe("Pet");
  });

  it("reports NOMINAL_CONFLICT when two nominals in same equivalence class", () => {
    const solver = new Solver();

    solver.addNode("file#/a", { kind: "prim", value: "hello" });
    solver.addNode("file#/b", { kind: "ref", target: "file#/a" });

    solver.setNominalAnchor("file#/a", "TypeA");
    solver.setNominalAnchor("file#/b", "TypeB");

    const result = solver.solve();
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
