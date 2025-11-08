// index.js
const express = require('express');
const bodyParser = require('body-parser');
const login = require('@dongdev/fca-unofficial');
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
let lockedGroups = {};
let lockedNicknames = {};
let lockedTargets = {};
let currentCookies = null;
let reconnectAttempt = 0;
let conversationState = {};
let antiOutEnabled = false;
let botOutEnabled = false;
let hangerEnabled = false;
let hangerIntervals = {};

// Track last message to avoid spam replies
let lastMessageTime = {};

const signature = '\n\n— 💕𝑴𝑹 𝑨𝑨𝑯𝑨𝑵 💕';
const separator = '\n------------------------------';

// === MASTI AUTO REPLY ===
const mastiReplies = [
  "TER1 BEHEN K1 CHOOT KO MUJHE CHODNE ME B4D4 M4Z4 4RH4 H41 BEHENCHOD KE D1NNE K1N4R1 4UL44D HEHEHEHEH <3😆",
  "TER1 TER1 BEHEN K1 CHOOT TO K4L4P K4L4P KE LOWD4 CHUSE J44 RH1 H41 HEN HEN BEHENCHOD KE D1NNE =]]😂",
  "44J4 BEHCOD KE LOWDE TER1 BEHEN K1 CHOOT KO M41 CHOD J4UNG4 LOWDE KE B44L R4ND1 KE D1NNE =]]😎",
  "TER1 BEHEN K1 CHOOT =]] F4T1 J44 RH1 H41 BHOSD KE B| TER1 BEHEN K1 CHOOT 1TN4 K4L4P K1YO RH1 H41 REEE R4ND1 KE B4CHEW =]]😜"
];

// === HANGER MESSAGES (SHORT VERSION) ===
const hangerMessages = [
  "💀 ALL HATTERS KI MAA CHODNE WALA AAHAN HERE 💀",
  "🔥 JH4NTU LOGO KO PEHCHANNE WALA AAHAN 🔥",
  "🎯 KALPO AB BETA AAHAN YAHAN 🎯",
  "⚡ FEEL KRO APNE BAAP KO ⚡",
  "💕 MR AAHAN INXIDE 💕"
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

    // === STARTUP MESSAGE ===
    setTimeout(async () => {
      try {
        // Send startup message to admin
        if (adminID) {
          const startupMsg = {
            body: `🤖 𝐁𝐎𝐓 𝐒𝐓𝐀𝐑𝐓𝐄𝐃 𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋𝐋𝐘!\n\n` +
                  `➤ 𝐁𝐨𝐭 𝐍𝐚𝐦𝐞: ${botNickname}\n` +
                  `➤ 𝐏𝐫𝐞𝐟𝐢𝐱: ${prefix}\n` +
                  `➤ 𝐀𝐝𝐦𝐢𝐧: ${adminID}\n` +
                  `➤ 𝐒𝐭𝐚𝐭𝐮𝐬: ✅ Online\n\n` +
                  `Type ${prefix}help for commands list.`
          };
          await api.sendMessage(startupMsg, adminID);
          emitLog('Startup message sent to admin.');
        }
        
        await setBotNicknamesInGroups(); 
      } catch (e) { 
        emitLog('Error in startup: ' + e.message, true); 
      }
      startListening(api);
    }, 3000);

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

// === HANGER MESSAGE FUNCTION (FIXED & SHORTER) ===
async function sendHangerMessage(api, threadID) {
  try {
    const randomMessage = hangerMessages[Math.floor(Math.random() * hangerMessages.length)];
    const hangerMessage = await formatMessage(api, { senderID: adminID, threadID }, randomMessage);
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
    if (command === 'help' || command === 'start') return handleHelpCommand(api, event, isAdmin);

    const help = await formatMessage(api, event, 'Unknown command. Type /help for commands list.');
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

  // === HANGER ON (AUTO MESSAGE EVERY 30 SECONDS) ===
  if ((msg.includes('hanger on') || msg.includes('hanger start')) && isAdmin) {
    // Stop existing hanger if any
    stopHangerInThread(threadID);
    
    // Send immediate message
    const startMessage = await formatMessage(api, event, '🪝 𝐇𝐀𝐍𝐆𝐄𝐑 𝐒𝐓𝐀𝐑𝐓𝐄𝐃: Auto messages every 30 seconds!');
    await api.sendMessage(startMessage, threadID);
    
    // Start interval for hanger messages (30 seconds)
    hangerIntervals[threadID] = setInterval(async () => {
      await sendHangerMessage(api, threadID);
    }, 30000);
    
    emitLog(`Hanger started in thread: ${threadID}`);
    return;
  }

  // === HANGER OFF ===
  if ((msg.includes('hanger off') || msg.includes('hanger stop')) && isAdmin) {
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

// === HELP COMMAND ===
async function handleHelpCommand(api, event, isAdmin) {
  const { threadID } = event;
  if (!isAdmin) return api.sendMessage(await formatMessage(api, event, 'Permission denied: admin only.'), threadID);

  const helpMessage = await formatMessage(api, event, 
    '🤖 𝐁𝐎𝐓 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:\n\n' +
    '➤ /group on/off <name> - Lock group name\n' +
    '➤ /nickname on/off <nick> - Lock nicknames\n' +
    '➤ /target on/off <userID> - Target lock\n' +
    '➤ /antiout on/off - Anti-out system\n' +
    '➤ /botout on/off - Bot-out system\n' +
    '➤ /hanger on/off - Auto messages\n' +
    '➤ /help - This menu\n\n' +
    '𝐍𝐨𝐧-𝐂𝐨𝐦𝐦𝐚𝐧𝐝𝐬:\n' +
    '• "bot left" - Bot leaves group\n' +
    '• "add virus" - Add virus user\n' +
    '• Normal chat - Auto replies'
  );
  return api.sendMessage(helpMessage, threadID);
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
    
    // Start hanger immediately in this thread
    stopHangerInThread(threadID);
    const startMessage = await formatMessage(api, event, '🪝 𝐇𝐀𝐍𝐆𝐄𝐑 𝐒𝐓𝐀𝐑𝐓𝐄𝐃: Auto messages every 30 seconds!');
    await api.sendMessage(startMessage, threadID);
    
    hangerIntervals[threadID] = setInterval(async () => {
      await sendHangerMessage(api, threadID);
    }, 30000);
    
    return api.sendMessage(await formatMessage(api, event, '🪝 𝐇𝐀𝐍𝐆𝐄𝐑 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃'), threadID);
  } else if (sub === 'off') {
    hangerEnabled = false;
    stopHangerInThread(threadID);
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
        await api.addUserToGroup(userID, threadID);
        emitLog(`Anti-out: Added back user ${userID} to group ${threadID}`);
        
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
    const welcomeMsg = await formatMessage(api, event, 
      '🤖 𝐁𝐎𝐓 𝐀𝐃𝐃𝐄𝐃 𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋𝐋𝐘!\n\n' +
      `➤ 𝐁𝐨𝐭: ${botNickname}\n` +
      `➤ 𝐏𝐫𝐞𝐟𝐢𝐱: ${prefix}\n` +
      `➤ 𝐀𝐝𝐦𝐢𝐧: ${adminID}\n\n` +
      `Type ${prefix}help for commands list.`
    );
    await api.sendMessage(welcomeMsg, threadID);
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
