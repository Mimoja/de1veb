<template>
  <div class="test container">
    <h1 class="text-primary">{{ title }}</h1>
    <p class="text-warning">v{{ version }}</p>
    <form v-on:submit="getDevices" class="form form-inline">
      <input class="btn btn-success" type="submit" value="Connect and Write" />
    </form>
    <br />
    <div id="output-panel" class="panel panel-default" hidden>
      <div class="panel-heading">Output</div>
      <div id="output" class="panel-body">
        <div id="content"></div>
        <div id="status" class="text-danger"></div>
        <pre id="log" style="text-align: left"></pre>
      </div>
    </div>
  </div>
</template>

<script>
import BLEManager from "@/ble.js";

export default {
  name: "DemoBLE",
  data() {
    return {
      title: "DE1Veb",
      message: "",
      version: "0.0.1",
    };
  },
  methods: {
    getDevices: function (e) {
      e.preventDefault();

      var manager = new BLEManager();
      if (manager.ready) {
        manager.start_scanning();
      } else {
        alert("No Bluetooth detected");
      }
    },
    onDisconnected: function (e) {
      let device = e.target;
      console.log("Device " + device.name + " is disconnected.");
    },
  },
};
</script>

<style scoped>
</style>
