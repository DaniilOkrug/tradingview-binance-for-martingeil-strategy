const { parentPort, workerData } = require("worker_threads");
const Binance = require("node-binance-api");

console.log("New Bot Manager");

const binance = new Binance().options({
  APIKEY: workerData.key,
  APISECRET: workerData.secret,
});

const orders = {};

parentPort.on("message", async (signalString) => {
  const signal = JSON.parse(signalString);

  console.log(signal);
  if (!signal.open || !signal.tp || !signal.sl) {
    console.log('Incorrect request');
    return;
  }

  switch (signal.side) {
    case "buy":
      //   const accountInfo = await binance.futuresAccount();
      // console.log(accountInfo);
      if (typeof orders[signal.symbol] !== "undefined") return;

      const newOrder = [
        {
          symbol: signal.symbol,
          side: "BUY",
          type: "MARKET",
          quantity: String(signal.open.amount),
          positionSide: "LONG",
        },
        {
          symbol: signal.symbol,
          side: "SELL",
          type: "STOP_MARKET",
          stopPrice: String(signal.sl.price),
          quantity: String(signal.amount),
          positionSide: "LONG",
        },
        {
          symbol: signal.symbol,
          side: "SELL",
          type: "TAKE_PROFIT_MARKET",
          stopPrice: String(signal.tp[0].price),
          quantity: String(signal.tp[0].amount),
          positionSide: "LONG",
        },
        {
          symbol: signal.symbol,
          side: "SELL",
          type: "TAKE_PROFIT_MARKET",
          stopPrice: String(signal.tp[1].price),
          quantity: String(signal.tp[1].amount),
          positionSide: "LONG",
        },
      ];

      console.log(newOrder);

      const binanceResponse = await binance.futuresMultipleOrders(newOrder);
      console.log(binanceResponse);

      orders[signal.symbol] = {
        order: binanceResponse[0],
        sl: binanceResponse[1],
        tp1: binanceResponse[2],
        tp2: binanceResponse[3],
      };

      break;

    case "sell":
      break;

    default:
      console.log("Wrong trading side");
      return;
      break;
  }
});

binance.websockets.userFutureData(
  console.log(),
  console.log(),
  async (updateInfo) => {
    console.log(updateInfo);

    const activePairs = Object.keys(orders);
    for (const pair of activePairs) {
      //Set average price for initial order
      if (
        updateInfo.order.orderId === orders[pair].order.orderId &&
        updateInfo.order.orderStatus === "FILLED"
      ) {
        orders[pair].order.avgPrice = updateInfo.order.averagePrice;
        return;
      }

      //Replace SL
      if (
        updateInfo.order.orderId === orders[pair].tp1.orderId &&
        updateInfo.order.orderStatus === "FILLED"
      ) {
        const cancelOrderResponse = await binance.futuresCancel(pair, {
          orderId: orders[pair].sl,
        });

        const newSlResponse = (
          await binance.futuresMultipleOrders([
            {
              symbol: pair,
              side: updateInfo.order.side,
              type: "STOP_MARKET",
              stopPrice: String(orders[pair].order.avgPrice),
              quantity: String(orders[pair].tp2.origQty),
              positionSide: "LONG",
            },
          ])
        )[0];

        // orders[pair].sl.orderId = newSlResponse.order.orderId

        console.log("new sl", newSlResponse);
        return;
      }

      //Cancel order for last tp and sl
      if (
        updateInfo.order.orderId === orders[pair].tp2.orderId &&
        updateInfo.order.orderStatus === "FILLED"
      ) {
        const cancelOrderResponse = await binance.futuresCancel(pair, {
          orderId: orders[pair].sl.orderId,
        });
      }

      if (
        updateInfo.order.orderId === orders[pair].sl.orderId &&
        updateInfo.order.orderStatus === "FILLED"
      ) {
        const cancelOrderResponse = await binance.futuresCancel(pair, {
          orderId: orders[pair].tp2.orderId,
        });
      }
    }
  }
);
