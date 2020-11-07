<template>
  <div id="creasesViewBox" class="viewBox" />
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { JSXGraph } from "jsxgraph";

@Component
export default class CreasesView extends Vue {
  //creases: string[]; // TODO Decide how to encode creases.

  mounted() {
    const creasesBoard = JSXGraph.initBoard("creasesViewBox", {
      boundingbox: [-0.05, 1.05, 1.05, -0.05],
      showCopyright: false,
      showNavigation: false
    });
    creasesBoard.create("grid", []);
    // TODO(Jamie) Construct JSXGraph visualization of creases from creases object.
  }

  /*
    computeCreases() {
        // TODO(Jamie) Replace with universal molecule algorithm, probably move this function to another file.
        var creases = null;
        return creases;
    }

    computeAndShowCreases() {
        if (diskPacking == null) {
            computeAndShowDiskPacking(true);
        } else {
            creases = computeCreases();
            showCreases();
        }
    }
    */
}
</script>
