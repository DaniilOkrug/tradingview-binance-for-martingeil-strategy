require("dotenv").config();
const express = require("express");
const cors = require('cors');

const router = require("./router/index");

const BinanceWorkerManager = require('./worker/index');

const PORT = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use(cors({
    origin: '*',
    optionSuccessStatus: 200
}));
app.use("/api", router);

const start = async () => {
  try {
    app.listen(PORT, () => console.log(`Server started on PORT = ${PORT}`));
    
    BinanceWorkerManager.createWorker(process.env.API, process.env.SECRET);
  } catch (err) {
    console.log(err);
  }
};

start();
