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
  CreasesGraph,
  TOLERANCE
} from "../../src/engine/packing";
import {
  cleanPacking,
  buildFaces,
  generateMolecules,
  subdivideCreasesInitial,
  isTwisted
} from "../../src/engine/creases";
import {
  fiveStarTree,
  fiveStarPacking,
  threeNodeSuboptimalTree,
  threeNodeSuboptimalPacking,
  tenStarSuboptimalTree,
  tenStarSuboptimalPacking,
  twoNodeTree,
  twoNodeAdjacentCornersPacking,
  rabbitEarOnSideTree,
  rabbitEarOnSidePacking,
  demaineLangPaperSmallTree,
  demaineLangPaperSmallPacking,
  boneTree,
  bonePacking
} from "../helper";

function getCorridor(g, v1, v2) {
  const e = g.getEdge(v1, v2);
  if (e.leftFace.isOuterFace) {
    return (e.rightFace as Face).corridor as Face[];
  } else {
    return (e.leftFace as Face).corridor as Face[];
  }
}

describe("subdivideCreasesInitial", function() {
  it("works on small example from paper", function() {
    const tree = demaineLangPaperSmallTree();
    const p = demaineLangPaperSmallPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    const [z, inactiveHullCreases] = subdivideCreasesInitial(
      g,
      d,
      p.scaleFactor
    );
    const v1 = g.nodes.get("1") as CreasesNode;
    const v2 = g.nodes.get("2") as CreasesNode;
    const v5 = g.nodes.get("5") as CreasesNode;
    const v6 = g.nodes.get("6") as CreasesNode;
    const zDistances12 = (z.get(v1) as Map<
      CreasesNode,
      Array<[string, number, CreasesNode | null]>
    >).get(v2) as Array<[string, number, CreasesNode | null]>;
    const zDistances15 = (z.get(v1) as Map<
      CreasesNode,
      Array<[string, number, CreasesNode | null]>
    >).get(v5) as Array<[string, number, CreasesNode | null]>;
    const zDistances16 = (z.get(v1) as Map<
      CreasesNode,
      Array<[string, number, CreasesNode | null]>
    >).get(v6) as Array<[string, number, CreasesNode | null]>;
    expect(zDistances12.length).to.equal(2);
    expect(zDistances15.length).to.equal(1);
    expect(zDistances16.length).to.equal(3);
  });
});

describe("generateMolecules", function() {
  it("works on optimal 4-leaf star", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
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
    expect(buildFaces(g)).to.be.null;
    expect(isTwisted(d, g)).to.be.false;
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

  it("works on bone, which makes exactly 2 inset nodes in one step", function() {
    const tree = boneTree();
    const p = bonePacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    expect(isTwisted(d, g)).to.be.false;
    generateMolecules(g, d, p.scaleFactor);
    expect(g.nodes.size).to.equal(15);
    expect(g.edges.size).to.equal(26);
    expect(g.faces.size).to.equal(13);
    const centralNode = g.nodes.get("i11") as CreasesNode;
    expect(centralNode.x).to.be.closeTo(1 / 3, TOLERANCE);
    expect(centralNode.y).to.be.closeTo(1 / 2, TOLERANCE);
    expect(
      Array.from(centralNode.edges)
        .map(e => e.creaseType)
        .sort()
        .map(c => CreaseType[c])
    ).to.eql(
      [
        CreaseType.Ridge,
        CreaseType.Ridge,
        CreaseType.Hinge,
        CreaseType.Hinge
      ].map(c => CreaseType[c])
    );
  });

  it("works on small example from paper", function() {
    const tree = demaineLangPaperSmallTree();
    const p = demaineLangPaperSmallPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor);
    //console.log(Array.from(g.edges.values()).map(e => CreaseType[e.creaseType]));
    expect(g.nodes.size).to.equal(30);
    expect(g.edges.size).to.equal(55);
    expect(g.faces.size).to.equal(27);
    
    const v1 = g.nodes.get("1") as CreasesNode;
    const v2 = g.nodes.get("2") as CreasesNode;
    const v7 = g.nodes.get("7") as CreasesNode;
    const v3Top = v1.edges[2].getOtherNode(v1);
    const v3TopLeft = v1.edges[0].getOtherNode(v1);
    const v4Right = v7.edges[1].getOtherNode(v7);
    const v3Right = v4Right.edges[2].getOtherNode(v4Right);
    
    const c1 = getCorridor(g, v1, v3Top);
    const c2 = Array.from(getCorridor(g, v1, v3TopLeft));
    expect(c1.length).to.equal(2);
    expect(c1).to.eql(c2.reverse());
    
    const c3 = getCorridor(g, v2, v3Top);
    const c4 = Array.from(getCorridor(g, v2, v3Right));
    expect(c3.length).to.equal(8);
    expect(c3).to.eql(c4.reverse());
    expect(c3.map(f => f.hasPseudohinge)).to.eql([false, true, true, false, false, false, false, false]);
    
    const c5 = getCorridor(g, v3Right, v4Right);
    expect(c5.length).to.equal(6);
    const c6 = Array.from((c5[5] as Face).corridor as Face[]);
    expect(c5).to.eql(c6.reverse());
    expect((c5[4] as Face).corridor).to.be.null;
  });

  it("does not throw error on 10-leaf star tree", function() {
    const tree = tenStarSuboptimalTree();
    const p = tenStarSuboptimalPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    expect(isTwisted(d, g)).to.be.false;
    generateMolecules(g, d, p.scaleFactor);
  });
});
