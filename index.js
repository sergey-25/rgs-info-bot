const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cron = require("node-cron");
const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const { config } = require('dotenv');
config();
const token = process.env.TELEGRAM_TOKEN;

let users = {};
let messageSentToday = false;

// Replace 'YOUR_TOKEN' with your actual bot token

const googleAppsScriptUrl =
  "https://script.google.com/macros/s/AKfycbyJS-0PLYOI4sWKZoSIksivuQHH7LkkFXwT5f4XDl8Wk7cAOuy7KdTvKc20pC8dvRF_pw/exec";
const googleAppsScriptTreck =
  "https://script.google.com/macros/s/AKfycbyJS-0PLYOI4sWKZoSIksivuQHH7LkkFXwT5f4XDl8Wk7cAOuy7KdTvKc20pC8dvRF_pw/exec";

// Create a new bot instance
const bot = new TelegramBot(token, { polling: true });
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const commands = [
  { command: "start", description: "Запуск бота" },
  { command: "menu", description: "Меню" },
];
bot.setMyCommands(commands);

const mainMenuKeyboard = [
  ["📝 Створити запит на навчання", "📖 Інструкції"],
  ["ℹ️ Корисна інформація"],
  ["☎️ Контакт служби підтримки"],
  ["❌ Закрити меню"],
];

const instructionsMenuKeyboard = [
  ["🩺💻 Інструкція для кабінету лікаря"],
  ["🧑🏻‍⚕️💻 Інструкція для кабінету пацієнта до пк"],
  ["🧑🏻‍⚕️📱 Інструкція для пацієнта до мобільного пристрою"],
  ["⬅️ Повернутися до головного меню"],
];

const infoMenuKeyboard = [
  ["⚖️ Законодавство"],
  ["▶️ Youtube канал"],
  ["⬅️ Повернутися до головного меню"],
];

let chatId; // Define chatId variable outside the event listener

let isFetchingVideos = false; // Flag to indicate if videos are currently being fetched

async function fetchNewVideos() {
  try {
    // Check if videos are currently being fetched
    if (isFetchingVideos) {
      console.log("Videos are already being fetched. Skipping.");
      return [];
    }

    isFetchingVideos = true; // Set the flag to true to indicate that videos are being fetched

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://www.youtube.com/channel/UCkRDVvF3JtSTj-bUa6Jn9wA");

    const videoLinks = await page.$$eval("a#video-title", (links) =>
      links.map((link) => link.href)
    );
    const uploadDates = await page.$$eval(
      "div#metadata-line > span.style-scope.ytd-grid-video-renderer",
      (dates) => dates.map((date) => date.textContent)
    );
    console.log(uploadDates);
    await browser.close();

    // Check if uploadDates includes "часа", "час", or "часов"
    const hasHourUpload = uploadDates.some(
      (date) =>
        date.includes("часа") || date.includes("час") || date.includes("часов")
    );
    if (hasHourUpload) {
      // If uploadDates includes hour-related strings, send message with the first link from videoLinks
      if (videoLinks.length > 0) {
        const message = `New video uploaded:  ${videoLinks[0]}`;
        await bot.sendMessage(
          chatId,
          `У нашому YouTube каналі, RGS UKRAINE додане нове відео - ${videoLinks[0]}`
        );
        console.log(
          "Message sent for new video uploaded within the last hour."
        );
      } else {
        console.log("No video links available.");
      }
    } else {
      // Otherwise, process uploadDates normally
      const videosWithDates = videoLinks.map((link, index) => ({
        link,
        uploadDate: uploadDates[index],
      }));
      return videosWithDates;
    }
  } catch (error) {
    console.error("Error fetching new videos:", error);
    return [];
  } finally {
    // Reset the flag after fetching is complete or an error occurs
    isFetchingVideos = false;
  }
}

async function checkAndSendTodayVideos() {
  const videos = await fetchNewVideos();
}

const emailContent = {
  from: "rgs.info.ua@ukr.net",
  to: "", // This will be updated dynamically
  subject:
    "Інформація про інформаційний телеграм бот від телемедичної платформи Rehabilitation Gaming System",
  html: `
    <h1>Добрий день,</h1>
    <p>Ми раді представити вам нашого Telegram-бота - <a href="https://t.me/rgs_support_bot">RGS_Support_bot</a>!</p>
    <p>Наш бот надає інформацю та є помічником для Вас. Для початку користування ним просто перейдіть за посиланням <a href="https://t.me/rgs_support_bot">RGS_Support_bot</a>.</p>
    <p>Не соромтеся звертатися до нас, якщо у вас є які-небудь питання чи відгуки.</p>
    <p>З найкращими побажаннями,<br>Rehabilitation Gaming System</p>
    <p>Також ви можете почати користуватися ботом, скористувавшись QR кодом</p>
    <img src="https://drive.google.com/uc?id=1w_KBXWV9LwAxukNbCIBzQhMToJQupF3L" alt="QR code">
    `,
};

const emailList = ["s.kurylenko.mail@gmail.com"]; // Replace with your actual email list

// Function to send emails
async function sendEmails() {
  try {
    // Set up Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.ukr.net",
      port: 2525,
      secure: true, // true for 465, false for other ports
      auth: {
        user: "rgs.info.ua@ukr.net",
        pass: "rczVFGR208jytBOh",
      },
    });

    // Iterate over the email list
    for (const email of emailList) {
      // Update email content with recipient's email address
      emailContent.to = email;

      // Send email
      await transporter.sendMail(emailContent);

      console.log(`Email sent successfully to ${email}`);
    }
  } catch (error) {
    console.error("Error sending emails:", error);
  }
}

// 0 9 * * 1-5 */2 * * * * *
bot.on("text", async (msg) => {
  chatId = msg.chat.id;

  // cron.schedule("1 0 * * 1-5", async () => {
  //   const today = new Date();
  //   const dayOfWeek = today.getDay();

  //   if (dayOfWeek !== 0 && dayOfWeek !== 6 && !messageSentToday) {
  //     await bot.sendMessage(
  //       msg.chat.id,
  //       "Вітаємо і нагадуємо якщо, у Вас виникають питання або труднощі з використання платформи звертайтеся до служби підримки за номером телефону: +380634390602 чи електронною поштою - rgs.info.ua@ukr.net або за потребою створіть запит на навчання! Дякуємо і гарного дня."
  //     );
  //     await checkAndSendTodayVideos();
  //     messageSentToday = true; // Set the flag to true to indicate that a message has been sent today
  //   }
  // });
  // cron.schedule("59 23 * * 1-5", () => {
  //   messageSentToday = false;
  // });

  // console.log("Message received:", msg);

  try {
    switch (msg.text) {
      case "/start":
        await bot.sendChatAction(msg.chat.id, "typing");
        await sendStartMessage(msg);
        await checkId(msg);
        break;
      case "/start@rgs_support_bot":
        await bot.sendChatAction(msg.chat.id, "typing");
        await sendStartMessage(msg);
        break;
      case "/menu":
        await sendMainMenuMessage(msg);
        break;
        case "/menu@rgs_support_bot":
          await sendMainMenuMessage(msg);
          break;
      case "❌ Закрити меню":
        await closeMenu(msg);
        break;
      case "⬅️ Повернутися до головного меню":
        await sendMainMenuMessage(msg);
        break;
      case "📝 Створити запит на навчання":
        await bot.sendChatAction(msg.chat.id, "typing");
        await createTrainingRequest(msg);
        break;
      case "☎️ Контакт служби підтримки":
        await bot.sendChatAction(msg.chat.id, "typing");
        await sendSupportContact(msg);
        break;
      case "📖 Інструкції":
        await sendInstructionsMenu(msg);
        break;
      case "🩺💻 Інструкція для кабінету лікаря":
        await sendDocument(msg, "./files/Doctors_cabinet_instruction.pdf");
        break;
      case "🧑🏻‍⚕️💻 Інструкція для кабінету пацієнта до пк":
        await sendDocument(msg, "./files/Patients_cabinet_web_manual.pdf");
        break;
      case "🧑🏻‍⚕️📱 Інструкція для пацієнта до мобільного пристрою":
        await sendDocument(msg, "./files/Patients_mobile_app_manual.pdf");
        break;
      case "ℹ️ Корисна інформація":
        await sendInfoMenu(msg);
        break;
      case "⚖️ Законодавство":
        await bot.sendChatAction(msg.chat.id, "typing");
        await sendUsefulInfoMessage(msg);
        break;
      case "▶️ Youtube канал":
        await bot.sendChatAction(msg.chat.id, "typing");
        await sendMessages(msg, "text");
        break;
      case "send mails":
        await sendEmails(msg);
      default:
        // await bot.sendMessage(msg.chat.id, 'fsdfs');
        break;
    }
  } catch (error) {
    console.log(error);
  }
});

async function checkId(msg) {
  let keyboard = [...mainMenuKeyboard];
  const yourChatId = 546357192; // Convert chat ID to a number

  // Check if the message is from your chat.id
  console.log("Message Chat ID:", msg.chat.id);
  console.log("Your Chat ID:", yourChatId);

  if (msg.chat.id === yourChatId) {
    console.log("Chat IDs match. Adding 'send mails' button.");
    // Add the menu item only if the chatId matches yourChatId
    keyboard.push(["send mails"]);
    await bot.sendMessage(msg.chat.id, `/menu`, {
      reply_markup: { keyboard: keyboard, resize_keyboard: true },
    });
  }

  if (!users[msg.chat.id]) {
    users[msg.chat.id] = {
      id: msg.chat.id,
      username: msg.from.username,
      firstName: msg.from.first_name,
      lastName: msg.from.last_name,
      // Add more properties as needed
    };

    console.log("New user added:", users[msg.chat.id]);
    await saveToGoogleSheetsUsers(msg, users[msg.chat.id]);
  }
  logUserInformation();
}

async function saveToGoogleSheetsUsers(msg, data) {
  const payload = { data: data };
  await bot.sendChatAction(msg.chat.id, "typing");
  try {
    // Send the user data to Google Sheets
    const response = await axios.post(googleAppsScriptTreck, payload);
    console.log("Data appended to Google Sheets:", response.data);

    // Send a confirmation message to the user
    // await bot.sendMessage(msg.chat.id, "Your data has been successfully saved to Google Sheets.");
  } catch (error) {
    console.error("Error appending data to Google Sheets:", error);
    // await bot.sendMessage(msg.chat.id, "Error saving data to Google Sheets.");
  }
}

function logUserInformation() {
  console.log("Total users:", Object.keys(users).length);
  console.log("User details:");
  for (const userId in users) {
    console.log(users[userId]);
  }
}

async function sendStartMessage(msg) {
  if (msg.text && msg.text.length > 6) {
    const refID = msg.text.slice(7);
    await bot.sendMessage(
      msg.chat.id,
      `Ви зашли по посиланню користувача з ID ${refID}`
    );
  }

  const startMessage = `Цей бот створений для підтримки користувачів RGS. Меню доступне за командою /menu`;

  // Check if the bot has the necessary permissions to send messages
  const botInfo = await bot.getMe();
  console.log(botInfo); // Check if the bot has permission to send messages

  await bot.sendMessage(msg.chat.id, startMessage, {
    reply_markup: {
      keyboard: [],
      resize_keyboard: true,
      one_time_keyboard: true, // Show keyboard once
      request_contact: true, // Request access to contact
    },
  });
}

async function sendMainMenuMessage(msg) {
  await bot.sendMessage(msg.chat.id, `Меню бота`, {
    reply_markup: { keyboard: mainMenuKeyboard, resize_keyboard: true },
  });
}

async function closeMenu(msg) {
  await bot.sendMessage(msg.chat.id, "Меню закрито", {
    reply_markup: { remove_keyboard: true },
  });
}

async function sendSupportContact(msg) {
  const contactInfo = `

    📞 <b>Телефон:</b> +380634390602
    \n---------------------------------------

    📧 <b>Email:</b> rgs.info.ua@ukr.net
    `;

  await bot.sendMessage(msg.chat.id, contactInfo, { parse_mode: "HTML" });
}

async function sendInstructionsMenu(msg) {
  await bot.sendMessage(
    msg.chat.id,
    "Тут Ви зможете знайти інструкції по платформі.",
    {
      reply_markup: {
        keyboard: instructionsMenuKeyboard,
        resize_keyboard: true,
      },
    }
  );
}

async function sendInfoMenu(msg) {
  await bot.sendMessage(
    msg.chat.id,
    "Тут Ви зможете знайти додаткову інформацію по платформі.",
    {
      reply_markup: { keyboard: infoMenuKeyboard, resize_keyboard: true },
    }
  );
}

async function sendDocument(msg, path) {
  await bot.sendMessage(msg.chat.id, `Документ завантажується...`);
  await bot.sendDocument(msg.chat.id, path);
}

async function sendMessages(msg, text) {
  const linkToYoutube = ` 
    <b>Тут ви зможете знайти корисні для Вас відео</b>
    
    <a href="https://www.youtube.com/@serhii-qh4lw">Youtube канал RGS UKRAINE</a>`;
  await bot.sendMessage(msg.chat.id, linkToYoutube, { parse_mode: "HTML" });
}

async function sendUsefulInfoMessage(msg) {
  const infoMessage = `
  <b>Тут Ви зможете знайти корисну інформацію:</b>
 
  1. <a href="https://zakon.rada.gov.ua/laws/show/2801-12#Text">Основи законодавства України про охорону здоров’я, ст. 35-6</a>
  
  2. <a href="https://moz.gov.ua/article/ministry-mandates/nakaz-moz-ukraini-vid-09062022--994-pro-provedennja-testovoi-ekspluatacii-telemedichnih-platform-sistem-v-umovah-voennogo-stanu-v-ukraini">Наказ МОЗ України від 09.06.2022 № 994 «Про проведення тестової експлуатації телемедичних платформ (систем) в умовах воєнного стану в Україні»</a>

  3. <a href="https://moz.gov.ua/article/ministry-mandates/nakaz-moz-ukraini-vid-20062022--1062-pro-organizaciju-nadannja-medichnoi-dopomogi-iz-zastosuvannjam-telemedicini-v-umovah-voennogo-stanu">Наказ МОЗ України від 20.06.2022 № 1062 «Про організацію надання медичної допомоги із застосуванням телемедицини в умовах воєнного стану»</a>
  
  4. <a href="https://zakon.rada.gov.ua/laws/show/z1155-22#Text">Наказ МОЗ від 17.09.2022 № 1695 «Про затвердження Порядку надання медичної допомоги із застосуванням телемедицини, реабілітаційної допомоги із застосуванням телереабілітації на період дії воєнного стану в Україні або окремих її місцевостях»</a>

  5. <a href = "https://zakon.rada.gov.ua/laws/show/3301-20#Text">ЗАКОН УКРАЇНИ Про внесення змін до деяких законодавчих актів України щодо функціонування телемедицини</a>
  `;

  await bot.sendMessage(msg.chat.id, infoMessage, { parse_mode: "HTML" });
}

async function createTrainingRequest(msg) {
  const questions = [
    "Як до Вас звертатися? Вкажіть будь-ласка ПІБ: ",
    "Вкажіть назву Вашого закладу або Код ЄДРПОУ.",
    "Вкажіть вашу електронну адресу або номер телефону:",
    "Будь-ласка вкажіть дату та годину. Коли Вам буде зручно щоб ми з Вами зв'язалися?",
    "І останнє питання. Чи проводили з Вами навчання?",
  ];

  let answers = {};

  for (const question of questions) {
    await bot.sendChatAction(msg.chat.id, "typing");
    await bot.sendMessage(msg.chat.id, question);
    const response = await waitForReply(msg.chat.id);
    answers[question] = response.text;
  }

  // Optionally, you can save or process the collected answers here
  await saveToGoogleSheets(msg, answers);
}

async function saveToGoogleSheets(msg, data) {
  const payload = { data: data };
  await bot.sendChatAction(msg.chat.id, "typing");
  try {
    const response = await axios.post(googleAppsScriptUrl, payload);
    console.log("Data appended to Google Sheets:", response.data);

    // Send the application data back to the user
    let applicationMessage = "Your application details:\n\n";
    for (const [question, answer] of Object.entries(data)) {
      applicationMessage += `${question}: ${answer}\n`;
    }
    //   await bot.sendMessage(msg.chat.id, applicationMessage);
    await bot.sendMessage(
      msg.chat.id,
      "Дякуємо. Ваш запит успішно надіслано. Ми зв'яжемося з Вами найближчим часом."
    );
  } catch (error) {
    console.error("Error appending data to Google Sheets:", error);
    await bot.sendMessage(
      msg.chat.id,
      "Error saving application to Google Sheets."
    );
  }
}

// Function to wait for a reply from the user
function waitForReply(chatId) {
  return new Promise((resolve) => {
    bot.once("message", (msg) => {
      resolve(msg);
    });
  });
}
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});


const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

const webhookUrl = 'https://rgs-telegram-bot-b27a5d9c9991.herokuapp.com/webhook'; // Update with your deployed bot's URL
bot.setWebHook(`${webhookUrl}/bot${token}`);
