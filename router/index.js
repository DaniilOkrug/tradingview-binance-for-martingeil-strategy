const Router = require("express").Router;

const BinanceWorkerManager = require('../worker/indexBinance');

const router = new Router();

router.get("/", (req, res) => {
  res.json("Its server");
});

router.post("/signal", async (req, res, next) => {
  try {
    const response = BinanceWorkerManager.newSignal(req.body);

    res.json(response);
  } catch (err) {
    console.log(err);
    next();
  }
});

module.exports = router;
