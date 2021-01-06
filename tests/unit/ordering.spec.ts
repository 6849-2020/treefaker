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
import { orderFacets } from "../../src/engine/creases/ordering";
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
  twoMoleculeTree,
  twoMoleculePacking,
  demaineLangPaperSmallTree,
  demaineLangPaperSmallPacking,
  boneTree,
  bonePacking,
  crossingSwordsTree,
  crossingSwordsPacking,
  pseudohingeElevationBugTree,
  pseudohingeElevationBugPacking
} from "../helper";

function getCorridor(g, v1, v2) {
  const e = g.getEdge(v1, v2);
  if (e.leftFace.isOuterFace) {
    return (e.rightFace as Face).corridor as Face[];
  } else {
    return (e.leftFace as Face).corridor as Face[];
  }
}

describe("dangle", function() {
  it("works on bone", function() {
    const tree = boneTree();
    const discreteDistances = tree.dangle("3");
    expect(discreteDistances).to.eql(new Map([
      ["unset", 1000],
      ["3", 0],
      ["1", 1],
      ["2", 1],
      ["4", 1],
      ["5", 2],
      ["6", 3],
      ["7", 3]
    ]));
  });
  
  it("works on small example from paper", function() {
    const tree = demaineLangPaperSmallTree();
    const discreteDistances = tree.dangle("3");
    expect(discreteDistances).to.eql(new Map([
      ["unset", 1000],
      ["3", 0],
      ["1", 1],
      ["2", 1],
      ["4", 1],
      ["5", 2],
      ["6", 2],
      ["7", 2]
    ]));
  });
});

describe("orderFacets", function() {
  it("has face pointers set correctly on small example from paper", function() {
    const tree = demaineLangPaperSmallTree();
    const p = demaineLangPaperSmallPacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("3");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    
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
    const f13Top = c1[0] as Face;
    expect(((f13Top).creaseToNextAxialFacet as Crease).getOtherFace(f13Top)).to.equal(c1[1]);
    
    const c3 = getCorridor(g, v2, v3Top);
    const c4 = Array.from(getCorridor(g, v2, v3Right));
    expect(c3.length).to.equal(8);
    expect(c3).to.eql(c4.reverse());
    expect(c3.map(f => f.hasPseudohinge)).to.eql([false, true, true, false, false, false, false, false]);
    const f23Top = c4[0] as Face;
    expect(((f23Top).creaseToNextAxialFacet as Crease).getOtherFace(f23Top)).to.equal(f13Top);
    
    const c5 = getCorridor(g, v3Right, v4Right);
    expect(c5.length).to.equal(6);
    const c6 = Array.from((c5[5] as Face).corridor as Face[]);
    expect(c5).to.eql(c6.reverse());
    expect((c5[4] as Face).corridor).to.be.null;
    
    const outerFace = f13Top.crossAxialOrHull as Face
    expect(outerFace.isOuterFace).to.be.true;
    expect(f23Top.crossAxialOrHull).to.equal(outerFace);
    
    const baseFace = f13Top.baseFaceLocalRoot as Face;
    expect(f23Top.baseFaceLocalRoot).to.equal(baseFace);
    expect(baseFace.baseFaceLocalRoot).to.equal("3");
  });
  
  it("correctly assigns all hinges on optimal 4-leaf star", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("1");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
    const numCreasesOfType = [0, 0, 0, 0, 0];
    for (const crease of g.edges.values()) {
      numCreasesOfType[crease.assignment]++;
    }
    expect(numCreasesOfType).to.eql([5, 3, 0, 0, 8]);
  });

  it("does not throw error on bone", function() {
    const tree = boneTree();
    const p = bonePacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("3");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });
  
  it("does not throw error on small example from paper", function() {
    const tree = demaineLangPaperSmallTree();
    const p = demaineLangPaperSmallPacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("3");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });

  it("does not throw error on instance with two triangular molecules", function() {
    const tree = twoMoleculeTree();
    const p = twoMoleculePacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("0");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });

  it("does not throw error on 10-leaf star tree", function() {
    const tree = tenStarSuboptimalTree();
    const p = tenStarSuboptimalPacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("0");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });

  it("does not throw error on instance where pseudohinge facet has low elevation", function() {
    const tree = pseudohingeElevationBugTree();
    const p = pseudohingeElevationBugPacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("1");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });

  it("does not throw error on complicated tree with 12 nodes", function() {
    const tree = crossingSwordsTree();
    const p = crossingSwordsPacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("1");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });
});
