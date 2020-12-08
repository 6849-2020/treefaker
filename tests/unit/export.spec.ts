import { expect } from "chai";
import {
  cleanPacking,
  buildFaces,
  generateMolecules,
} from "../../src/engine/creases";
import { generateFold } from "../../src/engine/creases/export";
import { fiveStarTree, fiveStarPacking } from "../helper";

describe("generateFold", function() {
  it("works on optimal 4-leaf star", function() {
    const tree = fiveStarTree();
    const p = fiveStarPacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    buildFaces(g);
    generateMolecules(g, d, p.scaleFactor);
    const fold = generateFold(g);

    // Metadata should be constant.
    expect(fold.file_spec).to.equal("1.1");
    expect(fold.file_creator).to.equal("TreeFaker");
    expect(fold.file_classes).to.eql(["creasePattern"]);

    const nNodes = g.nodes.size;
    const nEdges = g.edges.size;
    const nFaces = g.faces.size;

    // Number of elements should match the graph.
    expect(fold.vertices_coords).to.have.lengthOf(nNodes);
    expect(fold.vertices_edges).to.have.lengthOf(nNodes);
    expect(fold.edges_vertices).to.have.lengthOf(nEdges);
    expect(fold.edges_foldAngle).to.have.lengthOf(nEdges);
    expect(fold.edges_assignment).to.have.lengthOf(nEdges);
    expect(fold.faces_vertices).to.have.lengthOf(nFaces - 1);

    // Coordinates should be well-formed.
    for (const coord of fold.vertices_coords) {
      expect(coord).to.have.lengthOf(2);
      expect(coord[0]).to.be.at.least(0);
      expect(coord[0]).to.be.at.most(1);
      expect(coord[1]).to.be.at.least(0);
      expect(coord[1]).to.be.at.most(1);
    }

    // Newly generated IDs should be well-formed.
    for (const vertex of fold.vertices_edges) {
      for (const eid of vertex) {
        expect(eid).to.be.at.least(0);
        expect(eid).to.be.below(nEdges);
      }
    }
    for (const edge of fold.edges_vertices) {
      expect(edge).to.have.lengthOf(2);
      expect(edge[0]).to.not.equal(edge[1]);
      expect(edge[0]).to.be.at.least(0);
      expect(edge[0]).to.be.below(nNodes);
      expect(edge[1]).to.be.at.least(0);
      expect(edge[1]).to.be.below(nNodes);
    }
    for (const face of fold.faces_vertices) {
      for (const vid of face) {
        expect(vid).to.be.at.least(0);
        expect(vid).to.be.below(nNodes);
      }
    }

    // Crease assignments should be within the set of possible values.
    for (const assignment of fold.edges_assignment) {
      expect(["M", "V", "U", "B"]).to.include(assignment);
    }

    // Fold angles should be within the set of possible values.
    for (const angle of fold.edges_foldAngle) {
      expect([0, -180, 180, null]).to.include(angle);
    }
  });
});
