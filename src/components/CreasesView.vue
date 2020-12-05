<template>
  <div id="creasesViewBox" class="viewBox" />
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { JSXGraph, Board } from "jsxgraph";
import {
  TreeGraph,
  CreasesGraph,
  Packing,
  MVAssignment
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
    const creasesBoard = JSXGraph.initBoard("creasesViewBox", {
      boundingbox: [-0.1, 1.1, 1.1, -0.1],
      showCopyright: false,
      showNavigation: false
    });
    creasesBoard.create("grid", []);

    // @Jamie: uncomment this to use the real tree and packing.
    /*
    const treeGraph = (this.$store.state as any).treeGraph as TreeGraph;
    const creasesGraph = (this.$store.state as any).creasesGraph as CreasesGraph;
    const distances = treeGraph.getDistances();
    const packing = (this.$store.state as any).packing as Packing;
    */
   const distances = fiveStarTree().getDistances();
   const packing = fiveStarPacking();
   const creasesGraph = cleanPacking(packing, distances);

    // TODO (@pjrule): the UMA functions mutate objects in place, so we
    // should make deep copies here to avoid inadvertently mutating global state.
    buildFaces(creasesGraph);
    generateMolecules(creasesGraph, distances, packing.scaleFactor);
    for (const [edgeId, edge] of creasesGraph.edges) {
      const v1 = edge.to;
      const v2 = edge.from;
      const assignment = edge.assignment;
      const p1 = creasesBoard.create("point", [v1.x, v1.y], { name: v1.id });
      const p2 = creasesBoard.create("point", [v2.x, v2.y], { name: v2.id });
      creasesBoard.create("segment", [p1, p2], {
        name: edgeId,
        strokeColor: getColor(assignment),
        strokeWidth: 2,
        highlightStrokeWidth: 4
      });
    }
    this.creasesBoard = creasesBoard;
  }
}
</script>
