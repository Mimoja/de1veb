<template>
  <div id="app">
    <img alt="Vue logo" src="./assets/logo.png" />
    <DemoBLE />
  </div>
</template>

<script>
import DemoBLE from "./components/DemoBLE.vue";

export default {
  name: "App",
  components: {
    DemoBLE,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
