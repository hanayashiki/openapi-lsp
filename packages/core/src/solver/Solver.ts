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
  readonly incomingTypes: Map<NodeId, JSONType[]>;
  readonly incomingNominals: Map<NodeId, NominalId[]>;

  nodeToClass: Map<NodeId, ClassId> = new Map();
  classes: Map<ClassId, Class> = new Map();
  classTypes: Map<ClassId, JSONType> = new Map();
  diagnostics: Diagnostic[] = [];

  /** Nodes that are ref targets but not in input.nodes (external dependencies) */
  externalNodes: Set<NodeId> = new Set();

  constructor(input: SolverInput) {
    this.nodes = input.nodes;
    this.nominals = input.nominals;
    this.incomingTypes = input.incomingTypes ?? new Map();
    this.incomingNominals = input.incomingNominals ?? new Map();
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
  private readonly outgoingTypesMap: Map<NodeId, JSONType>;
  private readonly outgoingNominalsMap: Map<NodeId, NominalId>;

  constructor(
    diagnostics: Diagnostic[],
    nodeToClass: Map<NodeId, ClassId>,
    classes: Map<ClassId, Class>,
    classTypes: Map<ClassId, JSONType>,
    inputNodeIds: Set<NodeId>,
    externalNodes: Set<NodeId>
  ) {
    this.ok = diagnostics.length === 0;
    this.diagnostics = Object.freeze([...diagnostics]);
    this.nodeToClass = nodeToClass;
    this.classes = classes;
    this.classTypes = classTypes;
    this.inputNodeIds = inputNodeIds;

    // Compute outgoing types and nominals from external nodes
    this.outgoingTypesMap = new Map();
    this.outgoingNominalsMap = new Map();
    for (const extNode of externalNodes) {
      const classId = nodeToClass.get(extNode);
      if (classId !== undefined) {
        const type = classTypes.get(classId) ?? { kind: "typevar" };
        this.outgoingTypesMap.set(extNode, type);

        const cls = classes.get(classId);
        if (cls?.nominal) {
          this.outgoingNominalsMap.set(extNode, cls.nominal);
        }
      }
    }
  }

  getType(node: NodeId): JSONType {
    this.assertNodeExists(node);
    const classId = this.nodeToClass.get(node);
    if (classId === undefined) {
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

  getOutgoingTypes(): Map<NodeId, JSONType> {
    return new Map(this.outgoingTypesMap);
  }

  getOutgoingNominals(): Map<NodeId, NominalId> {
    return new Map(this.outgoingNominalsMap);
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
      new Set(input.nodes.keys()),
      ctx.externalNodes
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
          // External ref - track it and add to Union-Find
          ctx.externalNodes.add(target);
          uf.makeSet(target);
        }
        // Always union (whether target is local or external)
        uf.union(nodeId, target);
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
      // Collect all nominals from both local (ctx.nominals) and incoming (ctx.incomingNominals)
      let firstNominal: { node: NodeId; nominal: NominalId } | null = null;

      const tryAssignNominal = (node: NodeId, nominal: NominalId) => {
        if (firstNominal === null) {
          firstNominal = { node, nominal };
          cls.nominal = nominal;
        } else if (firstNominal.nominal !== nominal) {
          ctx.diagnostics.push({
            code: "NOMINAL_CONFLICT",
            a: firstNominal.nominal,
            b: nominal,
            proofA: [
              {
                kind: "anchor",
                node: firstNominal.node,
                nominal: firstNominal.nominal,
              },
            ],
            proofB: [{ kind: "anchor", node, nominal }],
          });
        }
      };

      for (const node of nodeSet) {
        ctx.nodeToClass.set(node, classId);

        // Check local nominals
        const localNominal = ctx.nominals.get(node);
        if (localNominal) {
          tryAssignNominal(node, localNominal);
        }

        // Check incoming nominals from upstream SCCs
        const incomingNominals = ctx.incomingNominals.get(node);
        if (incomingNominals) {
          for (const nominal of incomingNominals) {
            tryAssignNominal(node, nominal);
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

        // Check if all dependencies are resolved first
        if (!this.allDependenciesResolved(ctx, cls)) {
          continue;
        }

        const type = this.unifyClass(ctx, cls);
        if (type !== null) {
          ctx.classTypes.set(classId, type);
          pendingClasses.delete(classId);
          madeProgress = true;
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
    // Collect all incoming types for nodes in this class
    const incomingTypesForClass = [...cls.nodes].flatMap((node) =>
      (ctx.incomingTypes.get(node) ?? []).map((type) => ({ node, type }))
    );

    // Collect all concrete shapes from local nodes
    const concreteShapes = [...cls.nodes]
      .filter((node) => !ctx.externalNodes.has(node))
      .map((node) => ({ node, shape: ctx.nodes.get(node) }))
      .filter(
        (entry): entry is { node: NodeId; shape: LocalShape } =>
          entry.shape !== undefined && entry.shape.kind !== "ref"
      );

    // Start with typevar
    let unifiedType: JSONType = { kind: "typevar" };

    // Unify all incoming types
    for (const { node, type } of incomingTypesForClass) {
      const result = this.unifyTypes(unifiedType, type);
      if (result === null) {
        ctx.diagnostics.push({
          code: "STRUCT_CONFLICT",
          node,
          left: unifiedType,
          right: type,
        });
        return null;
      }
      unifiedType = result;
    }

    // Unify with concrete shapes
    for (const { node, shape } of concreteShapes) {
      const shapeType = this.shapeToType(ctx, shape);
      const result = this.unifyTypes(unifiedType, shapeType);
      if (result === null) {
        ctx.diagnostics.push({
          code: "STRUCT_CONFLICT",
          node,
          left: unifiedType,
          right: shapeType,
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
        // Array fields are indexed by stringified integers
        // For JSONType, we unify all elements into a single elem type
        const elemTypes = Object.values(shape.fields).map((nodeId) =>
          this.getNodeType(ctx, nodeId)
        );
        // Unify all element types (for now, just take first or typevar)
        const elem = elemTypes.length > 0 ? elemTypes[0] : { kind: "typevar" as const };
        return { kind: "array", elem };
      }
      case "object": {
        const fields: Record<string, JSONType> = {};
        for (const [key, fieldNodeId] of Object.entries(shape.fields)) {
          fields[key] = this.getNodeType(ctx, fieldNodeId);
        }
        return { kind: "object", fields };
      }
      case "ref":
        return { kind: "typevar" };
    }
  }

  /**
   * Get the type for a node during computation.
   */
  private getNodeType(ctx: SolveContext, nodeId: NodeId): JSONType {
    const classId = ctx.nodeToClass.get(nodeId);
    if (classId === undefined) {
      return { kind: "typevar" };
    }
    return ctx.classTypes.get(classId) ?? { kind: "typevar" };
  }

  /**
   * Check if all child node dependencies of a class have resolved types.
   */
  private allDependenciesResolved(ctx: SolveContext, cls: Class): boolean {
    const dependencyNodeIds = [...cls.nodes]
      .map((nodeId) => ctx.nodes.get(nodeId))
      .filter((shape): shape is LocalShape => shape !== undefined)
      .flatMap((shape) => {
        if (shape.kind === "object" || shape.kind === "array") {
          return Object.values(shape.fields);
        }
        return [];
      });

    return dependencyNodeIds.every((nodeId) => {
      const classId = ctx.nodeToClass.get(nodeId);
      return classId === undefined || ctx.classTypes.has(classId);
    });
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
    }
  }
}
