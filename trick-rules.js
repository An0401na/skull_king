/** Skull King 트릭 승자 판정 (로컬 HTML + game-engine 공용) */
const BLACK_SUIT = 'black';
const LEGACY_BLACK = 'purple';

function isBlackSuit(suit) {
  return suit === BLACK_SUIT || suit === LEGACY_BLACK;
}

function byPlayOrder(trick, type) {
  return trick.find((e) => e.card.type === type);
}

function filterType(trick, type) {
  return trick.filter((e) => e.card.type === type);
}

function winnerAmongNumbers(nums, trick, whaleMode) {
  if (!nums.length) return null;
  if (whaleMode) {
    const maxN = Math.max(...nums.map((e) => e.card.n));
    return nums.find((e) => e.card.n === maxN);
  }
  const blacks = nums.filter((e) => isBlackSuit(e.card.suit));
  if (blacks.length) return blacks.reduce((a, b) => (a.card.n > b.card.n ? a : b));
  const led = trick.find((e) => e.card.type === 'number');
  if (!led) return nums[0];
  const suitCards = nums.filter((e) => e.card.suit === led.card.suit);
  if (suitCards.length) return suitCards.reduce((a, b) => (a.card.n > b.card.n ? a : b));
  return led;
}

/**
 * 트릭 승자 (크라켄·흰고래는 resolveTrick에서 별도 처리)
 * @param {Array<{pIdx:number,card:object}>} trick
 * @param {boolean} whaleMode 흰고래 숫자-only 판정
 */
function determineTrickWinner(trick, whaleMode) {
  if (!trick.length) return trick[0];

  const escapes = filterType(trick, 'escape');
  if (escapes.length === trick.length) return escapes[0];

  const competing = trick.filter((e) => e.card.type !== 'escape');
  if (!competing.length) return trick[0];

  const skull = byPlayOrder(competing, 'skull');
  const pirates = filterType(competing, 'pirate');
  const mermaids = filterType(competing, 'mermaid');
  const hasSkull = !!skull;
  const hasPirate = pirates.length > 0;
  const hasMermaid = mermaids.length > 0;

  if (hasMermaid && hasSkull && hasPirate) return mermaids[0];
  if (hasMermaid && hasSkull) return mermaids[0];
  if (hasMermaid && hasPirate) return pirates[0];
  if (hasSkull && hasPirate) return skull;
  if (hasSkull) return skull;
  if (pirates.length) return pirates[0];
  if (mermaids.length) return mermaids[0];

  const nums = competing.filter((e) => e.card.type === 'number');
  const numWinner = winnerAmongNumbers(nums, competing, whaleMode);
  if (numWinner) return numWinner;

  return competing[0];
}

function getTrickLeaderCandidate(trick) {
  if (!trick.length) return null;

  if (trick.some((e) => e.card.type === 'kraken')) {
    return { entry: null, note: '🦑 크라켄 — 트릭이 끝나면 전원 패배' };
  }

  if (trick.some((e) => e.card.type === 'whale')) {
    const nums = trick.filter((e) => e.card.type === 'number');
    if (!nums.length) return { entry: null, note: '🐋 흰고래 — 숫자 카드 대기 중' };
    const maxN = Math.max(...nums.map((e) => e.card.n));
    const top = nums.filter((e) => e.card.n === maxN);
    return { entry: top[0], note: '🐋 흰고래 — 숫자 최고값' };
  }

  const allEscape = trick.every((e) => e.card.type === 'escape');
  if (allEscape) {
    return { entry: trick[0], note: '전원 탈출 — 먼저 낸 사람 우승' };
  }

  const entry = determineTrickWinner(trick, false);
  return { entry, note: null };
}

const skullKingRulesApi = {
  BLACK_SUIT,
  LEGACY_BLACK,
  isBlackSuit,
  determineTrickWinner,
  getTrickLeaderCandidate,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = skullKingRulesApi;
} else {
  globalThis.SkullKingRules = skullKingRulesApi;
}
