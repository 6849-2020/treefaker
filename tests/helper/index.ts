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
  CreasesGraph
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

export function fiveStarBadPacking() {
  const v2 = new PackingNode("2", 0.5, 0);
  const v3 = new PackingNode("3", 0.5, 1);
  const v4 = new PackingNode("4", 0, 1);
  const v5 = new PackingNode("5", 0, 0);
  const packing = new Packing();
  packing.scaleFactor = 1 / 12;
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
    [11.5 / 16, 6 / 16]
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
    [1, 0]
  ]);
}

export function rabbitEarOnSideTree() {
  return starTree([1, 4, 4]);
}

export function rabbitEarOnSidePacking() {
  return starPacking(1 / 8, [
    [1, 1 / 2],
    [5 / 8, 0],
    [5 / 8, 1]
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

export function demaineLangPaperSmallTree() {
  const v1 = new TreeNode("1", 0, 1);
  const v2 = new TreeNode("2", 1, 1);
  const v3 = new TreeNode("3", 0.5, 0.7);
  const v4 = new TreeNode("4", 0.5, 0.3);
  const v5 = new TreeNode("5", 0, 0);
  const v6 = new TreeNode("6", 0.5, 0);
  const v7 = new TreeNode("7", 1, 0);
  const tree = new TreeGraph();
  tree.addNode(v1);
  tree.addNode(v2);
  tree.addNode(v3);
  tree.addNode(v4);
  tree.addNode(v5);
  tree.addNode(v6);
  tree.addNode(v7);
  const e13 = new TreeEdge(v3, v1, 1);
  const e23 = new TreeEdge(v3, v2, 1);
  const e34 = new TreeEdge(v4, v3, 1);
  const e45 = new TreeEdge(v5, v4, 1);
  const e46 = new TreeEdge(v6, v4, 1);
  const e47 = new TreeEdge(v7, v4, 1);
  tree.addEdge(e13);
  tree.addEdge(e23);
  tree.addEdge(e34);
  tree.addEdge(e45);
  tree.addEdge(e46);
  tree.addEdge(e47);
  return tree;
}

export function demaineLangPaperSmallPacking() {
  const packing = new Packing();
  packing.scaleFactor = 0.2754;
  const v1 = new PackingNode("1", 0, 1);
  packing.nodes.set("1", v1);
  const v2 = new PackingNode("2", 0.551, 1);
  packing.nodes.set("2", v2);
  const v5 = new PackingNode("5", 0, 0.1);
  packing.nodes.set("5", v5);
  const v6 = new PackingNode("6", 0.5418, 0);
  packing.nodes.set("6", v6);
  const v7 = new PackingNode("7", 0.9999, 0.3061);
  packing.nodes.set("7", v7);
  return packing;
}

export function boneTree() {
  const v1 = new TreeNode("1", 0, 1);
  const v2 = new TreeNode("2", 1, 1);
  const v3 = new TreeNode("3", 0.5, 0.8);
  const v4 = new TreeNode("4", 0.5, 0.5);
  const v5 = new TreeNode("5", 0.5, 0.2);
  const v6 = new TreeNode("6", 0, 0);
  const v7 = new TreeNode("7", 1, 0);
  const tree = new TreeGraph();
  tree.addNode(v1);
  tree.addNode(v2);
  tree.addNode(v3);
  tree.addNode(v4);
  tree.addNode(v5);
  tree.addNode(v6);
  tree.addNode(v7);
  const e13 = new TreeEdge(v3, v1, 2);
  const e23 = new TreeEdge(v3, v2, 2);
  const e34 = new TreeEdge(v4, v3, 1);
  const e45 = new TreeEdge(v5, v4, 1);
  const e56 = new TreeEdge(v6, v5, 2);
  const e57 = new TreeEdge(v7, v5, 2);
  tree.addEdge(e13);
  tree.addEdge(e23);
  tree.addEdge(e34);
  tree.addEdge(e45);
  tree.addEdge(e56);
  tree.addEdge(e57);
  return tree;
}

export function bonePacking() {
  const packing = new Packing();
  packing.scaleFactor = 1 / 6;
  const v1 = new PackingNode("1", 0, 1);
  packing.nodes.set("1", v1);
  const v2 = new PackingNode("2", 2 / 3, 1);
  packing.nodes.set("2", v2);
  const v6 = new PackingNode("6", 0, 0);
  packing.nodes.set("6", v6);
  const v7 = new PackingNode("7", 2 / 3, 0);
  packing.nodes.set("7", v7);
  return packing;
}

export function twistedBonePacking() {
  const packing = new Packing();
  packing.scaleFactor = 1 / 15;
  const v1 = new PackingNode("1", 0.3, 0.7);
  packing.nodes.set("1", v1);
  const v7 = new PackingNode("7", 0.7, 0.7);
  packing.nodes.set("7", v7);
  const v6 = new PackingNode("6", 0.3, 0.3);
  packing.nodes.set("6", v6);
  const v2 = new PackingNode("2", 0.7, 0.3);
  packing.nodes.set("2", v2);
  return packing;
}

export function crabTree() {
  // Crab design by Jason Ku shown in lecture.
  const vertices = [
    [0, 0],
    [4.5, 0],
    [6.5, 0],
    [8.5, 0],
    [13, 0],
    [0, -2],
    [1.5, -3.5],
    [3, -4.5],
    [13, -2],
    [11.5, -3.5],
    [10, -4.5],
    [6.5, 3],
    [8.5, 1],
    [5.5, 4],
    [6.5, 4.5],
    [7.5, 4],
    [4.5, 3],
    [2.5, 5.5],
    [4.5, 7],
    [4, 6],
    [8.5, 3],
    [10.5, 5.5],
    [8.5, 7],
    [9, 6]
  ];
  const adjacency = [
    [0, 1],
    [1, 2],
    [1, 5],
    [1, 6],
    [1, 7],
    [2, 3],
    [2, 11],
    [3, 4],
    [3, 8],
    [3, 9],
    [3, 10],
    [11, 12],
    [11, 13],
    [11, 14],
    [11, 15],
    [11, 16],
    [11, 20],
    [16, 17],
    [17, 18],
    [17, 19],
    [20, 21],
    [21, 22],
    [21, 23]
  ];
  const tree = new TreeGraph();
  const nodes: TreeNode[] = [];
  for (const [idx, coords] of vertices.entries()) {
    const v = new TreeNode(idx.toString(), coords[0], coords[1]);
    nodes.push(v);
    tree.addNode(v);
  }
  for (const e of adjacency) {
    const nodeFrom = nodes[e[0]];
    const nodeTo = nodes[e[1]];
    const length = Math.sqrt(
      Math.pow(nodeFrom.x - nodeTo.x, 2) + Math.pow(nodeFrom.y - nodeTo.y, 2)
    );
    tree.addEdge(new TreeEdge(nodeFrom, nodeTo, length));
  }
  return tree;
}
