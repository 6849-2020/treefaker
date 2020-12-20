/**
 * Functional tests for the disk packing solver.
 */
import { expect } from "chai";
import { zeros, size } from "mathjs";
import {
  toMatrix,
  genConstraints,
  genGradConstraints
} from "../../src/engine/packing/constraints";
import { solve } from "../../src/engine/packing/alm";
import {
  fiveStarTree,
  threeNodeSuboptimalTree,
  tenStarSuboptimalTree,
  demaineLangPaperSmallTree,
  crabTree
} from "../helper";

const TEST_CASES = {
  "star tree (5 nodes)": fiveStarTree,
  "star tree (3 nodes)": threeNodeSuboptimalTree,
  "Demaine & Lang small example tree": demaineLangPaperSmallTree,
  "star tree (10 nodes)": tenStarSuboptimalTree,
  "crab tree (by Jason Ku)": crabTree
  // TODO (@pjrule): improve solver to cover these cases
  // w/o perturbation.
  /*
  "rabbit ear on side tree": rabbitEarOnSideTree,
  "bone tree": boneTree,
  */
};
const BOX_TOL = 1e-5;
const OVERLAP_TOL = 1e-5;

Object.entries(TEST_CASES).forEach(testCase => {
  const [testName, testFn] = testCase;
  // see https://stackoverflow.com/a/30815171
  describe("ALM disk packing solver: " + testName, function() {
    const tree = testFn();
    const d = tree.getDistances();
    const distanceMatrix = toMatrix(d);
    const constraints = {
      constraints: genConstraints(distanceMatrix),
      grad: genGradConstraints(distanceMatrix)
    };
    const n = d.size;
    const solSize = 2 * n + 1;
    const initSol = zeros([solSize]);

    const treeNodes = Array.from(tree.nodes.values());
    const minX = Math.min(...treeNodes.map(n => n.x));
    const maxX = Math.max(...treeNodes.map(n => n.x));
    const minY = Math.min(...treeNodes.map(n => n.y));
    const maxY = Math.max(...treeNodes.map(n => n.y));

    let nodeIdx = 0;
    for (const node of tree.nodes.values()) {
      if (node.edges.length === 1) {
        initSol[nodeIdx] = (0.25 * (node.x - minX)) / (maxX - minX);
        initSol[nodeIdx + n] = (0.25 * (node.y - minY)) / (maxY - minY);
        nodeIdx += 1;
      }
    }

    const sol = solve(initSol, distanceMatrix, constraints);
    it("should have the right solution size", function() {
      expect(sol).to.not.be.undefined;
      expect(size(sol)).to.eql([solSize]);
    });

    const scale = sol[2 * n];
    it("should have a positive scale factor", function() {
      expect(scale).to.be.above(0);
    });
    it("should satisfy unit box constraints", function() {
      for (let i = 0; i < n; i++) {
        expect(sol[i]).to.be.at.least(-BOX_TOL);
        expect(sol[i]).to.be.at.most(1 + BOX_TOL);
        expect(sol[i + n]).to.be.at.least(-BOX_TOL);
        expect(sol[i + n]).to.be.at.most(1 + BOX_TOL);
      }
    });
    it("should satisfy overlap constraints", function() {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const minDist = scale * distanceMatrix[i][j];
          const dist = Math.sqrt(
            Math.pow(sol[i] - sol[j], 2) + Math.pow(sol[i + n] - sol[j + n], 2)
          );
          expect(dist - minDist).to.be.at.least(-OVERLAP_TOL);
        }
      }
    });
  });
});
