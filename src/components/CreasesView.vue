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


    const treeGraph = (this.$store.state as any).treeGraph as TreeGraph;
    const creasesGraph = (this.$store.state as any).creasesGraph as CreasesGraph;
    const distances = treeGraph.getDistances();
    const packing = (this.$store.state as any).packing as Packing;

    // TODO (@pjrule): the UMA functions mutate objects in place, so we
    // should make deep copies here to avoid inadvertently mutating global state.
    buildFaces(creasesGraph);
    generateMolecules(creasesGraph, distances, packing.scaleFactor);
    const points: Map<CreasesNode, any> = new Map();
    for (const v of creasesGraph.nodes.values()) {
      const vertexName = (v.id.charAt(0) == "i") ? "" : v.id;
      const point = creasesBoard.create("point", [v.x, v.y], { name: vertexName, fixed: true });
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
  }
}
</script>
