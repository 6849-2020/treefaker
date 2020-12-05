import Vue from "vue";
import Vuex, { StoreOptions } from "vuex";
import App from "./App.vue";
import "./assets/css/style.css";
import "./assets/css/jsxgraph.css";
import { TreeGraph, CreasesGraph, Packing } from "./engine/packing";

Vue.use(Vuex);
Vue.config.productionTip = false;

// Typing a Vuex store:
// https://codeburst.io/vuex-and-typescript-3427ba78cfa8
export type RootState = {
  treeGraph: TreeGraph | undefined;
  creasesGraph: CreasesGraph | undefined;
  packing: Packing | undefined;
};

const storeTemplate: StoreOptions<RootState> = {
  state: {
    // The raw tree, as constructed by the user.
    treeGraph: undefined,

    // The cleaned-up packing, ready to be converted into creases.
    // TODO: is this name too confusing?
    creasesGraph: undefined,

    packing: undefined,
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
  },
};

const store = new Vuex.Store<RootState>(storeTemplate);

new Vue({
  render: (h) => h(App),
  store: store,
}).$mount("#app");
