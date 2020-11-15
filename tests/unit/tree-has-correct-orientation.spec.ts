import { expect } from "chai";
import { Node, Edge, Face, TreeNode, PackingNode, Packing, CreasesNode, CreaseType, MVAssignment, Crease, Graph, TreeGraph, CreasesGraphState, CreasesGraph }  from "../../src/engine/packing";

describe("TreeGraph", function() {
  it("should have edges arranged in correct order", function() {
    const centralNode = new Node("u", 0, 0);
    const v1 = new TreeNode("v1", 0, 1);
    const v2 = new TreeNode("v2", 0, -1);
    const v3 = new TreeNode("v3", 1, 0);
    const tree = new TreeGraph();
    tree.addNode(centralNode);
    tree.addNode(v1);
    tree.addNode(v2);
    tree.addNode(v3);
    const e1 = tree.addEdge(v1, centralNode);
    const e2 = tree.addEdge(v2, centralNode);
    const e3 = tree.addEdge(v3, centralNode);
    const edges = centralNode.edges;
    expect([edges[0].to.id, edges[1].to.id, edges[2].to.id]).to.eql(["v2", "v3", "v1"]);
  })
});

