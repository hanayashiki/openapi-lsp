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
 * JSON structural type (output of the solver).
 * Represents the document's own structure, NOT OpenAPI schema semantics.
 */
export type JSONType =
  | { kind: "prim"; prim: "null" | "bool" | "number" | "string" }
  | { kind: "array"; elem: JSONType }
  | { kind: "object"; fields: Record<string, JSONType> }
  | { kind: "typevar" } // Unresolved type (e.g., isolated $ref cycle)
  | { kind: "nominal"; id: NominalId }; // Named type reference

/**
 * Local shape fact (input to the solver).
 * Represents a JSON literal structure with $ref extensions.
 * Note: Composite types (array/object) reference child nodes by NodeId,
 * not nested LocalShape. Each JSON path should have its own node.
 */
export type LocalShape =
  | { kind: "prim"; value: string | null | boolean | number }
  | { kind: "ref"; target: NodeId }
  | { kind: "array"; elem: NodeId }
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
export type Diagnostic =
  | {
      code: "NOMINAL_CONFLICT";
      a: NominalId;
      b: NominalId;
      proofA: Reason[];
      proofB: Reason[];
    }
  | {
      code: "STRUCT_CONFLICT";
      node: NodeId;
      left: JSONType;
      right: JSONType;
    }
  | {
      code: "MISSING_TARGET";
      from: NodeId;
      to: NodeId;
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
  /** Nominal anchors mapping nodes to nominal identifiers */
  nominals: Map<NodeId, NominalId>;
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
   * Get the resolved type for a node.
   * @throws Error if the node was not in the input
   */
  getType(node: NodeId): JSONType;

  /**
   * Get the equivalence class ID for a node.
   * @throws Error if the node was not in the input
   */
  getClassId(node: NodeId): ClassId;

  /**
   * Get the canonical nominal for a node's equivalence class.
   * Returns null if the class has no nominal anchor.
   * @throws Error if the node was not in the input
   */
  getCanonicalNominal(node: NodeId): NominalId | null;
}
