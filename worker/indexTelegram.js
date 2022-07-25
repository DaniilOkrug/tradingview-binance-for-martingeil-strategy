const { Worker } = require("worker_threads");

class TelegramManager {
  #worker;

  createWorker(tokenStep, tokenProfit, tokenError) {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker("./worker/workerTelegram.js", {
          workerData: { tokenStep, tokenProfit, tokenError },
        });

        worker.on("message", async (data) => {
          console.log(data);
        });

        worker.on("error", (error) => {
          console.log(error);
        });
        worker.on("exit", (exitCode) => {
          console.log("Worker exit with code: " + exitCode);
        });

        this.#worker = worker;

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  newSignal(signal) {
    this.#worker.postMessage(signal);
    return "Ok";
  }
}

class Singleton {
  constructor() {
    throw new Error("Use Singleton.getInstance()");
  }
  static getInstance() {
    if (!Singleton.instance) {
      Singleton.instance = new TelegramManager();
    }
    return Singleton.instance;
  }
}

module.exports = Singleton.getInstance();
