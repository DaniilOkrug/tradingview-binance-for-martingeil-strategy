const { Worker } = require("worker_threads");

class BinanceWorkerManager {
    #worker;

    createWorker(key, secret) {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker("./worker/worker.js", { workerData: { key, secret } });

                worker.on("message", async (data) => {
                    console.log(data);
                });

                worker.on("error", error => {
                    console.log(error);
                });
                worker.on("exit", exitCode => {
                    console.log("Worker exit with code: " + exitCode);
                })

                this.#worker = worker;

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    newSignal(signal) {
        this.#worker.postMessage(JSON.stringify(signal));
        return 'Ok';
    }
}

class Singleton {
    constructor() {
        throw new Error('Use Singleton.getInstance()');
    }
    static getInstance() {
        if (!Singleton.instance) {
            Singleton.instance = new BinanceWorkerManager();
        }
        return Singleton.instance;
    }
}

module.exports = Singleton.getInstance();