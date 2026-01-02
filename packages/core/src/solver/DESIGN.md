# OpenAPI Document Structure Solver

> **Goal:**
> Build equivalence classes from `$ref` connections and propagate nominal type anchors.
> - Does NOT compute structural types (JSON shapes) - that's handled by schema validation
> - Does NOT handle incremental caching (handled by upper layers)
> - Supports incremental analysis via SCC (Strongly Connected Components) ordering

---

## 1. Core Types

### 1.1 Node

```ts
// `fileUri#jsonPointer`
type NodeId = string;
```

Represents a JSON node in the document. Examples:
- `file:///workspace/openapi.yaml#/components/schemas/Pet`
- `file:///workspace/schemas/User.yaml#/properties/name`

---

### 1.2 Local Shape (Solver Input)

The solver's input consists of "facts" - JSON literals with $ref extensions.
Only the `kind` and `target` fields are used by the solver.

```ts
type LocalShape =
  | { kind: "prim"; value: string | null | boolean | number }
  | { kind: "ref"; target: NodeId }
  | { kind: "array"; fields: Record<string, NodeId> }
  | { kind: "object"; fields: Record<string, NodeId> };
```

> Note: `ref` represents `$ref` with **identity/substitution semantics**

---

### 1.3 Equivalence Class

`$ref` creates equivalence relations. All nodes connected via `$ref` belong to the same class.

```ts
type ClassId = number;

type Class = {
  id: ClassId;
  nodes: Set<NodeId>;       // All nodes in this equivalence class
  nominal: NominalId | null; // At most one nominal per class
};
```

---

## 2. Nominals

### 2.1 What are Nominals?

```ts
type NominalId = string;  // e.g., "Schema", "Response", "Parameter"
```

Nominals are **named type anchors** that identify the semantic role of a node within the OpenAPI structure. They answer the question: "What kind of OpenAPI component is this node?"

Examples:
- A node at `#/components/schemas/Pet` gets nominal `"Schema"`
- A node at `#/components/responses/Error` gets nominal `"Response"`
- A node at `#/paths/~1users/get/parameters/0` gets nominal `"Parameter"`

### 2.2 Why Nominals Matter

**Problem:** External YAML files don't know their semantic context.

Consider this structure:
```yaml
# openapi.yaml
components:
  schemas:
    Pet:
      $ref: "./schemas/Pet.yaml"  # External file

# schemas/Pet.yaml
type: object
properties:
  name: { type: string }
```

The file `Pet.yaml` has no idea it's being used as a Schema. It could equally be a Response or RequestBody. Nominals solve this by propagating the semantic context.

### 2.3 Nominal Propagation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  openapi.yaml (SCC 1)                                       │
│    components/schemas/Pet → nominal: "Schema"               │
│    $ref: "./schemas/Pet.yaml"                               │
│                         ↓                                   │
│              outgoingNominals: { Pet.yaml → "Schema" }      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Pet.yaml (SCC 2)                                           │
│    incomingNominals: { Pet.yaml → ["Schema"] }              │
│                         ↓                                   │
│    Root node receives nominal "Schema"                      │
│    Structural propagation → nested nodes also get "Schema"  │
└─────────────────────────────────────────────────────────────┘
```

1. **Assignment:** OpenAPI document assigns nominals based on structural position
2. **Export:** Solver exports nominals for external refs via `getOutgoingNominals()`
3. **Import:** Downstream SCCs receive these as `incomingNominals`
4. **Propagation:** Component files propagate nominals through their structure

### 2.4 Nominal Conflicts

The same equivalence class cannot have multiple different nominals.

```yaml
# Conflict example:
components:
  schemas:
    Pet:
      $ref: "#/components/responses/Pet"  # Same target...
  responses:
    Pet:
      description: "A pet"  # ...but different nominals!
```

This produces a `NOMINAL_CONFLICT` diagnostic because `Pet` cannot be both a "Schema" and a "Response".

---

## 3. Solver Algorithm

The solver operates in a single phase:

### Build Equivalence Classes and Assign Nominals

```
solve(input):
  uf = new UnionFind()

  // Initialize all input nodes
  for each node in input.nodes:
    uf.makeSet(node)

  // Union $ref nodes with their targets
  for each (node, shape) in input.nodes:
    if shape.kind == "ref":
      target = shape.target
      if target not in input.nodes:
        externalNodes.add(target)  // Track external dependency
        uf.makeSet(target)
      uf.union(node, target)

  // Extract components and assign class IDs + nominals
  for each component in uf.getComponents():
    classId = nextId++
    class = { id: classId, nodes: component, nominal: null }

    // Assign nominals from both local and incoming, detect conflicts
    for each node in component:
      // Check local nominals (from input.nominals)
      if node has local nominal:
        tryAssignNominal(class, node, nominal)

      // Check incoming nominals (from upstream SCCs)
      for each incoming nominal for node:
        tryAssignNominal(class, node, nominal)

  tryAssignNominal(class, node, nominal):
    if class.nominal is null:
      class.nominal = nominal
    else if class.nominal != nominal:
      emit NOMINAL_CONFLICT diagnostic
```

---

## 4. SCC Integration

Documents form a dependency graph via `$ref`. The upper layer uses Kosaraju's algorithm to compute Strongly Connected Components (SCCs), which are then analyzed in topological order.

### Why SCCs?

- Circular references within an SCC are handled together
- Linear dependencies between SCCs enable incremental analysis
- Each SCC is solved independently with inputs from upstream SCCs

### Data Flow Between SCCs

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   SCC 1 (root)   │────▶│   SCC 2 (middle) │────▶│   SCC 3 (leaf)   │
│                  │     │                  │     │                  │
│ outgoingNominals │     │ incomingNominals │     │ incomingNominals │
│                  │     │ outgoingNominals │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 5. API Reference

### 5.1 Solver

```ts
class Solver {
  /**
   * Build equivalence classes and assign nominals.
   * Stateless - all input provided upfront, all output via SolveResult.
   */
  solve(input: SolverInput): SolveResult;
}
```

### 5.2 SolverInput

```ts
type SolverInput = {
  /** All nodes with their local shapes */
  nodes: Map<NodeId, LocalShape>;

  /** Nominal anchors mapping nodes to nominal identifiers */
  nominals: Map<NodeId, NominalId>;

  /** Pre-resolved nominals from upstream SCCs (optional) */
  incomingNominals?: Map<NodeId, NominalId[]>;
};
```

### 5.3 SolveResult

```ts
interface SolveResult {
  /** Whether solving completed without errors */
  readonly ok: boolean;

  /** All diagnostics produced during solving */
  readonly diagnostics: readonly Diagnostic[];

  /** Get the equivalence class ID for a node */
  getClassId(node: NodeId): ClassId;

  /** Get the canonical nominal for a node's equivalence class */
  getCanonicalNominal(node: NodeId): NominalId | null;

  /** Get nominals for external refs (for downstream SCCs) */
  getOutgoingNominals(): Map<NodeId, NominalId>;
}
```

---

## 6. Diagnostics

```ts
type Diagnostic = {
  code: "NOMINAL_CONFLICT";
  a: NominalId;
  b: NominalId;
  proofA: Reason[];  // Path showing how 'a' was assigned
  proofB: Reason[];  // Path showing how 'b' was assigned
};

type Reason =
  | { kind: "ref"; from: NodeId; to: NodeId; raw?: string }
  | { kind: "anchor"; node: NodeId; nominal: NominalId }
  | { kind: "shape"; node: NodeId };
```

---

## 7. Design Principles

1. **`$ref` is identity/substitution** - Nodes connected by `$ref` are equivalent
2. **Nominals propagate through equivalence** - All nodes in a class share the same nominal
3. **Conflicts are errors** - No silent resolution, always report with proof paths
4. **Stateless solver** - All input provided upfront, enables incremental caching at upper layer
5. **No structural type checking** - Schema validation is handled separately

---

> **Essence:** Equivalence classes (`$ref`) + Nominal propagation + SCC-based incremental analysis
