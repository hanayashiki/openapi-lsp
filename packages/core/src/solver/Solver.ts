import { UnionFind } from "./union-find.js";
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
  readonly nominals: Map<NodeId, NominalId>;
  readonly incomingNominals: Map<NodeId, NominalId[]>;

  nodeToClass: Map<NodeId, ClassId> = new Map();
  classes: Map<ClassId, Class> = new Map();
  diagnostics: Diagnostic[] = [];

  /** Nodes that are ref targets but not in input.nodes (external dependencies) */
  externalNodes: Set<NodeId> = new Set();

  constructor(input: SolverInput) {
    this.nominals = input.nominals;
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
}
