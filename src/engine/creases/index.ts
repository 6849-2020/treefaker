// TODO: univeral molecule.
import { Node, Edge, Face, TreeNode, TreeEdge, PackingNode, Packing, CreasesNode, CreaseType, MVAssignment, Crease, Graph, TreeGraph, CreasesGraphState, CreasesGraph, TOLERANCE }  from "../packing";

export function cleanPacking(p: Packing, d: Map<string, Map<string, Map<string, number>>>): CreasesGraph {
  const g = new CreasesGraph(p);
  for (const v1Id of p.nodes.keys()) {
    for (const v2Id of p.nodes.keys()) {
      if (v1Id < v2Id) {
        const v1 = p.nodes.get(v1Id) as PackingNode;
        const v2 = p.nodes.get(v2Id) as PackingNode;
        const v1CreasesNode = g.nodes.get(v1Id) as CreasesNode;
        const v2CreasesNode = g.nodes.get(v2Id) as CreasesNode;
        const xDistance = v2.x - v1.x;
        const yDistance = v2.y - v1.y;
        const distanceOnPlane = Math.sqrt(xDistance*xDistance + yDistance*yDistance);
        const distancesAlongPath = (d.get(v1Id) as Map<string, Map<string, number>>).get(v2Id) as Map<string, number>;
        if (distanceOnPlane - (p.scaleFactor as number )*(distancesAlongPath.get(v2Id) as number) < TOLERANCE) { // Active path.
          const axialCrease = new Crease(v1CreasesNode, v2CreasesNode, CreaseType.ActiveHull); // TODO(Jamie) Should be Axial if not on boundary - need to compute convex hull first.
          g.addEdge(axialCrease);
        }
        //throw Error(`${g.leafExtensions.values()}`);
      }
    }
  }
  // TODO(Jamie) Cleanup both kinds of potential problems.
  return g;
}

export function generateMolecules(graph: CreasesGraph): any {
  // TODO: We need a type for the final creases output.
}
