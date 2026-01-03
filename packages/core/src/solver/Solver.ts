import { UnionFind } from "./union-find.js";
import { md5 } from "js-md5";
import type {
  NodeId,
  NominalId,
  ClassId,
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
  readonly nominals: Map<NodeId, NominalId[]>;

  nodeToClass: Map<NodeId, ClassId> = new Map();
  classes: Map<ClassId, Class> = new Map();
  diagnostics: Diagnostic[] = [];

  /** Nodes that are ref targets but not in input.nodes (external dependencies) */
  externalNodes: Set<NodeId> = new Set();

  constructor(input: SolverInput) {
    this.nominals = input.nominals;
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
  private readonly inputNodeIds: Set<NodeId>;
  private readonly outgoingNominalsMap: Map<NodeId, NominalId>;

  constructor(
    diagnostics: Diagnostic[],
    nodeToClass: Map<NodeId, ClassId>,
    classes: Map<ClassId, Class>,
    inputNodeIds: Set<NodeId>,
    externalNodes: Set<NodeId>
  ) {
    this.ok = diagnostics.length === 0;
    this.diagnostics = Object.freeze([...diagnostics]);
    this.nodeToClass = nodeToClass;
    this.classes = classes;
    this.inputNodeIds = inputNodeIds;

    // Compute outgoing nominals from external nodes
    this.outgoingNominalsMap = new Map();
    for (const extNode of externalNodes) {
      const classId = nodeToClass.get(extNode);
      if (classId !== undefined) {
        const cls = classes.get(classId);
        if (cls?.nominal) {
          this.outgoingNominalsMap.set(extNode, cls.nominal);
        }
      }
    }
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

  getValueNodeId(node: NodeId): NodeId | null {
    this.assertNodeExists(node);
    const classId = this.nodeToClass.get(node);
    if (classId === undefined) return null;
    return this.classes.get(classId)?.valueNode ?? null;
  }

  getOutgoingNominals(): Map<NodeId, NominalId> {
    return new Map(this.outgoingNominalsMap);
  }

  getHash(): string {
    // Hash based on nodeId → nominal mapping (what downstream consumers need)
    const hash = md5.create();

    // Build nodeId → nominal map from nodeToClass → classes
    const nodeNominals: [NodeId, NominalId | null][] = [];
    for (const [nodeId, classId] of this.nodeToClass) {
      const cls = this.classes.get(classId);
      nodeNominals.push([nodeId, cls?.nominal ?? null]);
    }

    // Sort for deterministic hashing
    nodeNominals.sort(([a], [b]) => a.localeCompare(b));

    for (const [nodeId, nominal] of nodeNominals) {
      hash.update(nodeId);
      hash.update("\0");
      hash.update(nominal ?? "");
      hash.update("\n");
    }
    return hash.hex();
  }

  private assertNodeExists(node: NodeId): void {
    if (!this.inputNodeIds.has(node)) {
      throw new Error(`Node "${node}" was not in the solver input`);
    }
  }
}

/**
 * Stateless solver for OpenAPI document structure.
 *
 * The solver builds equivalence classes from $ref connections and
 * propagates nominal type anchors through those classes.
 *
 * Usage:
 * const solver = new Solver();
 * const result = solver.solve({
 *   nodes: new Map([...]),
 *   nominals: new Map([...])
 * });
 * const nominal = result.getCanonicalNominal("file#/a");
 */
export class Solver {
  /**
   * Solve: build equivalence classes and assign nominals.
   * @param input All nodes and nominal anchors
   * @returns SolveResult with query methods for accessing computed data
   */
  solve(input: SolverInput): SolveResult {
    const ctx = new SolveContext(input);

    this.buildEquivalenceClasses(ctx, input.nodes);

    return new SolveResultImpl(
      ctx.diagnostics,
      ctx.nodeToClass,
      ctx.classes,
      new Set(input.nodes.keys()),
      ctx.externalNodes
    );
  }

  /**
   * Build equivalence classes using Union-Find and assign nominals.
   */
  private buildEquivalenceClasses(
    ctx: SolveContext,
    nodes: Map<NodeId, { kind: string; target?: NodeId }>
  ): void {
    const uf = new UnionFind<NodeId>();

    // Initialize all nodes
    for (const nodeId of nodes.keys()) {
      uf.makeSet(nodeId);
    }

    // Union nodes whose shape is a $ref with their target
    for (const [nodeId, shape] of nodes) {
      if (shape.kind === "ref" && shape.target) {
        const target = shape.target;
        if (!nodes.has(target)) {
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
        valueNode: null,
      };

      // Check for nominal conflicts and assign nominal
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

        // Find the value node (non-ref node) in this class
        // There can be at most one since refs form a forest pointing to a single value
        const shape = nodes.get(node);
        if (shape && shape.kind !== "ref") {
          if (cls.valueNode !== null) {
            throw new Error(
              `Invariant violation: equivalence class ${classId} has multiple value nodes: "${cls.valueNode}" and "${node}"`
            );
          }
          cls.valueNode = node;
        }

        // Check all nominals (unified from local tags, refs, and upstream SCCs)
        const nominals = ctx.nominals.get(node);
        if (nominals) {
          for (const nominal of nominals) {
            tryAssignNominal(node, nominal);
          }
        }
      }

      ctx.classes.set(classId, cls);
    }
  }
}
