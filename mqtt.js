let mosca = require("mosca");

class MqttBroker {

    constructor(
    ) {
        this.connectedDevices = 0;
        this.qrcode = "43324566hgj"
        this.lampOn = false;
    }

    /**
     * Start the broker
     * 
     * @returns {Promise<any>} 
     * 
     * @memberOf TechmassMqttBroker
     */
    async listen() {

        // build mosca broker settings
        let moscaSettings = {
            http: {
                port: 8780
            },
            allowNonSecure: true,
            port: 8781,
            backend: {
                type: "mongo",
                url: "mongodb://localhost:27017/mqtt",
                pubsubCollection: "ioniccourse"
            },
            mongo: {}
        };

        // start mqtt broker
        this.server = new mosca.Server(moscaSettings);
        this.server.on("ready", () => {
            console.log("Broker: connected on port " + moscaSettings.port);

            // configure authentication
            this.server.authorizeSubscribe = this.authorizeSubscribe.bind(this);
            this.server.authorizePublish = this.authorizePublish.bind(this);
            this.server.authenticate = this.authenticate.bind(this);
        });
        this.server.on("clientConnected", this.onClientConnected.bind(this));
        this.server.on("clientDisconnected", this.onClientDisconnected.bind(this));
        this.server.on("published", (packet, client) => {
            console.log(this.getClientInfo(client) + "Published (T) ", packet.topic, " ", this.binaryToString(packet.payload));
        });

        // message routing
        this.server.on("published", this.onPublished.bind(this));
    }

    /**
     * Fired when a client connects
     * 
     * @param {MqttClient} client 
     * 
     * @memberOf TechmassMqttBroker
     */
    async onClientConnected(client) {
        this.connectedDevices++;
        console.log(this.getClientInfo(client) + "Broker: client connected");

        let buf = Buffer.alloc(1);
        buf.writeUIntBE(this.connectedDevices, 0, 1);
        this.server.publish({
            topic: this.qrcode + "/connection",
            payload: buf
        })

    }

    /**
     * Fired when a client disconnects
     * 
     * @param {MqttClient} client 
     * 
     * @memberOf TechmassMqttBroker
     */
    async onClientDisconnected(client) {
        this.connectedDevices--;
        console.log(this.getClientInfo(client) + "Broker: client disconnected");

        let buf = Buffer.alloc(1);
        buf.writeUIntBE(this.connectedDevices, 0, 1);
        this.server.publish({
            topic: this.qrcode + "/connection",
            payload: buf
        })
    }


    binaryToString(message){
        if (typeof message === "string") return message;
        return message.reduce((tot, cur) => {
            return tot + cur;
        }, "");
    }

    /**
     * Incoming messages routing
     * 
     * @param {any} packet 
     * @param {any} client 
     * 
     * @memberOf TechmassMqttBroker
     */
    onPublished(packet, client) {
        let topic= packet.topic;
        let payload= packet.payload;

        // topic: {{qrcode}}/command
        // payload: {{command}}
        if (topic === this.qrcode + "/command") {
            let payloadString = String.fromCharCode(...payload);

            if (payloadString === "1") {
                // switch on lamp
                console.log("==== LAMP ON")
                this.lampOn = true;

                if (client) {
                        this.server.publish({
                            topic: this.qrcode + "/event",
                            payload: client.username + " ha acceso la luce"
                        })
                }
            }
            else if (payloadString === "2") {
		        console.log("==== LAMP OFF")
                // switch off lamp
                this.lampOn = false;

                if (client) {
                        this.server.publish({
                            topic: this.qrcode + "/event",
                            payload: client.username + " ha spento la luce"
                        })
                }
            }
            else if (payloadString === "3") {
                console.log("==== LAMP STATE")
                // send lamp state
                let command = (this.lampOn) ? "1": "2";
                this.server.publish({
                    topic: this.qrcode + "/command",
                    payload: command
                })
            }
        }
    }

    notificaEvento(evento) {

    }



    /**
     * authenticate a client with username(mac) and password. If no user/pass is provided, the client will be anonymous
     * if username === 'token', the client will be authenticated as a frontend web user, with token given by web login
     * 
     * @param {any} client
     * @param {any} username
     * @param {any} password
     * @param {any} callback
     */
    authenticate(client, username, password, callback) {
        let passwordString = "";
        if (password) {
            passwordString = String.fromCharCode(...password);
        }
        
        if (passwordString !== "course") {
            console.log("Auth FAIL" + username + " (pass) " + passwordString);
            callback(null, false);
        } else {
            client.username = username;
            console.log("Auth OK" + username + " (pass) " + passwordString);
            callback(null, true);
        }
    }

    /**
     * Authorization function at sub
     * 
     * @param {any} client
     * @param {any} topic
     * @param {any} callback
     */
    authorizeSubscribe(client, topic, callback) {
        
        if (topic === this.qrcode + "/command" || topic === this.qrcode + "/connection") {
            console.log(this.getClientInfo(client) + "Authorized Subscribe (topic) " + topic);
            callback(null, true);
        } else {
            console.log(this.getClientInfo(client) + "Not Authorized Subscribe (topic) " + topic);
            callback(null, false);
        }
    }

    /**
     * Authorization function at pub
     * 
     * @param {any} client
     * @param {any} topic
     * @param {any} callback
     */
    authorizePublish(client, topic, payload, callback) {

        if (topic === this.qrcode + "/command" || topic === this.qrcode + "/connection") {
            console.log(this.getClientInfo(client) + "Authorized Subscribe (topic) " + topic);
            callback(null, true);
        } else {
            console.log(this.getClientInfo(client) + "Not Authorized Subscribe (topic) " + topic);
            callback(null, false);
        }

    }


    /**
     * Output client info (id, mac, serial)
     * 
     * @param {*} client
     * @returns {string}
     */
    getClientInfo(client) {
        if (!client) return " ";

        let ret = " (ID) " + client.id + " ";
        return ret;
    }

}

let broker = new MqttBroker();
broker.listen();
