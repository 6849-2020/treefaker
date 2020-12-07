import Vue from "vue";
import Vuex, { StoreOptions } from "vuex";
import App from "./App.vue";
import "./assets/css/origamiSimulator/nav.css";
import "./assets/css/origamiSimulator/main.css";
import "./assets/css/jsxgraph.css";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import "./assets/css/style.css";
import { TreeGraph, CreasesGraph, Packing } from "./engine/packing";

Vue.use(Vuex);
Vue.config.productionTip = false;

// Typing a Vuex store:
// https://codeburst.io/vuex-and-typescript-3427ba78cfa8
export type RootState = {
  treeGraph: TreeGraph | undefined;
  creasesGraph: CreasesGraph | undefined;
  packing: Packing | undefined;
  globalError: string | undefined;
  packingCreasesSynced: boolean;
};

const storeTemplate: StoreOptions<RootState> = {
  state: {
    // The raw tree, as constructed by the user.
    treeGraph: undefined,

    // The cleaned-up packing, ready to be converted into creases.
    // TODO: is this name too confusing?
    creasesGraph: undefined,

    packing: undefined,
    globalError: undefined,
    packingCreasesSynced: false
  },
  mutations: {
    updateTreeGraph(state, graph: TreeGraph) {
      state.treeGraph = graph;
    },
    updateCreasesGraph(state, graph: CreasesGraph) {
      state.creasesGraph = graph;
    },
    updatePacking(state, packing: Packing) {
      state.packing = packing;
    },
    updateGlobalError(state, msg: string) {
      state.globalError = msg;
    },
    clearGlobalError(state) {
      state.globalError = undefined;
    },
    unsync(state) {
      state.packingCreasesSynced = false;
    },
    sync(state) {
      state.packingCreasesSynced = true;
    }
  }
};

const store = new Vuex.Store<RootState>(storeTemplate);

new Vue({
  render: h => h(App),
  store: store
}).$mount("#app");
