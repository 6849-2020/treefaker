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

export function decode(
  t: TreeGraph,
  p: Packing,
  g: CreasesGraph,
  rootId
): string {
  let toReturn = `export function decodedTree() {\n  const tree = new TreeGraph();\n  tree.debugOverrideRootId = "${rootId}";`;
  for (const [nodeId, node] of t.nodes) {
    toReturn += `\n  const v${nodeId} = new TreeNode("${nodeId}", ${node.x}, ${node.y});\n  tree.addNode(v${nodeId});`;
  }
  for (const edge of t.edges.values()) {
    let leafExtension = 0;
    for (const nodeId of [edge.from.id, edge.to.id]) {
      const possibleLeafExtension = g.leafExtensions.get(
        g.nodes.get(nodeId) as CreasesNode
      );
      if (possibleLeafExtension != undefined) {
        leafExtension = possibleLeafExtension;
        break;
      }
    }
    toReturn += `\n  tree.addEdge(new TreeEdge(v${edge.to.id}, v${
      edge.from.id
    }, ${edge.length + leafExtension}));`;
  }
  toReturn += `\n  return tree;\n}\n\nexport function decodedPacking() {\n  const packing = new Packing();\n  packing.scaleFactor = ${p.scaleFactor};`;
  for (const [nodeId, node] of p.nodes) {
    toReturn += `\n  packing.nodes.set("${nodeId}", new PackingNode("${nodeId}", ${node.x}, ${node.y}));`;
  }
  toReturn += "\n  return packing;\n}";
  return toReturn;
}

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

export function twoMoleculeTree() {
  return starTree([1, 4, 1, 4]);
}

export function twoMoleculePacking() {
  return starPacking(1 / 8, [
    [3 / 4, 1 / 2],
    [3 / 8, 1],
    [0, 1 / 2],
    [3 / 8, 0]
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

export function crossingSwordsTree() {
  const v1 = new TreeNode("1", 0, 0);
  const v2 = new TreeNode("2", -3, -3);
  const v3 = new TreeNode("3", 3, -3);
  const v4 = new TreeNode("4", -1, 1);
  const v5 = new TreeNode("5", 1, 1);
  const v6 = new TreeNode("6", -4, -2);
  const v7 = new TreeNode("7", -4, -4);
  const v8 = new TreeNode("8", -2, -4);
  const v9 = new TreeNode("9", 4, -2);
  const v10 = new TreeNode("10", 4, -4);
  const v11 = new TreeNode("11", 2, -4);
  const v12 = new TreeNode("12", -5, -3);
  const tree = new TreeGraph();
  tree.addNode(v1);
  tree.addNode(v2);
  tree.addNode(v3);
  tree.addNode(v4);
  tree.addNode(v5);
  tree.addNode(v6);
  tree.addNode(v7);
  tree.addNode(v8);
  tree.addNode(v9);
  tree.addNode(v10);
  tree.addNode(v11);
  tree.addNode(v12);
  tree.addEdge(new TreeEdge(v2, v1, 3));
  tree.addEdge(new TreeEdge(v3, v1, 3));
  tree.addEdge(new TreeEdge(v4, v1, 1));
  tree.addEdge(new TreeEdge(v5, v1, 1));
  tree.addEdge(new TreeEdge(v6, v2, 1));
  tree.addEdge(new TreeEdge(v7, v2, 1));
  tree.addEdge(new TreeEdge(v8, v2, 1));
  tree.addEdge(new TreeEdge(v9, v3, 1));
  tree.addEdge(new TreeEdge(v10, v3, 1));
  tree.addEdge(new TreeEdge(v11, v3, 1));
  tree.addEdge(new TreeEdge(v12, v2, 3));
  return tree;
}

export function crossingSwordsPacking() {
  const packing = new Packing();
  packing.scaleFactor = 1 / 12;
  packing.nodes.set("4", new PackingNode("4", 8 / 12, 9 / 12));
  packing.nodes.set("5", new PackingNode("5", 8 / 12, 3 / 12));
  packing.nodes.set("6", new PackingNode("6", 4 / 12, 12 / 12));
  packing.nodes.set("7", new PackingNode("7", 4 / 12, 6 / 12));
  packing.nodes.set("8", new PackingNode("8", 4 / 12, 0 / 12));
  packing.nodes.set("9", new PackingNode("9", 12 / 12, 12 / 12));
  packing.nodes.set("10", new PackingNode("10", 12 / 12, 6 / 12));
  packing.nodes.set("11", new PackingNode("11", 12 / 12, 0 / 12));
  packing.nodes.set("12", new PackingNode("12", 0 / 12, 6 / 12));
  return packing;
}

export function pseudohingeElevationBugTree() {
  const v1 = new TreeNode("1", -1, 1);
  const v2 = new TreeNode("2", 0, 0);
  const v3 = new TreeNode("3", -2, 2);
  const v4 = new TreeNode("4", -1, -1);
  const v5 = new TreeNode("5", 1, 1);
  const tree = new TreeGraph();
  tree.addNode(v1);
  tree.addNode(v2);
  tree.addNode(v3);
  tree.addNode(v4);
  tree.addNode(v5);
  tree.addEdge(new TreeEdge(v2, v1, 0.6));
  tree.addEdge(new TreeEdge(v3, v1, 0.25));
  tree.addEdge(new TreeEdge(v4, v2, 0.15));
  tree.addEdge(new TreeEdge(v5, v2, 0.15));
  return tree;
}

export function pseudohingeElevationBugPacking() {
  const packing = new Packing();
  packing.scaleFactor = 1;
  packing.nodes.set("3", new PackingNode("3", 0, 1));
  packing.nodes.set("4", new PackingNode("4", 0, 0));
  packing.nodes.set("5", new PackingNode("5", 1, 1));
  return packing;
}

export function mogMergeBugSimpleTree() {
  const tree = new TreeGraph();
  tree.debugOverrideRootId = "1";
  const v1 = new TreeNode("1", 0, 0);
  tree.addNode(v1);
  const v2 = new TreeNode("2", 0, 1);
  tree.addNode(v2);
  const v3 = new TreeNode("3", 2, 2);
  tree.addNode(v3);
  const v4 = new TreeNode("4", -2, 2);
  tree.addNode(v4);
  const v5 = new TreeNode("5", -1, -1);
  tree.addNode(v5);
  const v6 = new TreeNode("6", 1, -1);
  tree.addNode(v6);
  tree.addEdge(new TreeEdge(v2, v1, 1));
  tree.addEdge(new TreeEdge(v3, v2, 10));
  tree.addEdge(new TreeEdge(v4, v2, 10));
  tree.addEdge(new TreeEdge(v5, v1, 1));
  tree.addEdge(new TreeEdge(v6, v1, 1));
  return tree;
}

export function mogMergeBugSimplePacking() {
  const packing = new Packing();
  packing.scaleFactor = 1 / 16;
  packing.nodes.set("3", new PackingNode("3", 3 / 4, 1));
  packing.nodes.set("5", new PackingNode("5", 0, 1));
  packing.nodes.set("4", new PackingNode("4", 0, 0));
  packing.nodes.set("6", new PackingNode("6", 3 / 4, 0));
  return packing;
}

export function decodedTestTree() {
  const tree = new TreeGraph();
  tree.debugOverrideRootId = "1";
  const v1 = new TreeNode("1", 5, 4);
  tree.addNode(v1);
  const v2 = new TreeNode("2", 4.910714285714286, 7.700892857142858);
  tree.addNode(v2);
  const v3 = new TreeNode("3", 2.96875, 2.834821428571429);
  tree.addNode(v3);
  const v4 = new TreeNode("4", 5.111607142857143, 2.299107142857143);
  tree.addNode(v4);
  const v5 = new TreeNode("5", 6.808035714285714, 2.879464285714286);
  tree.addNode(v5);
  const v6 = new TreeNode("6", 3.5267857142857144, 8.705357142857144);
  tree.addNode(v6);
  const v7 = new TreeNode("7", 5.915178571428572, 8.705357142857144);
  tree.addNode(v7);
  tree.addEdge(new TreeEdge(v1, v4, 2.387976429952156));
  tree.addEdge(new TreeEdge(v3, v1, 3.3701006940340474));
  tree.addEdge(new TreeEdge(v1, v5, 3.1272107631640544));
  tree.addEdge(new TreeEdge(v1, v2, 3.701969729593495));
  tree.addEdge(new TreeEdge(v2, v6, 3.42057599122217));
  tree.addEdge(new TreeEdge(v2, v7, 3.1400255076229553));
  return tree;
}

export function decodedTestPacking() {
  const packing = new Packing();
  packing.scaleFactor = 0.06998501126871456;
  packing.nodes.set(
    "3",
    new PackingNode("3", -2.64378557934819e-9, 0.6449532240035764)
  );
  packing.nodes.set(
    "4",
    new PackingNode("4", 0.4152402487712022, 0.6369842363991575)
  );
  packing.nodes.set("5", new PackingNode("5", 0.28408974824848027, 1));
  packing.nodes.set(
    "6",
    new PackingNode("6", 0.9999999982410215, 0.954901533967804)
  );
  packing.nodes.set("7", new PackingNode("7", 0.30793237713994537, 0));
  return packing;
}

export function decodedNotADagErrorTree() {
  const tree = new TreeGraph();
  tree.debugOverrideRootId = "1";
  const v1 = new TreeNode("1", 5, 4);
  tree.addNode(v1);
  const v2 = new TreeNode("2", 5, 6);
  tree.addNode(v2);
  const v3 = new TreeNode("3", 3.5267857142857144, 3.035714285714286);
  tree.addNode(v3);
  const v4 = new TreeNode("4", 6.026785714285714, 3.325892857142857);
  tree.addNode(v4);
  const v5 = new TreeNode("5", 6.026785714285714, 6.71875);
  tree.addNode(v5);
  const v6 = new TreeNode("6", 4.776785714285714, 7.343750000000001);
  tree.addNode(v6);
  const v7 = new TreeNode("7", 2.03125, 6.227678571428572);
  tree.addNode(v7);
  const v8 = new TreeNode("8", 2.1205357142857144, 7.276785714285714);
  tree.addNode(v8);
  const v9 = new TreeNode("9", 0.9375000000000001, 6.40625);
  tree.addNode(v9);
  const v10 = new TreeNode("10", 2.1205357142857144, 2.96875);
  tree.addNode(v10);
  const v11 = new TreeNode("11", 2.834821428571429, 2.1651785714285716);
  tree.addNode(v11);
  const v12 = new TreeNode("12", 1.1607142857142858, 2.232142857142857);
  tree.addNode(v12);
  tree.addEdge(new TreeEdge(v1, v4, 15.761812131503053));
  tree.addEdge(new TreeEdge(v3, v1, 39.726212926513504));
  tree.addEdge(new TreeEdge(v1, v2, 2));
  tree.addEdge(new TreeEdge(v2, v6, 46.46729352139373));
  tree.addEdge(new TreeEdge(v5, v2, 37.36025003041873));
  tree.addEdge(new TreeEdge(v2, v7, 2.9774677318801888));
  tree.addEdge(new TreeEdge(v7, v9, 15.001887942990807));
  tree.addEdge(new TreeEdge(v8, v7, 1.1443317883360984));
  tree.addEdge(new TreeEdge(v7, v10, 3.260151433974959));
  tree.addEdge(new TreeEdge(v10, v11, 62.276098123250016));
  tree.addEdge(new TreeEdge(v10, v12, 153.78043821836764));
  return tree;
}

export function decodedNotADagErrorPacking() {
  const packing = new Packing();
  packing.scaleFactor = 0.00445064931456961;
  packing.nodes.set("11", new PackingNode("11", 0.6002975636558101, 1));
  packing.nodes.set(
    "12",
    new PackingNode("12", -1.8485998287687266e-9, 0.24879978192179975)
  );
  packing.nodes.set(
    "3",
    new PackingNode("3", 0.999999999208625, 0.7154567587617131)
  );
  packing.nodes.set(
    "4",
    new PackingNode("4", 0.7971095092142312, 0.5746605416350531)
  );
  packing.nodes.set(
    "5",
    new PackingNode("5", 0.932417886312053, 0.3700195268893871)
  );
  packing.nodes.set(
    "6",
    new PackingNode("6", 0.8846741930276222, 2.0510018683417286e-9)
  );
  packing.nodes.set("8", new PackingNode("8", 1, 0.1933763774956242));
  packing.nodes.set(
    "9",
    new PackingNode("9", 0.6547918075274544, 0.6457195548347869)
  );
  return packing;
}

export function decodedMogMergeBug2Tree() {
  const tree = new TreeGraph();
  tree.debugOverrideRootId = "1";
  const v1 = new TreeNode("1", 4.888392857142858, 2.700892857142857);
  tree.addNode(v1);
  const v2 = new TreeNode("2", 5, 6);
  tree.addNode(v2);
  const v3 = new TreeNode("3", 8.616071428571429, 8.191964285714286);
  tree.addNode(v3);
  const v4 = new TreeNode("4", 1.049107142857143, 7.924107142857143);
  tree.addNode(v4);
  const v5 = new TreeNode("5", 3.6830357142857144, 1.5401785714285716);
  tree.addNode(v5);
  const v6 = new TreeNode("6", 5.803571428571429, 1.4732142857142858);
  tree.addNode(v6);
  const v7 = new TreeNode("7", 9.441964285714286, 6.9419642857142865);
  tree.addNode(v7);
  const v8 = new TreeNode("8", 1.8080357142857144, 8.59375);
  tree.addNode(v8);
  const v9 = new TreeNode("9", 0.5133928571428572, 8.459821428571429);
  tree.addNode(v9);
  const v10 = new TreeNode("10", 0.625, 6.651785714285714);
  tree.addNode(v10);
  const v11 = new TreeNode("11", 9.53125, 8.4375);
  tree.addNode(v11);
  const v12 = new TreeNode("12", 8.482142857142858, 8.839285714285715);
  tree.addNode(v12);
  const v13 = new TreeNode("13", 4.821428571428572, 1.09375);
  tree.addNode(v13);
  tree.addEdge(new TreeEdge(v2, v1, 3.3009944099297948));
  tree.addEdge(new TreeEdge(v1, v6, 6.790156953778052));
  tree.addEdge(new TreeEdge(v5, v1, 9.193741447416954));
  tree.addEdge(new TreeEdge(v1, v13, 29.37348750180522));
  tree.addEdge(new TreeEdge(v2, v4, 4.39451279049411));
  tree.addEdge(new TreeEdge(v2, v3, 4.228555309603689));
  tree.addEdge(new TreeEdge(v3, v11, 4.013923428191168));
  tree.addEdge(new TreeEdge(v7, v3, 25.764524269447353));
  tree.addEdge(new TreeEdge(v3, v12, 9.981490229297913));
  tree.addEdge(new TreeEdge(v4, v9, 25.628450492576142));
  tree.addEdge(new TreeEdge(v8, v4, 8.563558530127219));
  tree.addEdge(new TreeEdge(v4, v10, 14.287958914386362));
  return tree;
}

export function decodedMogMergeBug2Packing() {
  const packing = new Packing();
  packing.scaleFactor = 0.01293291920705089;
  packing.nodes.set(
    "10",
    new PackingNode("10", 0.45204563121333136, 0.4384670865022129)
  );
  packing.nodes.set(
    "11",
    new PackingNode("11", 0.6738868305005234, -2.5512846696384983e-9)
  );
  packing.nodes.set("12", new PackingNode("12", 0.6121828388798757, 1));
  packing.nodes.set(
    "13",
    new PackingNode("13", 0.005829033300032704, 1.0000000018326995)
  );
  packing.nodes.set(
    "5",
    new PackingNode("5", 0.800870184838832, 0.236225659232633)
  );
  packing.nodes.set("6", new PackingNode("6", 1, 0.1807293425767597));
  packing.nodes.set(
    "7",
    new PackingNode("7", 0.9999999986489463, 0.7483664685765745)
  );
  packing.nodes.set(
    "8",
    new PackingNode("8", 0.39970182944998894, 2.014007613460045e-9)
  );
  packing.nodes.set("9", new PackingNode("9", 0, 0.1891599604850908));
  return packing;
}

export function decodedWhereDoFlapsGoTree() {
  const tree = new TreeGraph();
  tree.debugOverrideRootId = "1";
  const v1 = new TreeNode("1", 5, 4);
  tree.addNode(v1);
  const v2 = new TreeNode("2", 5, 6);
  tree.addNode(v2);
  const v3 = new TreeNode("3", 2.8125, 2.96875);
  tree.addNode(v3);
  const v4 = new TreeNode("4", 6.40625, 1.986607142857143);
  tree.addNode(v4);
  const v5 = new TreeNode("5", 7.477678571428572, 4.665178571428572);
  tree.addNode(v5);
  const v6 = new TreeNode("6", 6.517857142857143, 6.450892857142858);
  tree.addNode(v6);
  const v7 = new TreeNode("7", 8.950892857142858, 5.46875);
  tree.addNode(v7);
  const v8 = new TreeNode("8", 7.589285714285714, 2.7678571428571432);
  tree.addNode(v8);
  tree.addEdge(new TreeEdge(v2, v1, 18.3535269088408));
  tree.addEdge(new TreeEdge(v1, v4, 5.374958203338106));
  tree.addEdge(new TreeEdge(v3, v1, 4.343574713529792));
  tree.addEdge(new TreeEdge(v1, v5, 2.565414905079505));
  tree.addEdge(new TreeEdge(v5, v7, 9.725527648642851));
  tree.addEdge(new TreeEdge(v6, v5, 5.485700768590421));
  tree.addEdge(new TreeEdge(v5, v8, 10.733303331582217));
  return tree;
}

export function decodedWhereDoFlapsGoPacking() {
  const packing = new Packing();
  packing.scaleFactor = 0.031701175524034175;
  packing.nodes.set(
    "2",
    new PackingNode("2", 1.0000000000569993, 0.836799711012014)
  );
  packing.nodes.set(
    "3",
    new PackingNode("3", 0.4630704572433471, 0.35781891059362164)
  );
  packing.nodes.set(
    "4",
    new PackingNode("4", 0.5585535539217014, 0.06489953680507765)
  );
  packing.nodes.set(
    "6",
    new PackingNode("6", 0.9791987885239919, 7.367175203221166e-10)
  );
  packing.nodes.set(
    "7",
    new PackingNode("7", -4.2213310624816813e-10, 0.10553605968356494)
  );
  packing.nodes.set(
    "8",
    new PackingNode("8", -1.261446724853954e-9, 0.7541050516042278)
  );
  return packing;
}

export function decodedBadCorridorAfterPseudohingeTree() {
  const tree = new TreeGraph();
  tree.debugOverrideRootId = "4";
  const v1 = new TreeNode("1", 5, 4);
  tree.addNode(v1);
  const v2 = new TreeNode("2", 5, 6);
  tree.addNode(v2);
  const v5 = new TreeNode("5", 4.5504087193460485, 2.506811989100817);
  tree.addNode(v5);
  const v6 = new TreeNode("6", 5.640326975476839, 3.215258855585831);
  tree.addNode(v6);
  const v3 = new TreeNode("3", 3.514986376021798, 7.275204359673024);
  tree.addNode(v3);
  const v4 = new TreeNode("4", 6.076294277929155, 7.68392370572207);
  tree.addNode(v4);
  const v7 = new TreeNode("7", 7.1117166212534055, 7.68392370572207);
  tree.addNode(v7);
  const v8 = new TreeNode("8", 6.757493188010899, 8.77384196185286);
  tree.addNode(v8);
  const v9 = new TreeNode("9", 3.1335149863760217, 8.119891008174386);
  tree.addNode(v9);
  const v10 = new TreeNode("10", 2.7247956403269753, 6.975476839237056);
  tree.addNode(v10);
  tree.addEdge(new TreeEdge(v1, v5, 4.150476717883663));
  tree.addEdge(new TreeEdge(v1, v6, 2.654521076821072));
  tree.addEdge(new TreeEdge(v1, v2, 2));
  tree.addEdge(new TreeEdge(v2, v4, 1.9985015435059814));
  tree.addEdge(new TreeEdge(v2, v3, 1.9573991985106054));
  tree.addEdge(new TreeEdge(v3, v9, 0.9529317277948539));
  tree.addEdge(new TreeEdge(v3, v10, 1.1282162660313555));
  tree.addEdge(new TreeEdge(v4, v7, 1.0631695901529052));
  tree.addEdge(new TreeEdge(v4, v8, 3.6352767380799076));
  return tree;
}

export function decodedBadCorridorAfterPseudohingePacking() {
  const packing = new Packing();
  packing.scaleFactor = 0.0873900315629287;
  packing.nodes.set(
    "10",
    new PackingNode("10", 0.9999999971164418, 0.13695020600926255)
  );
  packing.nodes.set("5", new PackingNode("5", 0, 0.10156788020638523));
  packing.nodes.set(
    "6",
    new PackingNode("6", -3.017856131659613e-9, 0.6962568522712922)
  );
  packing.nodes.set("7", new PackingNode("7", 0.6020342518673453, 1));
  packing.nodes.set(
    "8",
    new PackingNode("8", 0.9999999986129633, 0.8989383006929783)
  );
  packing.nodes.set("9", new PackingNode("9", 0.8803257897397259, 0));
  return packing;
}
