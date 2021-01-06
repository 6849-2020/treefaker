import {
  TOLERANCE,
  BINARY_SEARCH_TOLERANCE,
  UPDATE_TOLERANCE,
  IS_RIGHT_TURN_CUTOFF_1,
  IS_RIGHT_TURN_CUTOFF_2,
  IS_RIGHT_TURN_CUTOFF_3,
  IS_RIGHT_TURN_CUTOFF_4,
  getAnyElement,
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
} from "../packing";

function getMVAssignment(f1, f2, coloring) {
  if (f1.facetOrderIndex < f2.facetOrderIndex) {
    if (coloring) {
      return MVAssignment.Mountain;
    } else {
      return MVAssignment.Valley;
    }
  } else if (f1.facetOrderIndex > f2.facetOrderIndex) {
    if (coloring) {
      return MVAssignment.Valley;
    } else {
      return MVAssignment.Mountain;
    }
  } else {
    throw new Error(`Two faces have the same facetOrderIndex: ${f1.facetOrderIndex}.`);
  }
}

// Performs a DFS on the dual graph to assign all creases and check for inconsistencies.
function computeMVAssignmentRecursive(g: CreasesGraph, face: Face, coloring: boolean) {
  if (face.isColored) {
    if (face.coloring != coloring) {
      throw new Error(`Coloring inconsistency on face ${face.nodes.map(n => n.id)}.`);
    }
  } else {
    console.log(`${face.nodes.map(n => n.id)} - ${coloring}`);
    face.isColored = true;
    face.coloring = coloring;
    let v1 = face.nodes[face.nodes.length - 1];
    for (const v2 of face.nodes) {
      const e = g.getEdge(v1, v2) as Crease;
      const otherFace = e.getOtherFace(face);
      if (!otherFace.isOuterFace) {
        if (e.assignment == MVAssignment.Unfolded) {
          computeMVAssignmentRecursive(g, otherFace, coloring);
        } else {
          const correctAssignment = getMVAssignment(face, otherFace, coloring);
          if (e.assignment == MVAssignment.Unknown) {
            e.assignment = correctAssignment;
          } else if (e.assignment != correctAssignment) {
            throw new Error(`Inconsistency between faces ${face.nodes.map(n => n.id)} and ${otherFace.nodes.map(n => n.id)}: crease ${e.idString()} [from node ${e.from.displayId} at (${e.from.x}, ${e.from.y}) to node ${e.to.displayId} at (${e.to.x}, ${e.to.y})] should be assigned ${MVAssignment[correctAssignment]} but is actually assigned ${MVAssignment[e.assignment]}.`);
          }
          computeMVAssignmentRecursive(g, otherFace, !coloring);
        }
      }
      v1 = v2;
    }
  }
}

function findNextNonPseudohingeFacet(f: Face) {
  for (let numIterations = 0; numIterations < 100; numIterations++) {
    if (!f.extendedHasPseudohinge) {
      return f;
    }
    f = (f.creaseToNextAxialFacet as Crease).getOtherFace(f);
  }
  throw new Error("Caught in infinite loop while trying to find a non-pseudohinge-facet.");
}

function isValidMOGMergePoint(axialFacet1: Face) {
  const hinge1 = axialFacet1.creaseToNextAxialFacet as Crease;
  if (hinge1.creaseType != CreaseType.Hinge) {
    return false;
  }
  const nextAxialFacet1 = hinge1.getOtherFace(axialFacet1);
  const axialFacet2 = nextAxialFacet1.crossAxialOrHull as Face;
  if (axialFacet2.isOuterFace) {
    throw new Error(`Tried to merge MOGs across from outer face ${axialFacet2.nodes.map(n => n.id)}, which should have been caught earlier.`);
  }
  const hinge2 = axialFacet2.creaseToNextAxialFacet as Crease;
  if (hinge2.creaseType != CreaseType.Hinge) {
    throw new Error(`Tried to merge MOGs across from face ${axialFacet2.nodes.map(n => n.id)}, which is not immediately before a hinge.`);
  }
  const hingeNodeId = hinge1.from.displayId;
  if (hingeNodeId != hinge2.from.displayId) {
    throw new Error(`Hinge displayId mismatch: hinge ${hinge1.idString()} has displayId ${hinge1.from.displayId}, but hinge ${hinge2.idString()} has displayId ${hinge2.from.displayId}`);
  }
  const baseFace1 = axialFacet1.baseFaceLocalRoot as Face;
  const baseFace2 = axialFacet2.baseFaceLocalRoot as Face;
  return baseFace1.baseFaceLocalRoot == hingeNodeId
      || baseFace2.baseFaceLocalRoot == hingeNodeId;
}

// Sets hinge creases to be unfolded if discrete depth difference is 2.
function assignUnfoldedHinges(g: CreasesGraph, discreteDepth: Map<string, number>): Face {
  let globalSourceBaseFace: Face | null = null;
  for (const crease of g.edges.values()) {
    if (crease.creaseType == CreaseType.Hinge) {
      const leftFlap = (crease.leftFace as Face).flap;
      const rightFlap = (crease.rightFace as Face).flap;
      let leftId = "unset";
      let rightId = "unset";
      let intersectingId = "unset";
      for (const s of leftFlap) {
        if (rightFlap.has(s)) {
          intersectingId = s;
        } else {
          leftId = s;
        }
      }
      for (const s of rightFlap) {
        if (!leftFlap.has(s)) {
          rightId = s;
          break;
        }
      }
      if (leftId == "unset" || rightId == "unset" || intersectingId == "unset") {
        throw new Error(`Flaps to not intersect properly at hinge ${crease.idString()}: leftFlap=${Array.from(leftFlap)}, rightFlap=${Array.from(rightFlap)}.`);
      }
      if (!(intersectingId == crease.from.displayId && intersectingId == crease.to.displayId)) {
        throw new Error(`Inconsistency among hinge/flap ids at hinge ${crease.idString()}: intersectingId=${intersectingId}, from=${crease.from.displayId}, to=${crease.to.displayId}.`);
      }
      const leftDepth = discreteDepth.get(leftId) as number;
      const rightDepth = discreteDepth.get(rightId) as number;
      const depthDifference = Math.abs(leftDepth - rightDepth);
      if (depthDifference == 0) {
        // Folded, do nothing.
      } else if (depthDifference == 2) {
        crease.assignment = MVAssignment.Unfolded;
      } else {
        throw new Error(`Invalid discrete depth difference hinge ${crease.idString()}: node ${leftId} has depth ${leftDepth}, and node ${rightId} has depth ${rightDepth}.`);
      }
      
      // See if the face to the right of the hinge can be the source for an MOG.
      const baseFace = crease.baseFace as Face;
      if (baseFace.moleculeSource == null && crease.from.elevation == 0) {
        const potentialMoleculeSource = crease.rightFace as Face;
        if (!potentialMoleculeSource.hasPseudohinge) {
          const localRoot = baseFace.baseFaceLocalRoot as string;
          if (crease.from.displayId == localRoot) {
            baseFace.moleculeSource = potentialMoleculeSource;
            if (globalSourceBaseFace == null && discreteDepth.get(intersectingId) == 0) {
              globalSourceBaseFace = baseFace;
            }
          }
        }
      }
    }
  }
  if (globalSourceBaseFace == null) {
    throw new Error("Could not find global root hinge.");
  } else {
    return globalSourceBaseFace; // Assuming hinges point inward in each molecule.
  }
}

// Sets Face fields extendedHasPseudohinge and creaseToPreviousAxialFacet.
function annotateExtendedPseudohinges(sourceFace: Face) {
  let currentFace = sourceFace;
  let possibleExtendedPseudohinges: Face[] = []
  let foundPseudohinge = false;
  for (let numIterations = 0; numIterations < 200; numIterations++) {
    possibleExtendedPseudohinges.push(currentFace);
    const nextCrease = currentFace.creaseToNextAxialFacet as Crease;
    if (currentFace.hasPseudohinge) {
      foundPseudohinge = true;
    }
    if (nextCrease.assignment != MVAssignment.Unfolded) {
      if (foundPseudohinge) {
        for (const f of possibleExtendedPseudohinges) {
          f.extendedHasPseudohinge = true;
        }
      }
      possibleExtendedPseudohinges = [];
      foundPseudohinge = false;
    }
    const nextFace = nextCrease.getOtherFace(currentFace) as Face;
    nextFace.creaseToPreviousAxialFacet = nextCrease;
    if (nextFace == sourceFace) {
      return;
    } else {
      currentFace = nextFace;
    }
  }
  throw new Error("Caught in infinite loop while annotating extended pseudohinges.");
}

function launchPseudohingeCorridors(orderingGraph: FacetOrderingGraph, currentFace: Face, isOrdinaryDirection: boolean) {
  for (let numIterations = 0; numIterations < 100; numIterations++) {
    const nextCrease = (isOrdinaryDirection ? currentFace.creaseToNextAxialFacet : currentFace.creaseToPreviousAxialFacet) as Crease;
    const nextFace = nextCrease.getOtherFace(currentFace) as Face;
    if (nextCrease.assignment != MVAssignment.Unfolded || nextFace.hasPseudohinge) {
      return;
    }
    orderingGraph.addFace(nextFace);
    orderingGraph.addEdge(currentFace, nextFace);
    currentFace = nextFace;
    const corridor = currentFace.corridor as Face[];
    const nextFaceInCorridor = corridor[1] as Face;
    if (orderingGraph.faces.has(nextFaceInCorridor)) {
      throw new Error(`Already encountered corridor chain going the other direction from face ${currentFace.nodes.map(n => n.id)}, but attempted to launch a new corridor after crossing a pseudohinge.`);
    }
    const numVerticesInCorridor = corridor.length;
    console.log(`Found corridor (after crossing pseudohinge) of length ${numVerticesInCorridor}:`);
    console.log(corridor.map(f => f.nodes.map(n => n.id)));
    let lastCorridorFace = currentFace;
    for (let i = 1; i < numVerticesInCorridor; i++) {
      const corridorFace = corridor[i] as Face;
      if (orderingGraph.faces.has(corridorFace)) {
        throw new Error(`Corridor (after pseudohinge) face ${corridorFace.nodes.map(n => n.id)} was already visited.`);
      }
      orderingGraph.addFace(corridorFace);
      orderingGraph.addEdge(lastCorridorFace, corridorFace);   
      lastCorridorFace = corridorFace;
    }
  }
  throw new Error("Caught in infinite loop while annotating extended pseudohinges.");
}

function buildROGRecursive(orderingGraph: FacetOrderingGraph, visitedMolecules: Set<Face>, baseFace: Face, mergePoint: Face | null) {
  visitedMolecules.add(baseFace);
  const sourceFace = baseFace.moleculeSource as Face;
  orderingGraph.addFace(sourceFace);
  annotateExtendedPseudohinges(sourceFace);
  
  // Main loop to construct MOG.
  let currentFace = findNextNonPseudohingeFacet(sourceFace);
  for (let numIterations = 0; numIterations < 200; numIterations++) {
    console.log(currentFace.nodes.map(n => n.id));
    // Launch corridor chain if haven't done so already from the other direction.
    const corridor = currentFace.corridor as Face[];
    const nextFaceInCorridor = corridor[1] as Face;
    if (!orderingGraph.faces.has(nextFaceInCorridor)) {
      const numVerticesInCorridor = corridor.length;
      console.log(`Found corridor of length ${numVerticesInCorridor}.`);
      let lastCorridorFace = currentFace;
      for (let i = 1; i < numVerticesInCorridor; i++) {
        const corridorFace = corridor[i] as Face;
        if (orderingGraph.faces.has(corridorFace)) {
          throw new Error(`Corridor face ${corridorFace.nodes.map(n => n.id)} was already visited.`);
        }
        orderingGraph.addFace(corridorFace);
        orderingGraph.addEdge(lastCorridorFace, corridorFace);
        
        // See if we need to launch some more corridors after crossing a pseudohinge.
        if (corridorFace.hasPseudohinge && lastCorridorFace.hasPseudohinge) {
          const positiveDirection = (corridorFace.creaseToPreviousAxialFacet == lastCorridorFace.creaseToNextAxialFacet);
          const negativeDirection = (corridorFace.creaseToNextAxialFacet == lastCorridorFace.creaseToPreviousAxialFacet);
          if (positiveDirection == negativeDirection) {
            throw new Error(`Could not determine which way pseudohinge was crossed in going from face ${lastCorridorFace.nodes.map(n => n.id)} to face ${corridorFace.nodes.map(n => n.id)}.`);
          }
          launchPseudohingeCorridors(orderingGraph, corridorFace, positiveDirection);
        }        
        
        lastCorridorFace = corridorFace;
      }
    }
    
    const nextFace = findNextNonPseudohingeFacet((currentFace.creaseToNextAxialFacet as Crease).getOtherFace(currentFace));
    if (nextFace.isOuterFace) {
      throw new Error(`Next face from ${currentFace.nodes.map(n => n.id)} within same molecule is outer face.`);
    }
    orderingGraph.addFace(nextFace);
    const jumpToOtherMolecule = currentFace.crossAxialOrHull as Face;
    if (!(jumpToOtherMolecule.isOuterFace || visitedMolecules.has(jumpToOtherMolecule.baseFaceLocalRoot as Face))
        && isValidMOGMergePoint(currentFace)) { // Can jump to a new neighboring molecule.
      console.log(`Jumping to new molecule.`);
      orderingGraph.addFace(jumpToOtherMolecule);
      orderingGraph.addEdge(currentFace, jumpToOtherMolecule);
      buildROGRecursive(orderingGraph, visitedMolecules, jumpToOtherMolecule.baseFaceLocalRoot as Face, jumpToOtherMolecule);
    } else { // Keep going within the same molecule.
      if (nextFace == mergePoint) { // At merge point, add edge back to old molecule.
        if (nextFace.isOuterFace) {
          throw new Error(`Should be merging back to old molecule, but face across axial/hull edge from ${currentFace.nodes.map(n => n.id)} is outer face.`);
        }
        orderingGraph.addEdge(currentFace, jumpToOtherMolecule);
      } else if (mergePoint == null && nextFace == sourceFace) { // Done building entire ROG.
        return;
      } else { // General case, add axial link to next axial facet.
        orderingGraph.addEdge(currentFace, nextFace);
      }
      if (nextFace == sourceFace) { // Done with molecule.
        console.log(`Jumping back to old molecule.`);
        return;
      }
    }
    currentFace = nextFace;
  }
  throw new Error("Caught in infinite loop while building an MOG.");
}

export function orderFacets(g: CreasesGraph, discreteDepth: Map<string, number>) {
  if (g.state != CreasesGraphState.PreFacetOrdering) {
    throw new Error(
      `Should not be calling orderFacets from state ${
        CreasesGraphState[g.state]
      }.`
    );
  }
  
  // Assign unfolded hinges.
  const initialBaseFace = assignUnfoldedHinges(g, discreteDepth);
  //console.log(initialBaseFace);
  const initialFace = initialBaseFace.moleculeSource as Face;
  
  // Build ROG.
  console.log(`Building ROG starting from ${initialFace.nodes.map(n => n.id)}.`);
  const orderingGraph = new FacetOrderingGraph();
  const visitedMolecules: Set<Face> = new Set();
  buildROGRecursive(orderingGraph, visitedMolecules, initialBaseFace, null);
  
  // Sort ROG and set facet order indices for each face.
  let facetOrderIndex = 0;
  for (const face of orderingGraph.topologicalSort()) {
    face.facetOrderIndex = facetOrderIndex++;
  }
  if (orderingGraph.faces.size != g.faces.size - 1) {
    throw new Error(`Expected to find all ${g.faces.size - 1} inner faces, instead found ${orderingGraph.faces.size}.`);
  }
  
  // Assign all creases.
  computeMVAssignmentRecursive(g, initialFace, true);
  
  g.state = CreasesGraphState.FullyAssigned;
}
