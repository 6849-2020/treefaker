import { matrix, math } from "mathjs";

const TOLERANCE = 0.000001;
const UPDATE_TOLERANCE = TOLERANCE * 5;
const BINARY_SEARCH_TOLERANCE = TOLERANCE / 1024;
const IS_RIGHT_TURN_CUTOFF_1 = -Math.PI - TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_2 = Math.PI - TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_3 = -2 * Math.PI + TOLERANCE;
const IS_RIGHT_TURN_CUTOFF_4 = 2 * Math.PI - TOLERANCE;

function getAnyElement<T>(s: Set<T>) {
  for (const e of s) {
    return e;
  }
  throw new Error("Set is empty.");
}

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
  displayId: string; // The id to be displayed in the GUI.
  faces: Face[];
  onBoundaryOfSquare: boolean;
  goUpRidge: CreasesNode | null;
  readonly elevation: number;

  constructor(
    id: string,
    displayId: string,
    x: number,
    y: number,
    elevation: number
  ) {
    super(id, x, y);
    this.displayId = displayId;
    this.faces = [];
    this.onBoundaryOfSquare =
      x < TOLERANCE || y < TOLERANCE || x > 1 - TOLERANCE || y > 1 - TOLERANCE;
    this.goUpRidge = null;
    this.elevation = elevation;
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
  Unfolded,
  Unknown,
  Boundary
}

class Crease extends Edge {
  readonly baseFace: Face | null; // The active polygon which this crease is inside of.
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
    } else {
      this.assignment = MVAssignment.Unknown;
    }
  }

  getOtherFace(f: Face): Face {
    if (f == this.leftFace) {
      return this.rightFace as Face;
    } else if (f == this.rightFace) {
      return this.leftFace as Face;
    } else {
      throw new Error("Face not adjacent to edge.");
    }
  }

  sumElevations() {
    return (
      (this.from as CreasesNode).elevation + (this.to as CreasesNode).elevation
    );
  }

  constructor(
    to: CreasesNode,
    from: CreasesNode,
    creaseType: CreaseType,
    baseFace: Face | null
  ) {
    super(to, from);
    this.baseFace = baseFace;
    this.leftFace = null;
    this.rightFace = null;

    // TODO These two lines are only necessary because TypeScript is being stupid.
    this.creaseType = CreaseType.Axial;
    this.assignment = MVAssignment.Unknown;

    this.updateCreaseType(creaseType);
  }
}

class Face {
  isOuterFace: boolean;
  readonly nodes: CreasesNode[];
  inactiveHullCrease: Crease | null;
  crossRidge: Face | null; // The face on the other side of the highest elevation ridge.
  crossGussetOrPseudohinge: Face | null; // May be null if on boundary of active polyton, indicating end of corridor.
  crossAxialOrHull: Face | null; // Will be non-null if and only if the face is an axial facet.
  hasPseudohinge: boolean;
  extendedHasPseudohinge: boolean; // Whether there is a path crossing only unfolded creases to a pseudohinge facet.
  flap: Set<string>; // Set of 2 tree node ids the face projects down to.
  corridor: Face[] | null; // Will be non-null if and only if the face is an axial facet.
  creaseToNextAxialFacet: Crease | null;
  creaseToPreviousAxialFacet: Crease | null;
  facetOrderIndex: number;
  isColored: boolean;
  coloring: boolean;
  baseFaceLocalRoot: Face | string; // A pointer to the face representing the original active polygon or the local root id.
  //isAMoleculeSource: boolean; // Whether the face is to the right of a local root hinge.
  moleculeSource: Face | null; // The axial facet from which the MOG starts.
  [key: string]: any;

  averageX(): number {
    let total = 0;
    for (const n of this.nodes) {
      total += n.x;
    }
    return total / this.nodes.length;
  }

  averageY(): number {
    let total = 0;
    for (const n of this.nodes) {
      total += n.y;
    }
    return total / this.nodes.length;
  }

  constructor() {
    this.isOuterFace = false;
    this.nodes = [];
    this.inactiveHullCrease = null;
    this.crossRidge = null;
    this.crossGussetOrPseudohinge = null;
    this.crossAxialOrHull = null;
    this.hasPseudohinge = false;
    this.extendedHasPseudohinge = false;
    this.flap = new Set();
    this.corridor = null;
    this.creaseToNextAxialFacet = null;
    this.creaseToPreviousAxialFacet = null;
    this.facetOrderIndex = -1;
    this.isColored = false;
    this.coloring = false;
    this.baseFaceLocalRoot = "unset";
    //this.isAMoleculeSource = false;
    this.moleculeSource = null;
  }
}

class FacetOrderingGraph {
  readonly faces: Set<Face>;
  readonly adj: Map<Face, Face[]>;

  constructor() {
    this.faces = new Set();
    this.adj = new Map();
  }

  addFace(face: Face) {
    if (!this.faces.has(face)) {
      this.faces.add(face);
      this.adj.set(face, []);
    }
  }

  addEdge(face1: Face, face2: Face) {
    if (!this.faces.has(face1)) {
      throw new Error(
        `First face ${face1.nodes.map(n => n.id)} not in FacetOrderingGraph.`
      );
    }
    if (!this.faces.has(face2)) {
      throw new Error(
        `Second face ${face2.nodes.map(n => n.id)} not in FacetOrderingGraph.`
      );
    }
    const adjList = this.adj.get(face1) as Face[];
    adjList.push(face2);
  }

  // Using topological sort algorithm cut-and-pasted from:
  // https://www.tutorialspoint.com/Topological-sorting-using-Javascript-DFS
  topologicalSortHelper(face: Face, explored: Set<Face>, s: Face[]) {
    explored.add(face);

    // Marks this node as visited and goes on to the nodes
    // that are dependent on this node, the edge is node ----> n
    const adjList = this.adj.get(face) as Face[];
    adjList.forEach(f => {
      if (!explored.has(f)) {
        this.topologicalSortHelper(f, explored, s);
      }
    });
    // All dependencies are resolved for this node, we can now add
    // This to the stack.
    s.push(face);
  }

  topologicalSort(): Face[] {
    // Create a Stack to keep track of all elements in sorted order
    const s: Face[] = [];
    const explored: Set<Face> = new Set();

    // For every unvisited node in our graph, call the helper.
    this.faces.forEach(face => {
      if (!explored.has(face)) {
        this.topologicalSortHelper(face, explored, s);
      }
    });

    // Verify all edges go the proper direction.
    const encounteredFaces: Set<Face> = new Set();
    for (const face of s) {
      for (const adjacentFace of this.adj.get(face) as Face[]) {
        if (!encounteredFaces.has(adjacentFace)) {
          throw new Error(
            `Facet ordering graph is not a DAG: cycle involving faces ${face.nodes.map(
              n => n.id
            )} and ${adjacentFace.nodes.map(n => n.id)}.`
          );
        }
      }
      encounteredFaces.add(face);
    }

    return s.reverse();
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
  debugOverrideRootId: string | undefined;

  // Returns d such that, for all leaf nodes a and b, d.get(a).get(b) is a sorted list of ids and distances along the path from a to b.
  getDistances(): Map<string, Map<string, Array<[string, number]>>> {
    const d = new Map();
    for (const fromNodeId of this.nodes.keys()) {
      const fromNode = this.nodes.get(fromNodeId) as TreeNode;
      if (fromNode.edges.length == 1) {
        const distancesTo = new Map();
        this.getDistancesRecursive(
          distancesTo,
          0,
          [],
          fromNode,
          fromNode.edges[0] as TreeEdge
        );
        d.set(fromNodeId, distancesTo);
      }
    }
    return d;
  }

  // Helper function for getDistances.
  getDistancesRecursive(
    distancesTo: Map<string, Array<[string, number]>>,
    distanceSoFar: number,
    distancesAlongPath: Array<[string, number]>,
    fromNode: TreeNode,
    e: TreeEdge
  ) {
    distanceSoFar += e.length;
    const toNode = e.getOtherNode(fromNode);
    distancesAlongPath.push([toNode.id, distanceSoFar]);
    if (toNode.edges.length == 1) {
      distancesTo.set(toNode.id, distancesAlongPath);
    } else {
      for (const ePrime of toNode.edges) {
        if (ePrime.getOtherNode(toNode) != fromNode) {
          this.getDistancesRecursive(
            distancesTo,
            distanceSoFar,
            Array.from(distancesAlongPath),
            toNode,
            ePrime as TreeEdge
          );
        }
      }
    }
  }

  // Compute discrete depths from a given root.
  // If rootId is unset, choose the highest y-coordinate branch node as the root.
  dangle(rootId: string) {
    let root: TreeNode | null = null;
    if (this.debugOverrideRootId != undefined) {
      root = this.nodes.get(this.debugOverrideRootId) as TreeNode;
    } else if (rootId == "unset") {
      for (const n of this.nodes.values()) {
        if (n.edges.length >= 2 && (root == null || root.y < n.y)) {
          root = n;
        }
      }
    } else {
      root = this.nodes.get(rootId) as TreeNode;
    }
    if (root == null) {
      throw new Error("Tree has no non-leaf nodes.");
    } else {
      const discreteDepth: Map<string, number> = new Map();
      discreteDepth.set("unset", 1000);
      this.dangleRecursive(discreteDepth, root, 0);
      return discreteDepth;
    }
  }

  dangleRecursive(
    discreteDepth: Map<string, number>,
    n: TreeNode,
    depth: number
  ) {
    if (!discreteDepth.has(n.id)) {
      discreteDepth.set(n.id, depth);
      for (const incidentEdge of n.edges) {
        const nextNode = incidentEdge.getOtherNode(n);
        this.dangleRecursive(discreteDepth, nextNode, depth + 1);
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
  PreFacetOrdering,
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
      const creasesNode = new CreasesNode(
        nodeId,
        nodeId,
        packingNode.x,
        packingNode.y,
        0
      );
      this.addNode(creasesNode);
      this.leafExtensions.set(creasesNode, 0);
    }
  }

  // For constructing new nodes that were not in the original packing.
  nextInternalId() {
    return "i" + (this.nextInternalNodeIndex++).toString();
  }

  // Splits a crease into two pieces, returning the node inserted in the middle. Does not check that x and y are actually coordinates of a point in the middle of the crease e.
  subdivideCrease(
    e: Crease,
    x: number,
    y: number,
    displayId: string,
    elevation: number
  ) {
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
    const baseFace = e.baseFace;

    this.removeEdge(e);
    const newNode = new CreasesNode(
      this.nextInternalId(),
      displayId,
      x,
      y,
      elevation
    );
    this.addNode(newNode);
    const firstCrease = new Crease(newNode, fromNode, creaseType, baseFace);
    this.addEdge(firstCrease);
    firstCrease.leftFace = leftFace;
    firstCrease.rightFace = rightFace;
    const secondCrease = new Crease(toNode, newNode, creaseType, baseFace);
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
        `Do not call suppressRidgeNodeIfRedundant from state ${
          CreasesGraphState[this.state]
        }.`
      );
    }
    if (v2.edges.length == 2) {
      const e1 = v2.edges[0] as Crease;
      const e3 = v2.edges[1] as Crease;
      const v1 = e1.getOtherNode(v2) as CreasesNode;
      const v3 = e3.getOtherNode(v2) as CreasesNode;
      const v2Angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
      const v3Angle = Math.atan2(v3.y - v1.y, v3.x - v1.x);
      const creaseType = e1.creaseType;
      const baseFace = e1.baseFace;
      if (Math.abs(v2Angle - v3Angle) < TOLERANCE) {
        if (
          creaseType != e3.creaseType ||
          (creaseType != CreaseType.Ridge && creaseType != CreaseType.Hinge)
        ) {
          throw new Error(
            `Invalid crease types: edge ${e1.idString()} is of type ${
              e1.creaseType
            } and edge ${e3.idString()} is of type ${e3.creaseType}.`
          );
        }
        newCreases.delete(e1);
        newCreases.delete(e3);
        this.removeEdge(e1);
        this.removeEdge(e3);
        this.nodes.delete(v2.id);
        const newCrease =
          v1.elevation < v3.elevation
            ? new Crease(v3, v1, creaseType, baseFace)
            : new Crease(v1, v3, creaseType, baseFace);
        newCreases.add(newCrease);
        this.addEdge(newCrease);
        return true;
      }
    }
    return false;
  }

  // Constructs a new face to the left of a crease by traversing the rotation system.
  fillInFaceToTheLeft(vStart: CreasesNode, eStart: Crease) {
    if (this.state != CreasesGraphState.PostUMA) {
      throw new Error(
        `Do not call fillInFaceToTheLeft from state ${
          CreasesGraphState[this.state]
        }.`
      );
    }
    const face = new Face();
    this.faces.add(face);
    face.baseFaceLocalRoot = eStart.baseFace as Face;
    let v = vStart;
    let e = eStart;
    for (let numIterations = 0; numIterations < 100; numIterations++) {
      face.nodes.push(v);
      if (v == e.from) {
        e.leftFace = face;
      } else {
        e.rightFace = face;
      }
      const foundBoundaryOfPolygon =
        e.creaseType == CreaseType.Axial ||
        e.creaseType == CreaseType.ActiveHull ||
        e.creaseType == CreaseType.InactiveHull;
      if (e.creaseType == CreaseType.Pseudohinge) {
        face.hasPseudohinge = true;
      } else if (e.creaseType == CreaseType.InactiveHull) {
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
      if (foundBoundaryOfPolygon) {
        face.creaseToNextAxialFacet = e;
      }
      if (v == vStart && e == eStart) {
        return face;
      }
    }
    throw new Error(
      "Caught in infinite loop while filling in new face in UMA."
    );
  }

  // Sets crossRidge, crossGussetOrPseudohinge, crossHinge, and flap fields, returning set of axial facets.
  annotateFaceData(face: Face) {
    if (this.state != CreasesGraphState.PostUMA) {
      throw new Error(
        `Do not call annotateFaceData from state ${
          CreasesGraphState[this.state]
        }.`
      );
    }
    let highestSumElevations = 0;
    let v1 = face.nodes[face.nodes.length - 1];
    for (const v2 of face.nodes) {
      if (v2.displayId != "") {
        face.flap.add(v2.displayId);
      }
      const e = this.getEdge(v1, v2) as Crease;
      if (e.creaseType == CreaseType.Ridge) {
        const newSumElevations = e.sumElevations();
        const otherFace = e.getOtherFace(face) as Face;
        if (otherFace.hasPseudohinge) {
          // Ensure otherFace is crossRidge face.
          highestSumElevations = 2;
          face.crossRidge = otherFace;
        } else if (newSumElevations > highestSumElevations) {
          highestSumElevations = newSumElevations;
          face.crossRidge = otherFace;
        }
      } else if (
        e.creaseType == CreaseType.Gusset ||
        e.creaseType == CreaseType.Pseudohinge
      ) {
        if (face.crossGussetOrPseudohinge == null) {
          face.crossGussetOrPseudohinge = e.getOtherFace(face);
        } else {
          console.log(e);
          throw new Error(
            `Found two gusset/pseudohinge creases on one face, second is ${e.idString()}, which has type ${
              CreaseType[e.creaseType]
            }.`
          );
        }
      } else if (e.creaseType == CreaseType.Hinge) {
        //face.crossHinge = e.getOtherFace(face);
      } else {
        if (face.crossAxialOrHull == null) {
          face.crossAxialOrHull = e.getOtherFace(face);
          face.corridor = [face];
        } else {
          console.log(e);
          throw new Error(
            `Found two axial/hull creases on one face, second is ${e.idString()}, which has type ${
              CreaseType[e.creaseType]
            }.`
          );
        }
      }
      v1 = v2;
    }
    return face.crossAxialOrHull != null;
  }

  // Makes new faces to either side of every crease in newCreases, leaving theOuterFace untouched, then annotates faces with data necessary for facet ordering.
  rebuildFaces(theOuterFace: Face, newCreases: Set<Crease>) {
    if (this.state != CreasesGraphState.PostUMA) {
      throw new Error(
        `Do not call rebuildFaces from state ${CreasesGraphState[this.state]}.`
      );
    }

    // Fill in all faces except theOuterFace.
    const oldFaces = this.faces;
    oldFaces.delete(theOuterFace);
    this.faces = new Set([theOuterFace]);
    for (const e of newCreases) {
      if (e.leftFace == null || oldFaces.has(e.leftFace)) {
        this.fillInFaceToTheLeft(e.from as CreasesNode, e);
      }
      if (e.rightFace == null || oldFaces.has(e.rightFace)) {
        this.fillInFaceToTheLeft(e.to as CreasesNode, e);
      }
    }
    const eulerChar = this.nodes.size - this.edges.size + this.faces.size;
    if (eulerChar != 2) {
      throw new Error(
        `Euler characteristic check failed after building faces: v=${this.nodes.size}, e=${this.edges.size}, f=${this.faces.size}`
      );
    }

    // Set all face pointers and get list of axial facets.
    const axialNonPseudohingeFacets: Set<Face> = new Set();
    for (const face of this.faces) {
      if (face != theOuterFace) {
        if (this.annotateFaceData(face) && !face.hasPseudohinge) {
          axialNonPseudohingeFacets.add(face);
        }
      }
    }

    // Build corridors from each axial facet and set flaps as union.
    for (let numIterations1 = 0; numIterations1 < 500; numIterations1++) {
      if (axialNonPseudohingeFacets.size == 0) {
        return;
      } else {
        let face = getAnyElement(axialNonPseudohingeFacets);
        axialNonPseudohingeFacets.delete(face);
        let corridorHasNotTerminated = true;
        const corridor = face.corridor as Face[];
        const flap: Set<string> = new Set(face.flap);
        for (let numIterations2 = 0; numIterations2 < 100; numIterations2++) {
          const nextFace =
            numIterations2 % 2 == 0
              ? face.crossRidge
              : face.crossGussetOrPseudohinge;
          if (nextFace == null) {
            // Done building corridor.
            const didDeleteEndpoint = axialNonPseudohingeFacets.delete(face);
            if (!didDeleteEndpoint) {
              console.log(corridor);
              throw new Error(
                `Corridor ${corridor.map(
                  f => "[" + f.nodes.map(n => n.id) + "]"
                )} ended somewhere that wasn't in list of axial facets.`
              );
            }
            face.corridor = Array.from(corridor).reverse();

            // Reset flaps with all ids encountered in corridor.
            if (flap.size != 2) {
              console.log(face);
              throw new Error(`Could not determine flap: ${Array.from(flap)}.`);
            }
            for (const faceOfCorridor of corridor) {
              faceOfCorridor.flap = flap;
            }
            corridorHasNotTerminated = false;
            break;
          } else {
            corridor.push(nextFace);
            for (const nodeId of nextFace.flap) {
              flap.add(nodeId);
            }
            face = nextFace;
          }
        }
        if (corridorHasNotTerminated) {
          throw new Error(
            "Caught in infinite loop while building corridors (2)."
          );
        }
      }
    }
    throw new Error("Caught in infinite loop while building corridors (1).");
  }

  // Returns the id of a branch node that hopefully wont cause MOG merge problems.
  // If there are no axial paths, returns "unset".
  findAGoodRoot(d: Map<string, Map<string, Array<[string, number]>>>): string {
    const occurrences: Map<string, number> = new Map();
    for (const axialCrease of this.edges.values()) {
      if (axialCrease.creaseType == CreaseType.Axial) {
        const internalNodes = Array.from(
          (d.get(axialCrease.from.id) as Map<
            string,
            Array<[string, number]>
          >).get(axialCrease.to.id) as Array<[string, number]>
        );
        internalNodes.pop();
        for (const [nodeId, distance] of internalNodes) {
          if (occurrences.has(nodeId)) {
            occurrences.set(nodeId, (occurrences.get(nodeId) as number) + 1);
          } else {
            occurrences.set(nodeId, 1);
          }
        }
      }
    }

    let rootId = "unset";
    let maxNumOccurrences = 0;
    for (const [nodeId, numOccurrences] of occurrences) {
      if (numOccurrences > maxNumOccurrences) {
        maxNumOccurrences = numOccurrences;
        rootId = nodeId;
      }
    }
    return rootId;
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
  getAnyElement,
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
  FacetOrderingGraph,
  Graph,
  TreeGraph,
  CreasesGraphState,
  CreasesGraph
};
