import { UnionFind } from "./union-find.js";
import type {
  NodeId,
  NominalId,
  ClassId,
  JSONType,
  LocalShape,
  Class,
  Diagnostic,
  SolveResult,
  SolverInput,
} from "./types.js";

/**
 * Ephemeral context for a single solve() invocation.
 * Holds mutable state during the solving algorithm.
 */
class SolveContext {
  readonly nodes: Map<NodeId, LocalShape>;
  readonly nominals: Map<NodeId, NominalId>;

  nodeToClass: Map<NodeId, ClassId> = new Map();
  classes: Map<ClassId, Class> = new Map();
  classTypes: Map<ClassId, JSONType> = new Map();
  diagnostics: Diagnostic[] = [];

  constructor(input: SolverInput) {
    this.nodes = input.nodes;
    this.nominals = input.nominals;
  }

  /** Helper: get node type during computation (returns typevar if not yet computed) */
  getNodeType(nodeId: NodeId): JSONType {
    const classId = this.nodeToClass.get(nodeId);
    if (classId === undefined) {
      return { kind: "typevar" };
    }
    return this.classTypes.get(classId) ?? { kind: "typevar" };
  }
}

/**
 * Concrete implementation of SolveResult.
 * Holds immutable computed state from a solve() call.
 */
class SolveResultImpl implements SolveResult {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];

  private readonly nodeToClass: Map<NodeId, ClassId>;
  private readonly classes: Map<ClassId, Class>;
  private readonly classTypes: Map<ClassId, JSONType>;
  private readonly inputNodeIds: Set<NodeId>;

  constructor(
    diagnostics: Diagnostic[],
    nodeToClass: Map<NodeId, ClassId>,
    classes: Map<ClassId, Class>,
    classTypes: Map<ClassId, JSONType>,
    inputNodeIds: Set<NodeId>
  ) {
    this.ok = diagnostics.length === 0;
    this.diagnostics = Object.freeze([...diagnostics]);
    this.nodeToClass = nodeToClass;
    this.classes = classes;
    this.classTypes = classTypes;
    this.inputNodeIds = inputNodeIds;
  }

  getType(node: NodeId): JSONType {
    this.assertNodeExists(node);
    const classId = this.nodeToClass.get(node);
    if (classId === undefined) {
      // Node exists in input but not in any class (shouldn't happen normally)
      return { kind: "typevar" };
    }
    return this.classTypes.get(classId) ?? { kind: "typevar" };
  }

  getClassId(node: NodeId): ClassId {
    this.assertNodeExists(node);
    const classId = this.nodeToClass.get(node);
    if (classId === undefined) {
      throw new Error(`Node "${node}" has no assigned class`);
    }
    return classId;
  }

  getCanonicalNominal(node: NodeId): NominalId | null {
    this.assertNodeExists(node);
    const classId = this.nodeToClass.get(node);
    if (classId === undefined) return null;
    return this.classes.get(classId)?.nominal ?? null;
  }

  private assertNodeExists(node: NodeId): void {
    if (!this.inputNodeIds.has(node)) {
      throw new Error(`Node "${node}" was not in the solver input`);
    }
  }
}

/**
 * Stateless solver for OpenAPI document structure types.
 *
 * Usage:
 * const solver = new Solver();
 * const result = solver.solve({
 *   nodes: new Map([...]),
 *   nominals: new Map([...])
 * });
 * const type = result.getType("file#/a");
 */
export class Solver {
  /**
   * Solve the type system: build equivalence classes and unify types.
   * @param input All nodes and nominal anchors
   * @returns SolveResult with query methods for accessing computed data
   */
  solve(input: SolverInput): SolveResult {
    const ctx = new SolveContext(input);

    this.buildEquivalenceClasses(ctx);
    this.computeTypes(ctx);

    return new SolveResultImpl(
      ctx.diagnostics,
      ctx.nodeToClass,
      ctx.classes,
      ctx.classTypes,
      new Set(input.nodes.keys())
    );
  }

  /**
   * Phase 1: Build equivalence classes using Union-Find.
   */
  private buildEquivalenceClasses(ctx: SolveContext): void {
    const uf = new UnionFind<NodeId>();

    // Initialize all nodes
    for (const nodeId of ctx.nodes.keys()) {
      uf.makeSet(nodeId);
    }

    // Union nodes whose shape is a $ref with their target
    for (const [nodeId, shape] of ctx.nodes) {
      if (shape.kind === "ref") {
        const target = shape.target;
        if (!ctx.nodes.has(target)) {
          ctx.diagnostics.push({
            code: "MISSING_TARGET",
            from: nodeId,
            to: target,
          });
        } else {
          uf.union(nodeId, target);
        }
      }
    }

    // Extract components and assign class IDs
    const components = uf.getComponents();
    let classIdCounter = 0;

    for (const [, nodeSet] of components) {
      const classId = classIdCounter++;
      const cls: Class = {
        id: classId,
        nodes: nodeSet,
        nominal: null,
      };

      // Check for nominal conflicts and assign nominal
      let firstNominal: { node: NodeId; nominal: NominalId } | null = null;

      for (const node of nodeSet) {
        ctx.nodeToClass.set(node, classId);

        const nominal = ctx.nominals.get(node);
        if (nominal) {
          if (firstNominal === null) {
            firstNominal = { node, nominal };
            cls.nominal = nominal;
          } else if (firstNominal.nominal !== nominal) {
            // Nominal conflict
            ctx.diagnostics.push({
              code: "NOMINAL_CONFLICT",
              a: firstNominal.nominal,
              b: nominal,
              proofA: [
                { kind: "anchor", node: firstNominal.node, nominal: firstNominal.nominal },
              ],
              proofB: [{ kind: "anchor", node, nominal }],
            });
          }
        }
      }

      ctx.classes.set(classId, cls);
    }
  }

  /**
   * Phase 2: Compute types for each equivalence class.
   */
  private computeTypes(ctx: SolveContext): void {
    // We need to process classes in dependency order (leaves first).
    // Use iterative approach: keep processing until no more progress.
    const pendingClasses = new Set(ctx.classes.keys());
    let madeProgress = true;

    while (madeProgress && pendingClasses.size > 0) {
      madeProgress = false;

      for (const classId of pendingClasses) {
        const cls = ctx.classes.get(classId)!;
        const type = this.unifyClass(ctx, cls);

        if (type !== null && type.kind !== "typevar") {
          // Successfully computed a concrete type
          ctx.classTypes.set(classId, type);
          pendingClasses.delete(classId);
          madeProgress = true;
        } else if (type !== null) {
          // Got typevar, might resolve later or stay as typevar
          // Check if all dependencies are resolved
          if (this.allDependenciesResolved(ctx, cls)) {
            ctx.classTypes.set(classId, type);
            pendingClasses.delete(classId);
            madeProgress = true;
          }
        }
      }
    }

    // Set remaining classes to typevar
    for (const classId of pendingClasses) {
      if (!ctx.classTypes.has(classId)) {
        ctx.classTypes.set(classId, { kind: "typevar" });
      }
    }
  }

  /**
   * Unify all concrete (non-ref) shapes in an equivalence class.
   */
  private unifyClass(ctx: SolveContext, cls: Class): JSONType | null {
    const concreteShapes: { node: NodeId; shape: LocalShape }[] = [];

    for (const node of cls.nodes) {
      const shape = ctx.nodes.get(node);
      if (shape && shape.kind !== "ref") {
        concreteShapes.push({ node, shape });
      }
    }

    if (concreteShapes.length === 0) {
      // No concrete shapes - type is unknown
      return { kind: "typevar" };
    }

    // Convert first shape to type
    let unifiedType = this.shapeToType(ctx, concreteShapes[0].shape);

    // Unify with remaining shapes
    for (let i = 1; i < concreteShapes.length; i++) {
      const { node, shape } = concreteShapes[i];
      const otherType = this.shapeToType(ctx, shape);
      const result = this.unifyTypes(unifiedType, otherType);

      if (result === null) {
        ctx.diagnostics.push({
          code: "STRUCT_CONFLICT",
          node,
          left: unifiedType,
          right: otherType,
        });
        return null;
      }

      unifiedType = result;
    }

    return unifiedType;
  }

  /**
   * Convert a LocalShape to a JSONType.
   * For composite types, looks up child node types from classTypes.
   */
  private shapeToType(ctx: SolveContext, shape: LocalShape): JSONType {
    switch (shape.kind) {
      case "prim":
        return { kind: "prim", prim: this.inferPrimType(shape.value) };
      case "array": {
        // Look up element node's type
        const elemType = ctx.getNodeType(shape.elem);
        return { kind: "array", elem: elemType };
      }
      case "object": {
        const fields: Record<string, JSONType> = {};
        for (const [key, fieldNodeId] of Object.entries(shape.fields)) {
          fields[key] = ctx.getNodeType(fieldNodeId);
        }
        return { kind: "object", fields };
      }
      case "ref":
        // Should not reach here in normal flow (refs are handled via union)
        return { kind: "typevar" };
    }
  }

  /**
   * Check if all child node dependencies of a class have resolved types.
   */
  private allDependenciesResolved(ctx: SolveContext, cls: Class): boolean {
    for (const nodeId of cls.nodes) {
      const shape = ctx.nodes.get(nodeId);
      if (!shape) continue;

      if (shape.kind === "object") {
        for (const fieldNodeId of Object.values(shape.fields)) {
          const fieldClassId = ctx.nodeToClass.get(fieldNodeId);
          if (fieldClassId !== undefined && !ctx.classTypes.has(fieldClassId)) {
            return false;
          }
        }
      } else if (shape.kind === "array") {
        const elemClassId = ctx.nodeToClass.get(shape.elem);
        if (elemClassId !== undefined && !ctx.classTypes.has(elemClassId)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Infer primitive type from a JS value.
   */
  private inferPrimType(
    value: string | null | boolean | number
  ): "null" | "bool" | "number" | "string" {
    if (value === null) return "null";
    if (typeof value === "boolean") return "bool";
    if (typeof value === "number") return "number";
    return "string";
  }

  /**
   * Unify two JSONTypes. Returns null if they are incompatible.
   */
  private unifyTypes(a: JSONType, b: JSONType): JSONType | null {
    // typevar unifies with anything
    if (a.kind === "typevar") return b;
    if (b.kind === "typevar") return a;

    // Different kinds are incompatible
    if (a.kind !== b.kind) return null;

    switch (a.kind) {
      case "prim":
        return a.prim === (b as { kind: "prim"; prim: string }).prim ? a : null;

      case "array": {
        const bArray = b as { kind: "array"; elem: JSONType };
        const elemResult = this.unifyTypes(a.elem, bArray.elem);
        return elemResult ? { kind: "array", elem: elemResult } : null;
      }

      case "object": {
        const bObj = b as { kind: "object"; fields: Record<string, JSONType> };
        const aKeys = Object.keys(a.fields).sort();
        const bKeys = Object.keys(bObj.fields).sort();

        // Must have same keys
        if (aKeys.length !== bKeys.length) return null;
        for (let i = 0; i < aKeys.length; i++) {
          if (aKeys[i] !== bKeys[i]) return null;
        }

        // Unify all field types
        const fields: Record<string, JSONType> = {};
        for (const key of aKeys) {
          const result = this.unifyTypes(a.fields[key], bObj.fields[key]);
          if (result === null) return null;
          fields[key] = result;
        }

        return { kind: "object", fields };
      }

      case "nominal":
        return a.id === (b as { kind: "nominal"; id: string }).id ? a : null;

      default:
        return null;
    }
  }
}
