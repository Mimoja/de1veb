import BluetoothDevice from '@/devices/BluetoothDevice.js'

var _appendBuffer = function (buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
};

export default class Acaia extends BluetoothDevice {
    static SERVICE_UUID = '00001820-0000-1000-8000-00805f9b34fb';
    static CHAR_UUID = '00002a80-0000-1000-8000-00805f9b34fb';

    static HEADER1 = 0xef;
    static HEADER2 = 0xdd;

    constructor(device) {
        super()
        this.device = device
        console.log("Created new Acaia Scale");
        this.weight = 0;
        this.batteryLevel = 0;
        this.buffer = new Uint8Array();
        this.connect()
    }

    decode() {
        console.log("Got stuff to decode", buffer);

        if (this.buffer.byteLength <= 4) {
            return
        }
        var buffer = this.buffer

        if (buffer[0] !== Acaia.HEADER1 && buffer[1] !== Acaia.HEADER2) {
            console.log("header does not match: ", buffer[0], buffer[1]);
            this.buffer = new Uint8Array();
            return;
        }

        var cmd = buffer[2];
        console.log("Got event", cmd);
        switch (cmd) {
            // Event
            case 12:
                var msgType = buffer[4];
                var payload = new Uint8Array(buffer.slice(5));

                if (msgType === 5) {
                    var value = ((payload[1] & 0xff) << 8) + (payload[0] & 0xff);
                    var unit = payload[4] & 0xFF;

                    if (unit === 1) {
                        value /= 10;
                    } else if (unit === 2) {
                        value /= 100;
                    } else if (unit === 3) {
                        value /= 1000;
                    } else if (unit === 4) {
                        value /= 10000;
                    }

                    if ((payload[5] & 0x02) === 0x02) {
                        value *= -1;
                    }

                    this.weight = value;
                }
                break;
            // Status
            case 8:
                //length = buffer[3];
                this.batteryLevel = buffer[4];
                console.log('Got status message, battery= ' + this.batteryLevel)
                break

            default:
                console.log('unknown message type: ' + cmd);
                console.log(buffer);
                break
        }
        this.buffer = new Uint8Array();
    }

    static notification_callback(event, scale) {
        var buffer = event.target.value.buffer;
        scale.buffer = _appendBuffer(scale.buffer, buffer)
        scale.decode();
        console.log("weight:", scale.weight, "battery:", scale.batteryLevel);
    }

    async connect() {
        console.log('Connecting to GATT Server...');
        const server = await this.device.gatt.connect();

        console.log('Getting Weight Service...');
        this.service = await server.getPrimaryService(Acaia.SERVICE_UUID).catch(async e => {
            console.log('FAILED: ' + e);
            return null;
        });
        console.log('Getting Weight Characteristic...');
        this.weightCharacteristic = await this.service.getCharacteristic(Acaia.CHAR_UUID).catch(async e => {
            console.log('FAILED: ' + e);
            return null;
        });
        console.log('Adding Weight Listener...');
        var scale = this;
        this.weightCharacteristic.addEventListener('characteristicvaluechanged', e => Acaia.notification_callback(e, scale));

        // Identify to the scale and enable notifications

        setTimeout(function () {
            console.log('Sending ident...');
            scale.ident()
        }, 500);
        setTimeout(function () {
            console.log('Sending config...');
            scale.enable_notifications()
            scale.enable_notifications()
        }, 1000);

    }

    static encode(msgType, payload) {

        var buf = new ArrayBuffer(5 + payload.length);
        var bytes = new Uint8Array(buf);
        bytes[0] = Acaia.HEADER1;
        bytes[1] = Acaia.HEADER2;
        bytes[2] = msgType;
        var cksum1 = 0;
        var cksum2 = 0;

        for (var i = 0; i < payload.length; i++) {
            var val = payload[i] & 0xff;
            bytes[3 + i] = val;
            if (i % 2 == 0) {
                cksum1 += val;
            } else {
                cksum2 += val;
            }
        }

        bytes[payload.length + 3] = (cksum1 & 0xFF);
        bytes[payload.length + 4] = (cksum2 & 0xFF);

        return buf;
    }

    static encodeId() {

        var payload = [0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d];
        return Acaia.encode(11, payload);
    }

    static encodeEventData(payload) {

        var buf = new ArrayBuffer(payload.length + 1);
        var bytes = new Uint8Array(buf);
        bytes[0] = payload.length + 1;

        for (var i = 0; i < payload.length; i++) {
            bytes[i + 1] = payload[i] & 0xff;
        }

        return Acaia.encode(12, bytes);
    }

    static encodeNotificationRequest() {
        var payload = [
            0, // weight
            1, // weight argument
            1, // battery
            2, // battery argument
            2, // timer
            5, // timer argument
            3, // key
            4 // setting
        ];

        return Acaia.encodeEventData(payload);
    }

    async ident() {
        await this.weightCharacteristic.writeValue(Acaia.encodeId())
    }

    async enable_notifications() {
        this.weightCharacteristic.startNotifications().catch(async e => {
            console.log('FAILED: ' + e);
            return null;
        });
        await this.weightCharacteristic.writeValue(Acaia.encodeNotificationRequest())
    }
}
