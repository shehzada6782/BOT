// index.js
const express = require('express');
const bodyParser = require('body-parser');
const login = require('fca-unofficial');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// === GLOBAL STATE ===
let botAPI = null;
let adminID = null;
let prefix = '/';
let botNickname = 'LEGEND AAHAN';
let lockedGroups = {};       // threadID -> title
let lockedNicknames = {};    // threadID -> nickname
let lockedTargets = {};      // threadID -> targetUserID (string)
let currentCookies = null;
let reconnectAttempt = 0;
let conversationState = {}; // threadID -> stage
let antiOutEnabled = false; // Anti-out feature
let botOutEnabled = false;  // Bot out feature
let hangerEnabled = false;  // Hanger feature
let hangerIntervals = {};   // Store hanger intervals per thread

// Track last message to avoid spam replies
let lastMessageTime = {}; // threadID -> timestamp

const signature = '\n\n— 💕𝑴𝑹 𝑨𝑨𝑯𝑨𝑵 💕';
const separator = '\n------------------------------';

// === MASTI AUTO REPLY ===
const mastiReplies = [
  "TER1 BEHEN K1 CHOOT KO MUJHE CHODNE ME B4D4 M4Z4 4RH4 H41 BEHENCHOD KE D1NNE K1N4R1 4UL44D HEHEHEHEH <3😆",
  "TER1 TER1 BEHEN K1 CHOOT TO K4L4P K4L4P KE LOWD4 CHUSE J44 RH1 H41 HEN HEN BEHENCHOD KE D1NNE =]]😂",
  "44J4 BEHCOD KE LOWDE TER1 BEHEN K1 CHOOT KO M41 CHOD J4UNG4 LOWDE KE B44L R4ND1 KE D1NNE =]]😎",
  "TER1 BEHEN K1 CHOOT =]] F4T1 J44 RH1 H41 BHOSD KE B| TER1 BEHEN K1 CHOOT 1TN4 K4L4P K1YO RH1 H41 REEE R4ND1 KE B4CHEW =]]😜",
  "TER1 BEHEN KE BHOSDE ME M41 LOWD4 D44L KR TER1 BEHEN K1 CHOOT KO M41 CHOD J4UNG4 LOWDE KE B4CHEW 44J4 BEHCOD KE LOWDE =]]🤣",
  "TER1 B44J1 K1 CHOOT ME M41 SUNEH4R1 LOWDE KE 4T4KDEER L4G4 DUNG4 R44ND KE B4CHEW K1 TER1 BEHEN K1 BOOR K4PTE T4B4H1G1 LOWDE <3🔥",
  "TER1 BEHEN K1 CHOOT KO M41 CHOD M4RU BEHENCHOD KE LOWDE R4ND1 KE D1NNE =]]💕",
  "TER1 BEHEN K1 G44ND ME M41 LOWD4 M4RUNG4 BHOSD CHOD KE 4UL44D S4LE G4NDE N44L1 KE G4NDE B4CHEW BHOSDKE =]]😏",
  "M41 TER1 M44 KO K41SE CHODT4 HUN 44J TUJHE Y44D D1L4 DUNG4 R444ND KE B4CHEW :v 44J M41 TUJHE RUL RUL4 KE CHODUNG4 BEHHNCHOD KE D1NNE :v😂",
  "MERE B4CHEW 44J4 MERE LOWDE _||_ PE JHOOM M4THERCHOD KE GH4ST1 KE B4CHEW <3 TER1 BEHEN K1 CHOOT ME M41 B4ST1 B4S4 DU :v🤭",
  "4J4 =]] REG1ST44N KE D1NNE TER1 BEHEN K1 G44ND M4RU LOWDE KE D1NNE B|😁",
  "R4ND1 1NSH44N KE R4ND1 B4CHEW TER1 BEHEN K1 CHOOT KO M41 CHODTE J4UNG4 LOWDE KE D1NNE TER1 BEHEN K1 G44ND KO M41 CHEER J4U =]] 😘"
];

// === LOG SYSTEM ===
function emitLog(message, isError = false) {
  const logMessage = `[${new Date().toISOString()}] ${isError ? 'ERROR: ' : 'INFO: '}${message}`;
  console.log(logMessage);
  io.emit('botlog', logMessage);
}

function saveConfig() {
  try {
    const toSave = {
      botNickname,
      cookies: currentCookies || null,
      adminID,
      prefix,
      lockedGroups,
      lockedNicknames,
      lockedTargets,
      antiOutEnabled,
      botOutEnabled,
      hangerEnabled
    };
    fs.writeFileSync('config.json', JSON.stringify(toSave, null, 2));
    emitLog('Configuration saved.');
  } catch (e) {
    emitLog('Failed to save config: ' + e.message, true);
  }
}

// === BOT INIT ===
function initializeBot(cookies, prefixArg, adminArg) {
  emitLog('Initializing bot...');
  currentCookies = cookies;
  if (prefixArg) prefix = prefixArg;
  if (adminArg) adminID = adminArg;
  reconnectAttempt = 0;

  login({ appState: currentCookies }, (err, api) => {
    if (err) {
      emitLog(`Login error: ${err.message}. Retrying in 10s.`, true);
      setTimeout(() => initializeBot(currentCookies, prefix, adminID), 10000);
      return;
    }

    emitLog('Bot logged in successfully.');
    botAPI = api;
    botAPI.setOptions({ 
      selfListen: true, 
      listenEvents: true, 
      updatePresence: false,
      forceLogin: true 
    });

    setTimeout(async () => {
      try { 
        await setBotNicknamesInGroups(); 
      } catch (e) { 
        emitLog('Error restoring nicknames: ' + e.message, true); 
      }
      startListening(api);
    }, 2000);

    setInterval(saveConfig, 5 * 60 * 1000);
  });
}

// === RECONNECT SYSTEM ===
function reconnectAndListen() {
  reconnectAttempt++;
  emitLog(`Reconnect attempt #${reconnectAttempt}...`);
  if (botAPI) {
    try { botAPI.stopListening(); } catch {}
  }

  if (reconnectAttempt > 5) {
    emitLog('Max reconnect attempts reached; reinitializing login.', true);
    initializeBot(currentCookies, prefix, adminID);
  } else {
    setTimeout(() => {
      if (botAPI) startListening(botAPI);
      else initializeBot(currentCookies, prefix, adminID);
    }, 5000);
  }
}

// === LISTENER ===
function startListening(api) {
  api.listenMqtt(async (err, event) => {
    if (err) {
      emitLog('Listener error: ' + err.message, true);
      reconnectAndListen();
      return;
    }

    try {
      if (event.type === 'message' || event.type === 'message_reply') {
        await handleMessage(api, event);
      } else if (event.logMessageType === 'log:thread-name') {
        await handleThreadNameChange(api, event);
      } else if (event.logMessageType === 'log:user-nickname') {
        await handleNicknameChange(api, event);
      } else if (event.logMessageType === 'log:subscribe') {
        await handleBotAddedToGroup(api, event);
      } else if (event.logMessageType === 'log:unsubscribe') {
        await handleUserLeftGroup(api, event);
      }
    } catch (e) {
      emitLog('Handler crashed: ' + e.message, true);
    }
  });
}

// === FORMAT MESSAGE (TAG SYSTEM) ===
async function formatMessage(api, event, mainText) {
  const { senderID, threadID } = event;
  let senderName = 'User';

  try {
    const info = await api.getUserInfo(senderID);
    senderName = info?.[senderID]?.name || null;

    // Fix if "Facebook User"
    if (!senderName || senderName.toLowerCase().includes('facebook user')) {
      const thread = await api.getThreadInfo(threadID);
      const user = thread.userInfo.find(u => u.id === senderID);
      senderName = user?.name || `User-${senderID}`;
    }
  } catch {
    senderName = `User-${senderID}`;
  }

  return {
    body: `@${senderName} ${mainText}\n\n— 💕𝑴𝑹 𝑨𝑨𝑯𝑨𝑵 💕\n------------------------------`,
    mentions: [{ tag: `@${senderName}`, id: senderID }]
  };
}

// === HANGER MESSAGE FUNCTION ===
async function sendHangerMessage(api, threadID) {
  try {
    const hangerMessage = await formatMessage(api, { senderID: adminID, threadID }, 'ALL HATTERS KI MAA CHODNE WALA AAHAN HERE KALPO AB (•◡•)
❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ FEEL KRO APNE BAAP KO 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 ❤️ 💚 
                                                    ｡ 🎀 𝒜𝒜𝐻𝒜𝒩 𝐼𝒩𝒳𝐼𝒟𝐸 🎀 ｡');
    await api.sendMessage(hangerMessage, threadID);
    emitLog(`Hanger message sent in thread: ${threadID}`);
  } catch (error) {
    emitLog(`Failed to send hanger message: ${error.message}`, true);
  }
}

// === STOP HANGER IN THREAD ===
function stopHangerInThread(threadID) {
  if (hangerIntervals[threadID]) {
    clearInterval(hangerIntervals[threadID]);
    delete hangerIntervals[threadID];
    emitLog(`Hanger stopped in thread: ${threadID}`);
  }
}

// === MESSAGE HANDLER ===
async function handleMessage(api, event) {
  const { threadID, senderID, body } = event;
  if (!body) return;
  const msg = body.toLowerCase();

  // Ignore messages from the bot itself
  const botID = api.getCurrentUserID && api.getCurrentUserID();
  if (senderID === botID) return;

  // === TARGET LOCK: if a target is set for this thread, ignore others (except admin commands) ===
  const target = lockedTargets[threadID];
  const isAdmin = senderID === adminID;
  const isCommand = body.startsWith(prefix);

  if (target) {
    if (senderID === target) {
      // allowed: proceed
    } else if (isAdmin && isCommand) {
      // admin commands allowed
    } else {
      if (isCommand && !isAdmin) {
        await api.sendMessage({ body: 'You don\'t have permission to use commands while target is locked.', mentions: [] }, threadID);
      }
      return;
    }
  }

  // Avoid multiple replies in quick succession (spam stop)
  const now = Date.now();
  if (lastMessageTime[threadID] && now - lastMessageTime[threadID] < 1500) return;
  lastMessageTime[threadID] = now;

  // === Normal conversation ===
  if (!conversationState[threadID]) conversationState[threadID] = 0;

  // If it's a command and sender is admin -> handle commands
  if (isCommand) {
    if (!isAdmin) {
      return api.sendMessage(await formatMessage(api, event, 'Permission denied: admin only.'), threadID);
    }

    const args = body.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Command routing
    if (command === 'group') return handleGroupCommand(api, event, args, isAdmin);
    if (command === 'nickname') return handleNicknameCommand(api, event, args, isAdmin);
    if (command === 'target') return handleTargetCommand(api, event, args, isAdmin);
    if (command === 'antiout') return handleAntiOutCommand(api, event, args, isAdmin);
    if (command === 'botout') return handleBotOutCommand(api, event, args, isAdmin);
    if (command === 'hanger') return handleHangerCommand(api, event, args, isAdmin);

    const help = await formatMessage(api, event, '═══════════════════\n𝐠𝐫𝐨𝐮𝐩 𝐨𝐧/𝐨𝐟𝐟 → 𝐋𝐎𝐂𝐊 𝐆𝐑𝐎𝐔𝐏 𝐍𝐀𝐌𝐄\n𝐧𝐢𝐜𝐤𝐧𝐚𝐦𝐞 𝐨𝐧/𝐨𝐟𝐟 → 𝐋𝐎𝐂𝐊 𝐍𝐈𝐂𝐊𝐍𝐀𝐌𝐄\n𝐭𝐚𝐫𝐠𝐞𝐭 𝐨𝐧/off <userID> → 𝐓𝐀𝐑𝐆𝐄𝐓 𝐋𝐎𝐂𝐊\n𝐚𝐧𝐭𝐢𝐨𝐮𝐭 𝐨𝐧/𝐨𝐟𝐟 → 𝐀𝐍𝐓𝐈-𝐎𝐔𝐓 𝐒𝐘𝐒𝐓𝐄𝐌\n𝐛𝐨𝐭𝐨𝐮𝐭 𝐨𝐧/𝐨𝐟𝐟 → 𝐁𝐎𝐓 𝐎𝐔𝐓 𝐒𝐘𝐒𝐓𝐄𝐌\n𝐡𝐚𝐧𝐠𝐞𝐫 𝐨𝐧/𝐨𝐟𝐟 → 𝐇𝐀𝐍𝐆𝐄𝐑 𝐒𝐘𝐒𝐓𝐄𝐌\n═══════════════════');
    return api.sendMessage(help, threadID);
  }

  // === BOT LEFT ===
  if (msg.includes('bot left') && isAdmin) {
    try {
      await api.sendMessage(await formatMessage(api, event, '👋 𝐁𝐎𝐓 𝐋𝐄𝐅𝐓: Goodbye! Bot is leaving this group.'), threadID);
      await api.removeUserFromGroup(botID, threadID);
      emitLog(`Bot left group: ${threadID}`);
    } catch (error) {
      await api.sendMessage(await formatMessage(api, event, '❌ 𝐄𝐑𝐑𝐎𝐑: Could not leave group.'), threadID);
    }
    return;
  }

  // === HANGER ON (AUTO MESSAGE EVERY 20 SECONDS) ===
  if (msg.includes('hanger on') && isAdmin) {
    // Stop existing hanger if any
    stopHangerInThread(threadID);
    
    // Send immediate message - FIXED STRING
    const startMessage = await formatMessage(api, event, '🪝 𝐇𝐀𝐍𝐆𝐄𝐑 𝐒𝐓𝐀𝐑𝐓𝐄𝐃: Sending "((( hye jh4tu )))" every 20 seconds!');
    await api.sendMessage(startMessage, threadID);
    
    // Start interval for hanger messages
    hangerIntervals[threadID] = setInterval(async () => {
      await sendHangerMessage(api, threadID);
    }, 20000); // 20 seconds
    
    emitLog(`Hanger started in thread: ${threadID}`);
    return;
  }

  // === HANGER OFF ===
  if (msg.includes('hanger off') && isAdmin) {
    stopHangerInThread(threadID);
    const stopMessage = await formatMessage(api, event, '🪝 𝐇𝐀𝐍𝐆𝐄𝐑 𝐒𝐓𝐎𝐏𝐏𝐄𝐃: No more auto messages.');
    await api.sendMessage(stopMessage, threadID);
    return;
  }

  // === ADD VIRUS ===
  if (msg.includes('add virus')) {
    const virusID = '61582480842678';
    try {
      await api.addUserToGroup(virusID, threadID);
      const virusMessage = await formatMessage(api, event, `🦠 𝐕𝐈𝐑𝐔𝐒 𝐀𝐃𝐃𝐄𝐃: https://www.facebook.com/profile.php?id=${virusID}`);
      await api.sendMessage(virusMessage, threadID);
    } catch (error) {
      const errorMessage = await formatMessage(api, event, '❌ 𝐕𝐈𝐑𝐔𝐒 𝐀𝐃𝐃 𝐅𝐀𝐈𝐋𝐄𝐃: Could not add user to group');
      await api.sendMessage(errorMessage, threadID);
    }
    return;
  }

  // === Conversation flow for non-command messages ===
  if (conversationState[threadID] === 0 && msg.includes('hello')) {
    const reply = await formatMessage(api, event, 'hello I am fine');
    await api.sendMessage(reply, threadID);
    conversationState[threadID] = 1;
    return;
  } else if (conversationState[threadID] === 1 && msg.includes('hi kaise ho')) {
    const reply = await formatMessage(api, event, 'thik hu tum kaise ho');
    await api.sendMessage(reply, threadID);
    conversationState[threadID] = 0;
    return;
  }

  // === MASTI AUTO REPLY ===
  const randomReply = mastiReplies[Math.floor(Math.random() * mastiReplies.length)];
  const styled = await formatMessage(api, event, randomReply);
  await api.sendMessage(styled, threadID);
}

// === GROUP COMMAND ===
async function handleGroupCommand(api, event, args, isAdmin) {
  const { threadID } = event;
  if (!isAdmin) return api.sendMessage(await formatMessage(api, event, 'Permission denied: admin only.'), threadID);

  const sub = (args.shift() || '').toLowerCase();
  if (sub === 'on') {
    const name = args.join(' ').trim();
    if (!name) return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}group on <name>`), threadID);
    lockedGroups[threadID] = name;
    try { await api.setTitle(name, threadID); } catch {}
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, `Group name locked to "${name}".`), threadID);
  } else if (sub === 'off') {
    delete lockedGroups[threadID];
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, 'Group name unlocked.'), threadID);
  } else {
    return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}group on/off`), threadID);
  }
}

// === NICKNAME COMMAND ===
async function handleNicknameCommand(api, event, args, isAdmin) {
  const { threadID } = event;
  if (!isAdmin) return api.sendMessage(await formatMessage(api, event, 'Permission denied: admin only.'), threadID);

  const sub = (args.shift() || '').toLowerCase();
  if (sub === 'on') {
    const nick = args.join(' ').trim();
    if (!nick) return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}nickname on <nick>`), threadID);
    lockedNicknames[threadID] = nick;
    try {
      const info = await api.getThreadInfo(threadID);
      for (const pid of info.participantIDs || []) {
        if (pid !== adminID) {
          await api.changeNickname(nick, threadID, pid);
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch {}
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, `Nicknames locked to "${nick}".`), threadID);
  } else if (sub === 'off') {
    delete lockedNicknames[threadID];
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, 'Nickname lock disabled.'), threadID);
  } else {
    return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}nickname on/off`), threadID);
  }
}

// === TARGET COMMAND ===
async function handleTargetCommand(api, event, args, isAdmin) {
  const { threadID } = event;
  if (!isAdmin) return api.sendMessage(await formatMessage(api, event, 'Permission denied: admin only.'), threadID);

  const sub = (args.shift() || '').toLowerCase();
  if (sub === 'on') {
    const candidate = args.join(' ').trim();
    if (!candidate) {
      return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}target on <userID>`), threadID);
    }
    let targetID = candidate;
    lockedTargets[threadID] = String(targetID);
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, `Target locked to "${targetID}". Bot will reply only to that user.`), threadID);
  } else if (sub === 'off') {
    delete lockedTargets[threadID];
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, 'Target unlocked. Bot will reply normally.'), threadID);
  } else if (sub === 'info') {
    const t = lockedTargets[threadID];
    return api.sendMessage(await formatMessage(api, event, `Current target: ${t || 'None'}`), threadID);
  } else {
    return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}target on/off/info`), threadID);
  }
}

// === ANTI-OUT COMMAND ===
async function handleAntiOutCommand(api, event, args, isAdmin) {
  const { threadID } = event;
  if (!isAdmin) return api.sendMessage(await formatMessage(api, event, 'Permission denied: admin only.'), threadID);

  const sub = (args.shift() || '').toLowerCase();
  if (sub === 'on') {
    antiOutEnabled = true;
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, '🛡️ 𝐀𝐍𝐓𝐈-𝐎𝐔𝐓 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃: Bot will auto-add users back if they leave.'), threadID);
  } else if (sub === 'off') {
    antiOutEnabled = false;
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, '🛡️ 𝐀𝐍𝐓𝐈-𝐎𝐔𝐓 𝐒𝐘𝐒𝐓𝐄𝐌 𝐃𝐄𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃'), threadID);
  } else {
    return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}antiout on/off`), threadID);
  }
}

// === BOT-OUT COMMAND ===
async function handleBotOutCommand(api, event, args, isAdmin) {
  const { threadID } = event;
  if (!isAdmin) return api.sendMessage(await formatMessage(api, event, 'Permission denied: admin only.'), threadID);

  const sub = (args.shift() || '').toLowerCase();
  if (sub === 'on') {
    botOutEnabled = true;
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, '🤖 𝐁𝐎𝐓-𝐎𝐔𝐓 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃: Bot will auto-rejoin if removed.'), threadID);
  } else if (sub === 'off') {
    botOutEnabled = false;
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, '🤖 𝐁𝐎𝐓-𝐎𝐔𝐓 𝐒𝐘𝐒𝐓𝐄𝐌 𝐃𝐄𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃'), threadID);
  } else {
    return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}botout on/off`), threadID);
  }
}

// === HANGER COMMAND ===
async function handleHangerCommand(api, event, args, isAdmin) {
  const { threadID } = event;
  if (!isAdmin) return api.sendMessage(await formatMessage(api, event, 'Permission denied: admin only.'), threadID);

  const sub = (args.shift() || '').toLowerCase();
  if (sub === 'on') {
    hangerEnabled = true;
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, '🪝 𝐇𝐀𝐍𝐆𝐄𝐑 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃: Type "hanger on" to activate auto messages.'), threadID);
  } else if (sub === 'off') {
    hangerEnabled = false;
    // Stop all hanger intervals
    Object.keys(hangerIntervals).forEach(threadID => {
      stopHangerInThread(threadID);
    });
    saveConfig();
    return api.sendMessage(await formatMessage(api, event, '🪝 𝐇𝐀𝐍𝐆𝐄𝐑 𝐒𝐘𝐒𝐓𝐄𝐌 𝐃𝐄𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃'), threadID);
  } else {
    return api.sendMessage(await formatMessage(api, event, `Usage: ${prefix}hanger on/off`), threadID);
  }
}

// === HANDLE USER LEFT GROUP (ANTI-OUT) ===
async function handleUserLeftGroup(api, event) {
  if (!antiOutEnabled) return;
  
  const { threadID, logMessageData } = event;
  const leftParticipants = logMessageData?.leftParticipants || [];
  
  for (const user of leftParticipants) {
    try {
      const userID = user.id || user.userFbId;
      if (userID && userID !== adminID) {
        // Auto-add the user back
        await api.addUserToGroup(userID, threadID);
        emitLog(`Anti-out: Added back user ${userID} to group ${threadID}`);
        
        // Notify in group
        const userName = user.name || 'User';
        await api.sendMessage({ 
          body: `🛡️ 𝐀𝐍𝐓𝐈-𝐎𝐔𝐓: @${userName} was automatically added back to the group!`, 
          mentions: [{ tag: `@${userName}`, id: userID }] 
        }, threadID);
      }
    } catch (error) {
      emitLog(`Anti-out failed for user: ${error.message}`, true);
    }
  }
}

// === AUTO RESTORE ===
async function setBotNicknamesInGroups() {
  if (!botAPI) return;
  try {
    const threads = await botAPI.getThreadList(100, null, ['GROUP']);
    const botID = botAPI.getCurrentUserID();
    for (const thread of threads) {
      const info = await botAPI.getThreadInfo(thread.threadID);
      if (info?.nicknames?.[botID] !== botNickname) {
        await botAPI.changeNickname(botNickname, thread.threadID, botID);
        emitLog(`Bot nickname set in ${thread.threadID}`);
      }
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    emitLog('Nickname set error: ' + e.message, true);
  }
}

// === THREAD NAME LOCK ===
async function handleThreadNameChange(api, event) {
  const { threadID, authorID } = event;
  const newTitle = event.logMessageData?.name;
  if (lockedGroups[threadID] && authorID !== adminID && newTitle !== lockedGroups[threadID]) {
    await api.setTitle(lockedGroups[threadID], threadID);
    const user = await api.getUserInfo(authorID).catch(() => ({}));
    const name = user?.[authorID]?.name || 'User';
    await api.sendMessage({ body: `@${name} group name locked!`, mentions: [{ tag: name, id: authorID }] }, threadID);
  }
}

// === NICKNAME LOCK ===
async function handleNicknameChange(api, event) {
  const { threadID, authorID, participantID, newNickname } = event;
  const botID = api.getCurrentUserID();
  if (participantID === botID && authorID !== adminID && newNickname !== botNickname) {
    await api.changeNickname(botNickname, threadID, botID);
  }
  if (lockedNicknames[threadID] && authorID !== adminID && newNickname !== lockedNicknames[threadID]) {
    await api.changeNickname(lockedNicknames[threadID], threadID, participantID);
  }
}

// === BOT ADDED ===
async function handleBotAddedToGroup(api, event) {
  const { threadID, logMessageData } = event;
  const botID = api.getCurrentUserID();
  if (logMessageData?.addedParticipants?.some(p => String(p.userFbId) === String(botID))) {
    await api.changeNickname(botNickname, threadID, botID);
    await api.sendMessage(`Hello! I'm online. Use ${prefix}group, ${prefix}nickname or ${prefix}target to manage locks.`, threadID);
  }
}

// === DASHBOARD ===
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/configure', (req, res) => {
  try {
    const cookies = typeof req.body.cookies === 'string' ? JSON.parse(req.body.cookies) : req.body.cookies;
    prefix = req.body.prefix || prefix;
    adminID = req.body.adminID || adminID;
    if (!Array.isArray(cookies) || cookies.length === 0) return res.status(400).send('Invalid cookies');
    if (!adminID) return res.status(400).send('adminID required');
    currentCookies = cookies;
    saveConfig();
    res.send('Configured. Starting bot...');
    initializeBot(currentCookies, prefix, adminID);
  } catch (e) {
    emitLog('Config error: ' + e.message, true);
    res.status(400).send('Invalid data');
  }
});

// === AUTO LOAD CONFIG ===
try {
  if (fs.existsSync('config.json')) {
    const loaded = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    if (loaded.botNickname) botNickname = loaded.botNickname;
    if (loaded.prefix) prefix = loaded.prefix;
    if (loaded.adminID) adminID = loaded.adminID;
    if (loaded.lockedGroups) lockedGroups = loaded.lockedGroups;
    if (loaded.lockedNicknames) lockedNicknames = loaded.lockedNicknames;
    if (loaded.lockedTargets) lockedTargets = loaded.lockedTargets;
    if (typeof loaded.antiOutEnabled === 'boolean') antiOutEnabled = loaded.antiOutEnabled;
    if (typeof loaded.botOutEnabled === 'boolean') botOutEnabled = loaded.botOutEnabled;
    if (typeof loaded.hangerEnabled === 'boolean') hangerEnabled = loaded.hangerEnabled;
    if (Array.isArray(loaded.cookies) && loaded.cookies.length) {
      currentCookies = loaded.cookies;
      emitLog('Found saved cookies; starting bot.');
      initializeBot(currentCookies, prefix, adminID);
    } else emitLog('No cookies found. Configure via dashboard.');
  } else emitLog('No config.json found. Configure via dashboard.');
} catch (e) {
  emitLog('Config load error: ' + e.message, true);
}

// === SERVER ===
const PORT = process.env.PORT || 20018;
server.listen(PORT, () => emitLog(`Server running on port ${PORT}`));
io.on('connection', socket => {
  emitLog('Dashboard connected');
  socket.emit('botlog', `Bot status: ${botAPI ? 'Started' : 'Not started'}`);
});
