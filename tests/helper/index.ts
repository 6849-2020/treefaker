import { Node, Edge, Face, TreeNode, TreeEdge, PackingNode, Packing, CreasesNode, CreaseType, MVAssignment, Crease, Graph, TreeGraph, CreasesGraphState, CreasesGraph }  from "../../src/engine/packing";

export function fiveStarTree() {
  const v1 = new TreeNode("1", 0, 0);
  const v2 = new TreeNode("2", 1, 0);
  const v3 = new TreeNode("3", 0, 1);
  const v4 = new TreeNode("4", -1, 0);
  const v5 = new TreeNode("5", 0, -1);
  const tree = new TreeGraph();
  tree.addNode(v1);
  tree.addNode(v2);
  tree.addNode(v3);
  tree.addNode(v4);
  tree.addNode(v5);
  const e2 = new TreeEdge(v2, v1, 3);
  const e3 = new TreeEdge(v3, v1, 3);
  const e4 = new TreeEdge(v4, v1, 3);
  const e5 = new TreeEdge(v5, v1, 3);
  tree.addEdge(e2);
  tree.addEdge(e3);
  tree.addEdge(e4);
  tree.addEdge(e5);
  return tree;
}

export function fiveStarPacking() {
  const v2 = new PackingNode("2", 1, 0);
  const v3 = new PackingNode("3", 1, 1);
  const v4 = new PackingNode("4", 0, 1);
  const v5 = new PackingNode("5", 0, 0);
  const packing = new Packing();
  packing.scaleFactor = 1/6;
  packing.nodes.set("2", v2);
  packing.nodes.set("3", v3);
  packing.nodes.set("4", v4);
  packing.nodes.set("5", v5);
  return packing;
}
