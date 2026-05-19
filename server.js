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

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(__dirname));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'skull_king_kraken_whale_fixed.html'));
});

const rooms = new Map();
const connections = new Map();

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
      connected: connections.has(p.id),
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
      connections.set(playerId, ws);
      const room = createRoom(playerId, name);
      roomCode = room.code;
      ws.playerId = playerId;
      ws.roomCode = roomCode;
      syncRoom(room);
      return;
    }

    if (msg.type === 'join_room') {
      const name = (msg.name || '').trim().slice(0, 20) || '선원';
      playerId = msg.playerId || playerId;
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
      syncRoom(room);
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

    if (msg.type === 'start_game') {
      if (room.hostId !== playerId) {
        send(ws, { type: 'error', message: '방장만 게임을 시작할 수 있습니다.' });
        return;
      }
      if (room.players.length < 2) {
        send(ws, { type: 'error', message: '최소 2명이 필요합니다.' });
        return;
      }
      room.status = 'playing';
      room.game = createGameState(room.players);
      startRound(room.game);
      syncRoom(room);
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
      return;
    }

    if (msg.type === 'play') {
      const r = applyPlay(room.game, idx, msg.cardId);
      if (!r.ok) {
        send(ws, { type: 'error', message: r.error });
        return;
      }
      sendGameState(room);
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
      return;
    }
  });

  ws.on('close', () => {
    connections.delete(playerId);
    const code = ws.roomCode || roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    syncRoom(room);
    if (room.players.every((p) => !connections.has(p.id))) {
      rooms.delete(code);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Skull King server listening on port ${PORT}`);
});
