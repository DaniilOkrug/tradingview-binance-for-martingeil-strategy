const { parentPort, workerData } = require("worker_threads");
const TelegramBot = require("node-telegram-bot-api");
const { logger } = require("../logger");

console.log(workerData);

const botStep = new TelegramBot(workerData.tokenStep, { polling: true });
const botProfit = new TelegramBot(workerData.tokenProfit, { polling: true });
const botError = new TelegramBot(workerData.tokenError, { polling: true });
const botExtraAlert = new TelegramBot(workerData.tokenExtraAlert, {
  polling: true,
});

const botStep_chatIDs = [];
const botProfit_chatIDs = [];
const botError_chatIDs = [];
const botExtraAlert_chanIDs = [];

parentPort.on("message", async (signalString) => {
  const signal = JSON.parse(signalString);

  if (signal.step) {
    for (const charId of botStep_chatIDs) {
      botStep.sendMessage(charId, `${signal.symbol} ${signal.step}`);
    }

    if (Number(signal.step) >= 15) {
      for (const charId of botExtraAlert_chanIDs) {
        botExtraAlert.sendMessage(charId, `!`);
      }
    }
    return;
  }

  if (signal.close_tp) {
    for (const charId of botProfit_chatIDs) {
      botProfit.sendMessage(charId, `${signal.symbol} ${signal.close_tp}/2`);
    }
  }

  if (signal.error) {
    for (const charId of botError_chatIDs) {
      botError.sendMessage(charId, signalString);
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
  botStep.sendMessage(chatId, "Connected");
});

botProfit.onText(/\/start/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  if (!botProfit_chatIDs.includes(chatId)) botProfit_chatIDs.push(chatId);

  // send back the matched "whatever" to the chat
  botProfit.sendMessage(chatId, "Connected");
});

botError.onText(/\/start/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  if (!botError_chatIDs.includes(chatId)) botError_chatIDs.push(chatId);

  // send back the matched "whatever" to the chat
  botError.sendMessage(chatId, "Connected");
});

botExtraAlert.onText(/\/start/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  if (!botExtraAlert_chanIDs.includes(chatId))
    botExtraAlert_chanIDs.push(chatId);

  // send back the matched "whatever" to the chat
  botExtraAlert.sendMessage(chatId, "Connected");
});

botStep.on("polling_error", (error) => {
  console.log(error.code); // => 'EFATAL'
});
