import BluetoothDevice from '@/devices/BluetoothDevice.js'

export default class Meater extends BluetoothDevice {
    static SERVICE_UUID = 'a75cc7fc-c956-488f-ac2a-2dbc08b63a04';
    static CHAR_UUID = '7edda774-045e-4bbf-909b-45d1991a2876';

    constructor(device) {
        super()
        this.device = device
        console.log("Created new Meater");

        this.connect()
    }

    notification_callback(event) {
        var buffer = event.target.value.buffer;
        var uint16view = new Uint16Array(buffer);
        var tip_temp = uint16view[0] / 16;

        console.log(tip_temp)
    }

    async connect() {
        console.log('Connecting to GATT Server...');
        const server = await this.device.gatt.connect()

        console.log('Getting Temperature Service...');
        var tempService = await server.getPrimaryService(Meater.SERVICE_UUID);
        var tempChar = await tempService.getCharacteristic(Meater.CHAR_UUID);

        tempChar.addEventListener('characteristicvaluechanged', this.notification_callback);
        tempChar.startNotifications().catch(async e => {
            console.log('FAILED: ' + e);
            return null;
        });
    }
}
