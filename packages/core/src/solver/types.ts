/**
 * Solver type definitions for OpenAPI document structure resolution.
 * Based on DESIGN.md specification.
 */

/** Unique identifier for a JSON document node: `fileUri#jsonPointer` */
export type NodeId = string;

/** Nominal type identifier for named type anchors */
export type NominalId = string;

/** Equivalence class identifier */
export type ClassId = number;

/**
 * Local shape fact (input to the solver).
 * Represents a JSON literal structure with $ref extensions.
 * Note: Composite types (array/object) reference child nodes by NodeId,
 * not nested LocalShape. Each JSON path should have its own node.
 *
 * Arrays and objects both use `fields: Record<string, NodeId>` - arrays
 * use stringified indices as keys. The `kind` tag differentiates them
 * so they can't unify together.
 */
export type LocalShape =
  | { kind: "prim"; value: string | null | boolean | number }
  | { kind: "ref"; target: NodeId }
  | { kind: "array"; fields: Record<string, NodeId> }
  | { kind: "object"; fields: Record<string, NodeId> };

/**
 * Equivalence class: nodes connected via $ref.
 */
export type Class = {
  id: ClassId;
  nodes: Set<NodeId>;
  nominal: NominalId | null;
};

/**
 * Diagnostic errors from the solver.
 */
export type Diagnostic = {
  code: "NOMINAL_CONFLICT";
  a: NominalId;
  b: NominalId;
  proofA: Reason[];
  proofB: Reason[];
};

/**
 * Reason for diagnostic proof paths.
 */
export type Reason =
  | { kind: "ref"; from: NodeId; to: NodeId; raw?: string }
  | { kind: "anchor"; node: NodeId; nominal: NominalId }
  | { kind: "shape"; node: NodeId };

/**
 * Input to the solver - contains all nodes and nominal anchors.
 */
export type SolverInput = {
  /** All nodes with their local shapes */
  nodes: Map<NodeId, LocalShape>;
  /**
   * All nominal anchors mapping nodes to nominal identifiers.
   * Multiple nominals per node are supported (from different sources like
   * local tags, reference targets, or upstream SCCs).
   * Conflicts within an equivalence class produce NOMINAL_CONFLICT diagnostic.
   */
  nominals: Map<NodeId, NominalId[]>;
};

/**
 * Result of the solve() operation with query methods.
 */
export interface SolveResult {
  /** Whether solving completed without errors */
  readonly ok: boolean;

  /** All diagnostics produced during solving */
  readonly diagnostics: readonly Diagnostic[];

  /**
   * Get the equivalence class ID for a node.
   * @internal For testing purposes only
   * @throws Error if the node was not in the input
   */
  getClassId(node: NodeId): ClassId;

  /**
   * Get the canonical nominal for a node's equivalence class.
   * Returns null if the class has no nominal anchor.
   * @throws Error if the node was not in the input
   */
  getCanonicalNominal(node: NodeId): NominalId | null;

  /**
   * Get nominals for external refs (nodes referenced but not in input).
   * These are the nominals this SCC expects from referenced SCCs.
   */
  getOutgoingNominals(): Map<NodeId, NominalId>;

  /**
   * Get a hash representing the solve result for cache invalidation.
   */
  getHash(): string;
}
