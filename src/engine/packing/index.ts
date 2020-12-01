import { matrix, math } from "mathjs";

const TOLERANCE = 0.000001;
const BINARY_SEARCH_TOLERANCE = TOLERANCE/4;
const IS_RIGHT_TURN_CUTOFF_1 = -Math.PI - TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_2 = Math.PI - TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_3 = -2*Math.PI + TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_4 = 2*Math.PI - TOLERANCE;

function getIdString(id1: string, id2: string) {
  if (id1 > id2) {
    return id2 + "-" + id1;
  } else {
    return id1 + "-" + id2;
  }
}

class Node {
  readonly id: string;
  x: number;
  y: number;
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
      throw new Error(`Edge ${e.from.id} -> ${e.to.id} not adjacent to vertex ${this.id}.`);
    } else {
      const numEdges = this.edges.length;
      return this.edges[(index + 1) % numEdges]
    }
  }
  
  clockwise(e: Edge) {
    const index = this.edges.indexOf(e);
    if (index == -1) {
      throw new Error(`Edge ${e.from.id} -> ${e.to.id} not adjacent to vertex ${this.id}.`);
    } else {
      const numEdges = this.edges.length;
      return this.edges[(index - 1 + numEdges) % numEdges]
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
  
  idString() {
    return getIdString(this.from.id, this.to.id);
  }
}

class Face {
  isOuterFace : boolean;
  readonly nodes : Node[]
  //edges : Edge[]
  [key: string]: any;
  
  constructor() {
    this.isOuterFace = false;
    this.nodes = [];
    //this.edges = [];
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
  onBoundaryOfSquare: boolean;
  
  constructor(id: string, x: number, y: number) {
    super(id, x, y);
    this.faces = [];
    this.onBoundaryOfSquare = x < TOLERANCE || y < TOLERANCE || x > 1 - TOLERANCE || y > 1 - TOLERANCE;
  }
}

enum CreaseType {
  Axial,
  Gusset,
  Ridge,
  Hinge,
  Pseudohinge,
  ActiveHull,
  InactiveHull
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
  creaseType: CreaseType;
  assignment: MVAssignment;
  
  updateCreaseType(creaseType: CreaseType) {
    this.creaseType = creaseType;
    if (creaseType == CreaseType.ActiveHull || creaseType == CreaseType.InactiveHull) {
      this.assignment = MVAssignment.Boundary;
    } else if (creaseType == CreaseType.Gusset) {
      this.assignment = MVAssignment.Valley;
    } else if (creaseType == CreaseType.Ridge || creaseType == CreaseType.Pseudohinge) {
      this.assignment = MVAssignment.Mountain;
    } else if (creaseType == CreaseType.Hinge) {
      this.assignment = MVAssignment.Tristate;
    } else {
      this.assignment = MVAssignment.Unknown;
    }
  }
  
  constructor(to: CreasesNode, from: CreasesNode, creaseType: CreaseType) {
    super(to, from);
    this.leftFace = null;
    this.rightFace = null;
    
    // TODO(Parker) These two lines are only necessary because TypeScript is being stupid. Can you fix?
    this.creaseType = CreaseType.Axial;
    this.assignment = MVAssignment.Unknown;
    
    this.updateCreaseType(creaseType);
  }
}

class Graph<N extends Node, E extends Edge> {
  nodes: Map<string, N>;
  edges: Map<string, E>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
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
      const otherEdge = e.from.edges[i]
      const otherNode = otherEdge.getOtherNode(e.from);
      const otherEdgeAngle = Math.atan2(otherNode.y - e.from.y, otherNode.x - e.from.x);
      const angleDifference = fromAngle - otherEdgeAngle;
      if (Math.abs(angleDifference) < TOLERANCE) {
        throw new Error(`Tried to add edge ${e.idString()} parallel to existing incident edge.`);
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
      if (Math.abs(angleDifference) < TOLERANCE) {
        throw new Error(`Tried to add edge parallel to existing incident edge.`);
      } else if (angleDifference > 0) {
        break;
      }
      e.to.edges[i + 1] = otherEdge;
    }
    e.to.edges[i + 1] = e;
    this.edges.set(e.idString(), e);
  }
  
  getEdge(v1: N, v2: N) {
    const idString = getIdString(v1.id, v2.id);
    return this.edges.get(idString);
  }
  
  removeEdge(e: E) {
    const fromIndex = e.from.edges.indexOf(e);
    const toIndex = e.to.edges.indexOf(e);
    if (fromIndex == -1 || toIndex == -1 || !this.edges.delete(e.idString())) {
      throw new Error(`Edge ${e.from.id} -> ${e.to.id} not in graph or not in node edge list.`);
    } else {
      e.from.edges.splice(fromIndex, 1);
      e.to.edges.splice(toIndex, 1);
    }
  }
  
  removeEdgeFromVertices(v1: N, v2: N) {
    const e = this.getEdge(v1, v2);
    if (e) {
      this.removeEdge(e);
    } else {
      throw new Error(`Edge (${v1.id}, ${v2.id}) not in graph.`);
    }
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
      this.getDistancesRecursive(distancesTo, 0, new Map(), fromNode, fromNode.edges[0] as TreeEdge);
      d.set(fromNodeId, distancesTo);
    }
    return d;
  }
  
  getDistancesRecursive(distancesTo: Map<string, Map<string, number>>, distanceSoFar: number, distancesAlongPath: Map<string, number>, fromNode: TreeNode, e: TreeEdge) {
    distanceSoFar += e.length;
    const toNode = e.getOtherNode(fromNode);
    distancesAlongPath.set(toNode.id, distanceSoFar);
    if (toNode.edges.length == 1) {
      distancesTo.set(toNode.id, distancesAlongPath);
    } else {
      for (const ePrime of toNode.edges) {
        if (ePrime.getOtherNode(toNode) != fromNode) {
          this.getDistancesRecursive(distancesTo, distanceSoFar, new Map(distancesAlongPath), toNode, ePrime as TreeEdge);
        }
      }
    }
  }
}

enum CreasesGraphState {
  NewlyCreated,
  Clean,
  PreUMA,
  PostUMA,
  FullyAssigned
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
  
  // TODO This isn't being called anywhere yet, and would need to be tested.
  suppressRidgeNodeIfRedundant(v2: CreasesNode) {
    if (v2.edges.length == 2) {
      const e2 = v2.edges[0] as Crease;
      const e3 = v2.edges[1] as Crease;
      const v1 = e2.getOtherVertex(v2);
      const v3 = e3.getOtherVertex(v2);
      const v2Angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
      const v3Angle = Math.atan2(v3.y - v1.y, v3.x - v1.x);
      if (Math.abs(v2Angle - v3Angle) < TOLERANCE) {
        if (e2.creaseType != CreaseType.Ridge) {
          throw new Error(`Edge ${e2.idString()} should be a ridge crease.`);
        }
        if (e3.creaseType != CreaseType.Ridge) {
          throw new Error(`Edge ${e3.idString()} should be a ridge crease.`);
        }
        const leftFace = (e2.from == v1 ? e2.leftFace : e2.rightFace) as Face;
        const rightFace = (e2.from == v1 ? e2.rightFace : e2.leftFace) as Face;
        this.removeEdge(e2);
        this.removeEdge(e3);
        this.nodes.delete(v2.id);
        const newCrease = new Crease(v3, v1, CreaseType.Ridge);
        this.addEdge(newCrease);
        newCrease.leftFace = leftFace;
        newCrease.rightFace = rightFace;
        const v2IndexInLeftFace = leftFace.nodes.indexOf(v2);
        leftFace.nodes.splice(v2IndexInLeftFace, 1);
        if (leftFace != rightFace) {
          const v2IndexInRightFace = rightFace.nodes.indexOf(v2);
          rightFace.nodes.splice(v2IndexInRightFace, 1);
        }
        return true;
      }
    }
    return false;
  }
}

export function pack(d: Map<string, Map<string, Map<string, number>>>): Packing {
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
  BINARY_SEARCH_TOLERANCE,
  IS_RIGHT_TURN_CUTOFF_1,
  IS_RIGHT_TURN_CUTOFF_2,
  IS_RIGHT_TURN_CUTOFF_3,
  IS_RIGHT_TURN_CUTOFF_4,
  getIdString,
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
  CreasesGraph
};
