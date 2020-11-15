import { matrix, math } from "mathjs";

class Node {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  edges: Edge[];
  [key: string]: any;

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.edges = [];
  }
}

class Edge {
  readonly to: Node;
  readonly from: Node;
  [key: string]: any;
  
  constructor(to: Node, from: Node) {
    this.to = to;
    this.from = from;
  }
  
  getOtherNode(n : Node) {
    if (n == this.to) {
      return this.from;
    } else if (n == this.from) {
      return this.to;
    }
    else {
      throw new Error("Node not in edge.");
    }
  }
}

class Face {
  readonly isOuterFace : boolean;
  nodes : Node[]
  edges : Edge[]
  [key: string]: any;
  
  constructor(isOuterFace : boolean) {
    this.isOuterFace = isOuterFace;
    this.nodes = [];
    this.edges = [];
  }
}

class TreeNode extends Node {}

class TreeEdge extends Edge {
  readonly length: number;

  constructor(to: TreeNode, from: TreeNode, length: number) {
    super(to, from);
    this.length = length;
  }
}

class PackingNode extends Node {}

class Packing {
  scaleFactor: number;
  nodes: Map<string, PackingNode>;

  constructor() {
    this.scaleFactor = 0;
    this.nodes = new Map();
  }

  rescale() {
    // TODO(Parker): compute optimal scale factor.
  }
}

class CreasesNode extends PackingNode {
  faces : Face[];
  
  constructor(id: string, x: number, y: number) {
    super(id, x, y);
    this.faces = [];
  }
}

enum CreaseType {
  Axial,
  Gusset,
  Ridge,
  Hinge,
  Pseudohinge,
  Boundary
}

enum MVAssignment {
  Mountain,
  Valley,
  Tristate,
  Unknown,
  Boundary
}

class Crease extends Edge {
  leftFace: Face | null;
  rightFace: Face | null;
  creaseType : CreaseType;
  assignment : MVAssignment;
  
  constructor(to: CreasesNode, from: CreasesNode, creaseType : CreaseType) {
    super(to, from);
    this.leftFace = null;
    this.rightFace = null;
    this.creaseType = creaseType;
    if (creaseType == CreaseType.Boundary) {
      this.assignment = MVAssignment.Boundary
    } else if (creaseType == CreaseType.Gusset) {
      this.assignment = MVAssignment.Valley
    } else if (creaseType == CreaseType.Ridge || creaseType == CreaseType.Pseudohinge) {
      this.assignment = MVAssignment.Mountain
    } else if (creaseType == CreaseType.Hinge) {
      this.assignment = MVAssignment.Tristate
    } else {
      this.assignment = MVAssignment.Unknown
    }
  }
}

class Graph {
  nodes: Map<string, Node>;
  edges: Set<Edge>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Set();
  }

  addNode(n: Node) {
    if (this.nodes.has(n.id)) {
      throw new Error(`Node with ID ${n.id} already exists.`);
    } else {
      this.nodes.set(n.id, n);
    }
  }

  addEdge(to : Node, from : Node) {
    const e = new Edge(to, from);
    if (!this.nodes.has(e.from.id)) {
      throw new Error(`Cannot add an edge from nonexistent node ${e.from.id}.`);
    }
    if (!this.nodes.has(e.to.id)) {
      throw new Error(`Cannot add an edge to nonexistent node ${e.to.id}.`);
    }
    const fromAngle = Math.atan2(e.to.y - e.from.y, e.to.x - e.from.x);
    const toAngle = Math.atan2(e.from.y - e.to.y, e.from.x - e.to.x);
    var i = e.from.edges.length - 1;
    for (; i >= 0; i--) {
      const otherEdge = e.from.edges[i]
      const otherNode = otherEdge.getOtherNode(e.from);
      const otherEdgeAngle = Math.atan2(otherNode.y - e.from.y, otherNode.x - e.from.x);
      const angleDifference = fromAngle - otherEdgeAngle;
      if (Math.abs(angleDifference) < 0.000001) {
        throw new Error(`Tried to add edge parallel to existing incident edge.`);
      } else if (angleDifference > 0) {
        break;
      }
      e.from.edges[i + 1] = otherEdge;
    }
    e.from.edges[i + 1] = e;
    i = e.to.edges.length - 1;
    for (; i >= 0; i--) {
      const otherEdge = e.to.edges[i]
      const otherNode = otherEdge.getOtherNode(e.to);
      const otherEdgeAngle = Math.atan2(otherNode.y - e.to.y, otherNode.x - e.to.x);
      const angleDifference = toAngle - otherEdgeAngle;
      if (Math.abs(angleDifference) < 0.000001) {
        throw new Error(`Tried to add edge parallel to existing incident edge.`);
      } else if (angleDifference > 0) {
        break;
      }
      e.to.edges[i + 1] = otherEdge;
    }
    e.to.edges[i + 1] = e;
    this.edges.add(e);
    return e;
  }
}

class TreeGraph extends Graph {
  shortestPath(from: TreeNode, to: TreeNode) {}

  pack(): Packing{
    // TODO(Parker)
    // Build shortest-path distance matrix l_{ij}.
    throw new Error("Function pack() not yet implemented.");
  }
}

enum CreasesGraphState {
  NewlyCreated,
  PreUMA,
  PostUMA,
  FullyAssigned
}

class CreasesGraph extends Graph {
  state : CreasesGraphState;
  
  constructor() {
    super();
    this.state = CreasesGraphState.NewlyCreated;
  }
}

export function testOpt() {
  // TODO(Parker) hardcode augmented Lagrangian and derivative, using clipping for inequality constraints.
  const augLag = function(x: matrix, lambda: matrix, mu: number) {
    const n = (math.size(x) - 1) / 2;
    const obj = -x[math.size(x) - 1];
  };
}

// TODO(Parker) optimization stuff.
export {
  Node,
  Edge,
  Face,
  TreeNode,
  PackingNode,
  Packing,
  CreasesNode,
  CreaseType,
  MVAssignment,
  Crease,
  Graph,
  TreeGraph,
  CreasesGraphState,
  CreasesGraph
};
