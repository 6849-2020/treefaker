<template>
  <div id="packingViewBox" class="viewBox" />
</template>

<script lang="ts">
import Vuex from "vuex";
import { Component, Prop, Vue } from "vue-property-decorator";
import { JSXGraph, Board } from "jsxgraph";
import { zeros, size, random, add, multiply, matrix } from "mathjs";
import {
  Packing,
  PackingNode,
  TreeGraph,
  TreeNode,
  CreasesGraph
} from "../engine/packing";
import {
  genConstraints,
  genGradConstraints,
  toMatrix
} from "../engine/packing/constraints";
import { solve } from "../engine/packing/alm";
import { cleanPacking, buildFaces, isTwisted } from "../engine/creases";

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
    const treeGraph = (this.$store.state as any).treeGraph as TreeGraph;
    const leafLengths = new Map();
    treeGraph.nodes.forEach((node: TreeNode, key: string) => {
      if (node.edges.length === 1) {
        leafLengths.set(key, node.edges[0].length);
      }
    });
    const d = treeGraph.getDistances();
    if (d.size === treeGraph.nodes.size) {
      this.$store.commit(
        "updateGlobalError",
        "Add at least one non-leaf vertex to the tree."
      );
      return;
    }
    const distanceMatrix = toMatrix(d);

    // Generate an initial solution from the user's placement of the nodes.
    const n = size(distanceMatrix)[0];
    const initSol = zeros([2 * n + 1]);
    const vKeys = Array.from(d.keys()).sort();
    const nodes = (this.$store.state as any).treeGraph.nodes;
    vKeys.forEach(function(key, idx) {
      initSol[idx] = nodes.get(key).x;
      initSol[idx + n] = nodes.get(key).y;
    });

    // Generate a (not necessarily optimal) disk packing.
    // If the solver fails to converge, perturb the problem slightly and retry.
    return new Promise(resolve => {
      let twisted = true;
      let finalErrorMessage = "Did not update error message.";
      for (let attempt = 0; twisted && attempt < 6; attempt++) {
        let sol: matrix | undefined = undefined;
        for (let trial = 0; trial < 6 && sol === undefined; trial++) {
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
        let cleanedPackingCreasesGraph: null | CreasesGraph = null;
        try {
          cleanedPackingCreasesGraph = cleanPacking(packing, d);
        } catch (err) {
          this.$store.commit(
            "updateGlobalError",
            "Could not clean packing. '" + err.message + "'"
          );
          return;
        }

        // Compute convex hull and active polygons.
        try {
          const possibleErrorMessage = buildFaces(cleanedPackingCreasesGraph);
          if (possibleErrorMessage != null) {
            finalErrorMessage = possibleErrorMessage;
            continue;
          }
        } catch (err) {
          this.$store.commit(
            "updateGlobalError",
            "Could not build faces: '" + err.message + "'"
          );
          return;
        }

        if (isTwisted(d, cleanedPackingCreasesGraph)) {
          finalErrorMessage = "Tree is twisted.";
          continue;
        }
        twisted = false;
        this.$store.commit("updatePacking", packing);
        this.$store.commit("updateCreasesGraph", cleanedPackingCreasesGraph);
        this.$store.commit("unsync");

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
        creasesGraph.nodes.forEach(function(v) {
          const center = packingBoard.create("point", [v.x, v.y], {
            name: v.id,
            label: { offset: [6, 6], highlight: false },
            highlight: false,
            fixed: true
          });
          const radius =
            (leafLengths.get(v.id) + creasesGraph.leafExtensions.get(v)) *
            packing.scaleFactor;
          packingBoard.create("circle", [center, radius], {
            fixed: true,
            strokeColor: "#0021e6",
            highlight: false
          });
        });
        this.packingBoard = packingBoard;
      }
      if (twisted) {
        this.$store.commit(
          "updateGlobalError",
          "Could not find packing. Error message from final attempt: '" +
            finalErrorMessage +
            "'"
        );
      }
      resolve(1);
    });
  }
}
</script>
