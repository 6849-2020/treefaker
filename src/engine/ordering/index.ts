/**
 * Implementation of the facet ordering algorithm described in Lang & Demaine 2006.
 */
import {
  CreasesGraph,
  TreeGraph,
  TreeNode,
  CreasesNode,
  Face,
} from "../packing";

export function facetOrder(
  treeGraph: TreeGraph,
  creasesGraph: CreasesGraph,
  moleculeBoundaries: CreasesNode[][]
): CreasesGraph {
  // Pick an arbitrary root node in the tree.
  // Assign discrete depths to the nodes in the tree by branching out
  // from the root node.
  const rootNode = treeGraph.nodes[0];
  const visitedIds = new Set();
  visitedIds.add(rootNode.id);
  rootNode.depth = 0;
  const stack: TreeNode[] = [rootNode];
  while (stack) {
    const nextNode = stack.pop();
    if (nextNode !== undefined) {
      for (const e of nextNode.edges) {
        if (e.from === nextNode) {
          e.to.depth = nextNode.depth + 1;
          if (!visitedIds.has(e.to.id)) {
            stack.push(e.to);
            visitedIds.add(e.to.id);
          }
        } else {
          e.from.depth = nextNode.depth + 1;
          if (!visitedIds.has(e.from.id)) {
            stack.push(e.from);
            visitedIds.add(e.from.id);
          }
        }
      }
    }
  }
}

function orderMolecule(
  treeGraph: TreeGraph,
  creasesGraph: CreasesGraph,
  boundary: CreasesNode[]
) {
  // Find axial facets within the molecule.
  //
  // Construct corridor chains: start from an axial facet
  // and walk until reaching another axial facet.
  //
  // Construct axial chains between corridors.
}
