import { expect } from "chai";
import { Node, Edge, Face, TreeNode, TreeEdge, PackingNode, Packing, CreasesNode, CreaseType, MVAssignment, Crease, Graph, TreeGraph, CreasesGraphState, CreasesGraph }  from "../../src/engine/packing";
import { cleanPacking } from "../../src/engine/creases";
import { fiveStarTree, fiveStarPacking } from "../helper";

describe("cleanPacking", function() {
  it("on 5-node star packing, does not change leaf lengths", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(Array.from(g.leafExtensions.values())).to.eql([0, 0, 0, 0]);
  });
  
  it("on 5-node star packing, has 4 active hull creases", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    const creases: CreaseType[] = [];
    for (const crease of g.edges) {
      creases.push(crease.creaseType);
    }
    expect(creases).to.eql([CreaseType.ActiveHull, CreaseType.ActiveHull, CreaseType.ActiveHull, CreaseType.ActiveHull]);
  });
});
