import {
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
  CreasesGraph,
} from "../../src/engine/packing";

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
  packing.scaleFactor = 1 / 6;
  packing.nodes.set("2", v2);
  packing.nodes.set("3", v3);
  packing.nodes.set("4", v4);
  packing.nodes.set("5", v5);
  return packing;
}

export function starTree(lengths: number[]) {
  const centralVertex = new TreeNode("0", 0, 0);
  const tree = new TreeGraph();
  tree.addNode(centralVertex);
  const angleDiff = Math.PI / lengths.length;
  const angleInitial = angleDiff / 2 - Math.PI;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i] as number;
    const angle = angleInitial + i * angleDiff;
    const v = new TreeNode(
      (i + 1).toString(),
      length * Math.cos(angle),
      length * Math.sin(angle)
    );
    tree.addNode(v);
    const e = new TreeEdge(v, centralVertex, length);
    tree.addEdge(e);
  }
  return tree;
}

export function starPacking(scaleFactor: number, locations: number[][]) {
  const packing = new Packing();
  packing.scaleFactor = scaleFactor;
  for (let i = 0; i < locations.length; i++) {
    const [x, y] = locations[i];
    const v = new PackingNode((i + 1).toString(), x, y);
    packing.nodes.set(v.id, v);
  }
  return packing;
}

export function threeNodeSuboptimalTree() {
  return starTree([5, 2.5]);
}

export function threeNodeSuboptimalPacking() {
  return starPacking(1 / 16, [
    [1, 0],
    [11.5 / 16, 6 / 16],
  ]);
}

export function tenStarSuboptimalTree() {
  return starTree([3, 2, 3, 3, 5, 2.5, 3, 2, 2, 5]);
}

export function tenStarSuboptimalPacking() {
  return starPacking(1 / 16, [
    [0, 1],
    [5 / 16, 1],
    [10 / 16, 1],
    [1, 1],
    [0, 8 / 16],
    [11.5 / 16, 6 / 16],
    [0, 0],
    [5 / 16, 0],
    [9 / 16, 0],
    [1, 0],
  ]);
}

export function rabbitEarOnSideTree() {
  return starTree([1, 4, 4]);
}

export function rabbitEarOnSidePacking() {
  return starPacking(1 / 8, [
    [1, 1 / 2],
    [5 / 8, 0],
    [5 / 8, 1],
  ]);
}

export function twoNodeTree() {
  return starTree([2]);
}

export function twoNodeAdjacentCornersPacking() {
  const packing = new Packing();
  packing.scaleFactor = 1 / 2;
  const v0 = new PackingNode("0", 1, 0);
  packing.nodes.set("0", v0);
  const v1 = new PackingNode("1", 1, 1);
  packing.nodes.set("1", v1);
  return packing;
}
