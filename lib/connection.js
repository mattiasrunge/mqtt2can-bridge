"use strict";

const EventEmitter = require("events");
const dgram = require("dgram");
const Protocol = require("./protocol");
const Encoder = require("./encoder");
const Decoder = require("./decoder");

class Connection extends EventEmitter {
    constructor(definitionfile, host, port = 1100) {
        super();

        this.protocol = new Protocol(definitionfile);
        this.encoder = new Encoder(this.protocol);
        this.decoder = new Decoder(this.protocol);
        this.host = host;
        this.port = port;

        this.decoder.on("message", (message) => {
            this.emit("message", message);
        });
    }

    async start() {
        await this.protocol.load();

        this.decoder.clear();
        this.server = dgram.createSocket("udp4");

        await new Promise((resolve, reject) => {
            this.server.on("error", (error) => {
              this.dispose();

              if (reject) {
                  reject(error);
                  reject = null;
                  return;
              }

              this.emit("error", error);
            });

            this.server.on("message", (data, info) => {
                this.decoder.addData(data);
            });

            this.server.on("listening", () => {
                this.ping();
                resolve();
            });

            this.server.bind(this.port);
        });
    }

    send(message) {
        return this._send(this.encoder.encode(message));
    }

    ping() {
        return this._send(this.encoder.getPing());
    }

    _send(data) {
        const client = dgram.createSocket("udp4");

        return new Promise((resolve, reject) => {
            client.send(data, this.port, this.host, (error) => {
                if (error) {
                    return reject(error);
                }

                client.close();
                resolve();
            });
        });
    }

    dispose() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.decoder.clear();
        }
    }
}

module.exports = Connection;