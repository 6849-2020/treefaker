import { expect } from "chai";
import { Node, Edge, Face, TreeNode, TreeEdge, PackingNode, Packing, CreasesNode, CreaseType, MVAssignment, Crease, Graph, TreeGraph, CreasesGraphState, CreasesGraph, TOLERANCE }  from "../../src/engine/packing";
import { cleanPacking, get2CircleIntersection, getIndexOfConvexGap, buildFaces } from "../../src/engine/creases";
import { fiveStarTree, fiveStarPacking, threeNodeSuboptimalTree, threeNodeSuboptimalPacking, tenStarSuboptimalTree, tenStarSuboptimalPacking } from "../helper";

describe("buildFaces", function() {
  it("on optimal 4-leaf star, constructs two faces with correct orientation", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    buildFaces(g);
    const creases: CreaseType[] = [];
    for (const crease of g.edges.values()) {
      creases.push(crease.creaseType);
    }
    
    expect(creases).to.eql([CreaseType.ActiveHull, CreaseType.ActiveHull, CreaseType.ActiveHull, CreaseType.ActiveHull]);
    
    const faces = Array.from(g.faces);
    expect(faces.length).to.equal(2);
    const f1 = faces[0] as Face;
    const f2 = faces[1] as Face;
    const outerFace = f1.isOuterFace ? f1 : f2;
    const innerFace = f1.isOuterFace ? f2 : f1;
    expect(innerFace.isOuterFace).to.be.false;
    
    const outerFaceNodeIds = outerFace.nodes.map(n => n.id);
    expect(Array.from(outerFaceNodeIds).sort()).to.eql(["2", "3", "4", "5"]);
    expect(outerFaceNodeIds.indexOf("3") - outerFaceNodeIds.indexOf("2")).to.equal(-1);
    
    const innerFaceNodeIds = innerFace.nodes.map(n => n.id);
    expect(Array.from(innerFaceNodeIds).sort()).to.eql(["2", "3", "4", "5"]);
    expect(innerFaceNodeIds.indexOf("3") - innerFaceNodeIds.indexOf("2")).to.equal(1);
    
    const crease25 = g.getEdge(g.nodes.get("2") as CreasesNode, g.nodes.get("5") as CreasesNode) as Crease;
    expect(crease25.leftFace).to.equal(outerFace);
    expect(crease25.rightFace).to.equal(innerFace);
    
    const crease23 = g.getEdge(g.nodes.get("2") as CreasesNode, g.nodes.get("3") as CreasesNode) as Crease;
    expect(crease23.leftFace).to.equal(innerFace);
    expect(crease23.rightFace).to.equal(outerFace);
  });
  
  it("on cleaned 3-node tree, constructs one face with all pointers correctly set", function() {
    const tree = threeNodeSuboptimalTree();
    const p = threeNodeSuboptimalPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    buildFaces(g);
    
    const faces = Array.from(g.faces);
    expect(faces.length).to.equal(1);
    const face = faces[0] as Face;
    expect(face.isOuterFace).to.be.true;
    
    const creases = Array.from(g.edges.values());
    expect(creases.length).to.equal(1);
    const crease = creases[0] as Crease;
    expect(crease.creaseType).to.equal(CreaseType.ActiveHull);
    
    expect(crease.leftFace).to.equal(face);
    expect(crease.rightFace).to.equal(face);
    expect(face.nodes.map(n => n.id).sort()).to.eql(["1", "2"]);
  });
  
  it("on cleaned 10-leaf tree, constructs the right number of faces and sets new hull edge pointers", function() {
    const tree = tenStarSuboptimalTree();
    const p = tenStarSuboptimalPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    buildFaces(g);
  
    const faces = Array.from(g.faces);
    expect(faces.length).to.equal(4);
    expect(faces.map(face => face.nodes.length).sort()).to.eql([4, 5, 6, 9]);
    
    const crease104 = g.getEdge(g.nodes.get("4") as CreasesNode, g.nodes.get("10") as CreasesNode) as Crease;
    expect(crease104.creaseType).to.equal(CreaseType.InactiveHull)
    const leftFace = crease104.leftFace as Face;
    const rightFace = crease104.rightFace as Face;
    expect(leftFace.nodes.length).to.equal(4);
    expect(rightFace.nodes.length).to.equal(9);
    expect(leftFace.isOuterFace).to.be.false;
    expect(rightFace.isOuterFace).to.be.true;
  });
  
  it("throws error if edges are disconnected", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    
    const v1 = new CreasesNode("x", 0.25, 0.25);
    const v2 = new CreasesNode("y", 0.75, 0.75);
    const e = new Crease(v2, v1, CreaseType.Gusset);
    g.addNode(v1);
    g.addNode(v2);
    g.addEdge(e);
    
    expect(() => buildFaces(g)).to.throw("Edges x-y lie in different component than first hull edge");
  });
});
