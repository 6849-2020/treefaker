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
  CreaseType,
  MVAssignment,
  Crease,
  CreasesNode
} from "../engine/packing";
import { generateMolecules, cleanPacking, buildFaces } from "../engine/creases";
import { orderFacets } from "../engine/creases/ordering";

import {
  tenStarSuboptimalTree,
  tenStarSuboptimalPacking,
  twoNodeTree,
  twoNodeAdjacentCornersPacking,
  rabbitEarOnSideTree,
  rabbitEarOnSidePacking,
  demaineLangPaperSmallTree,
  demaineLangPaperSmallPacking,
  boneTree,
  bonePacking,
  crossingSwordsTree,
  crossingSwordsPacking,
  pseudohingeElevationBugTree,
  pseudohingeElevationBugPacking
} from "../../tests/helper";

function getColor(e: Crease, useMV: boolean): string {
  if (useMV) {
    switch (e.assignment) {
      case MVAssignment.Mountain:
        return "#ee6666";
      case MVAssignment.Valley:
        return "#0021e6";
      case MVAssignment.Unfolded:
        return "#ccffcc";
      case MVAssignment.Boundary:
        return "#333333";
      case MVAssignment.Unknown:
        // We shouldn't be seeing this if facet ordering is working.
        return "#ffb000";
    }
  } else {
    switch (e.creaseType) {
      case CreaseType.Ridge:
        return "#ee6666";
      case CreaseType.Gusset:
        return "#0021e6";
      case CreaseType.Pseudohinge:
        return "#419cc3";
      case CreaseType.Hinge:
        return "#7744a6";
      case CreaseType.Axial:
        return "#333333";
      case CreaseType.ActiveHull:
        return "#333333";
      case CreaseType.InactiveHull:
        return "#333333";
    }
  }
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
      //showNavigation: false
    });
    creasesBoard.create("grid", []);
    this.creasesBoard = creasesBoard;
  }

  show() {
    // TODO Make these parameters interactive.
    const paramShowFacetOrder = true; // Overlay ROG in pink.
    const paramShowMVAssignmentOnly = true; // Color all creases as red or blue.
    const paramDisplayInternalNodes = true; // Show labels of branch nodes.
  
    if ((this.$store.state as any).packingCreasesSynced === true) {
      return; // No need to update.
    }

    this.$store.commit("clearGlobalError");
    const creasesBoard = JSXGraph.initBoard("creasesViewBox", {
      boundingbox: [-0.1, 1.1, 1.1, -0.1],
      showCopyright: false,
      //showNavigation: false
    });
    creasesBoard.create("grid", []);
    
    const treeGraph = (this.$store.state as any).treeGraph as TreeGraph;
    const creasesGraph = (this.$store.state as any)
      .creasesGraph as CreasesGraph;
    const distances = treeGraph.getDistances();
    const discreteDepth = treeGraph.dangle(creasesGraph.findAGoodRoot(distances));
    const packing = (this.$store.state as any).packing as Packing;
    
    /*/ Replace the lines above with these to visualize a hard-coded test case; also need to change exportDisabled in TreeFaker.vue if you want to be able to open in Origami Simulator.
    const treeGraph = crossingSwordsTree();
    const packing = crossingSwordsPacking();
    const distances = treeGraph.getDistances();
    const discreteDepth = treeGraph.dangle();
    const creasesGraph = cleanPacking(packing, distances);
    buildFaces(creasesGraph);*/

    // TODO (@pjrule): the UMA mutates objects in place, so we
    // should make deep copies here to avoid inadvertently mutating global state.
    try {
      generateMolecules(creasesGraph, distances, packing.scaleFactor, discreteDepth);
    } catch (err) {
      this.$store.commit(
        "updateGlobalError",
        "Could not generate molecules. (" + err.message + ")"
      );
      return;
    }
    try {
      orderFacets(creasesGraph, discreteDepth);
    } catch (err) {
      this.$store.commit(
        "updateGlobalError",
        "Could not order facets. (" + err.message + ")"
      );
    }
    const points: Map<CreasesNode, any> = new Map();
    for (const v of creasesGraph.nodes.values()) {
      const vertexName =
        !paramDisplayInternalNodes && v.id.charAt(0) == "i" ? "" : v.displayId; // TODO Change to v.id for debugging, then change back to v.displayId when done.
      if (v.id == v.displayId) { // leaf node
        const point = creasesBoard.create("point", [v.x, v.y], {
          name: vertexName,
          fixed: true,
          highlight: false,
          label: {offset: [6, 6], highlight: false}
        });
        points.set(v, point);
      } else {
        const point = creasesBoard.create("point", [v.x, v.y], {
          name: vertexName,
          fixed: true,
          size: 0,
          highlight: false,
          label: {offset: [0, 0], highlight: false}
        });
        points.set(v, point);
      }
    }
    for (const edge of creasesGraph.edges.values()) {
      const v1 = edge.to as CreasesNode;
      const v2 = edge.from as CreasesNode;
      const p1 = points.get(v1);
      const p2 = points.get(v2);
      const color = getColor(edge, paramShowMVAssignmentOnly);
      creasesBoard.create("segment", [p1, p2], {
        strokeColor: color,
        strokeWidth: 2,
        highlight: false
      });
    }
    
    // Visualize facet order.
    if (paramShowFacetOrder) {
      const faces = Array.from(creasesGraph.faces).sort((f1, f2) => f1.facetOrderIndex - f2.facetOrderIndex);
      faces.shift();
      let p1: any = null;
      for (const face of faces) {
        if (face.facetOrderIndex >= 0) {
          if (p1 == null) {
            p1 = creasesBoard.create("point", [face.averageX(), face.averageY()], {
              name: "",
              strokeColor: "#ff00e6",
              fillColor: "#ff00e6",
              fixed: true,
              highlight: false
            });
          } else {
            const p2 = creasesBoard.create("point", [face.averageX(), face.averageY()], {
              name: "",
              fixed: true,
              size: 0,
              highlight: false
            });
            creasesBoard.create("segment", [p1, p2], {
              strokeColor: "#ff00e6",
              strokeWidth: 1,
              highlight: false
            });
            p1 = p2;
          }
        } else {
          creasesBoard.create("point", [face.averageX(), face.averageY()], {
            name: "",
            strokeColor: "#ff00e6",
            fillColor: "#ff00e6",
            fixed: true,
            highlight: false
          });
        }
      }
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
      // POSTing to Origami Simulator: see @edemaine's Maze Font tool, etc.
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
