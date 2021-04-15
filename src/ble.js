import BluetoothDevice from '@/devices/BluetoothDevice.js'
import Meater from '@/devices/Meater.js'
import Acaia from '@/devices/Acaia.js'
import DE1 from '@/devices/DE1.js'

export default class BLEManager {
    constructor() {
        this.devices = Array < BluetoothDevice > {};
        this.scales = [];
        this.failed = false;
        this.ready = navigator.bluetooth ? true : false;
    }

    start_scanning() {
        if (!this.ready) {
            return
        }

        navigator.bluetooth
            .requestDevice({
                optionalServices: [Meater.SERVICE_UUID, Acaia.SERVICE_UUID],
                acceptAllDevices: true,
            })
            .then((device) => {
                console.log("-> Name:      " + device.name);
                console.log("-> ID:        " + device.id);
                console.log(device.name.indexOf('MEATER'));

                //TODO use lookup
                if (device.name.indexOf('MEATER') == 0) {
                    new Meater(device)
                }

                if (device.name.indexOf('ACAIA') == 0) {
                    new Acaia(device)
                }

                if (device.name.indexOf('DE1') == 0) {
                    new DE1(device)
                }

            }).catch((error) => {
                console.log("Error: " + error);
            });
    }
}
