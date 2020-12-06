<template>
  <div>
    <nav class="navbar">
      <img class="logo" src="../assets/img/TreeFakerLogo.svg" />
    </nav>
    <div class="container">
      <p class="description">
        Welcome to TreeFaker, an online, lightweight version of Robert Lang's <a href=https://langorigami.com/article/treemaker/>TreeMaker</a>. To get started, draw a tree in the left box. <strong>Ctrl + drag</strong> a vertex to add a new leaf to the tree. <strong>Shift + click</strong> on an edge to delete it. <strong>Right click</strong> on an edge to manually set its length. When you are done drawing the tree, click <strong>Generate Disk Packing</strong>. When you are satisfied with the disk packing, click <strong>Get Crease Pattern</strong>.
      </p>
      <table class="views">
        <tr class="threeViews">
          <td class="viewBoxTd"><TreeView ref="tree" /></td>
          <td class="spacer" />
          <td class="viewBoxTd"><PackingView ref="packing" /></td>
          <td class="spacer" />
          <td class="viewBoxTd"><CreasesView ref="creases" /> </td>
        </tr>

        <tr class="threeButtons">
          <td>
            <b-button variant="primary" size="lg" v-on:click="generatePacking">
              Generate Disk Packing
            </b-button>
          </td>
          <td />
          <td>
            <b-button variant="primary" size="lg" v-on:click="getCreasePattern">
              Get Crease Pattern
            </b-button>
           </td>
          <td />
          <td>
            <b-button variant="primary" size="lg" v-on:click="exportFold">
              Export .FOLD File
            </b-button>
         </td>
        </tr>
      </table>
      <input type="text" id="inputBox" style="display: none" />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import TreeView from './TreeView.vue';
import CreasesView from './CreasesView.vue';
import PackingView from './PackingView.vue';
import { BButton } from 'bootstrap-vue';

Vue.component('b-button', BButton);

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
    (this.$refs as any).creases.show();
  }
  exportFold() {
    alert('TODO');
  }
}
</script>