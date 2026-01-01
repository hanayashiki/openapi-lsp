/**
 * Union-Find (Disjoint Set Union) data structure with path compression and union by rank.
 */
export class UnionFind<T> {
  private parent: Map<T, T> = new Map();
  private rank: Map<T, number> = new Map();

  /**
   * Create a new set containing only element x.
   * If x already exists, this is a no-op.
   */
  makeSet(x: T): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  /**
   * Find the representative (root) of the set containing x.
   * Uses path compression for efficiency.
   */
  find(x: T): T {
    const p = this.parent.get(x);
    if (p === undefined) {
      // Auto-create set if not exists
      this.makeSet(x);
      return x;
    }
    if (p !== x) {
      // Path compression: point directly to root
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  /**
   * Union the sets containing x and y.
   * Uses union by rank for balanced trees.
   */
  union(x: T, y: T): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;

    // Attach smaller tree under larger tree
    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  /**
   * Check if x and y are in the same set.
   */
  connected(x: T, y: T): boolean {
    return this.find(x) === this.find(y);
  }

  /**
   * Get all components as a map from representative to set of elements.
   */
  getComponents(): Map<T, Set<T>> {
    const components = new Map<T, Set<T>>();

    for (const x of this.parent.keys()) {
      const root = this.find(x);
      let set = components.get(root);
      if (!set) {
        set = new Set();
        components.set(root, set);
      }
      set.add(x);
    }

    return components;
  }
}
