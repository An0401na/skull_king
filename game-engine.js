const SUITS = ['red', 'blue', 'yellow', 'purple'];

function buildDeck() {
  const d = [];
  SUITS.forEach((s) => {
    for (let n = 1; n <= 14; n++) d.push({ type: 'number', suit: s, n, id: s + n });
  });
  for (let i = 0; i < 5; i++) d.push({ type: 'escape', id: 'esc' + i, n: 0 });
  for (let i = 0; i < 5; i++) d.push({ type: 'pirate', id: 'p' + i, name: '해적', n: 15 });
  for (let i = 0; i < 2; i++) d.push({ type: 'mermaid', id: 'm' + i, n: 0 });
  d.push({ type: 'skull', id: 'skull', n: 16 });
  d.push({ type: 'kraken', id: 'kraken', n: 0 });
  d.push({ type: 'whale', id: 'whale', n: 0 });
  return d;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function determineTrickWinner(trick, whaleMode) {
  const skull = trick.find((e) => e.card.type === 'skull');
  if (skull) return skull;
  const pirates = trick.filter((e) => e.card.type === 'pirate');
  if (pirates.length) return pirates[0];
  const mermaids = trick.filter((e) => e.card.type === 'mermaid');
  if (mermaids.length) return mermaids[0];
  const nums = trick.filter((e) => e.card.type === 'number');
  if (!nums.length) return trick[0];
  if (whaleMode) {
    const maxN = Math.max(...nums.map((e) => e.card.n));
    return nums.find((e) => e.card.n === maxN);
  }
  const blacks = nums.filter((e) => e.card.suit === 'purple');
  if (blacks.length) return blacks.reduce((a, b) => (a.card.n > b.card.n ? a : b));
  const led = trick.find((e) => e.card.type === 'number');
  const suitCards = nums.filter((e) => e.card.suit === led.card.suit);
  if (suitCards.length) return suitCards.reduce((a, b) => (a.card.n > b.card.n ? a : b));
  return led;
}

function createPlayer(id, name, slot) {
  const AVATARS = ['🦜', '🐙', '🦈', '🐚', '⚓', '🐠'];
  const PCOLORS = ['#c94040', '#4070c9', '#c9a020', '#9040c9', '#40a960', '#c96040'];
  return {
    id,
    name,
    slot,
    avatar: AVATARS[slot],
    color: PCOLORS[slot],
    score: 0,
    roundScores: [],
    hand: [],
    tricksWon: 0,
    bonusPoints: 0,
  };
}

function createGameState(players) {
  return {
    status: 'playing',
    players,
    totalRounds: 10,
    round: 1,
    roundHistory: [],
    phase: 'bid',
    bids: {},
    currentBidder: 0,
    currentTrick: [],
    trickCount: 0,
    trickLeader: 0,
    activePlayerIdx: 0,
    lastTrickResult: null,
    roundSummary: null,
    log: [],
  };
}

function publicPlayer(p, idx, game) {
  return {
    id: p.id,
    name: p.name,
    slot: idx,
    avatar: p.avatar,
    color: p.color,
    score: p.score,
    roundScores: p.roundScores,
    handCount: p.hand.length,
    tricksWon: p.tricksWon || 0,
    bonusPoints: p.bonusPoints || 0,
  };
}

function publicState(game) {
  return {
    status: game.status,
    totalRounds: game.totalRounds,
    round: game.round,
    roundHistory: game.roundHistory,
    phase: game.phase,
    bids: game.bids,
    currentBidder: game.currentBidder,
    currentTrick: game.currentTrick,
    trickCount: game.trickCount,
    trickLeader: game.trickLeader,
    activePlayerIdx: game.activePlayerIdx,
    players: game.players.map((p, i) => publicPlayer(p, i, game)),
    lastTrickResult: game.lastTrickResult,
    roundSummary: game.roundSummary,
    log: game.log.slice(0, 5),
  };
}

function addLog(game, msg) {
  game.log.unshift(msg);
  if (game.log.length > 5) game.log.length = 5;
}

function startRound(game) {
  game.bids = {};
  game.currentTrick = [];
  game.trickCount = 0;
  game.trickLeader = 0;
  game.currentBidder = 0;
  game.activePlayerIdx = 0;
  game.phase = 'bid';
  game.lastTrickResult = null;
  game.roundSummary = null;
  const deck = shuffle(buildDeck());
  game.players.forEach((p, i) => {
    p.hand = deck.slice(i * game.round, (i + 1) * game.round);
    p.tricksWon = 0;
    p.bonusPoints = 0;
  });
}

function resolveTrick(game) {
  const trick = game.currentTrick;
  const hasKraken = trick.some((e) => e.card.type === 'kraken');
  const hasWhale = trick.some((e) => e.card.type === 'whale');
  let result = { type: 'normal', message: '', winnerIdx: null, nextLeader: game.trickLeader, bonus: 0 };

  if (hasKraken) {
    const withoutKraken = trick.filter((e) => e.card.type !== 'kraken');
    let nextLeader = game.trickLeader;
    if (withoutKraken.length > 0) nextLeader = determineTrickWinner(withoutKraken, false).pIdx;
    result = {
      type: 'kraken',
      message: '크라켄 — 전원 패배',
      winnerIdx: null,
      nextLeader,
    };
    addLog(game, `트릭 ${game.trickCount + 1}: 크라켄 — 전원 패배`);
    game.trickCount++;
    game.trickLeader = nextLeader;
    game.currentTrick = [];
    game.activePlayerIdx = nextLeader;
    game.lastTrickResult = result;
    return game.trickCount >= game.round;
  }

  if (hasWhale) {
    const whalePIdx = trick.find((e) => e.card.type === 'whale').pIdx;
    const numCards = trick.filter((e) => e.card.type === 'number');
    if (numCards.length === 0) {
      result = {
        type: 'whale',
        message: '흰고래 — 특수만 있어 전원 패배',
        winnerIdx: null,
        nextLeader: whalePIdx,
      };
      addLog(game, `트릭 ${game.trickCount + 1}: 흰고래 — 특수만 있어 전원 패배`);
      game.trickCount++;
      game.trickLeader = whalePIdx;
      game.currentTrick = [];
      game.activePlayerIdx = whalePIdx;
      game.lastTrickResult = result;
      return game.trickCount >= game.round;
    }
    const maxN = Math.max(...numCards.map((e) => e.card.n));
    const topCards = numCards.filter((e) => e.card.n === maxN);
    const winner = topCards[0];
    const winnerP = game.players[winner.pIdx];
    winnerP.tricksWon = (winnerP.tricksWon || 0) + 1;
    result = {
      type: 'whale',
      message: '흰고래 — ' + winnerP.name + ' 승리',
      winnerIdx: winner.pIdx,
      nextLeader: winner.pIdx,
    };
    addLog(game, `트릭 ${game.trickCount + 1}: 흰고래 — ${winnerP.name} 승리`);
    game.trickCount++;
    game.trickLeader = winner.pIdx;
    game.currentTrick = [];
    game.activePlayerIdx = winner.pIdx;
    game.lastTrickResult = result;
    return game.trickCount >= game.round;
  }

  const winner = determineTrickWinner(trick, false);
  const winnerP = game.players[winner.pIdx];
  winnerP.tricksWon = (winnerP.tricksWon || 0) + 1;
  let bonus = 0;
  const hasPirate = trick.some((e) => e.card.type === 'pirate');
  const hasMermaid = trick.some((e) => e.card.type === 'mermaid');
  if (winner.card.type === 'skull') {
    if (hasPirate) bonus += 30 * trick.filter((e) => e.card.type === 'pirate').length;
    if (hasMermaid) bonus += 20;
  }
  if (winner.card.type === 'pirate' && hasMermaid) bonus += 20;
  if (winner.card.type === 'number' && winner.card.n === 14) bonus += 10;
  winnerP.bonusPoints = (winnerP.bonusPoints || 0) + bonus;
  result = {
    type: 'normal',
    message: winnerP.name + ' 승리',
    winnerIdx: winner.pIdx,
    nextLeader: winner.pIdx,
    bonus,
  };
  addLog(game, `트릭 ${game.trickCount + 1}: ${winnerP.name} 획득`);
  game.trickCount++;
  game.trickLeader = winner.pIdx;
  game.currentTrick = [];
  game.activePlayerIdx = winner.pIdx;
  game.lastTrickResult = result;
  return game.trickCount >= game.round;
}

function endRound(game) {
  const res = [];
  game.players.forEach((p, i) => {
    const bid = game.bids[i];
    const won = p.tricksWon || 0;
    const bonus = p.bonusPoints || 0;
    let pts = 0;
    if (bid === 0) pts = won === 0 ? game.round * 10 : -(game.round * 10);
    else pts = won === bid ? bid * 20 + bonus : -Math.abs(bid - won) * 10;
    p.score += pts;
    res.push({ name: p.name, bid, won, pts, bonus });
    p.roundScores.push(pts);
  });
  game.roundHistory.push(res);
  game.phase = 'round_end';
  game.roundSummary = res;
  if (game.round >= game.totalRounds) game.status = 'finished';
}

function startPlayPhase(game) {
  game.phase = 'play';
  game.currentTrick = [];
  game.trickCount = 0;
  game.trickLeader = 0;
  game.activePlayerIdx = 0;
}

function applyBid(game, playerIdx, value) {
  if (game.phase !== 'bid') return { ok: false, error: '입찰 단계가 아닙니다.' };
  if (playerIdx !== game.currentBidder) return { ok: false, error: '지금은 당신 차례가 아닙니다.' };
  if (value < 0 || value > game.round) return { ok: false, error: '잘못된 입찰입니다.' };
  game.bids[playerIdx] = value;
  game.currentBidder++;
  game.activePlayerIdx = game.currentBidder;
  if (game.currentBidder >= game.players.length) {
    startPlayPhase(game);
  }
  return { ok: true };
}

function applyPlay(game, playerIdx, cardId) {
  if (game.phase !== 'play') return { ok: false, error: '플레이 단계가 아닙니다.' };
  const expected = (game.trickLeader + game.currentTrick.length) % game.players.length;
  if (playerIdx !== expected) return { ok: false, error: '지금은 당신 차례가 아닙니다.' };
  const p = game.players[playerIdx];
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) return { ok: false, error: '패에 없는 카드입니다.' };
  p.hand = p.hand.filter((c) => c.id !== cardId);
  game.currentTrick.push({ pIdx: playerIdx, card, playOrder: game.currentTrick.length });
  if (game.currentTrick.length >= game.players.length) {
    const roundDone = resolveTrick(game);
    if (roundDone) endRound(game);
  } else {
    game.activePlayerIdx = (game.trickLeader + game.currentTrick.length) % game.players.length;
  }
  return { ok: true };
}

function advanceRound(game) {
  if (game.phase !== 'round_end') return { ok: false, error: '라운드 종료 상태가 아닙니다.' };
  if (game.status === 'finished') return { ok: true, finished: true };
  game.round++;
  startRound(game);
  return { ok: true, finished: false };
}

module.exports = {
  buildDeck,
  shuffle,
  determineTrickWinner,
  createPlayer,
  createGameState,
  publicState,
  startRound,
  endRound,
  applyBid,
  applyPlay,
  advanceRound,
};
