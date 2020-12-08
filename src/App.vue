<template>
  <TreeFaker />
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import TreeFaker from "./components/TreeFaker.vue";
import { BootstrapVue } from "bootstrap-vue";

Vue.use(BootstrapVue);

@Component({
  components: {
    TreeFaker
  }
})
export default class App extends Vue {}
</script>
