/**
 * 간단한 AI 입찰/플레이 (서버 + 브라우저 공용).
 * 브라우저: trick-rules.js 다음에 로드 → SkullKingRules 사용.
 */
const _determineTrickWinner =
  typeof module !== 'undefined' && module.exports
    ? require('./trick-rules').determineTrickWinner
    : globalThis.SkullKingRules && globalThis.SkullKingRules.determineTrickWinner;

function isBlackish(card) {
  return card.type === 'number' && (card.suit === 'black' || card.suit === 'purple');
}

/** 완성된 트릭 한 번의 승자 (게임 엔진과 동일한 판정, 상태 변경 없음) */
function peekTrickOutcome(trick) {
  const hasKraken = trick.some((e) => e.card.type === 'kraken');
  const hasWhale = trick.some((e) => e.card.type === 'whale');

  if (hasKraken) {
    const withoutKraken = trick.filter((e) => e.card.type !== 'kraken');
    let nextLeader = trick[0].pIdx;
    if (withoutKraken.length > 0) nextLeader = _determineTrickWinner(withoutKraken, false).pIdx;
    return { winnerIdx: null, nextLeader };
  }

  if (hasWhale) {
    const whalePIdx = trick.find((e) => e.card.type === 'whale').pIdx;
    const numCards = trick.filter((e) => e.card.type === 'number');
    if (numCards.length === 0) return { winnerIdx: null, nextLeader: whalePIdx };
    const maxN = Math.max(...numCards.map((e) => e.card.n));
    const topCards = numCards.filter((e) => e.card.n === maxN);
    const w = topCards[0].pIdx;
    return { winnerIdx: w, nextLeader: w };
  }

  const w = _determineTrickWinner(trick, false).pIdx;
  return { winnerIdx: w, nextLeader: w };
}

function cardAggression(card) {
  if (card.type === 'skull') return 100;
  if (card.type === 'pirate') return 72;
  if (card.type === 'mermaid') return 58;
  if (card.type === 'number') {
    const boost = isBlackish(card) ? 48 : 28;
    return boost + card.n;
  }
  if (card.type === 'escape') return 4;
  if (card.type === 'whale') return 26;
  if (card.type === 'kraken') return 12;
  return 18;
}

function sortHandByAggression(hand, descending) {
  const arr = [...hand];
  arr.sort((a, b) => cardAggression(b) - cardAggression(a));
  return descending ? arr : arr.reverse();
}

function aiChooseBid(game, playerIdx) {
  const hand = game.players[playerIdx].hand;
  const r = game.round;
  let est = 0;
  for (const c of hand) {
    if (c.type === 'number') {
      if (isBlackish(c)) {
        if (c.n >= 11) est += 0.58;
        else if (c.n >= 8) est += 0.28;
      } else if (c.n >= 13) est += 0.52;
      else if (c.n >= 10) est += 0.32;
      else if (c.n >= 7) est += 0.12;
    } else if (c.type === 'pirate') est += 0.52;
    else if (c.type === 'skull') est += 1.05;
    else if (c.type === 'mermaid') est += 0.28;
    else if (c.type === 'kraken' || c.type === 'whale') est -= 0.12;
  }
  est += Math.random() * 1.2 - 0.45;
  let b = Math.round(est);
  if (b < 0) b = 0;
  if (b > r) b = r;
  return b;
}

function aiChooseCard(game, playerIdx) {
  const trick = game.currentTrick;
  const hand = game.players[playerIdx].hand;
  if (!hand.length) return null;

  const bid = game.bids[playerIdx];
  const tw = game.players[playerIdx].tricksWon || 0;
  const tricksLeft = game.round - game.trickCount;
  const need = bid - tw;
  const wantWin = need > 0 || (need === 0 && tricksLeft <= 2 && Math.random() < 0.35);

  const n = game.players.length;
  const isLast = trick.length === n - 1;

  const tryPick = (predicate) => {
    for (const c of hand) {
      if (predicate(c)) return c.id;
    }
    return null;
  };

  if (isLast) {
    let bestId = null;
    if (wantWin) {
      for (const card of hand) {
        const full = trick.concat([{ pIdx: playerIdx, card, playOrder: trick.length }]);
        const { winnerIdx } = peekTrickOutcome(full);
        if (winnerIdx === playerIdx) {
          const ag = cardAggression(card);
          if (bestId == null) bestId = { id: card.id, ag };
          else if (ag < bestId.ag) bestId = { id: card.id, ag };
        }
      }
      if (bestId) return bestId.id;
      return sortHandByAggression(hand, true)[0].id;
    }
    for (const card of sortHandByAggression(hand, false)) {
      const full = trick.concat([{ pIdx: playerIdx, card, playOrder: trick.length }]);
      const { winnerIdx } = peekTrickOutcome(full);
      if (winnerIdx !== playerIdx) return card.id;
    }
    return hand[0].id;
  }

  if (!wantWin) {
    const esc = tryPick((c) => c.type === 'escape');
    if (esc) return esc;
    const low = sortHandByAggression(hand, false);
    return low[0].id;
  }

  const hi = sortHandByAggression(hand, true);
  if (Math.random() < 0.2 && hi.length > 1) return hi[1].id;
  return hi[0].id;
}

const api = { aiChooseBid, aiChooseCard, peekTrickOutcome };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
globalThis.SkullKingAi = api;
