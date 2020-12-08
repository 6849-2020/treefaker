<template>
  <div>
  <b-navbar type="dark" variant="dark">
    <b-navbar-nav>
      <b-navbar-brand href="#">
        <img class="logo" src="../assets/img/TreeFakerLogo.svg" />
      </b-navbar-brand>

      <b-nav-item-dropdown text="File" right>
        <b-dropdown-item href="#" v-on:click="exportFold" :disabled=exportDisabled>Export to FOLD</b-dropdown-item>
      </b-nav-item-dropdown>
      <b-nav-item href="#" v-b-modal.controlsPopover>Controls</b-nav-item>
      <b-nav-item href="#" v-b-modal.aboutPopover>About</b-nav-item>
    </b-navbar-nav>
  </b-navbar> 
  
  <b-modal id="aboutPopover" title="About" size="lg" ok-only>
      <p class="description">This tool was created by <a href="https://pjrule.me/" target="_blank">Parker Rule</a> and <a href="http://www.jamie.tuckerfoltz.com/" target="_blank">Jamie Tucker-Foltz</a> as a final project for <a href="https://courses.csail.mit.edu/6.849/fall20/" target="_blank">6.849: Geometric Folding Algorithms</a> (MIT), fall 2020.</p>
      <p class="description">We are grateful for the guidance of Erik Demaine and Robert Lang, and we thank <a href="https://tck.mn/" target="_blank">Andy Tockman</a> for his contributions.</p>
  </b-modal>

  <b-modal id="controlsPopover" title="Controls" size="lg" ok-only>
      <p class="description">
        Welcome to TreeFaker, an online, lightweight version of Robert Lang's <a href="https://langorigami.com/article/treemaker/" target="_blank">TreeMaker</a>. To get started:
        <ol>
          <li>Draw a tree in the left box. <strong>Ctrl + drag</strong> a vertex to add a new leaf to the tree. <strong>Shift + click</strong> on an edge to delete it. <strong>Right click</strong> on an edge to manually set its length.</li>
          <li>When you are done drawing the tree, click <strong>Generate Disk Packing</strong>.
          <li>When you are satisfied with the disk packing, click <strong>Get Crease Pattern</strong>.</li>
          <li>To export the crease pattern, click <strong>Open in Origami Simulator</strong> or <strong>File > Export FOLD</strong>. <em>(As we have not fully implemented mountain/valley assignment, rendering in Origami Simulator may fail.)</em></li>
        </ol>
      </p>
  </b-modal>


    <div class="container">
      <b-alert :show=inErrorState variant="danger"><p>{{ errorMessage }}</p></b-alert>

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
              <b-spinner small v-show="generatingPacking"></b-spinner>
              Generate Disk Packing
            </b-button>
          </td>
          <td />
          <td>
            <b-button variant="primary" size="lg" v-on:click="getCreasePattern" :disabled=creasesDisabled>
              Get Crease Pattern
            </b-button>
           </td>
          <td />
          <td>
            <b-button variant="primary" size="lg" v-on:click="origamiSimulator" :disabled=exportDisabled>
              Open in Origami Simulator
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
import { BAlert, BButton, BSpinner, ModalPlugin, NavbarPlugin } from 'bootstrap-vue';
import { CreasesGraphState } from '../engine/packing';

Vue.component('b-alert', BAlert)
Vue.component('b-button', BButton);
Vue.component('b-spinner', BSpinner);
Vue.use(ModalPlugin);
Vue.use(NavbarPlugin);
 
@Component({
  components: {
    TreeView,
    CreasesView,
    PackingView
  }
})
export default class TreeFaker extends Vue {
  generatingPacking = false;

  async generatePacking() {
    //this.generatingPacking = true;
    //this.$forceUpdate();
    (this.$refs as any).tree.propagate();
    await (this.$refs as any).packing.pack();
    //this.generatingPacking = false;
  }
  getCreasePattern() {
    (this.$refs as any).creases.show();
  }
  exportFold() {
    (this.$refs as any).creases.download();
  }
  origamiSimulator() {
    (this.$refs as any).creases.origamiSimulator();
  }
  get creasesDisabled() {
      return (this.$store as any).state.creasesGraph === undefined;
  }
  get exportDisabled() {
    return (
      (this.$store as any).state.creasesGraph === undefined ||
      (this.$store as any).state.creasesGraph.state !== CreasesGraphState.PostUMA
    );
  }
  get inErrorState() {
    return (this.$store as any).state.globalError !== undefined;
  }
  get errorMessage() {
    return (this.$store as any).state.globalError;
  }
}
</script>