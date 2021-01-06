/* eslint-disable @typescript-eslint/camelcase */
/**
 * Helper functions for exporting a crease pattern to the FOLD format.
 */
import {
  CreasesGraph,
  CreasesNode,
  Crease,
  CreaseType,
  MVAssignment,
  Face
} from "../packing";

function edgeAssignmentShort(e: Crease, fanOutHinges: boolean): string {
  if (fanOutHinges && e.creaseType == CreaseType.Hinge) {
    return "B"; // Setting fanOutHinges true makes all hinges unassigned.
  }
  switch (e.assignment) {
    case MVAssignment.Mountain:
      return "M";
    case MVAssignment.Valley:
      return "V";
    case MVAssignment.Unfolded:
      return "F";
  }
  return "B";
}

export function generateFold(graph: CreasesGraph) {
  const coords: [number, number][] = [];
  const edges: [number, number][] = [];
  const assignments: string[] = [];
  const angles: (number | null)[] = [];
  const faceVertices: number[][] = [];

  const vertexOrder = Array.from(graph.nodes.keys()).sort();
  const edgeOrder = Array.from(graph.edges.keys()).sort();
  const vertexEdges: number[][] = vertexOrder.map(x => []);

  for (const vid of vertexOrder) {
    const node = graph.nodes.get(vid) as CreasesNode;
    coords.push([node.x, node.y]);
  }
  for (const [idx, eid] of edgeOrder.entries()) {
    const edge = graph.edges.get(eid) as Crease;

    // TODO (@pjrule): these lookups could be sped up.
    const toIdx = vertexOrder.indexOf(edge.to.id);
    const fromIdx = vertexOrder.indexOf(edge.from.id);
    vertexEdges[toIdx].push(idx);
    vertexEdges[fromIdx].push(idx);
    edges.push([toIdx, fromIdx]);
    const assn = edgeAssignmentShort(edge, true); // TODO Make second argument a user choice.
    assignments.push(assn);
    // Origami Simulator does not automatically infer fold angles upon a POST request,
    // so we generate them manually. See https://github.com/amandaghassaei/
    // OrigamiSimulator/blob/539f1cd4eaa8b7b631f1697b54dc726409e33799/js/importer.js
    if (assn === "M") {
      angles.push(-180);
    } else if (assn === "V") {
      angles.push(180);
    } else if (assn === "F") {
      angles.push(0);
    } else {
      angles.push(null);
    }
  }
  for (const face of graph.faces) {
    if (!face.isOuterFace) {
      const nodeIds: number[] = [];
      const reversedNodes: CreasesNode[] = Object.assign(
        [],
        face.nodes
      ).reverse();
      for (const faceNode of reversedNodes) {
        const vid = vertexOrder.indexOf(faceNode.id);
        nodeIds.push(vid);
      }
      faceVertices.push(nodeIds);
    }
  }

  return {
    file_spec: "1.1",
    file_creator: "TreeFaker",
    file_classes: ["creasePattern"],
    vertices_coords: coords,
    edges_vertices: edges,
    edges_assignment: assignments,
    edges_foldAngle: angles,
    vertices_edges: vertexEdges,
    faces_vertices: faceVertices
  };
}
