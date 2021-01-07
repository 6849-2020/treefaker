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
  Graph,
  TreeGraph,
  CreasesGraphState,
  CreasesGraph
} from "../packing";

// Returns the minimum distance enforced by the tree constraints in paper-units.
function activeDistance(
  v1: CreasesNode,
  v2: CreasesNode,
  scaleFactor: number,
  d: Map<string, Map<string, Array<[string, number]>>>,
  leafExtensions: Map<CreasesNode, number>
) {
  const distancesAlongPath = (d.get(v1.id) as Map<
    string,
    Array<[string, number]>
  >).get(v2.id) as Array<[string, number]>;
  const distanceAlongPath = distancesAlongPath[
    distancesAlongPath.length - 1
  ][1] as number;
  return (
    scaleFactor *
    (distanceAlongPath +
      (leafExtensions.get(v1) as number) +
      (leafExtensions.get(v2) as number))
  );
}

// Returns whether a path is active, throwing an error if the distance constraint is violated.
function isActive(
  v1: CreasesNode,
  v2: CreasesNode,
  scaleFactor: number,
  d: Map<string, Map<string, Array<[string, number]>>>,
  leafExtensions: Map<CreasesNode, number>,
  tolerance: number
) {
  const xDistance = v2.x - v1.x;
  const yDistance = v2.y - v1.y;
  const distanceOnPlane = Math.sqrt(
    xDistance * xDistance + yDistance * yDistance
  );
  //console.log(`v1.id: ${v1.id}  v2.id: ${v2.id}`);
  //console.log(`Computing isActive - Distance on plane: ${distanceOnPlane}  Active distance: ${activeDistance(v1, v2, scaleFactor, d, leafExtensions)}`)
  const slack =
    distanceOnPlane - activeDistance(v1, v2, scaleFactor, d, leafExtensions);
  if (slack < -tolerance) {
    console.log(
      `distanceOnPlane: ${distanceOnPlane}    activeDIstance: ${activeDistance(
        v1,
        v2,
        scaleFactor,
        d,
        leafExtensions
      )}`
    );
    throw new Error(
      `Insufficient slack of ${slack} between nodes '${v1.id}' and '${v2.id}'.`
    );
  } else {
    return slack < tolerance;
  }
}

// Using formula and notation from: https://mathworld.wolfram.com/Circle-CircleIntersection.html
export function get2CircleIntersection(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
  onLeftSide: boolean
) {
  const r1Squared = r1 * r1;
  const r2Squared = r2 * r2;
  const parallelX = x2 - x1;
  const parallelY = y2 - y1;
  const perpendicularX = onLeftSide ? -parallelY : parallelY;
  const perpendicularY = onLeftSide ? parallelX : -parallelX;
  const dSquared = parallelX * parallelX + parallelY * parallelY;
  const twoDSquared = 2 * dSquared;
  //const d = Math.sqrt(dSquared);
  const t = dSquared - r2Squared + r1Squared;
  const parallelDistanceScaled = t / twoDSquared; // AKA "x/d" from Wolfram site.
  const perpendicularDistanceScaled =
    Math.sqrt(4 * dSquared * r1Squared - t * t) / twoDSquared; // AKA "y/d" from Wolfram site.
  const x =
    x1 +
    parallelX * parallelDistanceScaled +
    perpendicularX * perpendicularDistanceScaled;
  const y =
    y1 +
    parallelY * parallelDistanceScaled +
    perpendicularY * perpendicularDistanceScaled;
  return [x, y];
}

// Returns a pair of adjacent nodes that forms a convex angle on one side, if it exists.
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
      v2Angle += 2 * Math.PI;
    }
    const angleDifference = v2Angle - v1Angle;
    //console.log(`Angle difference: ${angleDifference}`);
    if (angleDifference > Math.PI + TOLERANCE) {
      return [index, v1, v2];
    }
  }
  return [null, null, null];
}

// Makes leafs longer so that all active polygons are convex.
export function cleanPacking(
  p: Packing,
  d: Map<string, Map<string, Array<[string, number]>>>
): CreasesGraph {
  if (p.nodes.size < 2) {
    throw new Error("Must have at least two nodes in packing.");
  }

  // Make creases graph with Axial creases along each active path.
  const g = new CreasesGraph(p);
  for (const v1 of g.nodes.values()) {
    for (const v2 of g.nodes.values()) {
      if (
        v1.id < v2.id &&
        isActive(v1, v2, p.scaleFactor, d, g.leafExtensions, TOLERANCE)
      ) {
        const axialCrease = new Crease(v2, v1, CreaseType.Axial, null);
        g.addEdge(axialCrease);
      }
    }
  }
  const nodeQueue = new Set(g.nodes.values());

  // This function will be called repeatedly to reposition a vertex and recompute what paths are active.
  function updateNode(v: CreasesNode, r: number, x: number, y: number) {
    // Add leaf extension.
    const oldLeafExtension = g.leafExtensions.get(v) as number;
    g.leafExtensions.set(v, oldLeafExtension + r / p.scaleFactor);

    // Move vertex v to new position in packing and creases graph.
    (p.nodes.get(v.id) as PackingNode).x = x;
    (p.nodes.get(v.id) as PackingNode).y = y;
    v.x = x;
    v.y = y;
    v.onBoundaryOfSquare =
      v.x < TOLERANCE ||
      v.y < TOLERANCE ||
      v.x > 1 - TOLERANCE ||
      v.y > 1 - TOLERANCE;

    // Recompute active paths.
    for (const e of [...v.edges]) {
      nodeQueue.add(e.getOtherNode(v) as CreasesNode);
      g.removeEdge(e as Crease);
    }
    for (const u of g.nodes.values()) {
      if (
        u != v &&
        isActive(v, u, p.scaleFactor, d, g.leafExtensions, UPDATE_TOLERANCE)
      ) {
        const axialCrease = new Crease(v, u, CreaseType.Axial, null);
        g.addEdge(axialCrease);
      }
    }
  }

  // Main loop, tries to clean packing until the nodeQueue is empty, which means there are no more potential problems.
  for (let numIterations = 0; numIterations < 500; numIterations++) {
    if (nodeQueue.size == 0) {
      g.state = CreasesGraphState.Clean;
      return g;
    } else {
      const v = getAnyElement(nodeQueue);
      nodeQueue.delete(v);
      const numActivePaths = v.edges.length;
      if (numActivePaths == 0) {
        // No active paths, so expand in place until we get an active path.
        let rOpt = 2;
        for (const possibleConstraintVertex of g.nodes.values()) {
          if (possibleConstraintVertex != v) {
            const xDistance = possibleConstraintVertex.x - v.x;
            const yDistance = possibleConstraintVertex.y - v.y;
            const distanceOnPlane = Math.sqrt(
              xDistance * xDistance + yDistance * yDistance
            );
            const r =
              distanceOnPlane -
              activeDistance(
                v,
                possibleConstraintVertex,
                p.scaleFactor,
                d,
                g.leafExtensions
              );
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
        if (numActivePaths == 1) {
          // Only one active path, so expand along ray away from it until we hit another constraint.
          const x1 = v.x;
          const y1 = v.y;
          const u = v.edges[0].getOtherNode(v);
          const vectorFromActivePathX = x1 - u.x;
          const vectorFromActivePathY = y1 - u.y;
          const vectorFromActivePathLength = Math.sqrt(
            vectorFromActivePathX * vectorFromActivePathX +
              vectorFromActivePathY * vectorFromActivePathY
          );
          const dx = vectorFromActivePathX / vectorFromActivePathLength;
          const dy = vectorFromActivePathY / vectorFromActivePathLength;
          let rOpt = 2;
          let xOpt = -1;
          let yOpt = -1;

          // Check for active path constraints; based on 11-23-2020 whiteboard picture.
          for (const possibleConstraintVertex of g.nodes.values()) {
            if (
              possibleConstraintVertex != v &&
              possibleConstraintVertex != u
            ) {
              const x2 = possibleConstraintVertex.x;
              const y2 = possibleConstraintVertex.y;
              const xDiff = x1 - x2;
              const yDiff = y1 - y2;
              const r2 = activeDistance(
                v,
                possibleConstraintVertex,
                p.scaleFactor,
                d,
                g.leafExtensions
              );
              const r =
                (r2 * r2 - xDiff * xDiff - yDiff * yDiff) /
                (2 * (dx * xDiff + dy * yDiff - r2));
              //console.log(`Checking constraint on vertex ${possibleConstraintVertex.id}:  r = ${r/p.scaleFactor}`);
              if (0 < r && r < rOpt) {
                //console.log(`Updating rOpt = ${r/p.scaleFactor} from vertex ${possibleConstraintVertex.id} collision condition`);
                rOpt = r;
                xOpt = x1 + r * dx;
                yOpt = y1 + r * dy;
              }
            }
          }

          // Check x boundary conditions.
          if (Math.abs(dx) > TOLERANCE) {
            for (const r of [-x1 / dx, (1 - x1) / dx]) {
              if (0 < r && r < rOpt) {
                //console.log(`Updating rOpt = ${r/p.scaleFactor} from x boundary condition`);
                rOpt = r;
                xOpt = x1 + r * dx;
                yOpt = y1 + r * dy;
              }
            }
          }

          // Check y boundary conditions.
          if (Math.abs(dy) > TOLERANCE) {
            for (const r of [-y1 / dy, (1 - y1) / dy]) {
              if (0 < r && r < rOpt) {
                //console.log(`Updating rOpt = ${r/p.scaleFactor} from y boundary condition`);
                rOpt = r;
                xOpt = x1 + r * dx;
                yOpt = y1 + r * dy;
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
          if (indexOfConvexGap != null) {
            // We potentially have a non-convex active polygon, so expand both circles simultaneously.
            const v1 = v1t as CreasesNode;
            const v2 = v2t as CreasesNode;
            const x1 = v1.x;
            const y1 = v1.y;
            const x2 = v2.x;
            const y2 = v2.y;
            const baseR1 = activeDistance(
              v,
              v1,
              p.scaleFactor,
              d,
              g.leafExtensions
            );
            const baseR2 = activeDistance(
              v,
              v2,
              p.scaleFactor,
              d,
              g.leafExtensions
            );
            const parallelX = x2 - x1;
            const parallelY = y2 - y1;
            const leftX = -parallelY;
            const leftY = parallelX;
            const onLeftSide = (v.x - v1.x) * leftX + (v.y - v1.y) * leftY > 0;
            const possibleConstraintVertices = new Set(
              Array.from(g.nodes.values())
            );
            possibleConstraintVertices.delete(v);
            for (const neighboringEdge of v.edges) {
              possibleConstraintVertices.delete(
                neighboringEdge.getOtherNode(v) as CreasesNode
              );
            }

            // Binary search for smallest leaf radius we can legally add.
            let r = 1;
            for (let dr = 0.5; dr > BINARY_SEARCH_TOLERANCE; dr = dr / 2) {
              const [x, y] = get2CircleIntersection(
                x1,
                y1,
                baseR1 + r,
                x2,
                y2,
                baseR2 + r,
                onLeftSide
              );
              let constraintViolated = x < 0 || y < 0 || x > 1 || y > 1;
              if (!constraintViolated) {
                for (const possibleConstraintVertex of possibleConstraintVertices) {
                  const xDistance = possibleConstraintVertex.x - x;
                  const yDistance = possibleConstraintVertex.y - y;
                  const distanceOnPlane = Math.sqrt(
                    xDistance * xDistance + yDistance * yDistance
                  );
                  if (
                    distanceOnPlane <
                    activeDistance(
                      v,
                      possibleConstraintVertex,
                      p.scaleFactor,
                      d,
                      g.leafExtensions
                    ) +
                      r
                  ) {
                    constraintViolated = true;
                    break;
                  }
                }
              }
              if (constraintViolated) {
                r -= dr;
              } else {
                r += dr;
              }
            }
            const [x, y] = get2CircleIntersection(
              x1,
              y1,
              baseR1 + r,
              x2,
              y2,
              baseR2 + r,
              onLeftSide
            );
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
    return [
      angleDifference < IS_RIGHT_TURN_CUTOFF_1,
      angleDifference > -TOLERANCE || angleDifference < IS_RIGHT_TURN_CUTOFF_3
    ];
  } else {
    return [
      angleDifference < IS_RIGHT_TURN_CUTOFF_2,
      angleDifference < TOLERANCE || angleDifference > IS_RIGHT_TURN_CUTOFF_4
    ];
  }
}

// Builds a face for each active polygon. Returns an error message as a string if there are at least two inactive hull creases. Returns null if there are no errors.
export function buildFaces(g: CreasesGraph): null | string {
  if (g.state != CreasesGraphState.Clean) {
    throw new Error(
      `Should not be calling buildFaces from state ${
        CreasesGraphState[g.state]
      }.`
    );
  }

  // Compute convex hull using Graham Scan with tolerance.
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
  points.sort(function(v1, v2) {
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
      const [isRight, is180] = isRightTurn(
        convexHull[convexHull.length - 2],
        convexHull[convexHull.length - 1],
        point
      );
      if (isRight) {
        const removedPoint = convexHull.pop() as CreasesNode;
        if (is180) {
          points.push(removedPoint); // This is the key difference from ordinary Graham scan.
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

  // Set hull creases.
  for (let i = 0; i < convexHull.length; i++) {
    const v1 = convexHull[i] as CreasesNode;
    const v2 = convexHull[(i + 1) % convexHull.length] as CreasesNode;
    const e = g.getEdge(v1, v2);
    if (e == undefined) {
      g.addEdge(new Crease(v2, v1, CreaseType.InactiveHull, null));
    } else {
      e.updateCreaseType(CreaseType.ActiveHull);
    }
  }

  // Construct faces.
  let foundOuterFace = false;
  const undiscoveredEdges = new Set(g.edges.values());
  const edgeQueue: Set<Crease> = new Set();
  const firstVertexOfConvexHull = convexHull[0] as CreasesNode;
  const secondVertexOfConvexHull = convexHull[1] as CreasesNode;
  const firstEdgeOfConvexHull = g.getEdge(
    firstVertexOfConvexHull,
    secondVertexOfConvexHull
  ) as Crease;
  edgeQueue.add(firstEdgeOfConvexHull);
  undiscoveredEdges.delete(firstEdgeOfConvexHull);
  function fillInFaceToTheLeft(
    vStart: CreasesNode,
    eStart: Crease
  ): null | string {
    const face = new Face();
    g.faces.add(face);
    if (
      eStart == firstEdgeOfConvexHull &&
      eStart.getOtherNode(vStart) == firstVertexOfConvexHull
    ) {
      if (foundOuterFace) {
        throw new Error("Already found outer face.");
      }
      face.isOuterFace = true;
      foundOuterFace = true;
    }
    let v = vStart;
    let e = eStart;
    for (let numIterations = 0; numIterations < 100; numIterations++) {
      face.nodes.push(v);
      if (v == e.from) {
        if (e.leftFace == null) {
          e.leftFace = face;
        } else {
          throw new Error(
            `Left face has already been set for edge ${e.idString()}.`
          );
        }
      } else {
        if (e.right == null) {
          e.rightFace = face;
        } else {
          throw new Error(
            `Right face has already been set for edge ${e.idString()}.`
          );
        }
      }
      if (e.creaseType == CreaseType.InactiveHull) {
        if (!face.isOuterFace) {
          if (face.inactiveHullEdge == null) {
            face.inactiveHullEdge = e;
          } else {
            return `Face ${face.nodes.map(
              n => n.id
            )} has at least two inactive hull edges: ${face.inactiveHullEdge.idString()} and ${e.idString()}.`;
          }
        }
      }
      v = e.getOtherNode(v) as CreasesNode;
      e = v.clockwise(e) as Crease;
      if (v == vStart && e == eStart) {
        return null;
      } else if (undiscoveredEdges.delete(e)) {
        edgeQueue.add(e);
      }
    }
    throw new Error("Caught in infinite loop while building faces.");
  }
  while (edgeQueue.size > 0) {
    const e = getAnyElement(edgeQueue);
    edgeQueue.delete(e);
    if (e.leftFace == null) {
      const errorMessage = fillInFaceToTheLeft(e.from as CreasesNode, e);
      if (errorMessage != null) {
        return errorMessage;
      }
    }
    if (e.rightFace == null) {
      const errorMessage = fillInFaceToTheLeft(e.to as CreasesNode, e);
      if (errorMessage != null) {
        return errorMessage;
      }
    }
  }

  if (!foundOuterFace) {
    throw new Error("Could not find outer face.");
  }

  // Check that all creases are accounted for (will be good if graph is connected).
  if (undiscoveredEdges.size > 0) {
    throw new Error(
      `Edges ${Array.from(undiscoveredEdges).map(e =>
        e.idString()
      )} lie in different component than first hull edge.`
    );
  }

  g.state = CreasesGraphState.PreUMA;
  return null;
}

export function isTwisted(
  d: Map<string, Map<string, Array<[string, number]>>>,
  g: CreasesGraph
) {
  if (g.state != CreasesGraphState.PreUMA) {
    throw new Error(
      `Should not be calling isTwisted from state ${
        CreasesGraphState[g.state]
      }.`
    );
  }
  for (const face of g.faces) {
    if (face.isOuterFace) {
      continue;
    }
    const visitedEdgeStrings: Set<string> = new Set();
    for (let faceIndex = 0; faceIndex < face.nodes.length; faceIndex++) {
      const vStart = face.nodes[faceIndex] as CreasesNode;
      const vEnd = face.nodes[
        (faceIndex + 1) % face.nodes.length
      ] as CreasesNode;
      //console.log(`vStart: ${vStart.id}  vEnd: ${vEnd.id}`);
      const distancesAlongPath = d.get(vStart.id)?.get(vEnd.id) as Array<
        [string, number]
      >;
      //console.log(distancesAlongPath);
      const numInternalEdgesToCheck = distancesAlongPath.length - 2;
      for (
        let pathIndex = 0;
        pathIndex < numInternalEdgesToCheck;
        pathIndex++
      ) {
        const id1: string = distancesAlongPath[pathIndex][0];
        const id2: string = distancesAlongPath[pathIndex + 1][0];
        const edgeString = id1 + "-" + id2;
        if (visitedEdgeStrings.has(edgeString)) {
          return true;
        } else {
          //console.log(edgeString);
          visitedEdgeStrings.add(edgeString);
        }
      }
    }
  }
  return false;
}

export function buildMoleculeRecursive(
  g: CreasesGraph,
  baseFace: Face,
  boundary: CreasesNode[],
  z: Map<
    CreasesNode,
    Map<CreasesNode, Array<[string, number, CreasesNode | null]>>
  >,
  newCreases: Set<Crease>,
  elevation: number
) {
  // Compute inset amount h. Cut-and-pasted from TM5 source code:
  // https://github.com/6849-2020/treemaker/blob/75b47cdcd46a45e5de0eba95630119d2828426ad/Source/tmModel/tmTreeClasses/tmPoly.cpp#L719
  const nn = boundary.length;
  const r: number[][] = []; // bisector vector at each corner
  const rp: number[][] = []; // normalized vector to previous corner
  const rn: number[][] = []; // normalized vector to next corner
  const mr: number[] = []; // magnitude of projection of r along previous side

  for (let i = 0; i < nn; i++) {
    // get offsets of previous (ip) and next (in) corner, including
    // wrap-around effects.
    const ip = (i + nn - 1) % nn;
    const iN = (i + 1) % nn;

    const nip = boundary[ip];
    const nii = boundary[i];
    const nin = boundary[iN];

    // construct bisector and the magnitude of its projections along the
    // previous and next sides. All quantities are normalized to a unit inset
    // distance h.
    const dxp = nip.x - nii.x;
    const dyp = nip.y - nii.y;
    const magnitudeP = Math.sqrt(dxp * dxp + dyp * dyp);
    const rpx = dxp / magnitudeP;
    const rpy = dyp / magnitudeP;
    rp.push([rpx, rpy]); // vector to previous corner
    const dxn = nin.x - nii.x;
    const dyn = nin.y - nii.y;
    const magnitudeN = Math.sqrt(dxn * dxn + dyn * dyn);
    const rnx = dxn / magnitudeN;
    const rny = dyn / magnitudeN;
    rn.push([rnx, rny]); // vector to next corner
    const dxbis = rpy - rny;
    const dybis = rnx - rpx;
    const magnitudeBis = Math.sqrt(dxbis * dxbis + dybis * dybis);
    const bisx = dxbis / magnitudeBis; // angle bisector
    const bisy = dybis / magnitudeBis; // angle bisector
    const innerProduct = bisy * rnx - bisx * rny;
    const rx = bisx / innerProduct;
    const ry = bisy / innerProduct;
    r.push([rx, ry]); // normalize to unit inset
    mr.push(rx * rpx + ry * rpy); // cotangent of bisected angle
  }

  // Now compute the maximum value of the inset distance h that satifies the
  // reduced path condition for every path in the polygon. We handle RingPaths
  // and CrossPaths differently. i and j are the indices of the corners of the
  // path.

  let h = 2; // the best inset distance to use
  for (let i = 0; i < nn; i++) {
    for (let j = i + 1; j < nn; j++) {
      const [rix, riy] = r[i];
      const [rjx, rjy] = r[j];

      // If the angle bisectors are parallel and are pointing the same
      // direction, there's no solution, so go on to the next corner.
      const riAngle = Math.atan2(riy, rix);
      const rjAngle = Math.atan2(rjy, rjx);
      const angleDiff = Math.abs(rjAngle - riAngle);
      if (angleDiff < TOLERANCE || angleDiff > IS_RIGHT_TURN_CUTOFF_4) {
        continue;
      }

      // Get coordinates of the two nodes that we're checking
      const ni = boundary[i];
      const nj = boundary[j];

      // for paths between adjacent nodes, we'll use the intersection of
      // the bisectors to determine the maximum inset.
      if (j == i + 1 || (i == 0 && j == nn - 1)) {
        const numeratorX = ni.x - nj.x;
        const numeratorY = ni.y - nj.y;
        const denominatorX = rjx - rix;
        const denominatorY = rjy - riy;
        const denominator =
          denominatorX * denominatorX + denominatorY * denominatorY;
        if (denominator > 0) {
          const numerator = numeratorX * numeratorX + numeratorY * numeratorY;
          const h1 = Math.sqrt(numerator / denominator);
          if (h > h1) {
            //console.log(`Updating h = ${h1} from collision.`);
            h = h1;
          }
        }
      } else {
        // for paths between nonadjacent nodes, we'll compute the inset
        // distance (using the cotangents of the base angles) that makes the
        // given path active. If the computed inset distance is either complex
        // or negative, there's no solution. We'll keep the smallest inset
        // distance that we find.

        // Note: an alternate way of structuring this would be to iterate
        // through the mRingPaths and mCrossPaths separately; I wouldn't have
        // to call FindPath. But I reference the tmNode information in the
        // vectors by what amounts to the index of the mRingNode. So I do it
        // this way. A better way, which I should implement in the future, is
        // to put the vector data into scratch fields of the tmNode.

        // Note that if the reduced path length comes out to be negative,
        // we've found a spurious solution; so we have to detect and
        // eliminate that case.
        let lij = 0;
        const zMap = z.get(ni);
        if (zMap == undefined) {
          const zDistances = (z.get(nj) as Map<
            CreasesNode,
            Array<[string, number, CreasesNode | null]>
          >).get(ni) as Array<[string, number, CreasesNode | null]>;
          lij = (zDistances[zDistances.length - 1] as [
            string,
            number,
            CreasesNode | null
          ])[1];
        } else {
          let zDistances = zMap.get(nj);
          if (zDistances == undefined) {
            zDistances = (z.get(nj) as Map<
              CreasesNode,
              Array<[string, number, CreasesNode | null]>
            >).get(ni);
          }
          lij = ((zDistances as Array<[string, number, CreasesNode | null]>)[
            (zDistances as Array<[string, number, CreasesNode | null]>).length -
              1
          ] as [string, number, CreasesNode | null])[1];
        }
        const ux = ni.x - nj.x;
        const uy = ni.y - nj.y;
        const vx = rix - rjx;
        const vy = riy - rjy;
        const w = (mr[i] as number) + (mr[j] as number);
        const a = vx * vx + vy * vy - w * w;
        const b = ux * vx + uy * vy + lij * w;
        const c = ux * ux + uy * uy - lij * lij;
        const d = b * b - a * c;
        if (d < 0) continue; // both solutions are complex

        let h1 = (-b + Math.sqrt(d)) / a; // trial solution for inset distance
        let lijp = lij - h1 * w; // reduced path length
        if (lijp > 0 && h1 > 0 && h > h1) {
          //console.log(`Updating h = ${h1} from first case of active reduced path.`);
          h = h1;
        }

        h1 = (-b - Math.sqrt(d)) / a; // other trial solution
        lijp = lij - h1 * (mr[i] + mr[j]); // reduced path length
        if (lijp > 0 && h1 > 0 && h > h1) {
          //console.log(`Updating h = ${h1} from second case of active reduced path.`);
          h = h1;
        }
      }
    }
  }
  const newElevation = elevation + h;

  // Compute locations of inset nodes and connect with Ridge creases.
  const insetNodes: Array<CreasesNode> = [];
  const otherRidgeNodesArray: Array<CreasesNode> = [];
  const otherRidgeNodes = new Map<Crease, Array<[number, CreasesNode]>>();
  function getOrMakeNode(
    nodeX: number,
    nodeY: number,
    checkInsetNodes: boolean,
    displayId: string
  ): [CreasesNode, boolean] {
    for (const alreadyThereNode of checkInsetNodes
      ? insetNodes
      : otherRidgeNodesArray) {
      if (
        Math.abs(alreadyThereNode.x - nodeX) < TOLERANCE &&
        Math.abs(alreadyThereNode.y - nodeY) < TOLERANCE
      ) {
        if (displayId != "") {
          alreadyThereNode.displayId = displayId;
        }
        return [alreadyThereNode, false] as [CreasesNode, boolean];
      }
    }
    const newNode = new CreasesNode(
      g.nextInternalId(),
      displayId,
      nodeX,
      nodeY,
      newElevation
    );
    //console.log(`Making new node from getOrMake - ${newNode.id} at (${nodeX}, ${nodeY}).`);
    return [newNode, true] as [CreasesNode, boolean];
  }
  for (let i = 0; i < boundary.length; i++) {
    const boundaryNode = boundary[i] as CreasesNode;
    const [rix, riy] = r[i] as [number, number];
    const insetNodeX = boundaryNode.x + h * rix;
    const insetNodeY = boundaryNode.y + h * riy;
    const [insetNode, madeNewNode] = getOrMakeNode(
      insetNodeX,
      insetNodeY,
      true,
      ""
    );
    if (madeNewNode) {
      insetNodes.push(insetNode);
      g.addNode(insetNode);
    }
    boundaryNode.goUpRidge = insetNode;
    const newCrease = new Crease(
      insetNode,
      boundaryNode,
      CreaseType.Ridge,
      baseFace
    );
    otherRidgeNodes.set(newCrease, []);
    newCreases.add(newCrease);
    g.addEdge(newCrease);
  }

  // Hook up hinge creases and use to define z on adjacent inset nodes.
  //console.log(`Inset nodes: ${insetNodes.map(n => n.id)}`);
  const numberOfInsetNodes = insetNodes.length;
  let finalRidgeCreaseNode1: CreasesNode | null = null;
  let finalRidgeCreaseNode2: CreasesNode | null = null;
  if (insetNodes.length == 2) {
    [finalRidgeCreaseNode1, finalRidgeCreaseNode2] = insetNodes;
  }

  for (let i = 0; i < nn; i++) {
    for (let j = i + 1; j < nn; j++) {
      let chopOffFromJ = h * mr[j];
      let chopOffFromI = h * mr[i];
      let nodeJ = boundary[j];
      let nodeI = boundary[i];
      if (
        z.get(nodeJ) == undefined ||
        (z.get(nodeJ) as Map<
          CreasesNode,
          Array<[string, number, CreasesNode | null]>
        >).get(nodeI) == undefined
      ) {
        // The zDistances are only defined in one (arbitrary) direction, so need to swap everything if we guessed wrong.
        const temp1 = nodeJ;
        nodeJ = nodeI;
        nodeI = temp1;
        const temp2 = chopOffFromJ;
        chopOffFromJ = chopOffFromI;
        chopOffFromI = temp2;
      }
      const insetNodeJ = nodeJ.goUpRidge as CreasesNode;
      const insetNodeI = nodeI.goUpRidge as CreasesNode;
      const adjacentOnBoundary = j == i + 1 || (i == 0 && j == nn - 1);
      if (!adjacentOnBoundary) {
        if (insetNodeI == insetNodeJ) {
          continue;
        }
        const index = insetNodes.indexOf(insetNodeJ);
        const nextIndex = (index + 1) % numberOfInsetNodes;
        const previousIndex =
          (index + numberOfInsetNodes - 1) % numberOfInsetNodes;
        if (
          insetNodes[previousIndex] == insetNodeI ||
          insetNodes[nextIndex] == insetNodeI
        ) {
          continue;
        }
      }
      const zDistances = (z.get(nodeJ) as Map<
        CreasesNode,
        Array<[string, number, CreasesNode]>
      >).get(nodeI) as Array<[string, number, CreasesNode]>;
      const distanceToI = (zDistances[zDistances.length - 1] as [
        string,
        number,
        CreasesNode | null
      ])[1];
      const distanceFromIToInsetJ = distanceToI - chopOffFromJ;
      const insetDistanceToI = distanceFromIToInsetJ - chopOffFromI;
      const insetZDistances: Array<[string, number, CreasesNode | null]> = [];
      if (z.get(insetNodeJ) == undefined) {
        z.set(insetNodeJ, new Map());
      }
      (z.get(insetNodeJ) as Map<
        CreasesNode,
        Array<[string, number, CreasesNode | null]>
      >).set(insetNodeI, insetZDistances);
      const numInternalNodes = zDistances.length - 1;
      let lastNode = insetNodeJ;
      for (let k = 0; k < numInternalNodes; k++) {
        const [
          internalNodeId,
          distanceToInternalNode,
          internalNode
        ] = zDistances[k];
        if (adjacentOnBoundary && internalNode == null) {
          throw new Error(
            `Null internal node between ${nodeJ.id} and ${nodeI.id} at distance ${distanceToInternalNode}.`
          );
        }
        const insetDistanceToInternalNode =
          distanceToInternalNode - chopOffFromJ;
        if (insetDistanceToInternalNode < -TOLERANCE) {
          // Hinge crease intersects ridge crease to j.
          if (adjacentOnBoundary) {
            const fractionOver = distanceToInternalNode / chopOffFromJ;
            const [hingeNodeOnJRidge, madeNewNode] = getOrMakeNode(
              (1 - fractionOver) * nodeJ.x + fractionOver * insetNodeJ.x,
              (1 - fractionOver) * nodeJ.y + fractionOver * insetNodeJ.y,
              false,
              internalNodeId
            );
            if (madeNewNode) {
              g.addNode(hingeNodeOnJRidge);
              otherRidgeNodesArray.push(hingeNodeOnJRidge);
              (otherRidgeNodes.get(
                g.getEdge(nodeJ, insetNodeJ) as Crease
              ) as Array<[number, CreasesNode]>).push([
                distanceToInternalNode,
                hingeNodeOnJRidge
              ]);
            }
            const newCrease = new Crease(
              hingeNodeOnJRidge,
              internalNode,
              CreaseType.Hinge,
              baseFace
            );
            newCreases.add(newCrease);
            g.addEdge(newCrease);
          }
        } else if (insetDistanceToInternalNode < TOLERANCE) {
          // Hinge crease intersects ridge vertex j exactly.
          if (adjacentOnBoundary) {
            insetNodeJ.displayId = internalNodeId;
            const newCrease = new Crease(
              insetNodeJ,
              internalNode,
              CreaseType.Hinge,
              baseFace
            );
            newCreases.add(newCrease);
            g.addEdge(newCrease);
          }
        } else if (insetDistanceToInternalNode < insetDistanceToI - TOLERANCE) {
          // Hinge crease intersects in the middle, need to add to z.
          if (adjacentOnBoundary) {
            const fractionOver = insetDistanceToInternalNode / insetDistanceToI;
            const [hingeNodeOnInsetBoundary, madeNewNode] = getOrMakeNode(
              (1 - fractionOver) * insetNodeJ.x + fractionOver * insetNodeI.x,
              (1 - fractionOver) * insetNodeJ.y + fractionOver * insetNodeI.y,
              false,
              internalNodeId
            );
            if (madeNewNode) {
              g.addNode(hingeNodeOnInsetBoundary);
              otherRidgeNodesArray.push(hingeNodeOnInsetBoundary);
              insetZDistances.push([
                hingeNodeOnInsetBoundary.displayId,
                insetDistanceToInternalNode,
                hingeNodeOnInsetBoundary
              ]);
              if (numberOfInsetNodes == 2) {
                const newCrease = new Crease(
                  hingeNodeOnInsetBoundary,
                  lastNode,
                  CreaseType.Ridge,
                  baseFace
                );
                newCreases.add(newCrease);
                g.addEdge(newCrease);
                lastNode = hingeNodeOnInsetBoundary;
                finalRidgeCreaseNode1 = lastNode;
                finalRidgeCreaseNode2 = insetNodeI;
              }
            }
            const newCrease = new Crease(
              hingeNodeOnInsetBoundary,
              internalNode,
              CreaseType.Hinge,
              baseFace
            );
            newCreases.add(newCrease);
            g.addEdge(newCrease);
          } else {
            insetZDistances.push([
              internalNodeId,
              insetDistanceToInternalNode,
              null
            ]);
          }
        } else if (insetDistanceToInternalNode < insetDistanceToI + TOLERANCE) {
          // Hinge crease intersects ridge vertex i exactly.
          insetNodeI.displayId = internalNodeId;
          if (adjacentOnBoundary) {
            const newCrease = new Crease(
              insetNodeI,
              internalNode,
              CreaseType.Hinge,
              baseFace
            );
            newCreases.add(newCrease);
            g.addEdge(newCrease);
          }
        } else if (
          insetDistanceToInternalNode <
          distanceFromIToInsetJ - TOLERANCE
        ) {
          // Hinge crease intersects ridge crease to i.
          if (adjacentOnBoundary) {
            const distanceFromEnd =
              distanceFromIToInsetJ - insetDistanceToInternalNode;
            const fractionOver = distanceFromEnd / chopOffFromI;
            const [hingeNodeOnIRidge, madeNewNode] = getOrMakeNode(
              (1 - fractionOver) * nodeI.x + fractionOver * insetNodeI.x,
              (1 - fractionOver) * nodeI.y + fractionOver * insetNodeI.y,
              false,
              internalNodeId
            );
            if (madeNewNode) {
              g.addNode(hingeNodeOnIRidge);
              otherRidgeNodesArray.push(hingeNodeOnIRidge);
              (otherRidgeNodes.get(
                g.getEdge(nodeI, insetNodeI) as Crease
              ) as Array<[number, CreasesNode]>).push([
                distanceFromEnd,
                hingeNodeOnIRidge
              ]);
            }
            const newCrease = new Crease(
              hingeNodeOnIRidge,
              internalNode,
              CreaseType.Hinge,
              baseFace
            );
            newCreases.add(newCrease);
            g.addEdge(newCrease);
          }
        } else {
          throw new Error(
            `Distance from ${nodeJ.id} to ${internalNode.id} along boundary path to ${nodeI.id} is ${distanceToInternalNode}, which is too large (should be less than ${distanceFromIToInsetJ}).`
          );
        }
      }
      insetZDistances.push([
        insetNodeI.displayId,
        insetDistanceToI,
        insetNodeI
      ]);
    }
  }
  if (finalRidgeCreaseNode1 != null) {
    // This only happens if there are exactly two inset nodes - the rest of the ridge creases were filled in as the hinge nodes were added.
    const newCrease = new Crease(
      finalRidgeCreaseNode2 as CreasesNode,
      finalRidgeCreaseNode1 as CreasesNode,
      CreaseType.Ridge,
      baseFace
    );
    newCreases.add(newCrease);
    g.addEdge(newCrease);
  }

  // Subdivide ridges with new points that have been inserted for hinges creases.
  for (const ridgeCrease of otherRidgeNodes.keys()) {
    const nodesAlongRidge = otherRidgeNodes.get(ridgeCrease) as Array<
      [number, CreasesNode]
    >;
    if (nodesAlongRidge.length > 0) {
      nodesAlongRidge.sort((x, y) => x[0] - y[0]);
      newCreases.delete(ridgeCrease);
      g.removeEdge(ridgeCrease);
      let lastNode = ridgeCrease.from as CreasesNode;
      for (const nextNode of nodesAlongRidge
        .map(x => x[1] as CreasesNode)
        .concat(ridgeCrease.to as CreasesNode)) {
        const newCrease = new Crease(
          lastNode,
          nextNode,
          CreaseType.Ridge,
          baseFace
        );
        newCreases.add(newCrease);
        g.addEdge(newCrease);
        lastNode = nextNode;
      }
    }
  }

  // Recursively build sub-molecules if necessary.
  if (numberOfInsetNodes > 2) {
    //console.log(`Beginning recursive subdivision on inset nodes ${insetNodes.map(n => n.id)}.`);
    const indexStack = [numberOfInsetNodes - 1, 0];
    for (let numIterations = 0; numIterations < 100; numIterations++) {
      if (indexStack.length == 0) {
        //console.log(`Ending recursive subdivision on ${insetNodes.map(n => n.id)}.`);
        return newCreases;
      } else {
        const newBoundaryStartIndex = indexStack.pop() as number;
        const newBoundaryEndIndex = indexStack.pop() as number;
        ///console.log(`NEW ITERATION on ${insetNodes.map(n => n.id)} - Start index: ${newBoundaryStartIndex}  End index: ${newBoundaryEndIndex}.`);
        const newBoundary = [insetNodes[newBoundaryStartIndex]];
        let activePathStartIndex = newBoundaryStartIndex;
        while (activePathStartIndex < newBoundaryEndIndex) {
          let activePathEndIndex =
            activePathStartIndex == newBoundaryStartIndex
              ? newBoundaryEndIndex - 1
              : newBoundaryEndIndex;
          //console.log(`Starting to look for active reduced paths from start index ${activePathStartIndex} to end index ${activePathEndIndex}.`);
          for (
            ;
            activePathEndIndex > activePathStartIndex + 1;
            activePathEndIndex--
          ) {
            let activePathStartNode = insetNodes[activePathStartIndex];
            let activePathEndNode = insetNodes[activePathEndIndex];
            //console.log(`Checking if there is an active reduced path between ${activePathStartNode.id} and ${activePathEndNode.id}.`);
            if (
              z.get(activePathStartNode) == undefined ||
              (z.get(activePathStartNode) as Map<
                CreasesNode,
                Array<[string, number, CreasesNode | null]>
              >).get(activePathEndNode) == undefined
            ) {
              const temp = activePathStartNode;
              activePathStartNode = activePathEndNode;
              activePathEndNode = temp;
            }
            const zDistances = (z.get(activePathStartNode) as Map<
              CreasesNode,
              Array<[string, number, CreasesNode | null]>
            >).get(activePathEndNode) as Array<
              [string, number, CreasesNode | null]
            >;
            const distanceFromStartToEnd = (zDistances[
              zDistances.length - 1
            ] as [string, number, CreasesNode | null])[1];
            const dx = activePathEndNode.x - activePathStartNode.x;
            const dy = activePathEndNode.y - activePathStartNode.y;
            const distanceDifference =
              Math.sqrt(dx * dx + dy * dy) - distanceFromStartToEnd;
            if (distanceDifference < TOLERANCE) {
              // Active reduced path, so fill in zDistances with new nodes, connected by Gusset creases.
              //console.log("There is.");
              if (distanceDifference < -TOLERANCE) {
                console.log(zDistances);
                console.log(distanceFromStartToEnd);
                console.log(Math.sqrt(dx * dx + dy * dy));
                throw new Error(
                  `Looks like h = ${h} was inset too much, violating distance constraint.`
                );
              }
              const numInternalNodes = zDistances.length - 1;
              let lastNode = activePathStartNode;
              for (let k = 0; k < numInternalNodes; k++) {
                const [
                  internalNodeId,
                  distanceToInternalNode,
                  nullNode
                ] = zDistances[k];
                const fractionOver =
                  distanceToInternalNode / distanceFromStartToEnd;
                const nextNode = new CreasesNode(
                  g.nextInternalId(),
                  internalNodeId,
                  (1 - fractionOver) * activePathStartNode.x +
                    fractionOver * activePathEndNode.x,
                  (1 - fractionOver) * activePathStartNode.y +
                    fractionOver * activePathEndNode.y,
                  newElevation
                );
                //console.log(`Making new gusset node directly - ${nextNode.id} at (${nextNode.x}, ${nextNode.y}).`);
                g.addNode(nextNode);
                zDistances[k][2] = nextNode;
                const newCrease = new Crease(
                  lastNode,
                  nextNode,
                  CreaseType.Gusset,
                  baseFace
                );
                newCreases.add(newCrease);
                g.addEdge(newCrease);
                lastNode = nextNode;
              }
              const newCrease = new Crease(
                activePathEndNode,
                lastNode,
                CreaseType.Gusset,
                baseFace
              );
              newCreases.add(newCrease);
              g.addEdge(newCrease);
              indexStack.push(activePathEndIndex);
              indexStack.push(activePathStartIndex);
              break;
            }
          }
          //console.log(`Adding ${(insetNodes[activePathEndIndex] as Node).id} to newBoundary.`);
          newBoundary.push(insetNodes[activePathEndIndex]);
          activePathStartIndex = activePathEndIndex;
        }
        //console.log(`Making recursive call on ${newBoundary.map(n => n.id)}.`);
        buildMoleculeRecursive(
          g,
          baseFace,
          newBoundary,
          z,
          newCreases,
          newElevation
        );
      }
    }
    throw new Error(
      "Caught in infinite loop while recursively building molecules."
    );
  }
}

// Defines z map from d and scale factor, subdividing creases for internal nodes as needed.
export function subdivideCreasesInitial(
  g: CreasesGraph,
  d: Map<string, Map<string, Array<[string, number]>>>,
  scaleFactor: number,
  discreteDepth: Map<string, number>
): [
  Map<
    CreasesNode,
    Map<CreasesNode, Array<[string, number, CreasesNode | null]>>
  >,
  Set<Crease>
] {
  const nodeList = Array.from(g.nodes.values());
  const nn = nodeList.length;
  const z: Map<
    CreasesNode,
    Map<CreasesNode, Array<[string, number, CreasesNode | null]>>
  > = new Map();
  const inactiveHullCreases: Set<Crease> = new Set();
  for (let i = 0; i < nn; i++) {
    const nodeI = nodeList[i] as CreasesNode;
    const dMap = d.get(nodeI.id) as Map<string, Array<[string, number]>>;
    const zDistanceMap: Map<
      CreasesNode,
      Array<[string, number, CreasesNode | null]>
    > = new Map();
    z.set(nodeI, zDistanceMap);
    for (let j = i + 1; j < nn; j++) {
      const nodeJ = nodeList[j] as CreasesNode;
      let crease = g.getEdge(nodeI, nodeJ);
      const distances = dMap.get(nodeJ.id) as Array<[string, number]>;
      const zDistances: Array<[string, number, CreasesNode | null]> = [];
      zDistanceMap.set(nodeJ, zDistances);
      const numInternalNodes = distances.length - 1;
      const totalDistance =
        (distances[numInternalNodes][1] as number) +
        (g.leafExtensions.get(nodeI) as number) +
        (g.leafExtensions.get(nodeJ) as number);
      if (crease != undefined && crease.creaseType == CreaseType.InactiveHull) {
        inactiveHullCreases.add(crease);
      } else {
        for (let k = 0; k < numInternalNodes; k++) {
          const [
            internalNodeId,
            distanceToInternalNodeWithoutLeafExtension
          ] = distances[k] as [string, number];
          const distanceToInternalNode =
            distanceToInternalNodeWithoutLeafExtension +
            (g.leafExtensions.get(nodeI) as number);
          if (crease != undefined) {
            // See if we need to update the local root.
            const newDepth = discreteDepth.get(internalNodeId);
            if (newDepth == undefined) {
              console.log(discreteDepth);
              throw new Error(
                `Undefined (${newDepth}) new discrete depth for local root '${internalNodeId}'.`
              );
            }
            for (const baseFace of [
              crease.leftFace,
              crease.rightFace
            ] as Face[]) {
              const oldDepth = discreteDepth.get(
                baseFace.baseFaceLocalRoot as string
              );
              if (oldDepth == undefined) {
                console.log(discreteDepth);
                throw new Error(
                  `Undefined prior discrete depth for local root '${baseFace.baseFaceLocalRoot}'.`
                );
              }
              if (newDepth < oldDepth) {
                baseFace.baseFaceLocalRoot = internalNodeId;
              }
            }

            const fractionOver = distanceToInternalNode / totalDistance;
            const creaseFrom = crease.from;
            const creaseTo = crease.to;
            const newNode = g.subdivideCrease(
              crease,
              (1 - fractionOver) * nodeI.x + fractionOver * nodeJ.x,
              (1 - fractionOver) * nodeI.y + fractionOver * nodeJ.y,
              internalNodeId,
              0
            );
            crease = g.getEdge(newNode, nodeJ) as Crease;
            if (crease == undefined) {
              // Active path, so zDistances stores actual nodes.
              throw new Error(
                `Cannot find next crease after subdividing between ${creaseFrom.id} and ${creaseTo.id} with new node corresponding to ${internalNodeId} at (${newNode.x}, ${newNode.y}).`
              );
            }
            zDistances.push([
              newNode.displayId,
              distanceToInternalNode * scaleFactor,
              newNode
            ]);
          } else {
            // Not an active path, so no nodes yet, but we'll need to keep track of distances in case it becomes an active reduced path later.
            zDistances.push([
              internalNodeId,
              distanceToInternalNode * scaleFactor,
              null
            ]);
          }
        }
      }
      zDistances.push([nodeJ.id, totalDistance * scaleFactor, nodeJ]);
    }
  }
  return [z, inactiveHullCreases] as [
    Map<
      CreasesNode,
      Map<CreasesNode, Array<[string, number, CreasesNode | null]>>
    >,
    Set<Crease>
  ];
}

export function generateMolecules(
  g: CreasesGraph,
  d: Map<string, Map<string, Array<[string, number]>>>,
  scaleFactor: number,
  discreteDepth: Map<string, number>
) {
  if (g.state != CreasesGraphState.PreUMA) {
    throw new Error(
      `Should not be calling generateMolecules from state ${
        CreasesGraphState[g.state]
      }.`
    );
  }

  // Record the active polygons before more nodes get added in subdivision.
  const boundaries: Array<[Face, Array<CreasesNode>]> = [];
  let outerFace: Face | null = null;
  for (const face of Array.from(g.faces)) {
    if (face.isOuterFace) {
      outerFace = face;
    } else {
      boundaries.push([face, Array.from(face.nodes)]);
    }
  }
  if (outerFace == null) {
    throw new Error("Could not find outer face.");
  }

  // Build molecules recursively.
  const [z, inactiveHullCreases] = subdivideCreasesInitial(
    g,
    d,
    scaleFactor,
    discreteDepth
  );
  const newCreases: Set<Crease> = new Set();
  for (const [baseFace, boundary] of boundaries) {
    buildMoleculeRecursive(g, baseFace, boundary, z, newCreases, 0);
  }

  // Get rid of degree 2 ridge/hinge vertices.
  for (const v of Array.from(g.nodes.values())) {
    g.suppressNodeIfRedundant(v, newCreases);
  }

  // Fill in hinges and pseudohinges in each inactive hull face.
  for (const inactiveHullCrease of inactiveHullCreases) {
    const orientation = (inactiveHullCrease.rightFace as Face).isOuterFace;
    const endNode = orientation
      ? (inactiveHullCrease.from as CreasesNode)
      : (inactiveHullCrease.to as CreasesNode);
    let currentNode = orientation
      ? (inactiveHullCrease.to as CreasesNode)
      : (inactiveHullCrease.from as CreasesNode);
    let currentCrease = inactiveHullCrease;

    // Projection of point to line segment based on:
    // https://stackoverflow.com/a/21055661/14766845
    const x1 = currentNode.x;
    const y1 = currentNode.y;
    const x2 = endNode.x;
    const y2 = endNode.y;
    let dx = x2 - x1;
    let dy = y2 - y1;
    const mag = Math.sqrt(dx * dx + dy * dy);
    dx /= mag;
    currentCrease = currentNode.clockwise(currentCrease) as Crease;
    currentNode = currentCrease.getOtherNode(currentNode) as CreasesNode;
    const ridgeline: CreasesNode[] = [];
    for (let numIterations = 0; numIterations < 200; numIterations++) {
      if (currentNode == endNode) {
        break;
      }
      ridgeline.push(currentNode);

      currentCrease = currentNode.clockwise(currentCrease) as Crease;
      currentNode = currentCrease.getOtherNode(currentNode) as CreasesNode;
    }
    if (currentNode != endNode) {
      throw new Error(
        "Caught in infinite loop while filling in inactive hull face."
      );
    }
    let baseCrease = inactiveHullCrease;
    const baseFace = baseCrease.getOtherFace(outerFace);
    dy /= mag;
    for (const n of ridgeline) {
      if (n.edges.length % 2 == 1) {
        // Need a new crease by Maekawa's theorem.
        let creaseType = CreaseType.Pseudohinge;
        for (const creaseAttachedToRidgeVertex of n.edges) {
          if (creaseAttachedToRidgeVertex.creaseType == CreaseType.Hinge) {
            creaseType = CreaseType.Hinge;
            break;
          }
        }
        const lambda = dx * (n.x - x1) + dy * (n.y - y1);
        const x = dx * lambda + x1;
        const y = dy * lambda + y1;

        const newNode = g.subdivideCrease(baseCrease, x, y, n.displayId, 0);
        baseCrease = g.getEdge(endNode, newNode) as Crease;
        const newCrease = new Crease(n, newNode, creaseType, baseFace);
        g.addEdge(newCrease);
      }
    }
  }
  g.state = CreasesGraphState.PostUMA;

  // Fill in new faces and prep for facet ordering.
  g.rebuildFaces(outerFace, newCreases);

  g.state = CreasesGraphState.PreFacetOrdering;
  return discreteDepth;
}
