const { parentPort, workerData } = require("worker_threads");
const Binance = require("node-binance-api");
const { logger } = require("../logger");

console.log("New Bot Manager");

const binance = new Binance().options({
  APIKEY: workerData.key,
  APISECRET: workerData.secret,
  useServerTime: true,
  recvWindow: 60000, // Set a higher recvWindow to increase response timeout
  verbose: true, // Add extra output when subscribing to WebSockets, etc
  log: (log) => {
    console.log(log); // You can create your own logger here, or disable console output
  },
});

const orders = {};
const precisions = {};

parentPort.on("message", async (signalString) => {
  try {
    const signal = JSON.parse(signalString);
    logger.info(signal);

    if (!signal.symbol) return;
    if (typeof orders[signal.symbol] !== "undefined") {
      logger.error(`${signal.symbol} symbol already active`);
      return;
    }

    signal.symbol = signal.symbol.replace("PERP", "");
    console.log(signal);

    console.log(signal);
    if (!signal.open || !signal.tp || !signal.sl) {
      console.log("Incorrect request");
      logger.error(`${signal.symbol} Incorrect request ${signal}`);
      return;
    }

    const tp1_amount = await filterLotSize(
      signal.symbol,
      Number(signal.tp[0].amount)
    );

    const mainAmount = await filterLotSize(
      signal.symbol,
      Number(signal.open.amount)
    );

    switch (signal.side) {
      case "buy":
        //   const accountInfo = await binance.futuresAccount();
        // console.log(accountInfo);

        const mainLongOrder = [
          {
            symbol: signal.symbol,
            side: "BUY",
            type: "MARKET",
            quantity: String(mainAmount),
            positionSide: "LONG",
          },
        ];

        const binanceMainLongResponse = await binance.futuresMultipleOrders(
          mainLongOrder
        );

        // Проверка ошибки выставления главного ордера
        if (!binanceMainLongResponse[0].orderId) {
          console.log(binanceMainLongResponse);
          logger.error(binanceMainLongResponse);

          parentPort.postMessage(
            JSON.stringify({
              symbol: signal.symbol,
              error: binanceMainLongResponse,
            })
          );

          return;
        }

        //Определение цены открытия позиции
        binanceMainLongResponse[0].avgPrice = signal.open.price;

        //Открытие позиции
        const newLongOrders = [
          {
            symbol: signal.symbol,
            side: "SELL",
            type: "STOP_MARKET",
            stopPrice: String(
              await filterPrice(signal.symbol, Number(signal.sl.price))
            ),
            quantity: String(mainAmount),
            positionSide: "LONG",
          },
          {
            symbol: signal.symbol,
            side: "SELL",
            type: "TAKE_PROFIT_MARKET",
            stopPrice: String(
              await filterPrice(signal.symbol, Number(signal.tp[0].price))
            ),
            quantity: String(tp1_amount),
            positionSide: "LONG",
          },
          {
            symbol: signal.symbol,
            side: "SELL",
            type: "TAKE_PROFIT_MARKET",
            stopPrice: String(
              await filterPrice(signal.symbol, Number(signal.tp[1].price))
            ),
            quantity: String(
              await filterLotSize(signal.symbol, mainAmount - tp1_amount)
            ),
            positionSide: "LONG",
          },
        ];

        console.log(newLongOrders);

        const binanceLongResponse = await binance.futuresMultipleOrders(
          newLongOrders
        );
        console.log(binanceLongResponse);

        //Проверка ошибки при выставлении оредров
        for (const binanceResponse of binanceLongResponse) {
          if (!binanceResponse.orderId) {
            logger.error(binanceLongResponse);
            console.log("Canceling all orders due to one of the orders error!");

            parentPort.postMessage(
              JSON.stringify({
                symbol: signal.symbol,
                error: binanceLongResponse,
              })
            );

            //Закрытие позиции
            const mainLongCloseResponse = await binance.futuresMultipleOrders([
              {
                symbol: signal.symbol,
                side: "SELL",
                type: "MARKET",
                quantity: String(mainAmount),
                positionSide: "LONG",
              },
            ]);

            //Закрытие ордеров
            for (let i = 0; i < binanceLongResponse.length; i++) {
              const response = binanceLongResponse[i];

              const cancelResponse = await binance.futuresCancel(
                signal.symbol,
                {
                  orderId: response.orderId,
                }
              );
            }

            return;
          }
        }

        //Сохранение успешного открытия
        orders[signal.symbol] = {
          order: binanceMainLongResponse[0],
          sl: binanceLongResponse[0],
          tp1: binanceLongResponse[1],
          tp2: binanceLongResponse[2],
        };

        console.log(orders[signal.symbol]);

        //Отсылаем сигнал в телеграм
        parentPort.postMessage(JSON.stringify(signal));

        break;

      case "sell":
        const mainShortOrder = [
          {
            symbol: signal.symbol,
            side: "SELL",
            type: "MARKET",
            quantity: String(mainAmount),
            positionSide: "SHORT",
          },
        ];

        //Определение цены открытия позиции
        const binanceMainShortResponse = await binance.futuresMultipleOrders(
          mainShortOrder
        );

        // Проверка ошибки выставления главного ордера
        if (!binanceMainShortResponse[0].orderId) {
          console.log(binanceMainShortResponse);
          logger.error(binanceMainShortResponse);

          parentPort.postMessage(
            JSON.stringify({
              symbol: signal.symbol,
              error: binanceMainShortResponse,
            })
          );

          return;
        }

        binanceMainShortResponse[0].avgPrice = signal.open.price;

        //Открытие позиции
        const newShortOrders = [
          {
            symbol: signal.symbol,
            side: "BUY",
            type: "STOP_MARKET",
            stopPrice: String(
              await filterPrice(signal.symbol, Number(signal.sl.price))
            ),
            quantity: String(mainAmount),
            positionSide: "SHORT",
          },
          {
            symbol: signal.symbol,
            side: "BUY",
            type: "TAKE_PROFIT_MARKET",
            stopPrice: String(
              await filterPrice(signal.symbol, Number(signal.tp[0].price))
            ),
            quantity: String(tp1_amount),
            positionSide: "SHORT",
          },
          {
            symbol: signal.symbol,
            side: "BUY",
            type: "TAKE_PROFIT_MARKET",
            stopPrice: String(
              await filterPrice(signal.symbol, Number(signal.tp[1].price))
            ),
            quantity: String(
              await filterLotSize(signal.symbol, mainAmount - tp1_amount)
            ),
            positionSide: "SHORT",
          },
        ];

        console.log(newShortOrders);

        const binanceShortResponse = await binance.futuresMultipleOrders(
          newShortOrders
        );
        console.log(binanceShortResponse);

        //Проверка ошибки при выставлении оредров
        for (const binanceResponse of binanceShortResponse) {
          if (!binanceResponse.orderId) {
            logger.error(binanceShortResponse);
            console.log("Canceling all orders due to one of the orders error!");

            parentPort.postMessage(
              JSON.stringify({
                symbol: signal.symbol,
                error: binanceShortResponse,
              })
            );

            //Закрытие позиции
            const mainLongCloseResponse = await binance.futuresMultipleOrders([
              {
                symbol: signal.symbol,
                side: "BUY",
                type: "MARKET",
                quantity: String(mainAmount),
                positionSide: "SHORT",
              },
            ]);

            //Закрытие ордеров
            for (let i = 0; i < binanceShortResponse.length; i++) {
              const response = binanceShortResponse[i];

              const cancelResponse = await binance.futuresCancel(
                signal.symbol,
                {
                  orderId: response.orderId,
                }
              );
            }

            return;
          }
        }

        //Сохранение успешного открытия
        orders[signal.symbol] = {
          order: binanceMainShortResponse[0],
          sl: binanceShortResponse[0],
          tp1: binanceShortResponse[1],
          tp2: binanceShortResponse[2],
        };

        console.log(orders[signal.symbol]);

        //Отсылаем сигнал в телеграм
        parentPort.postMessage(JSON.stringify(signal));

        break;

      default:
        console.log("Wrong trading side");
        return;
        break;
    }
  } catch (error) {
    console.log(error);
    logger.error(error);
  }
});

binance.websockets.userFutureData(
  console.log(),
  console.log(),
  async (updateInfo) => {
    try {
      console.log(updateInfo);

      const activePairs = Object.keys(orders);
      console.log(activePairs);
      for (const pair of activePairs) {
        //Order cancelled by user
        if (
          updateInfo?.order?.isReduceOnly &&
          updateInfo?.order?.orderStatus === "FILLED" &&
          updateInfo?.order?.originalQuantity ===
            orders[pair]?.order?.origQty &&
          ((updateInfo?.order?.side === "SELL" &&
            orders[pair]?.order?.positionSide === "LONG") ||
            (updateInfo?.order?.side === "BUY" &&
              orders[pair]?.order?.positionSide === "SHORT"))
        ) {
          console.log("close all");

          if (updateInfo?.order?.orderId === orders[pair]?.tp2?.orderId) {
            parentPort.postMessage(
              JSON.stringify({
                symbol: updateInfo.order.symbol,
                close_tp: 2,
              })
            );
          }

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

          console.log(orders);
          return;
        }

        //Set average price for initial order
        if (
          updateInfo?.order?.orderId === orders[pair]?.order?.orderId &&
          updateInfo?.order?.orderStatus === "FILLED"
        ) {
          console.log("Set average price", updateInfo.order.averagePrice);
          orders[pair].order.avgPrice = updateInfo.order.averagePrice;
          return;
        }

        //Replace SL
        if (
          updateInfo?.order?.orderId === orders[pair]?.tp1?.orderId &&
          updateInfo?.order?.orderStatus === "FILLED"
        ) {
          console.log("replace");
          logger.info(pair + " replace SL");

          parentPort.postMessage(
            JSON.stringify({
              symbol: updateInfo.order.symbol,
              close_tp: 1,
            })
          );

          const cancelOrderResponse = await binance.futuresCancel(pair, {
            orderId: orders[pair].sl.orderId,
          });

          const newSlResponse = (
            await binance.futuresMultipleOrders([
              {
                symbol: updateInfo.order.symbol,
                side: orders[pair].sl.side,
                type: "STOP_MARKET",
                stopPrice: String(
                  await filterPrice(pair, Number(orders[pair].order.avgPrice))
                ),
                quantity: orders[pair].tp2.origQty,
                positionSide: updateInfo.order.positionSide,
              },
            ])
          )[0];

          orders[pair].sl.orderId = newSlResponse.orderId;
          orders[pair].order.origQty = orders[pair].tp2.origQty;

          console.log("new sl", newSlResponse);
          return;
        }

        //Cancel order for last tp and sl
        if (
          updateInfo?.order?.orderId === orders[pair]?.tp2?.orderId &&
          updateInfo?.order?.orderStatus === "FILLED"
        ) {
          console.log("Cancel sl after 2 tp");

          parentPort.postMessage(
            JSON.stringify({
              symbol: updateInfo.order.symbol,
              close_tp: 2,
            })
          );

          const cancelOrderResponse = await binance.futuresCancel(pair, {
            orderId: orders[pair].sl.orderId,
          });

          delete orders[pair];
          return;
        }

        if (
          updateInfo?.order?.orderId === orders[pair].sl.orderId &&
          updateInfo?.order?.orderStatus === "FILLED"
        ) {
          console.log("Cancel tp after sl");
          const cancelOrderResponse = await binance.futuresCancel(pair, {
            orderId: orders[pair].tp2.orderId,
          });

          delete orders[pair];
          return;
        }
      }
    } catch (error) {
      console.log(error);
      logger.error(error);
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
      if (typeof price === "undefined")
        return reject(new Error("Price in checking filter undefined!"));

      const priceFilter = precisions[symbol].find(
        (filter) => filter.filterType === "PRICE_FILTER"
      );

      if (price < priceFilter.minPrice) {
        reject(new Error(`[${symbol}] Price less than Binance require!`));
      }

      if (price > priceFilter.maxPrice) {
        reject(new Error(`[${symbol}] Price greater than Binance require!`));
      }

      const priceTickSizeRemainder =
        (price - priceFilter.minPrice) % priceFilter.tickSize;
      if (priceTickSizeRemainder != 0) {
        const tokens = priceFilter.tickSize.split(".");
        let precision = 0;
        for (let i = 0; i < tokens[1].length; i++) {
          precision++;
          if (tokens[1][i] == "1") break;
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
