import { expect } from "chai";
import { Node, Edge, Face, TreeNode, TreeEdge, PackingNode, Packing, CreasesNode, CreaseType, MVAssignment, Crease, Graph, TreeGraph, CreasesGraphState, CreasesGraph, TOLERANCE }  from "../../src/engine/packing";
import { cleanPacking, buildFaces, generateMolecules, subdivideCreasesInitial } from "../../src/engine/creases";
import { fiveStarTree, fiveStarPacking, threeNodeSuboptimalTree, threeNodeSuboptimalPacking, tenStarSuboptimalTree, tenStarSuboptimalPacking, twoNodeTree, twoNodeAdjacentCornersPacking, rabbitEarOnSideTree, rabbitEarOnSidePacking } from "../helper";

describe("generateMolecules", function() {
  it("works on optimal 4-leaf star", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    buildFaces(g);
    generateMolecules(g, d, p.scaleFactor);
    expect(g.nodes.size).to.equal(9);
    expect(g.edges.size).to.equal(16);
    expect(g.faces.size).to.equal(9);
    const centralNode = g.nodes.get("i5") as CreasesNode;
    expect(centralNode.edges.length).to.equal(8);
    const internalEdgeNode = g.nodes.get("i2") as CreasesNode;
    expect(internalEdgeNode.edges.length).to.equal(3);
    expect(centralNode.x).to.equal(0.5);
    expect(centralNode.y).to.equal(0.5);
    expect(g.nodes.get("i6")).to.be.undefined;
  });
  
  it("works on isosceles triangle (makes rabbit ear)", function() {
    const tree = rabbitEarOnSideTree();
    const p = rabbitEarOnSidePacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    buildFaces(g);
    generateMolecules(g, d, p.scaleFactor);
    expect(g.nodes.size).to.equal(7);
    expect(g.edges.size).to.equal(12);
    expect(g.faces.size).to.equal(7);
    const centralNode = g.nodes.get("i4") as CreasesNode;
    expect(centralNode.edges.length).to.equal(6);
    expect(centralNode.x).to.be.closeTo(0.791666, TOLERANCE);
    expect(centralNode.y).to.be.closeTo(0.5, TOLERANCE);
    expect(g.nodes.get("i5")).to.be.undefined;
  });
});
