<template>
  <div id="creasesViewBox" class="viewBox" />
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { JSXGraph, Board } from "jsxgraph";
import { saveAs } from "file-saver";
import { generateFold } from "../engine/creases/export";
import {
  TreeGraph,
  CreasesGraph,
  Packing,
  MVAssignment,
  CreasesNode
} from "../engine/packing";
import { buildFaces, generateMolecules, cleanPacking } from "../engine/creases";
import { fiveStarPacking, fiveStarTree } from "../../tests/helper";

function getColor(mv: MVAssignment): string {
  switch (mv) {
    case MVAssignment.Mountain:
      return "#ee6666";
    case MVAssignment.Valley:
      return "#0021e6";
    case MVAssignment.Tristate:
      return "#7744a6";
    case MVAssignment.Boundary:
      return "#000000";
  }
  return "#666666"; // unknown, etc.
}
@Component
export default class CreasesView extends Vue {
  creasesBoard: Board;
  fold: object | undefined;
  simulator: Window | null | undefined;

  mounted() {
    const creasesBoard = JSXGraph.initBoard("creasesViewBox", {
      boundingbox: [-0.1, 1.1, 1.1, -0.1],
      showCopyright: false,
      showNavigation: false
    });
    creasesBoard.create("grid", []);
    this.creasesBoard = creasesBoard;
  }

  show() {
    if ((this.$store.state as any).packingCreasesSynced === true) {
      return; // No need to update.
    }

    this.$store.commit("clearGlobalError");
    const creasesBoard = JSXGraph.initBoard("creasesViewBox", {
      boundingbox: [-0.1, 1.1, 1.1, -0.1],
      showCopyright: false,
      showNavigation: false
    });
    creasesBoard.create("grid", []);

    const treeGraph = (this.$store.state as any).treeGraph as TreeGraph;
    const creasesGraph = (this.$store.state as any)
      .creasesGraph as CreasesGraph;
    const distances = treeGraph.getDistances();
    const packing = (this.$store.state as any).packing as Packing;

    // TODO (@pjrule): the UMA functions mutate objects in place, so we
    // should make deep copies here to avoid inadvertently mutating global state.
    try {
      buildFaces(creasesGraph);
    } catch (err) {
      this.$store.commit(
        "updateGlobalError",
        "Could not build faces. (" + err.message + ")"
      );
      return;
    }
    try {
      generateMolecules(creasesGraph, distances, packing.scaleFactor);
    } catch (err) {
      this.$store.commit(
        "updateGlobalError",
        "Could not generate molecules. (" + err.message + ")"
      );
      return;
    }
    const points: Map<CreasesNode, any> = new Map();
    for (const v of creasesGraph.nodes.values()) {
      const vertexName = v.id.charAt(0) == "i" ? "" : v.id;
      const point = creasesBoard.create("point", [v.x, v.y], {
        name: vertexName,
        fixed: true
      });
      points.set(v, point);
    }
    for (const edge of creasesGraph.edges.values()) {
      const v1 = edge.to as CreasesNode;
      const v2 = edge.from as CreasesNode;
      const assignment = edge.assignment;
      const p1 = points.get(v1);
      const p2 = points.get(v2);
      creasesBoard.create("segment", [p1, p2], {
        strokeColor: getColor(assignment),
        strokeWidth: 2,
        highlightStrokeWidth: 4
      });
    }
    this.creasesBoard = creasesBoard;
    this.fold = generateFold(creasesGraph);
    this.$store.commit("sync");
  }

  download() {
    if (this.fold !== undefined) {
      const blob = new Blob([JSON.stringify(this.fold)], {
        type: "application.json;charset=utf-8"
      });
      saveAs(blob, "treefaker.fold");
    }
  }

  origamiSimulator() {
    if (this.fold !== undefined) {
      if (
        this.simulator !== null &&
        this.simulator !== undefined &&
        !this.simulator.closed
      ) {
        this.simulator.focus();
        this.simulator.postMessage({ op: "importFold", fold: this.fold }, "*");
      } else {
        this.simulator = window.open(
          "https://origamisimulator.org/?model=treefaker"
        );
        const fold = this.fold;
        const simulator = this.simulator;
        window.addEventListener("message", function(e) {
          if (
            simulator !== null &&
            e.source === simulator &&
            e.data &&
            e.data.from === "OrigamiSimulator" &&
            e.data.status === "ready"
          ) {
            simulator.postMessage({ op: "importFold", fold: fold }, "*");
          }
        });
      }
    }
  }
}
</script>
