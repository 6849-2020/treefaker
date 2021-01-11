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
  FacetOrderingGraph,
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
  pseudohingeElevationBugPacking,
  decodedNotADagErrorTree,
  decodedNotADagErrorPacking,
  decodedMogMergeBug2Tree,
  decodedMogMergeBug2Packing,
  mogMergeBugSimpleTree,
  mogMergeBugSimplePacking,
  decodedBadCorridorAfterPseudohingeTree,
  decodedBadCorridorAfterPseudohingePacking
} from "../helper";

function getCorridor(g, v1, v2) {
  const e = g.getEdge(v1, v2);
  if (e.leftFace.isOuterFace) {
    return (e.rightFace as Face).corridor as Face[];
  } else {
    return (e.leftFace as Face).corridor as Face[];
  }
}

describe("FacetOrderingGraph.topologicalSort", function() {
  it("returns facets in sorted order", function() {
    const face1 = new Face();
    face1.baseFaceLocalRoot = "1";
    const face2 = new Face();
    face2.baseFaceLocalRoot = "2";
    const face3 = new Face();
    face3.baseFaceLocalRoot = "3";
    const face4 = new Face();
    face4.baseFaceLocalRoot = "4";

    const orderingGraph = new FacetOrderingGraph();
    orderingGraph.addFace(face1);
    orderingGraph.addFace(face2);
    orderingGraph.addFace(face3);
    orderingGraph.addFace(face4);
    orderingGraph.addEdge(face1, face3);
    orderingGraph.addEdge(face2, face4);
    orderingGraph.addEdge(face1, face3);
    orderingGraph.addEdge(face4, face1);

    orderingGraph.addEdge(face2, face3);

    expect(
      orderingGraph.topologicalSort().map(face => face.baseFaceLocalRoot)
    ).to.eql(["2", "4", "1", "3"]);
  });

  it("throws error when graph is not a DAG", function() {
    const face1 = new Face();
    face1.baseFaceLocalRoot = "1";
    const face2 = new Face();
    face2.baseFaceLocalRoot = "2";
    const face3 = new Face();
    face3.baseFaceLocalRoot = "3";
    const face4 = new Face();
    face4.baseFaceLocalRoot = "4";

    const orderingGraph = new FacetOrderingGraph();
    orderingGraph.addFace(face1);
    orderingGraph.addFace(face2);
    orderingGraph.addFace(face3);
    orderingGraph.addFace(face4);
    orderingGraph.addEdge(face1, face3);
    orderingGraph.addEdge(face2, face4);
    orderingGraph.addEdge(face1, face3);
    orderingGraph.addEdge(face4, face1);

    orderingGraph.addEdge(face3, face2);

    expect(() => orderingGraph.topologicalSort()).to.throw("not a DAG");
  });
});

describe("dangle", function() {
  it("works on bone", function() {
    const tree = boneTree();
    const discreteDistances = tree.dangle("3");
    expect(discreteDistances).to.eql(
      new Map([
        ["unset", 1000],
        ["3", 0],
        ["1", 1],
        ["2", 1],
        ["4", 1],
        ["5", 2],
        ["6", 3],
        ["7", 3]
      ])
    );
  });

  it("works on small example from paper", function() {
    const tree = demaineLangPaperSmallTree();
    const discreteDistances = tree.dangle("3");
    expect(discreteDistances).to.eql(
      new Map([
        ["unset", 1000],
        ["3", 0],
        ["1", 1],
        ["2", 1],
        ["4", 1],
        ["5", 2],
        ["6", 2],
        ["7", 2]
      ])
    );
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
    expect(
      (f13Top.creaseToNextAxialFacet as Crease).getOtherFace(f13Top)
    ).to.equal(c1[1]);

    const c3 = getCorridor(g, v2, v3Top);
    const c4 = Array.from(getCorridor(g, v2, v3Right));
    expect(c3.length).to.equal(8);
    expect(c3).to.eql(c4.reverse());
    expect(c3.map(f => f.hasPseudohinge)).to.eql([
      false,
      true,
      true,
      false,
      false,
      false,
      false,
      false
    ]);
    const f23Top = c4[0] as Face;
    expect(
      (f23Top.creaseToNextAxialFacet as Crease).getOtherFace(f23Top)
    ).to.equal(f13Top);

    const c5 = getCorridor(g, v3Right, v4Right);
    expect(c5.length).to.equal(6);
    const c6 = Array.from((c5[5] as Face).corridor as Face[]);
    expect(c5).to.eql(c6.reverse());
    expect((c5[4] as Face).corridor).to.be.null;

    const outerFace = f13Top.crossAxialOrHull as Face;
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

  it("does not throw error on instance that once had a cyclic ordering graph", function() {
    const tree = decodedNotADagErrorTree();
    const p = decodedNotADagErrorPacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("doesn't matter");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });

  it("does not throw error on instance with a separate corridor between two pseudohinge facets", function() {
    const tree = decodedBadCorridorAfterPseudohingeTree();
    const p = decodedBadCorridorAfterPseudohingePacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("doesn't matter");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });
  
  
  // TODO The following two tests fail since the outer face is twisted.
  // Uncomment if we find a workaround (currently, twisted trees are caught at packing time).
  
  /*it("does not throw error on simple instance where MOGs can't be internally merged", function() {
    const tree = mogMergeBugSimpleTree();
    const p = mogMergeBugSimplePacking();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("doesn't matter");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });

  it("does not throw error on complicated instance where MOGs can't be internally merged", function() {
    const tree = decodedMogMergeBug2Tree();
    const p = decodedMogMergeBug2Packing();
    const d = tree.getDistances();
    const discreteDepth = tree.dangle("doesn't matter");
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    generateMolecules(g, d, p.scaleFactor, discreteDepth);
    orderFacets(g, discreteDepth);
  });*/
});
