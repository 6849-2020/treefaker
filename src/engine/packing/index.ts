import { matrix, math } from "mathjs";

const TOLERANCE = 0.000001;
const UPDATE_TOLERANCE = TOLERANCE * 5;
const BINARY_SEARCH_TOLERANCE = TOLERANCE / 4;
const IS_RIGHT_TURN_CUTOFF_1 = -Math.PI - TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_2 = Math.PI - TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_3 = -2 * Math.PI + TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_4 = 2 * Math.PI - TOLERANCE;

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
      console.log(this);
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

  idString() {
    return getIdString(this.from.id, this.to.id);
  }
}

class Face {
  isOuterFace: boolean;
  readonly nodes: CreasesNode[];
  inactiveHullCrease: Crease | null;
  [key: string]: any;

  constructor() {
    this.isOuterFace = false;
    this.nodes = [];
    this.inactiveHullCrease = null;
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
}

class CreasesNode extends PackingNode {
  faces: Face[];
  onBoundaryOfSquare: boolean;
  goUpRidge: CreasesNode | null;

  constructor(id: string, x: number, y: number) {
    super(id, x, y);
    this.faces = [];
    this.onBoundaryOfSquare =
      x < TOLERANCE || y < TOLERANCE || x > 1 - TOLERANCE || y > 1 - TOLERANCE;
    this.goUpRidge = null;
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

  // Mapping from crease type to mountain/valley assignment.
  updateCreaseType(creaseType: CreaseType) {
    this.creaseType = creaseType;
    if (
      creaseType == CreaseType.ActiveHull ||
      creaseType == CreaseType.InactiveHull
    ) {
      this.assignment = MVAssignment.Boundary;
    } else if (
      creaseType == CreaseType.Gusset ||
      creaseType == CreaseType.Pseudohinge
    ) {
      this.assignment = MVAssignment.Valley;
    } else if (creaseType == CreaseType.Ridge) {
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

    // TODO These two lines are only necessary because TypeScript is being stupid.
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

  // Inserts edge at correct position within rotation system.
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
        console.log(e);
        throw new Error(
          `Tried to add edge ${e.idString()} parallel to existing incident edge.`
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
        console.log(e);
        throw new Error(
          `Tried to add edge parallel to existing incident edge.`
        );
      } else if (angleDifference > 0) {
        break;
      }
      e.to.edges[i + 1] = otherEdge;
    }
    e.to.edges[i + 1] = e;
    this.edges.set(e.idString(), e);
  }

  // Returns the edge between v1 and v2, or undefined if there is no such edge.
  getEdge(v1: N, v2: N) {
    const idString = getIdString(v1.id, v2.id);
    return this.edges.get(idString);
  }

  removeEdge(e: E) {
    const fromIndex = e.from.edges.indexOf(e);
    const toIndex = e.to.edges.indexOf(e);
    if (fromIndex == -1 || toIndex == -1 || !this.edges.delete(e.idString())) {
      throw new Error(
        `Edge ${e.from.id} -> ${e.to.id} not in graph or not in node edge list.`
      );
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

  // Helper function for getDistances.
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

// The creases graph is modified in-place by several functions; these states are used to enforce that you don't try to make these calls in the wrong order.
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
  nextInternalNodeIndex: number;

  constructor(p: Packing) {
    super();
    this.state = CreasesGraphState.NewlyCreated;
    this.leafExtensions = new Map();
    this.faces = new Set();
    this.nextInternalNodeIndex = 1;
    for (const nodeId of p.nodes.keys()) {
      const packingNode = p.nodes.get(nodeId) as PackingNode;
      const creasesNode = new CreasesNode(nodeId, packingNode.x, packingNode.y);
      this.addNode(creasesNode);
      this.leafExtensions.set(creasesNode, 0);
    }
  }

  // For constructing new nodes that were not in the original packing.
  nextInternalId() {
    return "i" + (this.nextInternalNodeIndex++).toString();
  }

  // Splits a crease into two pieces, returning the node inserted in the middle. Does not check that x and y are actually coordinates of a point in the middle of the crease e.
  subdivideCrease(e: Crease, x: number, y: number) {
    if (this.state != CreasesGraphState.PreUMA) {
      throw new Error(`Do not call subdivideCrease from state ${this.state}.`);
    }
    const fromNode = e.from as CreasesNode;
    const toNode = e.to as CreasesNode;
    const leftFace = e.leftFace as Face;
    const rightFace = e.rightFace as Face;
    const indexOfToNodeInLeftFace = leftFace.nodes.indexOf(toNode);
    const indexOfFromNodeInRightFace = rightFace.nodes.indexOf(fromNode);
    const creaseType = e.creaseType;

    this.removeEdge(e);
    const newNode = new CreasesNode(this.nextInternalId(), x, y);
    this.addNode(newNode);
    const firstCrease = new Crease(newNode, fromNode, creaseType);
    this.addEdge(firstCrease);
    firstCrease.leftFace = leftFace;
    firstCrease.rightFace = rightFace;
    const secondCrease = new Crease(toNode, newNode, creaseType);
    this.addEdge(secondCrease);
    secondCrease.leftFace = leftFace;
    secondCrease.rightFace = rightFace;
    if (leftFace != rightFace) {
      // Faces are only the same when input tree is a path,
      // in which case we don't care about updating these pointers.
      leftFace.nodes.splice(indexOfToNodeInLeftFace, 0, newNode);
      rightFace.nodes.splice(indexOfFromNodeInRightFace, 0, newNode);
    }
    if (this.getEdge(newNode, fromNode) == undefined) {
      console.log(this.edges);
      throw new Error(
        "Problem subdividing crease - cannot find one of the new edges."
      );
    }
    return newNode;
  }

  // Removes nodes that were created as part of the UMA insetting process, but are unnecessary for the final crease pattern since they have degree 2.
  suppressNodeIfRedundant(v2: CreasesNode, newCreases: Set<Crease>) {
    if (this.state != CreasesGraphState.PreUMA) {
      throw new Error(
        `Do not call suppressRidgeNodeIfRedundant from state ${this.state}.`
      );
    }
    if (v2.edges.length == 2) {
      const e2 = v2.edges[0] as Crease;
      const e3 = v2.edges[1] as Crease;
      const v1 = e2.getOtherNode(v2) as CreasesNode;
      const v3 = e3.getOtherNode(v2) as CreasesNode;
      const v2Angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
      const v3Angle = Math.atan2(v3.y - v1.y, v3.x - v1.x);
      const creaseType = e2.creaseType;
      if (Math.abs(v2Angle - v3Angle) < TOLERANCE) {
        if (
          creaseType != e3.creaseType ||
          (creaseType != CreaseType.Ridge && creaseType != CreaseType.Hinge)
        ) {
          throw new Error(
            `Invalid crease types: edge ${e2.idString()} is of type ${
              e2.creaseType
            } and edge ${e3.idString()} is of type ${e3.creaseType}.`
          );
        }
        newCreases.delete(e2);
        newCreases.delete(e3);
        this.removeEdge(e2);
        this.removeEdge(e3);
        this.nodes.delete(v2.id);
        const newCrease = new Crease(v3, v1, creaseType);
        newCreases.add(newCrease);
        this.addEdge(newCrease);
        return true;
      }
    }
    return false;
  }

  // Constructs a new face to the left of a crease by traversing the rotation system.
  fillInFaceToTheLeft(vStart: CreasesNode, eStart: Crease) {
    const face = new Face();
    this.faces.add(face);
    let v = vStart;
    let e = eStart;
    for (let numIterations = 0; numIterations < 100; numIterations++) {
      face.nodes.push(v);
      if (v == e.from) {
        e.leftFace = face;
      } else {
        e.rightFace = face;
      }
      if (e.creaseType == CreaseType.InactiveHull) {
        if (!face.isOuterFace) {
          if (face.inactiveHullEdge == null) {
            face.inactiveHullEdge = e;
          } else {
            throw new Error(
              `Face ${face.nodes.map(
                n => n.id
              )} has at least two inactive hull edges: ${face.inactiveHullEdge.idString()} and ${e.idString()}.`
            );
          }
        }
      }
      v = e.getOtherNode(v) as CreasesNode;
      e = v.clockwise(e) as Crease;
      if (v == vStart && e == eStart) {
        return face;
      }
    }
    throw new Error(
      "Caught in infinite loop while filling in new face in UMA."
    );
  }

  // Makes new faces to either side of every crease in newCreases, as long as the faces to the left and right of each crease are unset or equal to the old face being subdivided.
  subdivideFace(face: Face, newCreases: Set<Crease>) {
    const newFaces: Array<Face> = [];
    for (const e of newCreases) {
      if (e.leftFace == null || e.leftFace == face) {
        newFaces.push(this.fillInFaceToTheLeft(e.from as CreasesNode, e));
      }
      if (e.rightFace == null || e.rightFace == face) {
        newFaces.push(this.fillInFaceToTheLeft(e.to as CreasesNode, e));
      }
    }
    this.faces.delete(face);
    return newFaces;
  }
}

export {
  TOLERANCE,
  UPDATE_TOLERANCE,
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
