/* eslint-disable @typescript-eslint/camelcase */
/**
 * Helper functions for exporting a crease pattern to the FOLD format.
 */
import {
  CreasesGraph,
  CreasesNode,
  Crease,
  MVAssignment,
  Face,
} from "../packing";

function edgeAssignmentShort(mv: MVAssignment): string {
  switch (mv) {
    case MVAssignment.Mountain:
      return "M";
    case MVAssignment.Valley:
      return "V";
    case MVAssignment.Tristate:
      // TODO (@pjrule): for now, we let tristate folds be boundary
      // folds---this makes the four-star example work.
      // Once facet ordering is fully implemented, this case should no
      // longer occur by the time we reach the export step.
      return "B";
    case MVAssignment.Boundary:
      return "B";
  }
  return "U"; // unknown, etc.
}

export function generateFold(graph: CreasesGraph) {
  const coords: [number, number][] = [];
  const edges: [number, number][] = [];
  const assignments: string[] = [];
  const angles: (number | null)[] = [];
  const faceVertices: number[][] = [];
  const faceEdges: number[][] = [];

  const vertexOrder = Array.from(graph.nodes.keys()).sort();
  const edgeOrder = Array.from(graph.edges.keys()).sort();
  const vertexEdges: number[][] = vertexOrder.map((x) => []);

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
    const assn = edgeAssignmentShort(edge.assignment);
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
    // TODO (@pjrule): the isOuterFace flag does not always
    // seem to be reliable, so we ignore the largest face.
    // However, we ought to fix the flag in the future.
    const maxFaceSize = Math.max(
      ...Array.from(graph.faces).map((f: Face) => f.nodes.length)
    );
    if (face.nodes.length < maxFaceSize) {
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
    faces_vertices: faceVertices,
  };
}
