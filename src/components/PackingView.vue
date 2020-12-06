<template>
  <div id="packingViewBox" class="viewBox" />
</template>

<script lang="ts">
import Vuex from "vuex";
import { Component, Prop, Vue } from "vue-property-decorator";
import { JSXGraph, Board } from "jsxgraph";
import { zeros, size, random, add, multiply } from "mathjs";
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

  mounted() {
    const packingBoard = JSXGraph.initBoard("packingViewBox", {
      boundingbox: [-0.05, 1.05, 1.05, -0.05],
      showCopyright: false,
      showNavigation: false
    });
    packingBoard.create("grid", []);
    this.packingBoard = packingBoard;
  }

  pack() {
    // TODO (@pjrule): this is not strictly view code and should
    // almost certainly be moved to the engine (perhaps as a method of `Packing`).
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
    const leafDistances = new Map();
    distances.forEach(function(dists: Map<string, Map<string, Map<string, number>>>, key: string) {
      if (leaves.has(key)) {
        leafDistances.set(key, dists);
      }
    });

    console.log("distances:", leafDistances);
    const distanceMatrix = toMatrix(leafDistances);
    const constraints = {
      constraints: genConstraints(distanceMatrix),
      grad: genGradConstraints(distanceMatrix),
    };

    // Generate an initial solution from the user's placement of the nodes.
    const n = size(distanceMatrix)[0];
    const initSol = zeros([2 * n + 1]);
    const vKeys = Array.from(leafDistances.keys()).sort();
    const nodes = (this.$store.state as any).treeGraph.nodes;
    vKeys.forEach(function (key, idx) {
      initSol[idx] = nodes.get(key).x;
      initSol[idx + n] = nodes.get(key).y;
    });
    console.log("distance matrix:", distanceMatrix);
    console.log("initial solution:", initSol);
    //const rescaledInitSol = rescaleSol(initSol, distanceMatrix);
    //console.log("rescaled initial solution:", rescaledInitSol);

    // Generate a (not necessarily optimal) disk packing.
    // If the solver fails to converge, perturb the problem slightly and retry.
    let sol = solve(initSol, distanceMatrix, constraints);
    for (let trial = 0; trial < 5 && sol === undefined; trial++) {
      const perturbedDists = add(
        distanceMatrix,
        multiply(PERTURB_EPS, random(size(distanceMatrix)))
      );
      const perturbedConstraints = {
        constraints: genConstraints(perturbedDists),
        grad: genGradConstraints(perturbedDists),
      };
      const perturbedInitSol = add(
        initSol,
        multiply(PERTURB_EPS, random(size(initSol)))
      );
      sol = solve(perturbedInitSol, perturbedDists, perturbedConstraints);
    }
    if (sol === undefined) {
      alert("couldn't solve :(");
      return; // give up. :(
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
    this.$store.commit(
      "updatePacking",
      packing
    );
    this.$store.commit(
      "updateCreasesGraph",
      cleanPacking(packing, leafDistances)
    );

    // Display the packing.
    // TODO (@pjrule): would it be more efficient to reuse the old board?
    const creasesGraph = (this.$store.state as any).creasesGraph as CreasesGraph;
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
        console.log("leaf length:", leafLengths.get(v.id));
        console.log("leaf extensions:", creasesGraph.leafExtensions.get(v));
        console.log("scale factor:", packing.scaleFactor);
        console.log("radius:", radius);
      packingBoard.create("circle", [center, radius], { fixed: true });
    });

    this.packingBoard = packingBoard;
  }
}
</script>
