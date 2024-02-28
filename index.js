const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const { config } = require('dotenv');
config();
const token = process.env.TELEGRAM_TOKEN;
console.log(token)
const app = express();
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const commands = [
    { command: "start", description: "Запуск бота" },
    { command: "menu", description: "Меню" },
  ];
  bot.setMyCommands(commands);
async function insertDocument(document) {

    console.log(document)
}


  
const generateMenuMarkup = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate(); // Get the number of days in the specified month
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1); // Create an array of days in the month
  
    // Divide the days into rows of 7 buttons per row
    const rows = [];
    for (let i = 0; i < daysArray.length; i += 7) {
      rows.push(daysArray.slice(i, i + 7));
    }
  
    // Generate markup for each row of buttons
    const markupRows = rows.map(row => {
      return row.map(day => {
        return {
          text: day.toString(), // Button text is the day number
          callback_data: `select_date_${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` // Callback data contains the selected date
        };
      });
    });
  
    // Generate buttons for navigation to previous and next months
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
  
    const prevMonthButton = { text: '◀️', callback_data: `navigate_month_${prevYear}-${prevMonth.toString().padStart(2, '0')}` };
    const nextMonthButton = { text: '▶️', callback_data: `navigate_month_${nextYear}-${nextMonth.toString().padStart(2, '0')}` };
  
    markupRows.push([prevMonthButton, nextMonthButton]);
  
    return markupRows; // Return the array of arrays representing rows of buttons
  };


  // Function to wait for user response
function waitForReply(chatId) {
    return new Promise((resolve) => {
        bot.once("message", (msg) => {
            resolve(msg);
        });
    });
}
  
  let isFirstMenuCall = true;


  
async function waitForDateSelection(chatId) {
    // Function to wait for date selection
    return new Promise((resolve) => {
        bot.once("callback_query", async (callbackQuery) => {
            const callbackData = callbackQuery.data;
            if (callbackData.startsWith('select_date')) {
                const selectedDateIndex = callbackData.lastIndexOf('_');
                const selectedDate = callbackData.substring(selectedDateIndex + 1);
                console.log('Selected date:', selectedDate);
                resolve({ text: selectedDate });
            } else if (callbackData.startsWith('navigate_month')) {
                const yearMonthMatch = callbackData.match(/(\d{4})-(\d{2})$/);
                const year = yearMonthMatch ? parseInt(yearMonthMatch[1]) : new Date().getFullYear();
                const month = yearMonthMatch ? parseInt(yearMonthMatch[2]) : new Date().getMonth() + 1;

               

                const menuMarkup = generateMenuMarkup(year, month);

                await bot.editMessageText(`Оберіть день проведення навчання ${year}-${month.toString().padStart(2, '0')}:`, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    reply_markup: {
                        inline_keyboard: menuMarkup
                    }
                });

                // Re-listen for date selection after navigating to a new month
                waitForDateSelection(chatId).then(resolve);
            }
        });
    });
}




async function waitForTimeSelection(chatId) {
    // Function to wait for time selection
    return new Promise((resolve) => {
        let resolved = false; // Flag to track if callback has been resolved

        const callbackHandler = async (callbackQuery) => {
            if (resolved) return; // Ignore callback if already resolved
            const callbackData = callbackQuery.data;
            if (callbackData.startsWith('select_time')) {
                const selectedTimeIndex = callbackData.lastIndexOf('_');
                const selectedTime = callbackData.substring(selectedTimeIndex + 1);
                console.log('Selected time:', selectedTime);
                resolved = true; // Set the flag to indicate callback has been resolved
                bot.removeListener("callback_query", callbackHandler); // Remove the listener
                resolve({ text: selectedTime });
            }
        };

        bot.on("callback_query", callbackHandler);
    });
}





bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;

    if (isFirstMenuCall) {
        bot.sendMessage(chatId, 'Будь-ласка, вкажіть назву закладу:');

        const hospitalResponse = await waitForReply(chatId);
        const hospitalName = hospitalResponse.text;

        bot.sendMessage(chatId, 'Будь-ласка, вкажіть як до Вас звертатися (ПІБ):');

        const recipientResponse = await waitForReply(chatId);
        const recipientName = recipientResponse.text;

        bot.sendMessage(chatId, 'Будь-ласка, вкажіть ваш контактий номер телефону:');

        const recipientPhoneResponse = await waitForReply(chatId);
        const recipientPhone = recipientPhoneResponse.text;

        // isFirstMenuCall = false;

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const menuMarkup = generateMenuMarkup(currentYear, currentMonth);
        await bot.sendMessage(chatId, 'Оберіть дату проведення навчання:', {
             force_reply: true ,
            reply_markup: {
                inline_keyboard: menuMarkup
            }
        });

        const dateResponse = await waitForDateSelection(chatId);
        const timeOptions = [
            ['10:00 - 11:00', '11:00 - 12:00'],
            ['12:00 - 13:00', '13:00 - 14:00'],
            ['14:00 - 15:00', '15:00 - 16:00'],
            ['16:00 - 17:00', 'Your option']
        ];

        const timeOptionsMarkup = timeOptions.map(row => {
            return row.map(timeOption => {
                return {
                    text: timeOption,
                    callback_data: `select_time_${dateResponse.text}_${timeOption}`
                };
            });
        });

        await bot.sendMessage(chatId, `Та обіріть бажаний час${dateResponse.text}:`, {
            reply_markup: {
                inline_keyboard: timeOptionsMarkup
            }
        });

        const timeResponse = await waitForTimeSelection(chatId);


        bot.sendMessage(chatId, 'Вкажіть перелік учасників (ПІБ, Електронну адресу):');
        const presentResponse = await waitForReply(chatId);
        const trainingRequest = {
            hospitalName: hospitalName,
            recipientName: recipientName,
            recipientPhone: recipientPhone,
            date: dateResponse.text,
            time: timeResponse.text,
            participants: presentResponse.text
        };


        // Insert the document into MongoDB
        await insertDocument(trainingRequest);
        bot.sendMessage(chatId, 'Дякуюємо за запит!');
        // Here you can continue with other questions if needed
    } else {
        // Handling for subsequent menu calls
    }
});
  
  
  
  
  

// Handle webhook events
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(5500, () => {
  console.log('Server is running on port 5500');
});

const webhookUrl = 'https://rgs-telegram-bot-b27a5d9c9991.herokuapp.com/webhook'; // Update with your deployed bot's URL
bot.setWebHook(`${webhookUrl}/bot${token}`);