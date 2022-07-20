require("dotenv").config();
const express = require("express");

const router = require("./router/index");

const BinanceWorkerManager = require('./worker/index');

const PORT = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use("/api", router);

const start = async () => {
  try {
    app.listen(PORT, () => console.log(`Server started on PORT = ${PORT}`));

    BinanceWorkerManager.createWorker('NkBfaDu33Fc8MGhIYEBZh0YitdfCSWjULkO90N1ZJCH5OWQJ7KCw3Q6giYrEdIlD', 'ppNEzfh3CYkT9t1mCqXo65m3yz1pgB64GUEG8c2IKqayxr7Ip2quQIei3td5V6Dk');
  } catch (err) {
    console.log(err);
  }
};

start();
