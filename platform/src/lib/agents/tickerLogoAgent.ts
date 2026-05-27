export interface TickerLogoEntry {
  brandColorHex: string;
  markStyle: string;
  portraitSubject?: string;
  companyName: string;
}

export const TICKER_LOGO_MAP: Record<string, TickerLogoEntry> = {
  // Tech mega-caps
  NVDA: { brandColorHex: '#76B900', markStyle: "NVIDIA's signature lime-green eye-mark logo", portraitSubject: 'jensen_huang', companyName: 'NVIDIA' },
  AAPL: { brandColorHex: '#A2AAAD', markStyle: 'minimalist silver Apple silhouette', portraitSubject: 'tim_cook', companyName: 'Apple' },
  MSFT: { brandColorHex: '#0078D4', markStyle: 'four-square Microsoft mark', portraitSubject: 'satya_nadella', companyName: 'Microsoft' },
  GOOGL: { brandColorHex: '#4285F4', markStyle: 'multicolor lowercase Google wordmark', portraitSubject: 'sundar_pichai', companyName: 'Alphabet' },
  META: { brandColorHex: '#0866FF', markStyle: 'infinity-loop Meta mark', portraitSubject: 'mark_zuckerberg', companyName: 'Meta Platforms' },
  AMZN: { brandColorHex: '#FF9900', markStyle: 'arrow-from-a-to-z Amazon smile', portraitSubject: 'andy_jassy', companyName: 'Amazon' },
  TSLA: { brandColorHex: '#CC0000', markStyle: 'stylized T Tesla mark in deep red', portraitSubject: 'elon_musk', companyName: 'Tesla' },
  NFLX: { brandColorHex: '#E50914', markStyle: 'bold N Netflix mark in signature red', companyName: 'Netflix' },

  // Chips / hardware
  AMD: { brandColorHex: '#ED1C24', markStyle: 'red AMD wordmark', portraitSubject: 'lisa_su', companyName: 'Advanced Micro Devices' },
  AVGO: { brandColorHex: '#CC092F', markStyle: 'red Broadcom B mark', companyName: 'Broadcom' },
  TSM: { brandColorHex: '#CC0000', markStyle: 'red TSMC wordmark', companyName: 'Taiwan Semiconductor' },
  ASML: { brandColorHex: '#0F69AF', markStyle: 'blue ASML wordmark', companyName: 'ASML Holding' },
  MU: { brandColorHex: '#0072CE', markStyle: 'blue Micron wordmark', companyName: 'Micron Technology' },
  SMCI: { brandColorHex: '#005EB8', markStyle: 'blue Super Micro mark', companyName: 'Super Micro Computer' },
  SNDK: { brandColorHex: '#E10025', markStyle: 'red SanDisk wordmark', companyName: 'SanDisk' },
  WDC: { brandColorHex: '#FFD200', markStyle: 'gold Western Digital W mark', companyName: 'Western Digital' },

  // Fintech / crypto
  PLTR: { brandColorHex: '#101113', markStyle: 'black Palantir wordmark', companyName: 'Palantir Technologies' },
  APP: { brandColorHex: '#FF5400', markStyle: 'orange AppLovin mark', companyName: 'AppLovin' },
  HOOD: { brandColorHex: '#00C805', markStyle: 'green Robinhood feather mark', companyName: 'Robinhood Markets' },
  COIN: { brandColorHex: '#0052FF', markStyle: 'blue Coinbase wordmark', companyName: 'Coinbase Global' },
  MSTR: { brandColorHex: '#F7931A', markStyle: 'orange Bitcoin-adjacent MicroStrategy mark', companyName: 'MicroStrategy' },
  SOFI: { brandColorHex: '#005CB9', markStyle: 'blue SoFi wordmark', companyName: 'SoFi Technologies' },
  PYPL: { brandColorHex: '#003087', markStyle: 'two-tone blue PayPal logo', companyName: 'PayPal Holdings' },
  V: { brandColorHex: '#1A1F71', markStyle: 'navy Visa wordmark', companyName: 'Visa' },
  MA: { brandColorHex: '#EB001B', markStyle: 'red and yellow Mastercard interlocking circles', companyName: 'Mastercard' },

  // Aerospace / quantum / other
  RKLB: { brandColorHex: '#0A0A0A', markStyle: 'black Rocket Lab R mark', companyName: 'Rocket Lab' },
  IONQ: { brandColorHex: '#FF4081', markStyle: 'pink IonQ wordmark with quantum-particle motif', companyName: 'IonQ' },

  // Financials
  JPM: { brandColorHex: '#221E1F', markStyle: 'blue and black JPMorgan octagonal mark', companyName: 'JPMorgan Chase' },
  'BRK.B': { brandColorHex: '#1A4480', markStyle: 'navy Berkshire Hathaway wordmark', portraitSubject: 'buffett', companyName: 'Berkshire Hathaway' },

  // China / e-commerce
  BABA: { brandColorHex: '#FF6A00', markStyle: 'orange Alibaba ribbon mark', companyName: 'Alibaba Group' },

  // Healthcare
  LLY: { brandColorHex: '#D52B1E', markStyle: 'red Eli Lilly wordmark', companyName: 'Eli Lilly' },
  UNH: { brandColorHex: '#002677', markStyle: 'navy UnitedHealth Group mark', companyName: 'UnitedHealth Group' },
  JNJ: { brandColorHex: '#CC0000', markStyle: 'red Johnson & Johnson script', companyName: 'Johnson & Johnson' },
  PFE: { brandColorHex: '#0093D0', markStyle: 'blue Pfizer wordmark', companyName: 'Pfizer' },
  MRK: { brandColorHex: '#00857C', markStyle: 'teal Merck wordmark', companyName: 'Merck' },
  ABBV: { brandColorHex: '#071D49', markStyle: 'navy AbbVie wordmark', companyName: 'AbbVie' },

  // Energy
  XOM: { brandColorHex: '#FF1B2D', markStyle: 'red Exxon interlocking X', companyName: 'ExxonMobil' },
  CVX: { brandColorHex: '#005EB8', markStyle: 'chevron blue and red mark', companyName: 'Chevron' },
  OXY: { brandColorHex: '#E31837', markStyle: 'red Occidental wordmark', companyName: 'Occidental Petroleum' },
  COP: { brandColorHex: '#E31837', markStyle: 'red ConocoPhillips wordmark', companyName: 'ConocoPhillips' },

  // Canadian banks + telcos + others
  'RY.TO': { brandColorHex: '#003168', markStyle: 'royal blue RBC mark with lion crest', companyName: 'Royal Bank of Canada' },
  'TD.TO': { brandColorHex: '#00B04F', markStyle: 'green TD shield mark', companyName: 'Toronto-Dominion Bank' },
  'BNS.TO': { brandColorHex: '#EC111A', markStyle: 'red Scotiabank S mark', companyName: 'Bank of Nova Scotia' },
  'BMO.TO': { brandColorHex: '#0079C1', markStyle: 'blue BMO M-bar mark', companyName: 'Bank of Montreal' },
  'CM.TO': { brandColorHex: '#BE1E2D', markStyle: 'red CIBC C mark', companyName: 'CIBC' },
  'ENB.TO': { brandColorHex: '#F58220', markStyle: 'orange Enbridge wordmark', companyName: 'Enbridge' },
  'SHOP.TO': { brandColorHex: '#7AB55C', markStyle: 'green Shopify shopping-bag mark', portraitSubject: 'tobi_lutke', companyName: 'Shopify' },
  'CNR.TO': { brandColorHex: '#000000', markStyle: 'black CN wordmark', companyName: 'Canadian National Railway' },
  'CP.TO': { brandColorHex: '#000000', markStyle: 'black Canadian Pacific Kansas City mark', companyName: 'Canadian Pacific Kansas City' },
  'BCE.TO': { brandColorHex: '#0072CE', markStyle: 'blue Bell wordmark', companyName: 'BCE' },
  'T.TO': { brandColorHex: '#46AE2D', markStyle: 'green Telus T mark', companyName: 'Telus' },
  'MFC.TO': { brandColorHex: '#00754A', markStyle: 'green Manulife mark', companyName: 'Manulife Financial' },
  'SLF.TO': { brandColorHex: '#FFB81C', markStyle: 'gold Sun Life mark', companyName: 'Sun Life Financial' },
  'ATD.TO': { brandColorHex: '#E31837', markStyle: 'red Couche-Tard / Circle K mark', companyName: 'Alimentation Couche-Tard' },
};

export class TickerLogoAgent {
  resolve(ticker: string): TickerLogoEntry | undefined {
    return TICKER_LOGO_MAP[ticker];
  }

  resolveMany(tickers: string[]): Array<{ ticker: string; entry: TickerLogoEntry | undefined }> {
    return tickers.map((t) => ({ ticker: t, entry: TICKER_LOGO_MAP[t] }));
  }

  hasAll(tickers: string[]): boolean {
    return tickers.every((t) => TICKER_LOGO_MAP[t] !== undefined);
  }

  missing(tickers: string[]): string[] {
    return tickers.filter((t) => TICKER_LOGO_MAP[t] === undefined);
  }
}
