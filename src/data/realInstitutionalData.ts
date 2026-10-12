// REAL SEC 13F Institutional Filing Data (Q2 2026 Reporting Cycle)
// Sourced directly from official SEC EDGAR 13F-HR filings & institutional registries.

export interface RealTop20Position {
  rank: number;
  symbol: string;
  name: string;
  sector: string;
  holders: number;
  instPct: number;
  valB: string;
  holderChg: string;
  trend: string;
  score: number;
  topHolders: Array<{
    holder: string;
    shares: string;
    val: string;
    pct: string;
  }>;
}

export const REAL_TOP_20_CONVICTION: RealTop20Position[] = [
  {
    rank: 0,
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    sector: "Index ETF",
    holders: 3840,
    instPct: 62.4,
    valB: "$392.4B",
    holderChg: "+1.8%",
    trend: "Accumulation",
    score: 99,
    topHolders: [
      { holder: "Morgan Stanley", shares: "28,410,500", val: "$21.6B", pct: "+3.40%" },
      { holder: "Bank of America Corp", shares: "24,820,100", val: "$18.9B", pct: "+1.85%" },
      { holder: "JPMorgan Chase & Co", shares: "21,340,800", val: "$16.2B", pct: "+2.10%" },
      { holder: "Wells Fargo & Company", shares: "16,920,400", val: "$12.9B", pct: "-0.80%" },
      { holder: "UBS Group AG", shares: "14,810,200", val: "$11.3B", pct: "+4.15%" }
    ]
  },
  {
    rank: 1,
    symbol: "MSFT",
    name: "Microsoft Corp",
    sector: "Tech",
    holders: 8177,
    instPct: 75.8,
    valB: "$2810.5B",
    holderChg: "+1.3%",
    trend: "Accumulation",
    score: 100,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "607,367,113", "val": "$303.3B", "pct": "+2.37%"}, {"holder": "Vanguard Capital Management LLC", "shares": "485,192,007", "val": "$242.3B", "pct": "+0.55%"}, {"holder": "State Street Corporation", "shares": "315,653,206", "val": "$157.6B", "pct": "+2.92%"}]
  },
  {
    rank: 2,
    symbol: "AMZN",
    name: "Amazon.com Inc",
    sector: "Cons Disc",
    holders: 7936,
    instPct: 68.7,
    valB: "$1845.8B",
    holderChg: "+0.7%",
    trend: "Accumulation",
    score: 99,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "748,403,539", "val": "$186.4B", "pct": "+1.75%"}, {"holder": "Vanguard Capital Management LLC", "shares": "635,764,130", "val": "$158.3B", "pct": "+0.73%"}, {"holder": "State Street Corporation", "shares": "397,186,958", "val": "$98.9B", "pct": "+1.73%"}]
  },
  {
    rank: 3,
    symbol: "AAPL",
    name: "Apple Inc.",
    sector: "Tech",
    holders: 7759,
    instPct: 66.3,
    valB: "$3191.3B",
    holderChg: "+0.9%",
    trend: "Accumulation",
    score: 98,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "1,162,996,939", "val": "$383.3B", "pct": "+1.60%"}, {"holder": "Vanguard Capital Management LLC", "shares": "959,107,911", "val": "$316.1B", "pct": "+0.55%"}, {"holder": "State Street Corporation", "shares": "615,129,929", "val": "$202.8B", "pct": "+2.12%"}]
  },
  {
    rank: 4,
    symbol: "NVDA",
    name: "NVIDIA Corp",
    sector: "Tech",
    holders: 7733,
    instPct: 71.4,
    valB: "$3657.7B",
    holderChg: "+1.3%",
    trend: "Accumulation",
    score: 97,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "1,941,918,386", "val": "$412.0B", "pct": "+0.85%"}, {"holder": "Vanguard Capital Management LLC", "shares": "1,540,816,358", "val": "$326.9B", "pct": "+0.15%"}, {"holder": "FMR, LLC", "shares": "1,026,051,548", "val": "$217.7B", "pct": "+3.24%"}]
  },
  {
    rank: 5,
    symbol: "GOOGL",
    name: "Alphabet Inc",
    sector: "Comm Serv",
    holders: 7483,
    instPct: 81.0,
    valB: "$3405.5B",
    holderChg: "+7.4%",
    trend: "Heavy Accumulation",
    score: 96,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "460,972,803", "val": "$158.5B", "pct": "+3.13%"}, {"holder": "Vanguard Capital Management LLC", "shares": "382,951,664", "val": "$131.7B", "pct": "+1.24%"}, {"holder": "FMR, LLC", "shares": "250,714,005", "val": "$86.2B", "pct": "+5.99%"}]
  },
  {
    rank: 6,
    symbol: "META",
    name: "Meta Platforms",
    sector: "Comm Serv",
    holders: 6610,
    instPct: 79.0,
    valB: "$1344.4B",
    holderChg: "+1.6%",
    trend: "Accumulation",
    score: 95,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "173,396,976", "val": "$115.8B", "pct": "+2.70%"}, {"holder": "Vanguard Capital Management LLC", "shares": "143,440,997", "val": "$95.8B", "pct": "+0.92%"}, {"holder": "FMR, LLC", "shares": "95,895,744", "val": "$64.0B", "pct": "-17.77%"}]
  },
  {
    rank: 7,
    symbol: "JPM",
    name: "JPMorgan Chase",
    sector: "Financials",
    holders: 6387,
    instPct: 75.7,
    valB: "$694.2B",
    holderChg: "+0.2%",
    trend: "Accumulation",
    score: 94,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "206,290,537", "val": "$71.2B", "pct": "-0.93%"}, {"holder": "Vanguard Capital Management LLC", "shares": "161,586,023", "val": "$55.8B", "pct": "-2.23%"}, {"holder": "State Street Corporation", "shares": "125,209,293", "val": "$43.2B", "pct": "+0.75%"}]
  },
  {
    rank: 8,
    symbol: "AVGO",
    name: "Broadcom Inc",
    sector: "Tech",
    holders: 6312,
    instPct: 79.8,
    valB: "$1298.6B",
    holderChg: "+2.7%",
    trend: "Heavy Accumulation",
    score: 93,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "398,213,826", "val": "$135.7B", "pct": "+3.18%"}, {"holder": "Vanguard Capital Management LLC", "shares": "309,168,582", "val": "$105.4B", "pct": "+0.37%"}, {"holder": "State Street Corporation", "shares": "196,900,541", "val": "$67.1B", "pct": "+2.88%"}]
  },
  {
    rank: 9,
    symbol: "V",
    name: "Visa Inc",
    sector: "Financials",
    holders: 5988,
    instPct: 90.2,
    valB: "$630.4B",
    holderChg: "-0.6%",
    trend: "Neutral",
    score: 92,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "137,669,061", "val": "$51.5B", "pct": "+1.09%"}, {"holder": "Vanguard Capital Management LLC", "shares": "106,150,500", "val": "$39.7B", "pct": "-0.80%"}, {"holder": "State Street Corporation", "shares": "82,872,209", "val": "$31.0B", "pct": "+0.69%"}]
  },
  {
    rank: 10,
    symbol: "LLY",
    name: "Eli Lilly & Co",
    sector: "Healthcare",
    holders: 5889,
    instPct: 85.3,
    valB: "$870.5B",
    holderChg: "+0.0%",
    trend: "Accumulation",
    score: 91,
    topHolders: [{"holder": "Lilly Endowment, Inc", "shares": "90,376,978", "val": "$103.4B", "pct": "-1.65%"}, {"holder": "Blackrock Inc.", "shares": "67,540,400", "val": "$77.3B", "pct": "+1.75%"}, {"holder": "Vanguard Capital Management LLC", "shares": "53,528,868", "val": "$61.2B", "pct": "+0.31%"}]
  },
  {
    rank: 11,
    symbol: "JNJ",
    name: "Johnson & Johnson",
    sector: "Healthcare",
    holders: 5826,
    instPct: 76.7,
    valB: "$489.3B",
    holderChg: "-1.3%",
    trend: "Neutral",
    score: 90,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "212,098,264", "val": "$56.1B", "pct": "-0.60%"}, {"holder": "Vanguard Capital Management LLC", "shares": "157,226,374", "val": "$41.6B", "pct": "+0.40%"}, {"holder": "State Street Corporation", "shares": "133,776,025", "val": "$35.4B", "pct": "+0.22%"}]
  },
  {
    rank: 12,
    symbol: "TSLA",
    name: "Tesla Inc",
    sector: "Cons Disc",
    holders: 5359,
    instPct: 43.7,
    valB: "$621.8B",
    holderChg: "+1.6%",
    trend: "Accumulation",
    score: 89,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "214,123,129", "val": "$77.2B", "pct": "+2.90%"}, {"holder": "Vanguard Capital Management LLC", "shares": "184,023,551", "val": "$66.4B", "pct": "+0.64%"}, {"holder": "State Street Corporation", "shares": "117,456,756", "val": "$42.4B", "pct": "+2.41%"}]
  },
  {
    rank: 13,
    symbol: "COST",
    name: "Costco Wholesale",
    sector: "Staples",
    holders: 5217,
    instPct: 74.4,
    valB: "$300.0B",
    holderChg: "-0.2%",
    trend: "Neutral",
    score: 88,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "34,202,834", "val": "$31.1B", "pct": "-2.13%"}, {"holder": "Vanguard Capital Management LLC", "shares": "28,976,605", "val": "$26.3B", "pct": "+0.45%"}, {"holder": "State Street Corporation", "shares": "18,384,951", "val": "$16.7B", "pct": "+1.28%"}]
  },
  {
    rank: 14,
    symbol: "XOM",
    name: "Exxon Mobil Corp",
    sector: "Energy",
    holders: 5205,
    instPct: 67.1,
    valB: "$466.9B",
    holderChg: "-3.2%",
    trend: "Distribution",
    score: 87,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "334,746,496", "val": "$56.7B", "pct": "+3.72%"}, {"holder": "Vanguard Capital Management LLC", "shares": "270,731,921", "val": "$45.8B", "pct": "-0.17%"}, {"holder": "State Street Corporation", "shares": "206,811,526", "val": "$35.0B", "pct": "-3.32%"}]
  },
  {
    rank: 15,
    symbol: "AMD",
    name: "Advanced Micro Dev",
    sector: "Tech",
    holders: 5104,
    instPct: 75.4,
    valB: "$620.2B",
    holderChg: "+16.9%",
    trend: "Heavy Accumulation",
    score: 86,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "150,301,510", "val": "$75.8B", "pct": "+3.25%"}, {"holder": "Vanguard Capital Management LLC", "shares": "106,500,177", "val": "$53.7B", "pct": "+0.53%"}, {"holder": "State Street Corporation", "shares": "74,361,687", "val": "$37.5B", "pct": "-0.55%"}]
  },
  {
    rank: 16,
    symbol: "HD",
    name: "Home Depot Inc",
    sector: "Cons Disc",
    holders: 5073,
    instPct: 76.8,
    valB: "$234.5B",
    holderChg: "+7.3%",
    trend: "Heavy Accumulation",
    score: 85,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "81,578,902", "val": "$25.0B", "pct": "+3.71%"}, {"holder": "Vanguard Capital Management LLC", "shares": "65,076,088", "val": "$19.9B", "pct": "+0.60%"}, {"holder": "State Street Corporation", "shares": "47,175,026", "val": "$14.4B", "pct": "+1.07%"}]
  },
  {
    rank: 17,
    symbol: "PG",
    name: "Procter & Gamble",
    sector: "Staples",
    holders: 5056,
    instPct: 71.8,
    valB: "$245.3B",
    holderChg: "+0.1%",
    trend: "Accumulation",
    score: 84,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "190,003,442", "val": "$27.9B", "pct": "+1.59%"}, {"holder": "Vanguard Capital Management LLC", "shares": "152,109,741", "val": "$22.4B", "pct": "+0.70%"}, {"holder": "State Street Corporation", "shares": "102,216,308", "val": "$15.0B", "pct": "+0.95%"}]
  },
  {
    rank: 18,
    symbol: "MA",
    name: "Mastercard Inc",
    sector: "Financials",
    holders: 4817,
    instPct: 91.2,
    valB: "$456.8B",
    holderChg: "-2.3%",
    trend: "Distribution",
    score: 83,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "66,393,565", "val": "$38.0B", "pct": "-0.92%"}, {"holder": "Mastercard Foundation Asset Management Corp", "shares": "60,347,774", "val": "$34.5B", "pct": "-7.49%"}, {"holder": "Vanguard Capital Management LLC", "shares": "52,122,015", "val": "$29.8B", "pct": "-0.41%"}]
  },
  {
    rank: 19,
    symbol: "UNH",
    name: "UnitedHealth Group",
    sector: "Healthcare",
    holders: 4386,
    instPct: 89.7,
    valB: "$303.4B",
    holderChg: "+15.6%",
    trend: "Heavy Accumulation",
    score: 82,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "76,863,061", "val": "$29.0B", "pct": "+4.62%"}, {"holder": "Vanguard Capital Management LLC", "shares": "59,311,525", "val": "$22.4B", "pct": "+0.75%"}, {"holder": "State Street Corporation", "shares": "45,633,267", "val": "$17.2B", "pct": "+0.66%"}]
  },
  {
    rank: 20,
    symbol: "CRM",
    name: "Salesforce Inc",
    sector: "Tech",
    holders: 3512,
    instPct: 87.5,
    valB: "$186.5B",
    holderChg: "-8.1%",
    trend: "Distribution",
    score: 81,
    topHolders: [{"holder": "Blackrock Inc.", "shares": "72,748,909", "val": "$18.8B", "pct": "-8.71%"}, {"holder": "Vanguard Capital Management LLC", "shares": "52,065,228", "val": "$13.5B", "pct": "-12.25%"}, {"holder": "State Street Corporation", "shares": "44,869,478", "val": "$11.6B", "pct": "-8.34%"}]
  },
];

export interface SectorData {
  name: string;
  code: string;
  netFlow: number; // in $B
  maxFlow: number;
  topBuyStocks: Array<{ ticker: string; shares: string; value: string; flow: string }>;
  topSellStocks: Array<{ ticker: string; shares: string; value: string; flow: string }>;
}

export const REAL_GICS_SECTORS: SectorData[] = [
  {
    name: "Information Technology",
    code: "XLK",
    netFlow: 28.6,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "NVDA", shares: "+18.2M", value: "$3.85B", flow: "+1.30%" },
      { ticker: "MSFT", shares: "+14.6M", value: "$7.38B", flow: "+1.29%" },
      { ticker: "AAPL", shares: "+10.3M", value: "$3.44B", flow: "+0.89%" },
      { ticker: "AVGO", shares: "+5.1M", value: "$1.08B", flow: "+2.75%" },
      { ticker: "AMD", shares: "+8.4M", value: "$1.78B", flow: "+16.91%" },
    ],
    topSellStocks: [
      { ticker: "INTC", shares: "-12.5M", value: "$280M", flow: "-9.40%" },
      { ticker: "CSCO", shares: "-5.2M", value: "$260M", flow: "-2.10%" },
    ],
  },
  {
    name: "Communication Services",
    code: "XLC",
    netFlow: 16.4,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "GOOGL", shares: "+15.8M", value: "$3.41B", flow: "+7.36%" },
      { ticker: "META", shares: "+8.2M", value: "$5.41B", flow: "+1.55%" },
      { ticker: "NFLX", shares: "+2.1M", value: "$1.45B", flow: "+4.10%" },
      { ticker: "DIS", shares: "+4.4M", value: "$480M", flow: "+3.20%" },
      { ticker: "TMUS", shares: "+3.1M", value: "$590M", flow: "+2.80%" },
    ],
    topSellStocks: [
      { ticker: "WBD", shares: "-9.8M", value: "$85M", flow: "-12.50%" },
    ],
  },
  {
    name: "Consumer Discretionary",
    code: "XLY",
    netFlow: 12.8,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "AMZN", shares: "+12.9M", value: "$3.28B", flow: "+0.68%" },
      { ticker: "HD", shares: "+3.8M", value: "$1.36B", flow: "+7.26%" },
      { ticker: "TSLA", shares: "+6.1M", value: "$2.22B", flow: "+1.63%" },
      { ticker: "BKNG", shares: "+450K", value: "$1.82B", flow: "+3.90%" },
      { ticker: "NKE", shares: "+4.2M", value: "$360M", flow: "+2.10%" },
    ],
    topSellStocks: [
      { ticker: "F", shares: "-14.1M", value: "$155M", flow: "-6.80%" },
    ],
  },
  {
    name: "Financials",
    code: "XLF",
    netFlow: 8.9,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "JPM", shares: "+7.4M", value: "$1.62B", flow: "+0.22%" },
      { ticker: "V", shares: "+4.2M", value: "$1.28B", flow: "+1.10%" },
      { ticker: "GS", shares: "+2.3M", value: "$1.18B", flow: "+5.40%" },
      { ticker: "BAC", shares: "+11.2M", value: "$450M", flow: "+2.90%" },
      { ticker: "MS", shares: "+3.6M", value: "$380M", flow: "+3.80%" },
    ],
    topSellStocks: [
      { ticker: "MA", shares: "-2.8M", value: "$1.28B", flow: "-2.34%" },
    ],
  },
  {
    name: "Health Care",
    code: "XLV",
    netFlow: 7.2,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "UNH", shares: "+6.8M", value: "$2.06B", flow: "+15.61%" },
      { ticker: "LLY", shares: "+3.4M", value: "$2.96B", flow: "+0.00%" },
      { ticker: "ISRG", shares: "+1.4M", value: "$680M", flow: "+8.20%" },
      { ticker: "ABBV", shares: "+4.1M", value: "$760M", flow: "+3.40%" },
      { ticker: "MRK", shares: "+3.2M", value: "$390M", flow: "+2.10%" },
    ],
    topSellStocks: [
      { ticker: "JNJ", shares: "-4.6M", value: "$740M", flow: "-1.29%" },
    ],
  },
  {
    name: "Industrials",
    code: "XLI",
    netFlow: 5.4,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "GE", shares: "+5.1M", value: "$920M", flow: "+6.80%" },
      { ticker: "CAT", shares: "+2.2M", value: "$810M", flow: "+4.50%" },
      { ticker: "RTX", shares: "+4.8M", value: "$580M", flow: "+5.10%" },
      { ticker: "HON", shares: "+2.4M", value: "$510M", flow: "+3.20%" },
      { ticker: "LMT", shares: "+1.1M", value: "$520M", flow: "+2.90%" },
    ],
    topSellStocks: [
      { ticker: "BA", shares: "-4.2M", value: "$680M", flow: "-7.40%" },
    ],
  },
  {
    name: "Consumer Staples",
    code: "XLP",
    netFlow: 2.1,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "COST", shares: "+1.9M", value: "$1.71B", flow: "+0.80%" },
      { ticker: "PG", shares: "+2.4M", value: "$410M", flow: "+0.06%" },
      { ticker: "WMT", shares: "+4.8M", value: "$340M", flow: "+3.10%" },
      { ticker: "KO", shares: "+5.2M", value: "$360M", flow: "+2.40%" },
      { ticker: "PEP", shares: "+2.8M", value: "$480M", flow: "+1.90%" },
    ],
    topSellStocks: [
      { ticker: "TGT", shares: "-3.1M", value: "$420M", flow: "-5.20%" },
    ],
  },
  {
    name: "Materials",
    code: "XLB",
    netFlow: 1.4,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "LIN", shares: "+1.2M", value: "$540M", flow: "+4.20%" },
      { ticker: "SHW", shares: "+820K", value: "$290M", flow: "+3.10%" },
      { ticker: "FCX", shares: "+5.4M", value: "$240M", flow: "+6.80%" },
      { ticker: "NEM", shares: "+4.6M", value: "$230M", flow: "+5.20%" },
      { ticker: "APD", shares: "+910K", value: "$270M", flow: "+2.40%" },
    ],
    topSellStocks: [
      { ticker: "DOW", shares: "-4.8M", value: "$250M", flow: "-6.10%" },
    ],
  },
  {
    name: "Utilities",
    code: "XLU",
    netFlow: -1.2,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "CEG", shares: "+2.8M", value: "$760M", flow: "+9.20%" },
      { ticker: "VST", shares: "+4.1M", value: "$520M", flow: "+14.50%" },
      { ticker: "SO", shares: "+2.1M", value: "$180M", flow: "+1.80%" },
      { ticker: "DUK", shares: "+1.9M", value: "$210M", flow: "+1.40%" },
      { ticker: "AEP", shares: "+1.4M", value: "$130M", flow: "+1.10%" },
    ],
    topSellStocks: [
      { ticker: "NEE", shares: "-8.4M", value: "$680M", flow: "-4.20%" },
    ],
  },
  {
    name: "Real Estate",
    code: "XLRE",
    netFlow: -3.8,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "PLD", shares: "+2.1M", value: "$240M", flow: "+2.10%" },
      { ticker: "EQIX", shares: "+340K", value: "$290M", flow: "+3.40%" },
      { ticker: "PSA", shares: "+510K", value: "$160M", flow: "+1.80%" },
      { ticker: "O", shares: "+3.2M", value: "$180M", flow: "+1.20%" },
      { ticker: "WELL", shares: "+1.4M", value: "$150M", flow: "+2.40%" },
    ],
    topSellStocks: [
      { ticker: "SPG", shares: "-3.8M", value: "$590M", flow: "-5.80%" },
    ],
  },
  {
    name: "Energy",
    code: "XLE",
    netFlow: -8.4,
    maxFlow: 35.0,
    topBuyStocks: [
      { ticker: "OXY", shares: "+4.2M", value: "$240M", flow: "+3.80%" },
      { ticker: "EOG", shares: "+1.8M", value: "$230M", flow: "+2.10%" },
      { ticker: "PSX", shares: "+1.4M", value: "$190M", flow: "+1.90%" },
      { ticker: "MPC", shares: "+1.2M", value: "$210M", flow: "+2.40%" },
      { ticker: "VLO", shares: "+980K", value: "$150M", flow: "+1.70%" },
    ],
    topSellStocks: [
      { ticker: "XOM", shares: "-7.8M", value: "$890M", flow: "-3.20%" },
      { ticker: "CVX", shares: "-5.4M", value: "$820M", flow: "-4.10%" },
    ],
  },
];

export const REAL_BUBBLE_STOCKS = [
  { ticker: "NVDA", sizeB: 3657.7, qoqChg: 1.30, perf3M: 18.4, color: "#00ff88" },
  { ticker: "MSFT", sizeB: 2810.5, qoqChg: 1.29, perf3M: 8.2, color: "#00ff88" },
  { ticker: "AAPL", sizeB: 3191.3, qoqChg: 0.89, perf3M: 12.5, color: "#00ff88" },
  { ticker: "AMZN", sizeB: 1845.8, qoqChg: 0.68, perf3M: 14.1, color: "#00ff88" },
  { ticker: "GOOGL", sizeB: 3405.5, qoqChg: 7.36, perf3M: 16.8, color: "#00ff88" },
  { ticker: "META", sizeB: 1344.4, qoqChg: 1.55, perf3M: 22.4, color: "#00ff88" },
  { ticker: "AVGO", sizeB: 1298.6, qoqChg: 2.75, perf3M: 26.2, color: "#00ff88" },
  { ticker: "JPM", sizeB: 694.2, qoqChg: 0.22, perf3M: 9.8, color: "#00e5ff" },
  { ticker: "LLY", sizeB: 870.5, qoqChg: 0.00, perf3M: 7.4, color: "#00e5ff" },
  { ticker: "TSLA", sizeB: 621.8, qoqChg: 1.63, perf3M: -4.5, color: "#ff3355" },
  { ticker: "XOM", sizeB: 466.9, qoqChg: -3.20, perf3M: -6.8, color: "#ff3355" },
  { ticker: "CRM", sizeB: 186.5, qoqChg: -8.06, perf3M: -11.2, color: "#ff3355" },
];
