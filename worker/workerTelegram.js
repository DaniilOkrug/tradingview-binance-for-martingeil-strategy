const { parentPort, workerData } = require("worker_threads");
const TelegramBot = require("node-telegram-bot-api");
const { logger } = require("../logger");

const botStep = new TelegramBot(workerData.tokenStep, { polling: true });
const botProfit = new TelegramBot(workerData.tokenProfit, { polling: true });

const botStep_chatIDs = [];
const botProfit_chatIDs = [];

parentPort.on("message", async (signalString) => {
  const signal = JSON.parse(signalString);

  if (signal.step) {
    for (const charId of botStep_chatIDs) {
        botStep.sendMessage(charId, `${signal.symbol} ${signal.step}`);
    }
    return;
  }

  if (signal.close_tp) {
    for (const charId of botStep_chatIDs) {
        botStep.sendMessage(charId, `${signal.symbol} ${signal.close_tp}/2`);
    }
  }

});

botStep.onText(/\/start/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  if (!botStep_chatIDs.includes(chatId)) botStep_chatIDs.push(chatId);

  // send back the matched "whatever" to the chat
  botStep.sendMessage(chatId, 'Connected');
});

botProfit.onText(/\/start/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  if (!botProfit_chatIDs.includes(chatId)) botProfit_chatIDs.push(chatId);

  // send back the matched "whatever" to the chat
  botProfit.sendMessage(chatId, 'Connected');
});

botStep.on("polling_error", (error) => {
  console.log(error.code); // => 'EFATAL'
});