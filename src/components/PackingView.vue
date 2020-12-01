<template>
  <div id="packingViewBox" class="viewBox" />
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { JSXGraph } from "jsxgraph";

@Component
export default class PackingView extends Vue {
  diskPacking: Record<number, number[]> | null; // Map from tree point ids to locations on [0, 1] X [0, 1].

  constructor() {
    super();
    this.diskPacking = null;
  }

  mounted() {
    //this.diskPacking = this.computeDiskPacking();
    const packingBoard = JSXGraph.initBoard("packingViewBox", {
      boundingbox: [-0.05, 1.05, 1.05, -0.05],
      showCopyright: false,
      showNavigation: false
    });
    packingBoard.create("grid", []);
    /*
    for (const vertexId of Object.keys(this.diskPacking)) {
      packingBoard.create("point", this.diskPacking[vertexId], {
        name: vertexId,
        fixed: true
      });
      // TODO Maybe we can color-code the points to match with the treeView?
    }
    */
  }

  /*
  computeDiskPacking() {
    // TODO(Parker) Replace with more advanced disk packing algorithm, probably move this function to another file.
    const adjacencyMatrix = {};
    for (const point of treePointsSet) {
      adjacencyMatrix[point.name] = {};
    }
    for (const point of treePointsSet) {
      for (const incidentLine of treePoints.get(point)) {
        const point1 = incidentLine.point1;
        const point2 = incidentLine.point2;
        adjacencyMatrix[point1.name][point2.name] = adjacencyMatrix[
          point2.name
        ][point1.name] = point1.Dist(point2).toFixed(5);
        // Round to 5 decimal places in case user typed in exact number for edge length.
      }
    }

    const diskPacking = {};
    for (const vertexId of Object.keys(adjacencyMatrix)) {
      diskPacking[vertexId] = [Math.random(), Math.random()];
    }
    return diskPacking;
  }
  */
}
</script>
