<template>
  <div id="packingViewBox" class="viewBox" />
</template>

<script lang="ts">
import Vuex from "vuex";
import { Component, Prop, Vue } from "vue-property-decorator";
import { JSXGraph, Board } from "jsxgraph";
import { zeros, size, random, add, multiply, matrix } from "mathjs";
import { Packing, PackingNode, CreasesGraph } from "../engine/packing";
import {
  genConstraints,
  genGradConstraints,
  toMatrix
} from "../engine/packing/constraints";
import { solve } from "../engine/packing/alm";
import { cleanPacking } from "../engine/creases";

@Component
export default class PackingView extends Vue {
  packingBoard: Board;

  constructor() {
    super();
    this.packingBoard = null;
  }

  clear() {
    const packingBoard = JSXGraph.initBoard("packingViewBox", {
      boundingbox: [-0.05, 1.05, 1.05, -0.05],
      showCopyright: false,
      showNavigation: false
    });
    packingBoard.create("grid", []);
    this.packingBoard = packingBoard;
  }

  mounted() {
    this.clear();
  }

  async pack() {
    // TODO (@pjrule): this is not strictly view code and should
    // almost certainly be moved to the engine (perhaps as a method of `Packing`).
    this.$store.commit("clearGlobalError");
    this.clear();
    const PERTURB_EPS = 1e-3;

    // Construct the optimization problem.
    const leaves = new Set();
    const leafLengths = new Map();
    (this.$store.state as any).treeGraph.nodes.forEach(function(
      node,
      key: string
    ) {
      if (node.edges.length === 1) {
        leaves.add(key);
        leafLengths.set(key, node.edges[0].length);
      }
    });
    const distances = (this.$store.state as any).treeGraph.getDistances();
    if (leaves.size === distances.size) {
      this.$store.commit(
        "updateGlobalError",
        "Add at least one non-leaf vertex to the tree."
      );
      return;
    }

    const leafDistances = new Map();
    distances.forEach(function(
      dists: Map<string, Map<string, Map<string, number>>>,
      key: string
    ) {
      if (leaves.has(key)) {
        leafDistances.set(key, dists);
      }
    });

    const distanceMatrix = toMatrix(leafDistances);
    const constraints = {
      constraints: genConstraints(distanceMatrix),
      grad: genGradConstraints(distanceMatrix)
    };

    // Generate an initial solution from the user's placement of the nodes.
    const n = size(distanceMatrix)[0];
    const initSol = zeros([2 * n + 1]);
    const vKeys = Array.from(leafDistances.keys()).sort();
    const nodes = (this.$store.state as any).treeGraph.nodes;
    vKeys.forEach(function(key, idx) {
      initSol[idx] = nodes.get(key).x;
      initSol[idx + n] = nodes.get(key).y;
    });

    // Generate a (not necessarily optimal) disk packing.
    // If the solver fails to converge, perturb the problem slightly and retry.
    return new Promise(resolve => {
      let sol: matrix | undefined = undefined;
      for (let trial = 0; trial <= 5 && sol === undefined; trial++) {
        const perturbedDists = add(
          distanceMatrix,
          multiply(PERTURB_EPS, random(size(distanceMatrix)))
        );
        const perturbedConstraints = {
          constraints: genConstraints(perturbedDists),
          grad: genGradConstraints(perturbedDists)
        };
        const perturbedInitSol = add(
          initSol,
          multiply(PERTURB_EPS, random(size(initSol)))
        );
        sol = solve(perturbedInitSol, perturbedDists, perturbedConstraints);
      }
      if (sol === undefined) {
        this.$store.commit(
          "updateGlobalError",
          "Could not generate disk packing from tree."
        );
        return;
      }

      const packing = new Packing();
      packing.scaleFactor = sol[2 * n];
      for (let i = 0; i < n; i++) {
        // TODO (@pjrule): better typing here?
        const id = vKeys[i] as string;
        const x = sol[i];
        const y = sol[i + n];
        packing.nodes.set(id, new PackingNode(id, x, y));
      }

      // Clean up the packing to enforce active path invariants.
      this.$store.commit("updatePacking", packing);
      try {
        const cleanedPacking = cleanPacking(packing, leafDistances);
        this.$store.commit("updateCreasesGraph", cleanedPacking);
        this.$store.commit("unsync");
      } catch (err) {
        this.$store.commit(
          "updateGlobalError",
          "Could not clean packing. (" + err.message + ")"
        );
        return;
      }

      // Display the packing.
      // TODO (@pjrule): would it be more efficient to reuse the old board?
      const creasesGraph = (this.$store.state as any)
        .creasesGraph as CreasesGraph;
      const packingBoard = JSXGraph.initBoard("packingViewBox", {
        boundingbox: [-0.1, 1.1, 1.1, -0.1],
        showCopyright: false,
        showNavigation: false
      });
      packingBoard.create("grid", []);
      creasesGraph.nodes.forEach(function(v, idx) {
        const center = packingBoard.create("point", [v.x, v.y], {
          name: v.id,
          fixed: true
        });
        const radius =
          (leafLengths.get(v.id) + creasesGraph.leafExtensions.get(v)) *
          packing.scaleFactor;
        packingBoard.create("circle", [center, radius], { fixed: true });
      });
      this.packingBoard = packingBoard;
      resolve(1);
    });
  }
}
</script>
