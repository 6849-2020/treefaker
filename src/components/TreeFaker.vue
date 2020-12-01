<template>
  <div class="container">
    <center>
      <img class="logo" src="../assets/img/TreeFakerLogo.svg" />
    </center>
    <table>
      <tr class="threeViews">
        <td class="viewBoxTd"><TreeView ref="tree" /></td>
        <td class="spacer" />
        <td class="viewBoxTd"><PackingView ref="packing" /></td>
        <td class="spacer" />
        <td class="viewBoxTd"><CreasesView ref="creases" /> </td>
      </tr>

      <tr class="threeButtons">
        <td><button type="button" v-on:click="generatePacking">Generate Disk Packing</button></td>
        <td />
        <td><button type="button" v-on:click="getCreasePattern">Get Crease Pattern</button></td>
        <td />
        <td><button type="button" v-on:click="exportFold">Export .FOLD File</button></td>
      </tr>

      <tr class="threeInstructions">
        <td>
          <p>
            Welcome to TreeFaker, an online, lightweight version of Robert Lang's <a href=https://langorigami.com/article/treemaker/>TreeMaker</a>. To get started, first draw a tree in the box above. <b>Ctrl + drag</b> a vertex to add a new leaf to the tree. <b>Shift + click</b> on an edge to delete it. <b>Right click</b> on an edge to manually set its length. When you are done drawing the tree, click the "Generate Disk Packing" button.
          </p>
        </td>
        <td />
        <td>
          <p>
            Once you have found a satisfactory disk packing, click the "Get Crease Pattern" button to show the crease pattern.
          </p>
        </td>
        <td />
        <td>
          <p>
            We haven't yet implemented the code to find the M/V assignment, so right now the "Export .FOLD File" button does nothing.
          </p>
        </td>
      </tr>
    </table>
    <input type="text" id="inputBox" style="display: none" />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import TreeView from './TreeView.vue';
import CreasesView from './CreasesView.vue';
import PackingView from './PackingView.vue';

@Component({
  components: {
    TreeView,
    CreasesView,
    PackingView
  }
})
export default class TreeFaker extends Vue {
  generatePacking() {
    (this.$refs as any).tree.propagate();
    (this.$refs as any).packing.pack();
  }
  getCreasePattern() {
    alert('TODO');
  }
  exportFold() {
    alert('TODO');
  }
}
</script>