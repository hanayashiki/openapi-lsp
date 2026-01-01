# OpenAPI 文档自身类型 Solver（Algorithm-only）设计

> 目标：
> 对 **拆分的 OpenAPI JSON/YAML 文档节点** 求解其 **文档自身的结构类型**（JSON shape），
> 支持 `$ref` 等价传播、递归、名义（nominal）命名与冲突处理。
> ❌ 不求解 OpenAPI schema 语义类型（string/object 等 API 含义）
> ❌ 不做增量缓存（由上层处理）

---

## 1. 基本建模

### 1.1 Node

```ts
// `fileUri#jsonPointer`
type NodeId = string;
```

表示文档中的一个 JSON 节点。

---

### 1.2 文档自身类型（JSON Shape）

```ts
type JSONType =
  | { kind: "prim"; prim: "null" | "bool" | "number" | "string" }
  | { kind: "array"; elem: JSONType }
  | {
      kind: "object";
      fields: Record<string, JSONType>;
    }
  | { kind: "typevar"; } // 未推出类型的节点，例如孤立 $ref 环
  | { kind: "nominal"; id: NominalId }; // 仅用于输出/引用层
```

> 说明
>
> * `nominal` **不参与求解**，仅用于命名/导出
> * `required` 在等价语义下必须保持一致，不允许通过 merge 推导 optional

---

### 1.3 名义锚点（Nominal）

```ts
type NominalId = string;
```

* 只是"给某个节点/等价类起名字"
* 多个 nominal 冲突时直接报错

---

### 1.4 局部形状事实（LocalShape）

Solver 的输入是"事实"，其实是 JSON Literal + ref 扩展。

```ts
type LocalShape =
  | { kind: "prim"; value: string | null | bool | number }
  | { kind: "ref"; id: NodeId }
  | { kind: "array"; elems: ValueRef[] }
  | { kind: "object"; fields: Record<string, LocalShape> }
```

说明：

* `ref` 表示 `$ref`，语义是 **完全等价（identity / substitution）**

---

### 1.5 等价类（Equivalence Class）

`$ref` 产生等价关系，所有通过 `$ref` 连接的节点属于同一个等价类。

```ts
type ClassId = number;

type Class = {
  id: ClassId;
  nodes: Set<NodeId>; // 等价类中的所有节点
  nominal: NominalId | null; // 该等价类的 nominal（如果有，最多一个）
};
```

| 字段        | 用途                        |
| --------- | ------------------------- |
| `id`      | 等价类编号，可作为数组索引             |
| `nodes`   | 所有通过 `$ref` 等价的节点         |
| `nominal` | 每个等价类最多一个 nominal，多个则冲突报错 |

---

### 1.6 Solver 内部状态

```ts
type SolverState = {
  nodes: Map<NodeId, LocalShape>; // 所有节点的局部形状
  nodeToClass: Map<NodeId, ClassId>; // 节点 → 等价类 映射
  classes: Map<ClassId, Class>; // 所有等价类
  nominalToClass: Map<NominalId, ClassId>; // nominal → 等价类 映射
};
```

---

## 2. 求解语义核心

### 2.1 等价语义（唯一语义）

* `$ref` 表示 **完全等价（identity）**
* 同一等价类内的节点 **必须具有完全一致的 JSON 结构类型**
* 不存在 subtype、上下界或方向性传播

---

### 2.2 等价类内的一致性检查（unify）

* 忽略所有 `ref` 形状
* 收集所有 **非-ref 的 concrete shapes**
* 规则：

  * 若 concrete shape 数量为 0 → 类型为 `typevar`
  * 若数量为 1 → 类型即该 shape 的结构类型
  * 若数量 ≥ 2 → 必须结构一致，否则报错

**一致性要求：**

* `prim`：必须同一 primitive
* `array`：元素类型（经等价类折叠）必须一致
* `object`：
  * 字段集合必须完全一致
  * `ref` 节点（经等价类折叠）必须一致
  * 宽容节点的顺序
* 任意不兼容情况 → `STRUCT_CONFLICT`

---

### 2.3 等价类的作用

* `$ref` 图可能有递归
* **先构建等价类**，把所有 `$ref` 连接的节点视为同一个语义实体
* 求解只在等价类内部进行
* 等价类之间 **不存在任何类型关系**

---

### 2.4 求解算法（两阶段）

```
solve():
  // Phase 1: 构建等价类（Union-Find）
  for each node A with LocalShape.ref(target=B):
    union(A, B)

  // Phase 2: 对每个等价类做一致性检查
  for each class C:
    shapes = all non-ref LocalShape in C.nodes
    if shapes.size == 0:
      type[C] = unknown
    else:
      type[C] = unify_all(shapes)  // 不一致则报错
```

说明：

* 不存在拓扑排序
* 不存在迭代
* 不存在 subtype 检查

---

## 3. 冲突处理

所有冲突直接报错：

* **Nominal 冲突**：同一等价类内有多个不同 nominal → 报错
* **结构冲突**：等价类内多个 concrete shape 不一致 → 报错
* **缺失目标**：`$ref` 指向不存在节点 → 报错

---

## 4. Solver API（Algorithm-only）

```ts
interface Solver {
  // --- 构建 ---
  addNode(id: NodeId, shape: LocalShape): void;
  setNominalAnchor(node: NodeId, nominal: NominalId): void;

  // --- 求解 ---
  solve(): SolveResult;

  // --- 查询 ---
  getType(node: NodeId): JSONType | undefined;
  getClassId(node: NodeId): ClassId | undefined;
  getCanonicalNominal(node: NodeId): NominalId | undefined;
}
```

---

### 4.1 SolveResult

```ts
type SolveResult = {
  ok: boolean;
  diagnostics: Diagnostic[];
};
```

---

### 4.2 Diagnostic（错误可解释性）

```ts
type Diagnostic =
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
```

```ts
type Reason =
  | { kind: "ref"; from: NodeId; to: NodeId; raw?: string }
  | { kind: "anchor"; node: NodeId; nominal: NominalId }
  | { kind: "shape"; node: NodeId };
```

---

## 5. 设计原则总结

* **求解的是"文档自身类型"，不是 OpenAPI schema 语义**
* `$ref` 是 **完全等价（identity / substitution）**
* 等价类内不做 widening merge，只做一致性检查
* 等价类之间不存在 subtype 或依赖关系
* Nominal 是 **命名/导出层概念**，不参与结构求解
* 冲突直接报错，需可解释（proof path）

---

> 本质是：**等价类（$ref） + 结构一致性检查（unify） + 名义命名层**

