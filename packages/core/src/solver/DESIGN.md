# OpenAPI Document Structure Type Solver

> **Goal:**
> Solve the **document's own structural types** (JSON shape) for split OpenAPI JSON/YAML document nodes.
> Supports `$ref` equivalence propagation, recursion, nominal naming, and conflict detection.
> - Does NOT solve OpenAPI schema semantic types (string/object API meanings)
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

### 1.2 Document Structure Type (JSON Shape)

```ts
type JSONType =
  | { kind: "prim"; prim: "null" | "bool" | "number" | "string" }
  | { kind: "array"; elem: JSONType }
  | { kind: "object"; fields: Record<string, JSONType> }
  | { kind: "typevar" };  // Unresolved type (e.g., isolated $ref cycle)
```

> Note: `typevar` represents unresolved types in cyclic references.
> Nominals are tracked separately via the `nominals` map, not as a JSONType variant.

---

### 1.3 Local Shape (Solver Input)

The solver's input consists of "facts" - JSON literals with $ref extensions.
Each JSON path has its own node; composite types reference children by NodeId.

```ts
type LocalShape =
  | { kind: "prim"; value: string | null | boolean | number }
  | { kind: "ref"; target: NodeId }
  | { kind: "array"; fields: Record<string, NodeId> }   // keys are stringified indices
  | { kind: "object"; fields: Record<string, NodeId> }; // keys are field names
```

> Notes:
> - `ref` represents `$ref` with **identity/substitution semantics**
> - Arrays and objects both use `fields: Record<string, NodeId>` - the `kind` tag differentiates them

---

### 1.4 Equivalence Class

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

The solver operates in two phases:

### Phase 1: Build Equivalence Classes

```
buildEquivalenceClasses():
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

  // Extract components and assign class IDs
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

### Phase 2: Compute Types

```
computeTypes():
  pendingClasses = all class IDs

  // Iterative processing (leaves first)
  while pendingClasses is not empty and making progress:
    for each classId in pendingClasses:
      if all dependencies resolved:
        type = unifyClass(classId)
        if type is not null:
          classTypes.set(classId, type)
          pendingClasses.remove(classId)

  // Remaining classes get typevar (cycles)
  for each classId in pendingClasses:
    classTypes.set(classId, { kind: "typevar" })

unifyClass(class):
  // Collect incoming types and concrete shapes
  unifiedType = { kind: "typevar" }

  for each incoming type:
    unifiedType = unify(unifiedType, type)
    if unifiedType is null:
      emit STRUCT_CONFLICT diagnostic
      return null

  for each non-ref shape in class:
    shapeType = shapeToType(shape)
    unifiedType = unify(unifiedType, shapeType)
    if unifiedType is null:
      emit STRUCT_CONFLICT diagnostic
      return null

  return unifiedType
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
│ outgoingTypes    │     │ incomingTypes    │     │ incomingTypes    │
│ outgoingNominals │     │ incomingNominals │     │ incomingNominals │
│                  │     │ outgoingTypes    │     │                  │
│                  │     │ outgoingNominals │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 5. API Reference

### 5.1 Solver

```ts
class Solver {
  /**
   * Solve the type system: build equivalence classes and unify types.
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

  /** Pre-resolved types from upstream SCCs (optional) */
  incomingTypes?: Map<NodeId, JSONType[]>;

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

  /** Get the resolved type for a node */
  getType(node: NodeId): JSONType;

  /** Get the equivalence class ID for a node */
  getClassId(node: NodeId): ClassId;

  /** Get the canonical nominal for a node's equivalence class */
  getCanonicalNominal(node: NodeId): NominalId | null;

  /** Get types for external refs (for downstream SCCs) */
  getOutgoingTypes(): Map<NodeId, JSONType>;

  /** Get nominals for external refs (for downstream SCCs) */
  getOutgoingNominals(): Map<NodeId, NominalId>;
}
```

---

## 6. Diagnostics

```ts
type Diagnostic =
  | {
      code: "NOMINAL_CONFLICT";
      a: NominalId;
      b: NominalId;
      proofA: Reason[];  // Path showing how 'a' was assigned
      proofB: Reason[];  // Path showing how 'b' was assigned
    }
  | {
      code: "STRUCT_CONFLICT";
      node: NodeId;
      left: JSONType;   // First type
      right: JSONType;  // Conflicting type
    };

type Reason =
  | { kind: "ref"; from: NodeId; to: NodeId; raw?: string }
  | { kind: "anchor"; node: NodeId; nominal: NominalId }
  | { kind: "shape"; node: NodeId };
```

---

## 7. Design Principles

1. **Document structure types, not OpenAPI schema semantics** - We solve what the JSON looks like, not what it means
2. **`$ref` is identity/substitution** - Nodes connected by `$ref` are equivalent
3. **No widening or merging** - Equivalence class members must be structurally identical
4. **No subtyping between classes** - Each class is independent
5. **Nominals are naming layer only** - They don't participate in structural solving
6. **Conflicts are errors** - No silent resolution, always report with proof paths
7. **Stateless solver** - All input provided upfront, enables incremental caching at upper layer

---

> **Essence:** Equivalence classes (`$ref`) + Structural consistency (unify) + Nominal naming layer + SCC-based incremental analysis
