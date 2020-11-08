<template>
  <TreeFaker />
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import TreeFaker from "./components/TreeFaker.vue";

@Component({
  components: {
    TreeFaker
  }
})
export default class App extends Vue {}
</script>
