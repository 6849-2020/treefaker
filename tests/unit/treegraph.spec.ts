import { expect } from "chai";
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

import { twoNodeTree } from "../helper";

describe("TreeGraph", function() {
  let centralNode: TreeNode;
  let v1: TreeNode;
  let v2: TreeNode;
  let v3: TreeNode;
  let tree: TreeGraph;
  let edges: TreeEdge[];
  let d: Map<string, Map<string, Array<[string, number]>>>;
  let dV1V2: Array<[string, number]>;
  let e1: TreeEdge;

  beforeEach(function() {
    centralNode = new TreeNode("u", 0, 0);
    v1 = new TreeNode("v1", 0, 1);
    v2 = new TreeNode("v2", 0, -1);
    v3 = new TreeNode("v3", 1, 0);
    tree = new TreeGraph();
    tree.addNode(centralNode);
    tree.addNode(v1);
    tree.addNode(v2);
    tree.addNode(v3);
    e1 = new TreeEdge(v1, centralNode, 1);
    tree.addEdge(e1);
    tree.addEdge(new TreeEdge(v2, centralNode, 2));
    tree.addEdge(new TreeEdge(v3, centralNode, 4));
    edges = centralNode.edges as TreeEdge[];
    d = tree.getDistances();
    dV1V2 = (d.get("v1") as Map<string, Array<[string, number]>>).get(
      "v2"
    ) as Array<[string, number]>;
  });

  it("computes distances correctly on two-node tree", function() {
    const simpleTree = twoNodeTree();
    const distances = simpleTree.getDistances();
    const distance1 = (distances.get("0") as Map<
      string,
      Array<[string, number]>
    >).get("1") as Array<[string, number]>;
    expect(distance1[0]).to.eql(["1", 2]);
    const distance2 = (distances.get("1") as Map<
      string,
      Array<[string, number]>
    >).get("0") as Array<[string, number]>;
    expect(distance2[0]).to.eql(["0", 2]);
  });

  it("has edges arranged in correct order", function() {
    expect([edges[0].to.id, edges[1].to.id, edges[2].to.id]).to.eql([
      "v2",
      "v3",
      "v1"
    ]);
  });

  it("correctly returns clockwise and counterclockwise edges", function() {
    expect(centralNode.clockwise(e1).to.id).to.equal("v3");
    expect(centralNode.counterclockwise(e1).to.id).to.equal("v2");
    expect(v1.clockwise(e1).to.id).to.equal("v1");
    expect(v1.counterclockwise(e1).to.id).to.equal("v1");
  });

  it("computes distances according to edge lengths", function() {
    expect(dV1V2[0]).to.eql(["u", 1]);
    expect(dV1V2[1]).to.eql(["v2", 3]);
  });
});
