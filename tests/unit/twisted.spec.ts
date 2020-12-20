import { expect } from "chai";
import { cleanPacking, buildFaces, isTwisted } from "../../src/engine/creases";
import { boneTree, twistedBonePacking } from "../helper";

describe("isTwisted", function() {
  it("correctly detects twisted bone packing", function() {
    const tree = boneTree();
    const p = twistedBonePacking();
    const d = tree.getDistances();
    const g = cleanPacking(p, d);
    expect(buildFaces(g)).to.be.null;
    expect(isTwisted(d, g)).to.be.true;
  });
});
