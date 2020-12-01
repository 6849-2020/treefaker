import { TOLERANCE, BINARY_SEARCH_TOLERANCE, IS_RIGHT_TURN_CUTOFF_1, IS_RIGHT_TURN_CUTOFF_2, IS_RIGHT_TURN_CUTOFF_3, IS_RIGHT_TURN_CUTOFF_4, Node, Edge, Face, TreeNode, TreeEdge, PackingNode, Packing, CreasesNode, CreaseType, MVAssignment, Crease, Graph, TreeGraph, CreasesGraphState, CreasesGraph }  from "../packing";

function getAnyElement<T>(s: Set<T>) {
  for (const e of s) {
    return e;
  }
  throw new Error("Set is empty.");
}

function activeDistance(v1: CreasesNode, v2: CreasesNode, scaleFactor: number, d: Map<string, Map<string, Map<string, number>>>, leafExtensions: Map<CreasesNode, number>) {
  const distanceAlongPath = ((d.get(v1.id) as Map<string, Map<string, number>>).get(v2.id) as Map<string, number>).get(v2.id) as number;
  return scaleFactor*(distanceAlongPath + (leafExtensions.get(v1) as number) + (leafExtensions.get(v2) as number));
}

function isActive(v1: CreasesNode, v2: CreasesNode, scaleFactor: number, d: Map<string, Map<string, Map<string, number>>>, leafExtensions: Map<CreasesNode, number>) {
  const xDistance = v2.x - v1.x;
  const yDistance = v2.y - v1.y;
  const distanceOnPlane = Math.sqrt(xDistance*xDistance + yDistance*yDistance);
  //console.log(`v1.id: ${v1.id}  v2.id: ${v2.id}`);
  const distanceAlongPath = ((d.get(v1.id) as Map<string, Map<string, number>>).get(v2.id) as Map<string, number>).get(v2.id) as number;
  //console.log(`Computing isActive - Distance on plane: ${distanceOnPlane}  Active distance: ${activeDistance(v1, v2, scaleFactor, d, leafExtensions)}`)
  const slack = distanceOnPlane - activeDistance(v1, v2, scaleFactor, d, leafExtensions);
  if (slack < -TOLERANCE) {
    throw new Error(`Insufficient slack of ${slack} between nodes '${v1.id}' and '${v2.id}'.`);
  } else {
    return slack < TOLERANCE;
  }
}

// Using formula and notation from: https://mathworld.wolfram.com/Circle-CircleIntersection.html
export function get2CircleIntersection(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number, onLeftSide: boolean) {
  const r1Squared = r1*r1;
  const r2Squared = r2*r2;
  const parallelX = x2 - x1;
  const parallelY = y2 - y1;
  const perpendicularX = onLeftSide ? -parallelY : parallelY;
  const perpendicularY = onLeftSide ? parallelX : -parallelX;
  const dSquared = parallelX*parallelX + parallelY*parallelY;
  const twoDSquared = 2*dSquared;
  //const d = Math.sqrt(dSquared);
  const t = (dSquared - r2Squared + r1Squared);
  const parallelDistanceScaled = t/twoDSquared; // AKA "x/d" from Wolfram site.
  const perpendicularDistanceScaled = Math.sqrt((4*dSquared*r1Squared - t*t))/twoDSquared; // AKA "y/d" from Wolfram site.
  const x = x1 + parallelX*parallelDistanceScaled + perpendicularX*perpendicularDistanceScaled;
  const y = y1 + parallelY*parallelDistanceScaled + perpendicularY*perpendicularDistanceScaled;
  return [x, y];
}

export function getIndexOfConvexGap(v: Node) {
  const numEdges = v.edges.length;
  if (numEdges < 2) {
    throw new Error(`There are ${numEdges} edges incident to Node ${v.id}.`);
  }
  for (let index = 0; index < numEdges; index++) {
    const e1 = v.edges[index] as Edge;
    const e2 = v.edges[(index + 1) % numEdges] as Edge;
    const v1 = e1.getOtherNode(v);
    const v2 = e2.getOtherNode(v);
    const v1Angle = Math.atan2(v1.y - v.y, v1.x - v.x);
    let v2Angle = Math.atan2(v2.y - v.y, v2.x - v.x);
    if (v2Angle < v1Angle) {
      v2Angle += 2*Math.PI
    }
    const angleDifference = v2Angle - v1Angle;
    //console.log(`Angle difference: ${angleDifference}`);
    if (angleDifference > Math.PI + TOLERANCE) {
      return [index, v1, v2];
    }
  }
  return [null, null, null];
}

export function cleanPacking(p: Packing, d: Map<string, Map<string, Map<string, number>>>): CreasesGraph {
  if (p.nodes.size < 2) {
    throw new Error("Must have at least two nodes in packing.");
  }
  const g = new CreasesGraph(p);
  for (const v1 of g.nodes.values()) {
    for (const v2 of g.nodes.values()) {
      if (v1.id < v2.id && isActive(v1, v2, p.scaleFactor, d, g.leafExtensions)) {
        const axialCrease = new Crease(v2, v1, CreaseType.Axial);
        g.addEdge(axialCrease);
      }
    }
  }
  const nodeQueue = new Set(g.nodes.values());
  
  function updateNode(v: CreasesNode, r: number, x: number, y: number) {
    // Add leaf extension.
    const oldLeafExtension = g.leafExtensions.get(v) as number;
    g.leafExtensions.set(v, oldLeafExtension + r/p.scaleFactor);
    
    // Move vertex v to new position in packing and creases graph.
    (p.nodes.get(v.id) as PackingNode).x = x;
    (p.nodes.get(v.id) as PackingNode).y = y;
    v.x = x;
    v.y = y;
    v.onBoundaryOfSquare = v.x < TOLERANCE || v.y < TOLERANCE || v.x > 1 - TOLERANCE || v.y > 1 - TOLERANCE;
    
    // Recompute active paths.
    for (const e of [...v.edges]) {
      nodeQueue.add(e.getOtherNode(v) as CreasesNode);
      g.removeEdge(e as Crease);
    }
    for (const u of g.nodes.values()) {
      if (u != v && isActive(v, u, p.scaleFactor, d, g.leafExtensions)) {
        const axialCrease = new Crease(v, u, CreaseType.Axial);
        g.addEdge(axialCrease);
      }
    }
  }
  
  for (let numIterations = 0; numIterations < 500; numIterations++) {
    if (nodeQueue.size == 0) {
      g.state = CreasesGraphState.Clean;
      return g;
    } else {
      const v = getAnyElement(nodeQueue);
      nodeQueue.delete(v);
      const numActivePaths = v.edges.length;
      if (numActivePaths == 0) { // No active paths, so expand in place until we get an active path.
        let rOpt = 2;
        for (const possibleConstraintVertex of g.nodes.values()) {
          if (possibleConstraintVertex != v) {
            const xDistance = possibleConstraintVertex.x - v.x;
            const yDistance = possibleConstraintVertex.y - v.y;
            const distanceOnPlane = Math.sqrt(xDistance*xDistance + yDistance*yDistance);
            const r = distanceOnPlane - activeDistance(v, possibleConstraintVertex, p.scaleFactor, d, g.leafExtensions);
            //console.log(r);
            if (r < rOpt) {
              rOpt = r;
            }
          }
        }
        if (rOpt == 2) {
          throw new Error("Did not find a new binding constraint.");
        } else if (rOpt <= 0) {
          throw new Error("Should have detected active path earlier.");
        }
        //console.log(`Updating node from case 1:  v: ${v.id}  rOpt: ${rOpt/p.scaleFactor}`);
        updateNode(v, rOpt, v.x, v.y);
        nodeQueue.add(v);
      } else if (!v.onBoundaryOfSquare) {
        if (numActivePaths == 1) { // Only one active path, so expand along ray away from it until we hit another constraint.
          const x1 = v.x;
          const y1 = v.y;
          const u = v.edges[0].getOtherNode(v);
          const vectorFromActivePathX = x1 - u.x;
          const vectorFromActivePathY = y1 - u.y;
          const vectorFromActivePathLength = Math.sqrt(vectorFromActivePathX*vectorFromActivePathX + vectorFromActivePathY*vectorFromActivePathY);
          const dx = vectorFromActivePathX/vectorFromActivePathLength;
          const dy = vectorFromActivePathY/vectorFromActivePathLength;
          let rOpt = 2;
          let xOpt = -1;
          let yOpt = -1;
          //console.log(u.x/p.scaleFactor);
          //console.log(u.y/p.scaleFactor);
          //console.log(v.x/p.scaleFactor);
          //console.log(v.y/p.scaleFactor);
          //console.log(dx);
          //console.log(dy);
          
          // Check for active path constraints; based on 11-23-2020 whiteboard picture.
          for (const possibleConstraintVertex of g.nodes.values()) {
            if (possibleConstraintVertex != v && possibleConstraintVertex != u) {
              const x2 = possibleConstraintVertex.x;
              const y2 = possibleConstraintVertex.y;
              const xDiff = x1 - x2;
              const yDiff = y1 - y2;
              const r2 = activeDistance(v, possibleConstraintVertex, p.scaleFactor, d, g.leafExtensions);
              const r = (r2*r2 - xDiff*xDiff - yDiff*yDiff)/(2*(dx*xDiff + dy*yDiff - r2));
              //console.log(`Checking constraint on vertex ${possibleConstraintVertex.id}:  r = ${r/p.scaleFactor}`);
              if (0 < r && r < rOpt) {
                //console.log(`Updating rOpt = ${r/p.scaleFactor} from vertex ${possibleConstraintVertex.id} collision condition`);
                rOpt = r;
                xOpt = x1 + r*dx;
                yOpt = y1 + r*dy;
              }
            }
          }
          
          // Check x boundary conditions.
          if (Math.abs(dx) > TOLERANCE) {
            for (const r of [-x1/dx, (1 - x1)/dx]) {
              if (0 < r && r < rOpt) {
                //console.log(`Updating rOpt = ${r/p.scaleFactor} from x boundary condition`);
                rOpt = r;
                xOpt = x1 + r*dx;
                yOpt = y1 + r*dy;
              }
            }
          }
          
          // Check y boundary conditions.
          if (Math.abs(dy) > TOLERANCE) {
            for (const r of [-y1/dy, (1 - y1)/dy]) {
              if (0 < r && r < rOpt) {
                //console.log(`Updating rOpt = ${r/p.scaleFactor} from y boundary condition`);
                rOpt = r;
                xOpt = x1 + r*dx;
                yOpt = y1 + r*dy;
              }
            }
          }
          if (rOpt == 2) {
            throw new Error("Did not find a new binding constraint.");
          }
          //console.log(`Updating node from case 2:  v: ${v.id}  rOpt: ${rOpt/p.scaleFactor}  xOpt: ${xOpt/p.scaleFactor}  yOpt: ${yOpt/p.scaleFactor}`);
          updateNode(v, rOpt, xOpt, yOpt);
          nodeQueue.add(v);
        } else {
          const [indexOfConvexGap, v1t, v2t] = getIndexOfConvexGap(v);
          if (indexOfConvexGap != null) { // We potentially have a non-convex active polygon, so expand both circles simultaneously.
            const v1 = v1t as CreasesNode;
            const v2 = v2t as CreasesNode;
            const x1 = v1.x;
            const y1 = v1.y;
            const x2 = v2.x;
            const y2 = v2.y;
            const baseR1 = activeDistance(v, v1, p.scaleFactor, d, g.leafExtensions);
            const baseR2 = activeDistance(v, v2, p.scaleFactor, d, g.leafExtensions);
            const parallelX = x2 - x1;
            const parallelY = y2 - y1;
            const leftX = -parallelY;
            const leftY = parallelX;
            const onLeftSide = (v.x - v1.x)*leftX + (v.y - v1.y)*leftY > 0;
            const possibleConstraintVertices = new Set(Array.from(g.nodes.values()));
            possibleConstraintVertices.delete(v);
            for (const neighboringEdge of v.edges) {
              possibleConstraintVertices.delete(neighboringEdge.getOtherNode(v) as CreasesNode);
            }
            
            // Binary search for smallest leaf radius we can legally add.
            let r = 1;
            for (let dr = 0.5; dr > BINARY_SEARCH_TOLERANCE; dr = dr/2) {
              const [x, y] = get2CircleIntersection(x1, y1, baseR1 + r, x2, y2, baseR2 + r, onLeftSide);
              let constraintViolated = x < 0 || y < 0 || x > 1 || y > 1;
              if (!constraintViolated) {
                for (const possibleConstraintVertex of possibleConstraintVertices) {
                  const xDistance = possibleConstraintVertex.x - x;
                  const yDistance = possibleConstraintVertex.y - y;
                  const distanceOnPlane = Math.sqrt(xDistance*xDistance + yDistance*yDistance);
                  if (possibleConstraintVertex.id == "3") {
                    //console.log(`Distance on plane: ${distanceOnPlane}  Active distance: ${activeDistance(v, possibleConstraintVertex, p.scaleFactor, d, g.leafExtensions)}`)
                  }
                  if (distanceOnPlane < activeDistance(v, possibleConstraintVertex, p.scaleFactor, d, g.leafExtensions) + r) {
                    constraintViolated = true;
                    break;
                  }
                }
              }
              if (constraintViolated) {
                r -= dr;
                //console.log(r/p.scaleFactor);
              } else {
                r += dr;
                //console.log(r/p.scaleFactor);
              }
            }
            const [x, y] = get2CircleIntersection(x1, y1, baseR1 + r, x2, y2, baseR2 + r, onLeftSide);
            //console.log(`Updating node from case 3:  v: ${v.id}  r: ${r/p.scaleFactor}  x: ${x/p.scaleFactor}  y: ${y/p.scaleFactor}`);
            updateNode(v, r, x, y);
            nodeQueue.add(v);
          }
        }
      }
    }
  }
  throw new Error("Caught in infinite loop while cleaning packing.");
}


// Returns whether v1-v2-v3 makes a right turn, and whether it is close to 180 degrees.
export function isRightTurn(v1, v2, v3) {
  const v1Angle = Math.atan2(v1.y - v2.y, v1.x - v2.x);
  const v3Angle = Math.atan2(v3.y - v2.y, v3.x - v2.x);
  const angleDifference = v3Angle - v1Angle;
  if (angleDifference < 0) {
    return [angleDifference < IS_RIGHT_TURN_CUTOFF_1,
            angleDifference > -TOLERANCE || angleDifference < IS_RIGHT_TURN_CUTOFF_3];
  } else {
    return [angleDifference < IS_RIGHT_TURN_CUTOFF_2,
            angleDifference < TOLERANCE || angleDifference > IS_RIGHT_TURN_CUTOFF_4];
  }
}

export function buildFaces(g: CreasesGraph) {
  if (g.state != CreasesGraphState.Clean) {
    throw new Error(`Should not be calling buildFaces from state '${g.state}'.`);
  }
  
  // Compute convex hull using Graham scan with tolerance.
  let leastX = 2;
  let leastXVertex: null | CreasesNode = null;
  const points: Array<CreasesNode> = [];
  for (const v of g.nodes.values()) {
    if (v.x < leastX) {
      if (leastXVertex != null) {
        points.push(leastXVertex);
      }
      leastX = v.x;
      leastXVertex = v;
    } else {
      points.push(v);
    }
  }
  if (leastXVertex == null) {
    throw new Error("Bad node x values.");
  }
  const v0 = leastXVertex as CreasesNode;
  points.sort(function(v1, v2){
    const v1Angle = Math.atan2(v1.y - v0.y, v1.x - v0.x);
    const v2Angle = Math.atan2(v2.y - v0.y, v2.x - v0.x);
    return v2Angle - v1Angle;
  });
  const convexHull = [v0];
  let stillComputingConvexHull = true;
  for (let numIterations = 0; numIterations < 200; numIterations++) {
    if (points.length == 0) {
      stillComputingConvexHull = false;
      break;
    }
    const point = points.pop() as CreasesNode;
    while (convexHull.length > 1) {
      const [isRight, is180] = isRightTurn(convexHull[convexHull.length - 2], convexHull[convexHull.length - 1], point);
      if (isRight) {
        const removedPoint = convexHull.pop() as CreasesNode;
        if (is180) {
          points.push(removedPoint); // This is the key differnce from ordinary Graham scan.
        }
      } else {
        break;
      }
    }
    convexHull.push(point);
  }
  if (stillComputingConvexHull) {
    throw new Error("Caught in infinite loop while computing convex hull.");
  }
  //console.log(convexHull.map(v => v.id));
  
  // Set hull creases.
  for (let i = 0; i < convexHull.length; i++) {
    const v1 = convexHull[i] as CreasesNode;
    const v2 = convexHull[(i + 1) % convexHull.length] as CreasesNode;
    const e = g.getEdge(v1, v2);
    if (e == undefined) {
      g.addEdge(new Crease(v2, v1, CreaseType.InactiveHull));
    } else {
      e.updateCreaseType(CreaseType.ActiveHull);
    }
  }
  
  // Construct faces.
  const undiscoveredEdges = new Set(g.edges.values());
  const edgeQueue: Set<Crease> = new Set();
  const firstVertexOfConvexHull = convexHull[0] as CreasesNode;
  const secondVertexOfConvexHull = convexHull[1] as CreasesNode;
  const firstEdgeOfConvexHull = g.getEdge(firstVertexOfConvexHull, secondVertexOfConvexHull) as Crease;
  edgeQueue.add(firstEdgeOfConvexHull);
  undiscoveredEdges.delete(firstEdgeOfConvexHull);
  function fillInFaceToTheLeft(vStart: CreasesNode, eStart: Crease) {
    const face = new Face();
    g.faces.add(face);
    let v = vStart;
    let e = eStart;
    //console.log(`Filling in face to the left from: ${v.id}  ${e.idString()}.`);
    for (let numIterations = 0; numIterations < 100; numIterations++) {
      //console.log(`${v.id}  ${e.idString()}`);
      face.nodes.push(v);
      if (v == e.from) {
        if (e.leftFace == null) {
          e.leftFace = face;
        } else {
          throw new Error(`Left face has already been set for edge ${e.idString()}.`);
        }
      } else {
        if (e.right == null) {
          e.rightFace = face;
        } else {
          throw new Error(`Right face has already been set for edge ${e.idString()}.`);
        }
      }
      v = e.getOtherNode(v) as CreasesNode;
      e = v.clockwise(e) as Crease;
      if (v == vStart && e == eStart) {
        return;
      } else if (undiscoveredEdges.delete(e)) {
        //console.log(`Deleting ${e.idString()} from undiscoveredEdges.`);
        edgeQueue.add(e);
      }
    }
    throw new Error("Caught in infinite loop while building faces.");
  }
  while (edgeQueue.size > 0) {
    const e = getAnyElement(edgeQueue);
    edgeQueue.delete(e);
    if (e.leftFace == null) {
      fillInFaceToTheLeft(e.from as CreasesNode, e);
    }
    if (e.rightFace == null) {
      fillInFaceToTheLeft(e.to as CreasesNode, e);
    }
  }
  
  // Check that all creases are accounted for (will be good if graph is connected).
  if (undiscoveredEdges.size > 0) {
    throw new Error(`Edges ${Array.from(undiscoveredEdges).map(e => e.idString())} lie in different component than first hull edge.`);
  }
  
  // Set outer face.
  if (firstEdgeOfConvexHull.from == firstVertexOfConvexHull) {
    (firstEdgeOfConvexHull.rightFace as Face).isOuterFace = true;
  } else {
    (firstEdgeOfConvexHull.leftFace as Face).isOuterFace = true;
  }
  
  g.state = CreasesGraphState.PreUMA;
}

export function buildMoleculeRecursive(wholeFace: Face, elevation: number) {
  // TODO(Jamie).
}

export function generateMolecules(g: CreasesGraph) {
  if (g.state != CreasesGraphState.PreUMA) {
    throw new Error(`Should not be calling buildFaces from state '${g.state}'.`);
  }
  for (const face of Array.from(g.faces)) {
    if (!face.isOuterFace) {
      buildMoleculeRecursive(face, 0);
    }
  }
  
  // TODO(Jamie) Build creases.
  
  /* TODO Uncomment and test this if we care about it.
  for (const v of Array.from(g.nodes.values()) {
    g.suppressRidgeNodeIfRedundant(v);
  }*/
  
  g.state = CreasesGraphState.PostUMA;
}



















