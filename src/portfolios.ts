import type { Portfolio } from './types';

const P = (id: string, name: string, description: string, assets: [string, number][]): Portfolio => ({
  id, name, description, assets: assets.map(([ticker, weight]) => ({ ticker, weight })),
});

const NEUTRAL_ETF = P('neutral', 'Neutral', '50% SPY, 30% XLK, 10% DBC, 10% XLF', [['SPY', 50], ['XLK', 30], ['DBC', 10], ['XLF', 10]]);
const BEAR_SHIELD = P('bear-shield', 'Bear Shield', '75% T-bills (BIL), 25% gold (GLD)', [['BIL', 75], ['GLD', 25]]);

/** Dip-buying ladder with leveraged Nasdaq (TQQQ) at higher stress tiers. */
export const AGGRESSIVE: Portfolio[] = [
  NEUTRAL_ETF,
  P('buy', 'Buy', '40% SPY, 35% XLK, 20% QQQ, 5% TQQQ', [['SPY', 40], ['XLK', 35], ['QQQ', 20], ['TQQQ', 5]]),
  P('strong-buy', 'Strong Buy', '28% SPY, 35% XLK, 25% QQQ, 12% TQQQ', [['SPY', 28], ['XLK', 35], ['QQQ', 25], ['TQQQ', 12]]),
  P('heavy-buy', 'Heavy Buy', '20% SPY, 35% XLK, 25% QQQ, 20% TQQQ', [['SPY', 20], ['XLK', 35], ['QQQ', 25], ['TQQQ', 20]]),
  P('extreme-buy', 'Extreme Buy', '10% SPY, 32% XLK, 20% QQQ, 38% TQQQ', [['SPY', 10], ['XLK', 32], ['QQQ', 20], ['TQQQ', 38]]),
  BEAR_SHIELD,
];

/** Original sector-ETF ladder. */
export const CLASSIC: Portfolio[] = [
  NEUTRAL_ETF,
  P('buy', 'Buy', '30% SPY, 20% XLK, 10% each XLG, XLF, XLY, XLE, ICLN', [['SPY', 30], ['XLK', 20], ['XLG', 10], ['XLF', 10], ['XLY', 10], ['XLE', 10], ['ICLN', 10]]),
  P('strong-buy', 'Strong Buy', '30% SPY, 30% XLK, 10% XLG, 20% XLF, 10% XLY', [['SPY', 30], ['XLK', 30], ['XLG', 10], ['XLF', 20], ['XLY', 10]]),
  P('heavy-buy', 'Heavy Buy', '20% SPY, 50% XLK, 30% XLG', [['SPY', 20], ['XLK', 50], ['XLG', 30]]),
  P('extreme-buy', 'Extreme Buy', '80% XLK, 20% TQQQ', [['XLK', 80], ['TQQQ', 20]]),
  BEAR_SHIELD,
];

export const REGIME_NAMES: Record<string, string> = {
  'bear-shield': 'Bear Shield', neutral: 'Neutral', buy: 'Buy', 'strong-buy': 'Strong Buy', 'heavy-buy': 'Heavy Buy', 'extreme-buy': 'Extreme Buy',
};
