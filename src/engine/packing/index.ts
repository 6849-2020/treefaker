import { matrix, math } from "mathjs";

const TOLERANCE = 0.000001;

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

  counterclockwise(e: Edge) {
    const index = this.edges.indexOf(e);
    if (index == -1) {
      throw new Error(
        `Edge ${e.from.id} -> ${e.to.id} not adjacent to vertex ${this.id}.`
      );
    } else {
      const numEdges = this.edges.length;
      return this.edges[(index + 1) % numEdges];
    }
  }

  clockwise(e: Edge) {
    const index = this.edges.indexOf(e);
    if (index == -1) {
      throw new Error(
        `Edge ${e.from.id} -> ${e.to.id} not adjacent to vertex ${this.id}.`
      );
    } else {
      const numEdges = this.edges.length;
      return this.edges[(index - 1 + numEdges) % numEdges];
    }
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

  getOtherNode(n: Node) {
    if (n == this.to) {
      return this.from;
    } else if (n == this.from) {
      return this.to;
    } else {
      throw new Error("Node not in edge.");
    }
  }
}

class Face {
  readonly isOuterFace: boolean;
  nodes: Node[];
  edges: Edge[];
  [key: string]: any;

  constructor(isOuterFace: boolean) {
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
  faces: Face[];

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
  ActiveHull,
  InactiveHull,
}

enum MVAssignment {
  Mountain,
  Valley,
  Tristate,
  Unknown,
  Boundary,
}

class Crease extends Edge {
  leftFace: Face | null;
  rightFace: Face | null;
  creaseType: CreaseType;
  assignment: MVAssignment;

  constructor(to: CreasesNode, from: CreasesNode, creaseType: CreaseType) {
    super(to, from);
    this.leftFace = null;
    this.rightFace = null;
    this.creaseType = creaseType;
    if (
      creaseType == CreaseType.ActiveHull ||
      creaseType == CreaseType.InactiveHull
    ) {
      this.assignment = MVAssignment.Boundary;
    } else if (creaseType == CreaseType.Gusset) {
      this.assignment = MVAssignment.Valley;
    } else if (
      creaseType == CreaseType.Ridge ||
      creaseType == CreaseType.Pseudohinge
    ) {
      this.assignment = MVAssignment.Mountain;
    } else if (creaseType == CreaseType.Hinge) {
      this.assignment = MVAssignment.Tristate;
    } else {
      this.assignment = MVAssignment.Unknown;
    }
  }
}

class Graph<N extends Node, E extends Edge> {
  nodes: Map<string, N>;
  edges: Set<E>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Set();
  }

  addNode(n: N) {
    if (this.nodes.has(n.id)) {
      throw new Error(`Node with ID ${n.id} already exists.`);
    } else {
      this.nodes.set(n.id, n);
    }
  }

  addEdge(e: E) {
    if (!this.nodes.has(e.from.id)) {
      throw new Error(`Cannot add an edge from nonexistent node ${e.from.id}.`);
    }
    if (!this.nodes.has(e.to.id)) {
      throw new Error(`Cannot add an edge to nonexistent node ${e.to.id}.`);
    }
    const fromAngle = Math.atan2(e.to.y - e.from.y, e.to.x - e.from.x);
    const toAngle = Math.atan2(e.from.y - e.to.y, e.from.x - e.to.x);
    let i = e.from.edges.length - 1;
    for (; i >= 0; i--) {
      const otherEdge = e.from.edges[i];
      const otherNode = otherEdge.getOtherNode(e.from);
      const otherEdgeAngle = Math.atan2(
        otherNode.y - e.from.y,
        otherNode.x - e.from.x
      );
      const angleDifference = fromAngle - otherEdgeAngle;
      if (Math.abs(angleDifference) < TOLERANCE) {
        throw new Error(
          `Tried to add edge parallel to existing incident edge.`
        );
      } else if (angleDifference > 0) {
        break;
      }
      e.from.edges[i + 1] = otherEdge;
    }
    e.from.edges[i + 1] = e;
    i = e.to.edges.length - 1;
    for (; i >= 0; i--) {
      const otherEdge = e.to.edges[i];
      const otherNode = otherEdge.getOtherNode(e.to);
      const otherEdgeAngle = Math.atan2(
        otherNode.y - e.to.y,
        otherNode.x - e.to.x
      );
      const angleDifference = toAngle - otherEdgeAngle;
      if (Math.abs(angleDifference) < TOLERANCE) {
        throw new Error(
          `Tried to add edge parallel to existing incident edge.`
        );
      } else if (angleDifference > 0) {
        break;
      }
      e.to.edges[i + 1] = otherEdge;
    }
    e.to.edges[i + 1] = e;
    this.edges.add(e);
  }
}

class TreeGraph extends Graph<TreeNode, TreeEdge> {
  //shortestPath(from: TreeNode, to: TreeNode) {}

  // Returns d such that, for all leaf nodes a and b, d.get(a).get(b).get(c) is the tree distance from a to c on the path to b.
  getDistances(): Map<string, Map<string, Map<string, number>>> {
    const d = new Map();
    for (const fromNodeId of this.nodes.keys()) {
      const fromNode = this.nodes.get(fromNodeId) as TreeNode;
      const distancesTo = new Map();
      this.getDistancesRecursive(
        distancesTo,
        0,
        new Map(),
        fromNode,
        fromNode.edges[0] as TreeEdge
      );
      d.set(fromNodeId, distancesTo);
    }
    return d;
  }

  getDistancesRecursive(
    distancesTo: Map<string, Map<string, number>>,
    distanceSoFar: number,
    distancesAlongPath: Map<string, number>,
    fromNode: TreeNode,
    e: TreeEdge
  ) {
    distanceSoFar += e.length;
    const toNode = e.getOtherNode(fromNode);
    distancesAlongPath.set(toNode.id, distanceSoFar);
    if (toNode.edges.length == 1) {
      distancesTo.set(toNode.id, distancesAlongPath);
    } else {
      for (const ePrime of toNode.edges) {
        if (ePrime.getOtherNode(toNode) != fromNode) {
          this.getDistancesRecursive(
            distancesTo,
            distanceSoFar,
            new Map(distancesAlongPath),
            toNode,
            ePrime as TreeEdge
          );
        }
      }
    }
  }
}

enum CreasesGraphState {
  NewlyCreated,
  PreUMA,
  PostUMA,
  FullyAssigned,
}

class CreasesGraph extends Graph<CreasesNode, Crease> {
  state: CreasesGraphState;
  leafExtensions: Map<CreasesNode, number>;
  faces: Set<Face>;

  constructor(p: Packing) {
    super();
    this.state = CreasesGraphState.NewlyCreated;
    this.leafExtensions = new Map();
    this.faces = new Set();
    for (const nodeId of p.nodes.keys()) {
      const packingNode = p.nodes.get(nodeId) as PackingNode;
      const creasesNode = new CreasesNode(nodeId, packingNode.x, packingNode.y);
      this.addNode(creasesNode);
      this.leafExtensions.set(creasesNode, 0);
    }
  }
}

export function pack(
  d: Map<string, Map<string, Map<string, number>>>
): Packing {
  // TODO(Parker)
  throw new Error("Function pack() not yet implemented.");
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
  TOLERANCE,
  Node,
  Edge,
  Face,
  TreeNode,
  TreeEdge,
  PackingNode,
  Packing,
  CreasesNode,
  CreaseType,
  MVAssignment,
  Crease,
  Graph,
  TreeGraph,
  CreasesGraphState,
  CreasesGraph,
};
