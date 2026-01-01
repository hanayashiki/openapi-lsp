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
} from "./types.js";

/**
 * Solver for OpenAPI document structure types.
 *
 * Usage:
 * 1. Call addNode() to register all nodes with their local shapes
 * 2. Call setNominalAnchor() to assign nominal names to specific nodes
 * 3. Call solve() to compute equivalence classes and unify types
 * 4. Query results with getType(), getClassId(), getCanonicalNominal()
 */
export class Solver {
  private nodes: Map<NodeId, LocalShape> = new Map();
  private nominals: Map<NodeId, NominalId> = new Map();

  // Computed after solve()
  private solved = false;
  private nodeToClass: Map<NodeId, ClassId> = new Map();
  private classes: Map<ClassId, Class> = new Map();
  private classTypes: Map<ClassId, JSONType> = new Map();
  private diagnostics: Diagnostic[] = [];

  /**
   * Add a node with its local shape.
   */
  addNode(id: NodeId, shape: LocalShape): void {
    if (this.solved) {
      throw new Error("Cannot add nodes after solve() has been called");
    }
    this.nodes.set(id, shape);
  }

  /**
   * Set a nominal anchor for a node.
   */
  setNominalAnchor(node: NodeId, nominal: NominalId): void {
    if (this.solved) {
      throw new Error("Cannot set nominals after solve() has been called");
    }
    this.nominals.set(node, nominal);
  }

  /**
   * Solve the type system: build equivalence classes and unify types.
   */
  solve(): SolveResult {
    if (this.solved) {
      return { ok: this.diagnostics.length === 0, diagnostics: this.diagnostics };
    }

    this.solved = true;
    this.diagnostics = [];

    // Phase 1: Build equivalence classes using Union-Find
    const uf = new UnionFind<NodeId>();

    // Initialize all nodes
    for (const nodeId of this.nodes.keys()) {
      uf.makeSet(nodeId);
    }

    // Union nodes whose shape is a $ref with their target
    for (const [nodeId, shape] of this.nodes) {
      if (shape.kind === "ref") {
        const target = shape.target;
        if (!this.nodes.has(target)) {
          this.diagnostics.push({
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
        this.nodeToClass.set(node, classId);

        const nominal = this.nominals.get(node);
        if (nominal) {
          if (firstNominal === null) {
            firstNominal = { node, nominal };
            cls.nominal = nominal;
          } else if (firstNominal.nominal !== nominal) {
            // Nominal conflict
            this.diagnostics.push({
              code: "NOMINAL_CONFLICT",
              a: firstNominal.nominal,
              b: nominal,
              proofA: [{ kind: "anchor", node: firstNominal.node, nominal: firstNominal.nominal }],
              proofB: [{ kind: "anchor", node, nominal }],
            });
          }
        }
      }

      this.classes.set(classId, cls);
    }

    // Phase 2: Compute types for each equivalence class
    // We need to process classes in dependency order (leaves first).
    // Use iterative approach: keep processing until no more progress.
    const pendingClasses = new Set(this.classes.keys());
    let madeProgress = true;

    while (madeProgress && pendingClasses.size > 0) {
      madeProgress = false;

      for (const classId of pendingClasses) {
        const cls = this.classes.get(classId)!;
        const type = this.unifyClass(cls);

        if (type !== null && type.kind !== "typevar") {
          // Successfully computed a concrete type
          this.classTypes.set(classId, type);
          pendingClasses.delete(classId);
          madeProgress = true;
        } else if (type !== null) {
          // Got typevar, might resolve later or stay as typevar
          // Check if all dependencies are resolved
          if (this.allDependenciesResolved(cls)) {
            this.classTypes.set(classId, type);
            pendingClasses.delete(classId);
            madeProgress = true;
          }
        }
      }
    }

    // Set remaining classes to typevar
    for (const classId of pendingClasses) {
      if (!this.classTypes.has(classId)) {
        this.classTypes.set(classId, { kind: "typevar" });
      }
    }

    return { ok: this.diagnostics.length === 0, diagnostics: this.diagnostics };
  }

  /**
   * Get the resolved type for a node.
   */
  getType(node: NodeId): JSONType | undefined {
    const classId = this.nodeToClass.get(node);
    if (classId === undefined) return undefined;
    return this.classTypes.get(classId);
  }

  /**
   * Get the equivalence class ID for a node.
   */
  getClassId(node: NodeId): ClassId | undefined {
    return this.nodeToClass.get(node);
  }

  /**
   * Get the canonical nominal for a node's equivalence class.
   */
  getCanonicalNominal(node: NodeId): NominalId | undefined {
    const classId = this.nodeToClass.get(node);
    if (classId === undefined) return undefined;
    return this.classes.get(classId)?.nominal ?? undefined;
  }

  /**
   * Unify all concrete (non-ref) shapes in an equivalence class.
   */
  private unifyClass(cls: Class): JSONType | null {
    const concreteShapes: { node: NodeId; shape: LocalShape }[] = [];

    for (const node of cls.nodes) {
      const shape = this.nodes.get(node);
      if (shape && shape.kind !== "ref") {
        concreteShapes.push({ node, shape });
      }
    }

    if (concreteShapes.length === 0) {
      // No concrete shapes - type is unknown
      return { kind: "typevar" };
    }

    // Convert first shape to type
    let unifiedType = this.shapeToType(concreteShapes[0].shape);

    // Unify with remaining shapes
    for (let i = 1; i < concreteShapes.length; i++) {
      const { node, shape } = concreteShapes[i];
      const otherType = this.shapeToType(shape);
      const result = this.unifyTypes(unifiedType, otherType);

      if (result === null) {
        this.diagnostics.push({
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
  private shapeToType(shape: LocalShape): JSONType {
    switch (shape.kind) {
      case "prim":
        return { kind: "prim", prim: this.inferPrimType(shape.value) };
      case "array": {
        // Look up element node's type
        const elemType = this.getNodeType(shape.elem);
        return { kind: "array", elem: elemType };
      }
      case "object": {
        const fields: Record<string, JSONType> = {};
        for (const [key, fieldNodeId] of Object.entries(shape.fields)) {
          fields[key] = this.getNodeType(fieldNodeId);
        }
        return { kind: "object", fields };
      }
      case "ref":
        // Should not reach here in normal flow (refs are handled via union)
        return { kind: "typevar" };
    }
  }

  /**
   * Get the resolved type for a node, used during shapeToType.
   * Returns typevar if the node's type hasn't been computed yet.
   */
  private getNodeType(nodeId: NodeId): JSONType {
    const classId = this.nodeToClass.get(nodeId);
    if (classId === undefined) {
      return { kind: "typevar" };
    }
    return this.classTypes.get(classId) ?? { kind: "typevar" };
  }

  /**
   * Check if all child node dependencies of a class have resolved types.
   */
  private allDependenciesResolved(cls: Class): boolean {
    for (const nodeId of cls.nodes) {
      const shape = this.nodes.get(nodeId);
      if (!shape) continue;

      if (shape.kind === "object") {
        for (const fieldNodeId of Object.values(shape.fields)) {
          const fieldClassId = this.nodeToClass.get(fieldNodeId);
          if (fieldClassId !== undefined && !this.classTypes.has(fieldClassId)) {
            return false;
          }
        }
      } else if (shape.kind === "array") {
        const elemClassId = this.nodeToClass.get(shape.elem);
        if (elemClassId !== undefined && !this.classTypes.has(elemClassId)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Infer primitive type from a JS value.
   */
  private inferPrimType(value: string | null | boolean | number): "null" | "bool" | "number" | "string" {
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
