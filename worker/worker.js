const { parentPort, workerData } = require("worker_threads");
const Binance = require("node-binance-api");

console.log("New Bot Manager");

const binance = new Binance().options({
  APIKEY: workerData.key,
  APISECRET: workerData.secret,
});

const orders = {};
const precisions = {};

parentPort.on("message", async (signalString) => {
  const signal = JSON.parse(signalString);

  console.log(signal);
  if (!signal.open || !signal.tp || !signal.sl) {
    console.log("Incorrect request");
    return;
  }

  const tp1_amount = await filterLotSize(signal.symbol, Number(signal.tp[0].amount));

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
          stopPrice: String(await filterPrice(signal.symbol, signal.sl.price)),
          quantity: String(signal.open.amount),
          positionSide: "LONG",
        },
        {
          symbol: signal.symbol,
          side: "SELL",
          type: "TAKE_PROFIT_MARKET",
          stopPrice: String(await filterPrice(signal.symbol, signal.tp[0].price)),
          quantity: String(tp1_amount),
          positionSide: "LONG",
        },
        {
          symbol: signal.symbol,
          side: "SELL",
          type: "TAKE_PROFIT_MARKET",
          stopPrice: String(await filterPrice(signal.symbol, signal.tp[1].price)),
          quantity: String(signal.open.amount - tp1_amount),
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

      console.log(orders[signal.symbol]);

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
      //Order cancelled by user
      if (
        updateInfo.order.isReduceOnly &&
        updateInfo.order.orderStatus === "FILLED" &&
        updateInfo.order.originalQuantity === orders[pair].order.origQty &&
        ((updateInfo.order.side === "SELL" &&
          orders[pair].order.positionSide === "LONG") ||
          (updateInfo.order.side === "BUY" &&
            orders[pair].positionSide === "SHORT"))
      ) {
        console.log('close all');

        const cancelSlResponse = await binance.futuresCancel(pair, {
          orderId: orders[pair].sl.orderId,
        });

        const cancelTp1Response = await binance.futuresCancel(pair, {
          orderId: orders[pair].tp1.orderId,
        });

        const cancelTp2Response = await binance.futuresCancel(pair, {
          orderId: orders[pair].tp2.orderId,
        });

        delete orders[pair];
        return;
      }

      //Set average price for initial order
      if (
        updateInfo.order.orderId === orders[pair].order.orderId &&
        updateInfo.order.orderStatus === "FILLED"
      ) {
        console.log('Set average price', updateInfo.order.averagePrice);
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

        orders[pair].sl.orderId = newSlResponse.orderId;

        console.log("new sl", newSlResponse);
        return;
      }

      //Cancel order for last tp and sl
      if (
        updateInfo.order.orderId === orders[pair].tp2.orderId &&
        updateInfo.order.orderStatus === "FILLED"
      ) {
        console.log('Cancel sl after 2 tp');
        const cancelOrderResponse = await binance.futuresCancel(pair, {
          orderId: orders[pair].sl.orderId,
        });

        delete orders[pair];
        return;
      }

      if (
        updateInfo.order.orderId === orders[pair].sl.orderId &&
        updateInfo.order.orderStatus === "FILLED"
      ) {
        console.log('Cancel tp after sl');
        const cancelOrderResponse = await binance.futuresCancel(pair, {
          orderId: orders[pair].tp2.orderId,
        });

        delete orders[pair];
        return;
      }
    }
  }
);

(async () => {
  const exchangeInfo = await binance.futuresExchangeInfo();

  const coinsInfo = exchangeInfo.symbols;
  // console.log(coinsInfo);

  for (const info of coinsInfo) {
    precisions[info.symbol] = info.filters;
  }

  //   console.log(precisions);
})();

function filterLotSize(symbol, volume) {
  return new Promise((resolve, reject) => {
    try {
      const volumeFilter = precisions[symbol].find(
        (filter) => filter.filterType === "MARKET_LOT_SIZE"
      );

      if (volume < volumeFilter.minQty) {
        reject(
          new Error(`[${symbol}] Lot less than Binance require!`)
        );
      }

      if (volume > volumeFilter.maxQty) {
        reject(
          new Error(`[${symbol}] Lot greater than Binance require!`)
        );
      }

      const volumeStepSizeRemainder =
        (volume - volumeFilter.minQty) % volumeFilter.stepSize;
      if (volumeStepSizeRemainder != 0) {
        const tokens = volumeFilter.stepSize.split(".");
        let precision = 0;
        if (tokens[0] != "1") {
          for (let i = 0; i < tokens[1].length; i++) {
            precision++;
            if (tokens[1][i] == "1") break;
          }
        }
        resolve(+volume.toFixed(precision));
      }

      resolve(volume);
    } catch (err) {
      console.log(err);
      reject(err);
    }
  });
}

function filterPrice(symbol, price) {
    return new Promise((resolve, reject) => {
        try {
            if (typeof price === 'undefined') return reject(new Error('Price in checking filter undefined!'));

            const priceFilter = precisions[symbol].find((filter) => filter.filterType === 'PRICE_FILTER');

            if (price < priceFilter.minPrice) {
                reject(new Error(`[${symbol}] Price less than Binance require!`));
            }

            if (price > priceFilter.maxPrice) {
                reject(new Error(`[${symbol}] Price greater than Binance require!`));
            }

            const priceTickSizeRemainder = (price - priceFilter.minPrice) % priceFilter.tickSize;
            if (priceTickSizeRemainder != 0) {
                const tokens = priceFilter.tickSize.split('.');
                let precision = 0;
                for (let i = 0; i < tokens[1].length; i++) {
                    precision++;
                    if (tokens[1][i] == '1') break;
                }
                resolve(+price.toFixed(precision));
            }

            resolve(price);
        } catch (err) {
            console.log(err);
            reject(err);
        }
    });
}
