import { matrix, math } from "mathjs";

class Graph {
  nodes: Set<Node>;
  edges: Set<Edge>;
  neighbors: Record<number, Edge[]>;

  constructor() {
    this.nodes = new Set();
    this.edges = new Set();
    this.neighbors = {};
  }

  addNode(n: Node) {
    if (this.neighbors[n.id] === undefined) {
      this.neighbors[n.id] = [];
      this.nodes.add(n);
    } else {
      throw new Error(`Node with ID ${n.id} already exists.`);
    }
  }

  addEdge(e: Edge) {
    if (this.neighbors[e.from.id] === undefined) {
      throw new Error(`Cannot add an edge from nonexistent node ${e.from.id}.`);
    }
    if (this.neighbors[e.to.id] === undefined) {
      throw new Error(`Cannot add an edge to nonexistent node ${e.to.id}.`);
    }
    for (let neighbor of this.neighbors[e.from.id]) {
      if (neighbor.to.id === e.to.id) {
        throw new Error(`Edge ${e.from.id} -> ${e.to.id} already exists.`);
      }
    }
    for (let neighbor of this.neighbors[e.to.id]) {
      if (neighbor.to.id === e.from.id) {
        throw new Error(`Edge ${e.from.id} -> ${e.to.id} already exists.`);
      }
    }
    this.edges.add(e);
    this.neighbors[e.to.id].push(e);
    this.neighbors[e.from.id].push(e);
  }
}

class PackingGraph extends Graph {
  scaleFactor: number;

  constructor() {
    super();
    this.scaleFactor = 0;
  }

  rescale() {
    // TODO: compute optimal scale factor.
  }
}

class TreeGraph extends Graph {
  shortestPath(from: TreeNode, to: TreeNode) {}

  pack(): PackingGraph {
    // TODO:
    // Build shortest-path distance matrix l_{ij}.
  }
}

interface Node {
  id: string;
  [key: string]: any;
}

interface Edge {
  to: Node;
  from: Node;
  [key: string]: any;
}

class TreeNode implements Node {
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }
}

class TreeEdge implements Edge {
  readonly to: TreeNode;
  readonly from: TreeNode;
  readonly length: number;

  constructor(to: TreeNode, from: TreeNode, length: number) {
    this.to = to;
    this.from = from;
    this.length = length;
  }
}

class PackingEdge implements Edge {
  readonly to: PackingNode;
  readonly from: PackingNode;
  constructor(to: PackingNode, from: PackingNode) {
    this.to = to;
    this.from = from;
  }
}

class PackingNode implements Node {
  readonly id: string;
  readonly x: number;
  readonly y: number;

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
  }
}

class CreasesEdge extends PackingEdge {}
class CreasesNode extends PackingNode {}
class CreasesGraph extends PackingGraph {}

export function testOpt() {
  // TODO: hardcode augmented Lagrangian and derivative, using clipping for inequality constraints.
  const augLag = function(x: matrix, lambda: matrix, mu: number) {
    const n = (math.size(x) - 1) / 2;
    const obj = -x[math.size(x) - 1];
  };
}

// TODO: optimization stuff.
export {
  CreasesGraph,
  CreasesNode,
  CreasesEdge,
  PackingGraph,
  PackingNode,
  PackingEdge,
};
