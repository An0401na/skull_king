const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const {
  createPlayer,
  createGameState,
  publicState,
  startRound,
  applyBid,
  applyPlay,
  advanceRound,
} = require('./game-engine');
const { aiChooseBid, aiChooseCard } = require('./ai-player');

const PORT = process.env.PORT || 3000;

/** 온라인 퀵채팅 — 클라이언트와 동일 목록만 허용 */
const ALLOWED_QUICK_CHAT = new Set([
  '스겜',
  '풉킼',
  '쫄?',
  'ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ',
  '한판더?',
  '장난장난ㅋ',
  '헐',
  '나이스',
  '미안!',
  '잠시만',
  '화이팅!',
  '억까;;;',
  '개빡집중',
  '어?',
  '이게되네',
  '레전드',
  '살려줘',
  '냠',
  'EZ',
  'ㅎㅇ',
  '방가방가'
]);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(__dirname));

const GAME_HTML = path.join(__dirname, 'skull_king_kraken_whale_fixed.html');

app.get('/health', (_req, res) => res.type('text').send('ok'));
app.get('/', (_req, res) => {
  res.sendFile(GAME_HTML, (err) => {
    if (err) res.status(500).send('Game file not found');
  });
});

const rooms = new Map();
const connections = new Map();
const WS_HEARTBEAT_INTERVAL_MS = 25000;
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  if (rooms.has(code)) return genRoomCode();
  return code;
}

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      avatar: p.avatar,
      isAi: !!p.isAi,
      connected: p.isAi ? true : connections.has(p.id),
    })),
    game: room.game ? publicState(room.game) : null,
  };
}

function playerIdx(room, playerId) {
  return room.players.findIndex((p) => p.id === playerId);
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function hasConnectedHuman(room) {
  return room.players.some((p) => !p.isAi && connections.has(p.id));
}

function connectedHumanPlayers(room) {
  return room.players.filter((p) => !p.isAi && connections.has(p.id));
}

function assignHostOrDelete(room) {
  const nextHost = connectedHumanPlayers(room)[0];
  if (!nextHost) {
    rooms.delete(room.code);
    return false;
  }
  room.hostId = nextHost.id;
  return true;
}

function removePlayerFromRoom(room, playerId) {
  const idx = playerIdx(room, playerId);
  if (idx < 0) return { removed: false, roomAlive: true };
  const [removed] = room.players.splice(idx, 1);
  if (removed && connections.get(removed.id)) connections.delete(removed.id);
  if (room.hostId === playerId && !assignHostOrDelete(room)) return { removed: true, roomAlive: false };
  if (!hasConnectedHuman(room)) {
    rooms.delete(room.code);
    return { removed: true, roomAlive: false };
  }
  return { removed: true, roomAlive: true };
}

function clearRoomCleanup(room) {
  if (room && room._cleanupTimer) {
    clearTimeout(room._cleanupTimer);
    room._cleanupTimer = null;
  }
}

function scheduleRoomCleanup(code, room) {
  clearRoomCleanup(room);
  if (hasConnectedHuman(room)) return;
  room._cleanupTimer = setTimeout(() => {
    const latest = rooms.get(code);
    if (latest && !hasConnectedHuman(latest)) rooms.delete(code);
  }, EMPTY_ROOM_TTL_MS);
}

function broadcastRoom(room, exceptId) {
  const payload = { type: 'room', room: publicRoom(room) };
  room.players.forEach((p) => {
    const ws = connections.get(p.id);
    if (ws && p.id !== exceptId) send(ws, payload);
  });
  if (exceptId) {
    const ws = connections.get(exceptId);
    if (ws) send(ws, payload);
  }
}

function sendGameState(room) {
  room.players.forEach((p, idx) => {
    const ws = connections.get(p.id);
    if (!ws) return;
    const hand = room.game ? room.game.players[idx].hand : [];
    send(ws, {
      type: 'game',
      state: publicState(room.game),
      hand,
      myIdx: idx,
    });
  });
}

function scheduleAiTurns(room) {
  if (!room.game) return;
  if (room._aiTimer) clearTimeout(room._aiTimer);
  room._aiTimer = setTimeout(() => {
    room._aiTimer = null;
    runAiTurnChain(room);
  }, 900);
}

function runAiTurnChain(room) {
  if (!room.game) return;
  const g = room.game;

  if (g.phase === 'bid') {
    const p = g.players[g.currentBidder];
    if (!p.isAi) return;
    const v = aiChooseBid(g, g.currentBidder);
    applyBid(g, g.currentBidder, v);
    sendGameState(room);
    scheduleAiTurns(room);
    return;
  }

  if (g.phase === 'play') {
    const exp = (g.trickLeader + g.currentTrick.length) % g.players.length;
    const p = g.players[exp];
    if (!p.isAi) return;
    const cid = aiChooseCard(g, exp);
    if (cid == null) return;
    applyPlay(g, exp, cid);
    sendGameState(room);
    scheduleAiTurns(room);
  }
}

function syncRoom(room) {
  room.players.forEach((p) => {
    const ws = connections.get(p.id);
    if (!ws) return;
    send(ws, { type: 'room', room: publicRoom(room) });
    if (room.game) {
      const idx = playerIdx(room, p.id);
      send(ws, {
        type: 'game',
        state: publicState(room.game),
        hand: room.game.players[idx].hand,
        myIdx: idx,
      });
    }
  });
}

function createRoom(hostId, hostName) {
  const code = genRoomCode();
  const host = createPlayer(hostId, hostName || '선장', 0);
  const room = {
    code,
    hostId,
    status: 'lobby',
    players: [host],
    game: null,
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, playerId, name) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: '방을 찾을 수 없습니다.' };
  if (room.status !== 'lobby') return { error: '이미 게임이 시작된 방입니다.' };
  if (room.players.length >= 6) return { error: '방이 가득 찼습니다.' };
  if (room.players.some((p) => p.id === playerId)) return { room };
  const slot = room.players.length;
  room.players.push(createPlayer(playerId, name || '선원 ' + (slot + 1), slot));
  return { room };
}

wss.on('connection', (ws) => {
  let playerId = genId();
  let roomCode = null;
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  send(ws, { type: 'hello', playerId });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', message: '잘못된 메시지입니다.' });
      return;
    }

    if (msg.type === 'create_room') {
      const name = (msg.name || '').trim().slice(0, 20) || '선장';
      playerId = msg.playerId || playerId;
      if (connections.has(playerId)) connections.get(playerId).close();
      connections.set(playerId, ws);
      const room = createRoom(playerId, name);
      roomCode = room.code;
      ws.playerId = playerId;
      ws.roomCode = roomCode;
      clearRoomCleanup(room);
      syncRoom(room);
      return;
    }

    if (msg.type === 'join_room') {
      const name = (msg.name || '').trim().slice(0, 20) || '선원';
      playerId = msg.playerId || playerId;
      if (connections.has(playerId)) connections.get(playerId).close();
      connections.set(playerId, ws);
      const result = joinRoom(msg.code, playerId, name);
      if (result.error) {
        send(ws, { type: 'error', message: result.error });
        return;
      }
      const room = result.room;
      roomCode = room.code;
      ws.playerId = playerId;
      ws.roomCode = roomCode;
      clearRoomCleanup(room);
      syncRoom(room);
      return;
    }

    if (msg.type === 'reconnect_room') {
      const code = String(msg.code || '').toUpperCase();
      const room = rooms.get(code);
      const requestedId = msg.playerId || playerId;
      if (!room || playerIdx(room, requestedId) < 0) {
        send(ws, { type: 'error', message: '이전 방에 재접속할 수 없습니다. 새로 방을 만들거나 코드로 다시 참가하세요.' });
        return;
      }
      playerId = requestedId;
      const oldWs = connections.get(playerId);
      if (oldWs && oldWs !== ws) oldWs.close();
      connections.set(playerId, ws);
      roomCode = room.code;
      ws.playerId = playerId;
      ws.roomCode = roomCode;
      clearRoomCleanup(room);
      syncRoom(room);
      scheduleAiTurns(room);
      return;
    }

    const room = roomCode ? rooms.get(roomCode) : rooms.get(ws.roomCode);
    if (!room) {
      send(ws, { type: 'error', message: '방에 참가하지 않았습니다.' });
      return;
    }
    playerId = ws.playerId || playerId;
    const idx = playerIdx(room, playerId);
    if (idx < 0) {
      send(ws, { type: 'error', message: '플레이어를 찾을 수 없습니다.' });
      return;
    }

    if (msg.type === 'set_name') {
      const name = (msg.name || '').trim().slice(0, 20);
      if (name) room.players[idx].name = name;
      syncRoom(room);
      return;
    }

    if (msg.type === 'add_ai') {
      if (room.hostId !== playerId) {
        send(ws, { type: 'error', message: '방장만 AI 선원을 추가할 수 있습니다.' });
        return;
      }
      if (room.status !== 'lobby') {
        send(ws, { type: 'error', message: '대기실에서만 추가할 수 있습니다.' });
        return;
      }
      if (room.players.length >= 6) {
        send(ws, { type: 'error', message: '방이 가득 찼습니다.' });
        return;
      }
      const slot = room.players.length;
      const botId = 'bot_' + crypto.randomBytes(6).toString('hex');
      room.players.push(createPlayer(botId, `AI 선원 ${slot + 1}`, slot, { isAi: true }));
      syncRoom(room);
      return;
    }

    if (msg.type === 'quick_chat') {
      const text = String(msg.text ?? '').trim();
      if (!ALLOWED_QUICK_CHAT.has(text)) return;
      const from = room.players[idx];
      const payload = {
        type: 'quick_chat',
        fromName: from.name,
        fromAvatar: from.avatar,
        text,
      };
      room.players.forEach((p) => {
        const pWs = connections.get(p.id);
        if (pWs) send(pWs, payload);
      });
      return;
    }

    if (msg.type === 'leave_room') {
      if (connections.get(playerId) === ws) connections.delete(playerId);
      const result = removePlayerFromRoom(room, playerId);
      ws.roomCode = null;
      roomCode = null;
      if (result.roomAlive) syncRoom(room);
      ws.close();
      return;
    }

    if (msg.type === 'start_game') {
      if (room.hostId !== playerId) {
        send(ws, { type: 'error', message: '방장만 게임을 시작할 수 있습니다.' });
        return;
      }
      room.players = room.players.filter((p) => p.isAi || connections.has(p.id));
      if (!room.players.some((p) => !p.isAi && connections.has(p.id))) {
        rooms.delete(room.code);
        return;
      }
      if (room.players.length < 2) {
        send(ws, { type: 'error', message: '최소 2명이 필요합니다.' });
        syncRoom(room);
        return;
      }
      if (!room.players.some((p) => p.id === room.hostId)) room.hostId = connectedHumanPlayers(room)[0].id;
      room.status = 'playing';
      room.game = createGameState(room.players);
      startRound(room.game);
      syncRoom(room);
      scheduleAiTurns(room);
      return;
    }

    if (!room.game) return;

    if (msg.type === 'bid') {
      const r = applyBid(room.game, idx, msg.value);
      if (!r.ok) {
        send(ws, { type: 'error', message: r.error });
        return;
      }
      sendGameState(room);
      scheduleAiTurns(room);
      return;
    }

    if (msg.type === 'play') {
      const r = applyPlay(room.game, idx, msg.cardId);
      if (!r.ok) {
        send(ws, { type: 'error', message: r.error });
        return;
      }
      sendGameState(room);
      scheduleAiTurns(room);
      return;
    }

    if (msg.type === 'advance_round') {
      const r = advanceRound(room.game);
      if (!r.ok) {
        send(ws, { type: 'error', message: r.error });
        return;
      }
      if (r.finished) room.status = 'finished';
      syncRoom(room);
      scheduleAiTurns(room);
      return;
    }
  });

  ws.on('close', () => {
    if (connections.get(playerId) === ws) connections.delete(playerId);
    const code = ws.roomCode || roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    syncRoom(room);
    scheduleRoomCleanup(code, room);
  });
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, WS_HEARTBEAT_INTERVAL_MS);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Skull King server listening on port ${PORT}`);
});
