/* eslint-disable @typescript-eslint/camelcase */
/**
 * Helper functions for exporting a crease pattern to the FOLD format.
 */
import { CreasesGraph, CreasesNode, Crease, MVAssignment } from "../packing";

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
    assignments.push(edgeAssignmentShort(edge.assignment));
  }
  for (const face of graph.faces) {
    const nodeIds: Set<number> = new Set();
    for (const faceNode of face.nodes) {
      const vid = vertexOrder.indexOf(faceNode.id);
      nodeIds.add(vid);
    }
    const edgeIds: Set<number> = new Set();
    for (const faceNode of face.nodes) {
      for (const edge of faceNode.edges) {
        const toIdx = vertexOrder.indexOf(edge.to.id);
        const fromIdx = vertexOrder.indexOf(edge.from.id);
        const edgeIdParts = [edge.from.id, edge.to.id].sort();
        const edgeId = edgeIdParts[0] + "-" + edgeIdParts[1];
        if (nodeIds.has(toIdx) && nodeIds.has(fromIdx)) {
          edgeIds.add(edgeOrder.indexOf(edgeId));
        }
      }
    }
    faceVertices.push(Array.from(nodeIds));
    faceEdges.push(Array.from(edgeIds));
  }

  return {
    file_spec: "1.1",
    file_creator: "TreeFaker",
    file_classes: ["creasePattern"],
    vertices_coords: coords,
    edges_vertices: edges,
    edges_assignment: assignments,
    vertices_edges: vertexEdges,
    faces_vertices: faceVertices,
    faces_edges: faceEdges,
  };
}
