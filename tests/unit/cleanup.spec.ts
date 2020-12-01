import { expect } from "chai";
import { Node, Edge, Face, TreeNode, TreeEdge, PackingNode, Packing, CreasesNode, CreaseType, MVAssignment, Crease, Graph, TreeGraph, CreasesGraphState, CreasesGraph, TOLERANCE }  from "../../src/engine/packing";
import { cleanPacking, get2CircleIntersection, getIndexOfConvexGap } from "../../src/engine/creases";
import { fiveStarTree, fiveStarPacking, threeNodeSuboptimalTree, threeNodeSuboptimalPacking, tenStarSuboptimalTree, tenStarSuboptimalPacking } from "../helper";

describe("getIndexOfConvexGap", function() {
  it("returns null list when no convex gap exists", function() {
    const g = new Graph();
    const v1 = new Node("center", 0, 0);
    const v2 = new Node("left", -5, 1);
    const v3 = new Node("bottom-left", 3, 3);
    const v4 = new Node("right", 5, -2);
    g.addNode(v1);
    g.addNode(v2);
    g.addNode(v3);
    g.addNode(v4);
    const e2 = new Edge(v2, v1);
    const e3 = new Edge(v3, v1);
    const e4 = new Edge(v4, v1);
    g.addEdge(e2);
    g.addEdge(e3);
    g.addEdge(e4);
    const [indexOfConvexGap, v1t, v2t] = getIndexOfConvexGap(v1);
    expect(getIndexOfConvexGap(v1)).to.eql([null, null, null]);
  });
  
  it("finds convex gap when it exists and doesn't cover -x axis", function() {
    const g = new Graph();
    const v1 = new Node("center", 0, 0);
    const v2 = new Node("left", -5, 1);
    const v3 = new Node("bottom-left", -3, -3);
    const v4 = new Node("right", 5, -2);
    g.addNode(v1);
    g.addNode(v2);
    g.addNode(v3);
    g.addNode(v4);
    const e2 = new Edge(v2, v1);
    const e3 = new Edge(v3, v1);
    const e4 = new Edge(v4, v1);
    g.addEdge(e2);
    g.addEdge(e3);
    g.addEdge(e4);
    const [indexOfConvexGap, v1t, v2t] = getIndexOfConvexGap(v1);
    expect(indexOfConvexGap).to.equal(1);
    expect((v1t as Node).id).to.equal("right");
    expect((v2t as Node).id).to.equal("left");
  });
  
  it("finds convex gap when it exists and does cover -x axis", function() {
    const g = new Graph();
    const v1 = new Node("center", 0, 0);
    const v2 = new Node("left", -5, 1);
    const v3 = new Node("top-right", 3, 3);
    const v4 = new Node("right", 5, 0);
    g.addNode(v1);
    g.addNode(v2);
    g.addNode(v3);
    g.addNode(v4);
    const e2 = new Edge(v2, v1);
    const e3 = new Edge(v3, v1);
    const e4 = new Edge(v4, v1);
    g.addEdge(e2);
    g.addEdge(e3);
    g.addEdge(e4);
    const [indexOfConvexGap, v1t, v2t] = getIndexOfConvexGap(v1);
    expect(indexOfConvexGap).to.equal(2);
    expect((v1t as Node).id).to.equal("left");
    expect((v2t as Node).id).to.equal("right");
  });
});

describe("get2CircleIntersection", function() {
  it("computes intersection point on left side", function() {
    const [x, y] = get2CircleIntersection(1, 1, 5, 9, 1, 5, true)
    expect(x).to.equal(5);
    expect(y).to.equal(4);
  });
  
  it("computes intersection point on right side", function() {
    const [x, y] = get2CircleIntersection(2, 1, 4, 2, 4, 5, false)
    expect(x).to.equal(6);
    expect(y).to.equal(1);
  });
});

describe("cleanPacking", function() {
  it("on optimal 4-leaf star packing, does not change leaf lengths", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(Array.from(g.leafExtensions.values())).to.eql([0, 0, 0, 0]);
  });
  
  it("on optimal 4-leaf star packing, has 4 axial creases", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    const creases: CreaseType[] = [];
    for (const crease of g.edges.values()) {
      creases.push(crease.creaseType);
    }
    expect(creases).to.eql([CreaseType.Axial, CreaseType.Axial, CreaseType.Axial, CreaseType.Axial]);
  });
  
  it("on 4-leaf star packing with non-optimal scale factor, increases edge lengths", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    p.scaleFactor = 1/8;
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(Array.from(g.leafExtensions.values())).to.have.members([0, 0, 2, 2]);
  });
  
  it("on 3-node tree suboptimal packing, increases edge length and moves vertex to boundary", function() {
    const tree = threeNodeSuboptimalTree();
    const p = threeNodeSuboptimalPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    const vPacking = p.nodes.get("2") as PackingNode;
    const vCreases = g.nodes.get("2") as CreasesNode;
    expect(Array.from(g.leafExtensions.values())).to.have.members([0, 12.5]);
    expect(vPacking.x).to.equal(1/4);
    expect(vPacking.y).to.equal(1);
    expect(vCreases.x).to.equal(1/4);
    expect(vCreases.y).to.equal(1);
  });
  
  it("on 10-leaf tree suboptimal packing, increases edge length and moves vertex to center", function() {
    const tree = tenStarSuboptimalTree();
    const p = tenStarSuboptimalPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    const vPacking = p.nodes.get("6") as PackingNode;
    const vCreases = g.nodes.get("6") as CreasesNode;
    expect(Array.from(g.leafExtensions.values())).to.have.members([0, 0, 0, 0, 0, 0, 0, 0, 0, 2.5]);
    expect(vPacking.x).to.equal(10/16);
    expect(vPacking.y).to.equal(8/16);
    expect(vCreases.x).to.equal(10/16);
    expect(vCreases.y).to.equal(8/16);
  });
  
  it("on 10-leaf tree suboptimal packing variant, performs three different kinds of moves to center", function() {
    const tree = tenStarSuboptimalTree();
    const p = tenStarSuboptimalPacking();
    (p.nodes.get("6") as PackingNode).x = 9/16;
    (p.nodes.get("6") as PackingNode).y = 7/16;
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    const vPacking = p.nodes.get("6") as PackingNode;
    const vCreases = g.nodes.get("6") as CreasesNode;
    const leafExtension = g.leafExtensions.get(vCreases) as number;
    const leafExtensionsArray = Array.from(g.leafExtensions.values());
    leafExtensionsArray.splice(leafExtensionsArray.indexOf(leafExtension), 1);
    expect(leafExtension).to.be.closeTo(2.5, TOLERANCE/p.scaleFactor);
    expect(leafExtensionsArray).to.eql([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(vPacking.x).to.be.closeTo(10/16, TOLERANCE/p.scaleFactor);
    expect(vPacking.y).to.be.closeTo(8/16, TOLERANCE/p.scaleFactor);
    expect(vCreases.x).to.be.closeTo(10/16, TOLERANCE/p.scaleFactor);
    expect(vCreases.y).to.be.closeTo(8/16, TOLERANCE/p.scaleFactor);
  });
});
