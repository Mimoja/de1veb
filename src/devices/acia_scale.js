// based on https://github.com/bpowers/btscale

let SCALE_WEIGHT_SERVICE_UUID = '00001820-0000-1000-8000-00805f9b34fb';
let SCALE_WEIGHT_CHARACTERISTIC_UUID = '00002a80-0000-1000-8000-00805f9b34fb';

let HEADER1 = 0xef;
let HEADER2 = 0xdd;


var Message = (function () {

    function Message(type, payload) {

        this.type = type;
        this.payload = payload;
        this.value = null;

        if (type === 5) {
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

            this.value = value;
        }
    }

    return Message;
}());


function encode(msgType, payload) {

    var buf = new ArrayBuffer(5 + payload.length);
    var bytes = new Uint8Array(buf);
    bytes[0] = HEADER1;
    bytes[1] = HEADER2;
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

function encodeEventData(payload) {

    var buf = new ArrayBuffer(payload.length + 1);
    var bytes = new Uint8Array(buf);
    bytes[0] = payload.length + 1;

    for (var i = 0; i < payload.length; i++) {
        bytes[i + 1] = payload[i] & 0xff;
    }

    return encode(12, bytes);
}


function encodeNotificationRequest() {

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

    return encodeEventData(payload);
}


function encodeId() {

    var payload = [0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d];
    return encode(11, payload);
}


function encodeHeartbeat() {

    var payload = [2, 0];
    return encode(0, payload);
}



function encodeTare() {

    var payload = [0];
    return encode(4, payload);
}


function decode(bytes, scale) {

    // TODO: read length and make sure we have enough data
    // before decoding message
    if (bytes[0] !== HEADER1 && bytes[1] !== HEADER2) {
        return;
    }

    var cmd = bytes[2];

    switch (cmd) {
        // Event
        case 12:
            // TODO: verify length + checksum

            var msgType = bytes[4];
            var payloadIn = new Uint8Array(bytes.slice(5));

            return new Message(msgType, payloadIn);

        // Status
        case 8:
            length = bytes[3];
            scale.batteryLevel = bytes[4];
            console.log('Got status message, battery= ' + scale.batteryLevel)
            return;

        default:
            console.log('unknown message type: ' + cmd);
            console.log(bytes);
            return
    }
}


var Scale = (function () {

    function Scale(device) {

        this.connected = false;
        this.service = null;
        this.weightCharacteristic = null;
        this.weight = null;
        this.device = device;
        this.name = this.device.name;
        this.weightQueue = null;
        this.batteryLevel = 0;
        console.log('created scale for ' + this.device.address + ' (' + this.device.name + ')');
        this.connect();
    }

    Scale.prototype.connect = async function () {

        var _this = this;
        if (this.connected) {
            return;
        }

        var log = console.log.bind(console);

        _this.weightQueue = new Queue(function (payload) {

            _this.addBuffer(payload);
            // the packet header is split from the content
            // need to read in two times and recompose the message
            if (_this.packet.byteLength <= 3) {
                return;
            }


            var msg = decode(_this.packet, _this);
            _this.packet = null;

            if (!msg) {
                console.log('characteristic value update, but no message');
                return;
            }

            if (msg.type === 5) {
                _this.weight = msg.value;
                console.log('weight: ' + msg.value + ' battery: ' + _this.batteryLevel);
                list = document.querySelector('#list')
                list.textContent = _this.name + " weight:   " + msg.value + " bat: " + _this.batteryLevel;
            } else {
                console.log('non-weight response');
                console.log(msg);
            }
        });

        console.log('Connecting to GATT Server...');
        const server = await this.device.gatt.connect();
        /*
                    console.log('Getting Battery Service...');
                const batteryService = await server.getPrimaryService('battery_service');
                const cbattery = await batteryService.getCharacteristic(SCALE_BATTERY_CHARACTERISTIC_UUID);
                this.batteryCharacteristic = cbattery;
        */
        console.log('Getting Weight Service...');
        const weightService = await server.getPrimaryService(SCALE_WEIGHT_SERVICE_UUID);
        const cweight = await weightService.getCharacteristic(SCALE_WEIGHT_CHARACTERISTIC_UUID);
        this.weightCharacteristic = cweight;

        cweight.addEventListener('characteristicvaluechanged', _this.characteristicValueChanged.bind(_this));
        await cweight.startNotifications().catch(async e => {
            log('FAILED: ' + err);
            return null;
        });

        _this.notificationsReady();
    };


    Scale.prototype.addBuffer = function (buffer2) {

        var tmp = new Uint8Array(buffer2);
        var len = 0;

        if (this.packet != null) {
            len = this.packet.length;
        }

        var result = new Uint8Array(len + buffer2.byteLength);

        for (var i = 0; i < len; i++) {
            result[i] = this.packet[i];
        }

        for (var i = 0; i < buffer2.byteLength; i++) {
            result[i + len] = tmp[i];
        }

        this.packet = result;
    }


    Scale.prototype.characteristicValueChanged = function (event) {

        this.weightQueue.add(event.target.value.buffer);
    };

    Scale.prototype.disconnect = function () {

        this.connected = false;
        if (this.device) {
            this.device.gatt.connect();
        }
    };

    Scale.prototype.notificationsReady = function () {

        console.log('scale ready');
        this.connected = true;
        this.ident();
        setInterval(this.heartbeat.bind(this), 3000);
    };

    Scale.prototype.ident = function () {

        if (!this.connected) {
            return false;
        }

        var _this = this;
        this.weightCharacteristic.writeValue(encodeId())
            .then(function () { }, function (err) {
                console.log('write ident failed: ' + err);
            }).then(function () {
                _this.weightCharacteristic.writeValue(encodeNotificationRequest())
                    .then(function () { }, function (err) {
                        console.log('write failed: ' + err);
                    });
            });

        return true;
    };

    Scale.prototype.heartbeat = function () {

        if (!this.connected) {
            return false;
        }

        this.weightCharacteristic.writeValue(encodeHeartbeat())
            .then(function () { }, function (err) {
                console.log('write heartbeat failed: ' + err);
            });

        return true;
    };

    Scale.prototype.tare = function () {

        if (!this.connected) {
            return false;
        }

        this.weightCharacteristic.writeValue(encodeTare())
            .then(function () { }, function (err) {
                console.log('write tare failed: ' + err);
            });

        return true;
    };

    return Scale;
}());


var bluetooth = navigator.bluetooth;
var ScaleFinder = (function () {

    function ScaleFinder() {
        this.ready = false;
        this.devices = {};
        this.scales = [];
        this.failed = false;
    }

    ScaleFinder.prototype.deviceAdded = function (device) {

        if (device.address in this.devices) {
            console.log('WARN: device added that is already known ' + device.address);
            return;
        }

        var scale = new Scale(device);
        this.devices[device.address] = scale;
        this.scales.push(scale);
        list = document.querySelector('#list')
        list.textContent += scale.name + "\n"
    };

    ScaleFinder.prototype.tare = function () {
        if (this.failed) {
            return;
        }
        this.scales.forEach(scale => scale.tare());
    };

    ScaleFinder.prototype.startDiscovery = function () {

        var _this = this;
        if (this.failed) {
            return;
        }

        bluetooth.requestDevice({ filters: [{ services: [SCALE_WEIGHT_SERVICE_UUID] }] })
            .then(function (device) {
                _this.deviceAdded(device);
            });
    };

    ScaleFinder.prototype.stopDiscovery = function () {

        if (this.failed) {
            return;
        }
    };

    return ScaleFinder;
}());

if (typeof window !== 'undefined') {
    window.ScaleFinder = ScaleFinder;
}