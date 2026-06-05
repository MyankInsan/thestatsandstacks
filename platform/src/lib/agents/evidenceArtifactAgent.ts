import type { StrategyDecision } from './contentStrategyAgent';

export type EvidenceArtifactKind =
  | 'PRICE_CHART'
  | 'EARNINGS_TABLE'
  | 'FILING_EXCERPT'
  | 'STORE_SCENE'
  | 'PRODUCT_DETAIL'
  | 'EXECUTIVE_CONTEXT'
  | 'SOCIAL_SCREENSHOT'
  | 'CHECKLIST_RECEIPT'
  | 'SOURCE_DOCUMENT'
  | 'RISK_MATRIX';

export interface EvidenceArtifact {
  slideNumber: number;
  kind: EvidenceArtifactKind;
  label: string;
  visualAnchor: string;
  dataIntegrityNote: string;
}

export interface EvidenceArtifactPlan {
  premise: string;
  artifacts: EvidenceArtifact[];
  sharedEvidenceRule: string;
}

export interface EvidenceArtifactInput {
  strategy: StrategyDecision;
  tickerSymbols: string[];
  slideCount?: number;
}

interface TickerEvidenceProfile {
  company: string;
  chartLabel: string;
  chartAnchor: string;
  operatingAnchor: string;
  executiveAnchor?: string;
  earningsAnchor: string;
  riskAnchor: string;
}

const TICKER_PROFILES: Record<string, TickerEvidenceProfile> = {
  NVDA: {
    company: 'NVIDIA',
    chartLabel: 'NVDA split-adjusted price chart',
    chartAnchor: 'a realistic split-adjusted NVDA price timeline with stock-split markers, earnings-call markers, and a clearly reserved verified-result area',
    operatingAnchor: 'NVIDIA GPU or AI accelerator hardware, data-center racks, GTC keynote-stage visual, or Blackwell product-roadmap board',
    executiveAnchor: 'Jensen Huang in an editorial/business-news context when a real public leader portrait genuinely helps the slide',
    earningsAnchor: 'NVIDIA earnings table with data-center revenue, gross margin, EPS, and guidance rows styled like a human-built analyst tear sheet',
    riskAnchor: 'risk matrix covering data-center demand, export controls, margin pressure, and valuation sensitivity',
  },
  LULU: {
    company: 'Lululemon',
    chartLabel: 'LULU retail evidence board',
    chartAnchor: 'a realistic LULU stock chart or earnings dashboard paired with Lululemon storefront/apparel/inventory evidence',
    operatingAnchor: 'Lululemon storefront, apparel rack, fabric tag, yoga/apparel product detail, inventory shelf, or sales-floor traffic scene',
    earningsAnchor: 'Lululemon earnings table with inventory, comparable sales, margin, markdown, and guidance rows',
    riskAnchor: 'retail risk matrix covering inventory build, slower traffic, margin pressure, and international expansion pace',
  },
  AAPL: {
    company: 'Apple',
    chartLabel: 'AAPL price and product-cycle chart',
    chartAnchor: 'an AAPL price timeline tied to iPhone cycle, services revenue, and earnings-call markers',
    operatingAnchor: 'Apple Store table, iPhone/Mac product detail, services dashboard, or supply-chain/product-cycle evidence',
    earningsAnchor: 'Apple earnings table with iPhone, services, gross margin, and geographic-segment rows',
    riskAnchor: 'risk matrix covering iPhone cycle, China exposure, services growth, and margin pressure',
  },
  AMZN: {
    company: 'Amazon',
    chartLabel: 'AMZN segment evidence dashboard',
    chartAnchor: 'an AMZN price timeline paired with AWS, retail margin, and advertising-segment evidence',
    operatingAnchor: 'Amazon fulfillment center, delivery-route board, AWS data-center console, or advertising dashboard',
    earningsAnchor: 'Amazon earnings table with AWS, North America retail, international retail, ads, and operating margin rows',
    riskAnchor: 'risk matrix covering AWS growth, retail margin, capex, and consumer demand',
  },
  MSFT: {
    company: 'Microsoft',
    chartLabel: 'MSFT cloud and AI evidence chart',
    chartAnchor: 'an MSFT price timeline paired with Azure, AI capex, and productivity-segment evidence',
    operatingAnchor: 'Microsoft Azure data-center dashboard, Copilot workplace screen, or enterprise software evidence',
    earningsAnchor: 'Microsoft earnings table with Azure growth, productivity, cloud margin, and capex rows',
    riskAnchor: 'risk matrix covering Azure growth, AI capex, enterprise demand, and margins',
  },
  GOOGL: {
    company: 'Alphabet',
    chartLabel: 'GOOGL ads and cloud evidence chart',
    chartAnchor: 'a GOOGL price timeline paired with search ads, YouTube, cloud, and AI-spend evidence',
    operatingAnchor: 'Google search advertising dashboard, YouTube creator analytics, or Google Cloud console evidence',
    earningsAnchor: 'Alphabet earnings table with search ads, YouTube, cloud, TAC, and operating margin rows',
    riskAnchor: 'risk matrix covering ad demand, AI search disruption, cloud margins, and regulation',
  },
};

const GENERIC_PROFILE: TickerEvidenceProfile = {
  company: 'the featured company',
  chartLabel: 'verified source-style price chart',
  chartAnchor: 'a realistic source-style price chart with a clearly labeled ticker, time window, and annotation markers',
  operatingAnchor: 'a real-world business object directly tied to the topic, such as product shelves, customer traffic, a factory floor, a document, or a dashboard',
  earningsAnchor: 'an earnings-style table with revenue, margin, cash flow, and guidance rows',
  riskAnchor: 'a risk matrix with clearly labeled drivers and watch items',
};

export class EvidenceArtifactAgent {
  execute(input: EvidenceArtifactInput): EvidenceArtifactPlan {
    const requestedSlideCount = input.slideCount ?? input.strategy.slideCount ?? input.strategy.slideBreakdown.length;
    const slideCount = Math.max(1, requestedSlideCount || 1);
    const ticker = normalizeTicker(input.tickerSymbols[0] ?? inferTicker(input.strategy));
    const profile = ticker ? (TICKER_PROFILES[ticker] ?? GENERIC_PROFILE) : GENERIC_PROFILE;
    const artifacts: EvidenceArtifact[] = [];

    for (let index = 0; index < slideCount; index++) {
      const slideNumber = index + 1;
      const rawBeat = input.strategy.slideBreakdown[index] ?? '';
      artifacts.push(buildArtifactForSlide({
        slideNumber,
        slideCount,
        strategy: input.strategy,
        ticker,
        profile,
        rawBeat,
      }));
    }

    return {
      premise: `${input.strategy.topic} must be rendered as a sequence of concrete evidence artifacts, not isolated poster templates.`,
      sharedEvidenceRule: 'Every slide must make the human research artifact obvious: source-style chart, filing/table, storefront/product detail, public executive context, checklist, or risk matrix. Do not substitute decorative bulls, rockets, missiles, chess pieces, generic finance people, or unrelated ticker-logo collages.',
      artifacts,
    };
  }
}

function buildArtifactForSlide(input: {
  slideNumber: number;
  slideCount: number;
  strategy: StrategyDecision;
  ticker?: string;
  profile: TickerEvidenceProfile;
  rawBeat: string;
}): EvidenceArtifact {
  const { slideNumber, slideCount, strategy, ticker, profile, rawBeat } = input;
  const globalText = `${strategy.topic} ${strategy.hook} ${strategy.searchKeywords.join(' ')}`;
  const text = `${slideNumber === 1 ? globalText : ''} ${rawBeat || globalText}`.toLowerCase();
  const labelPrefix = ticker ? `${ticker} ` : '';

  if (slideNumber === slideCount) {
    return {
      slideNumber,
      kind: 'CHECKLIST_RECEIPT',
      label: `${labelPrefix}save-worthy evidence checklist`,
      visualAnchor: `a clean editorial checklist card recapping the real artifacts from earlier slides for ${profile.company}`,
      dataIntegrityNote: 'Use concise takeaways only; do not introduce new unverified numbers on the CTA slide.',
    };
  }

  if (slideNumber === 1) {
    return buildCoverArtifact({ slideNumber, text, ticker, profile });
  }

  if (/initial investment|invested 5 years ago|invested five years ago|buying when|purchase|entry/.test(text)) {
    return {
      slideNumber,
      kind: 'SOURCE_DOCUMENT',
      label: `${labelPrefix}historical starting receipt`,
      visualAnchor: `a realistic brokerage-style historical order ticket / starting receipt for the original $10,000 ${profile.company} investment, paired with a small source-style chart thumbnail`,
      dataIntegrityNote: 'Keep the $10,000 premise explicit but do not invent fees, share counts, timestamps, or a final dollar value.',
    };
  }

  if (/10k|10,000|5 years|five years|return|worth|growth journey|result today|final result|price|chart|split/.test(text)) {
    return {
      slideNumber,
      kind: 'PRICE_CHART',
      label: `${labelPrefix}${profile.chartLabel}`,
      visualAnchor: profile.chartAnchor,
      dataIntegrityNote: 'Use a source-style chart and leave exact return/final-dollar figures as manually verified text unless the calculation is already confirmed.',
    };
  }

  if (/inventory|traffic|store|retail|consumer|apparel|lululemon|product|margin pressure|markdown/.test(text)) {
    const isProduct = /product|apparel|fabric|tag|shelf|inventory/.test(text);
    return {
      slideNumber,
      kind: isProduct ? 'PRODUCT_DETAIL' : 'STORE_SCENE',
      label: `${profile.company} retail operating evidence`,
      visualAnchor: profile.operatingAnchor,
      dataIntegrityNote: 'Depict realistic retail evidence without fake customer counts, fake receipts, or unrelated ticker logos.',
    };
  }

  if (/earnings|eps|revenue|sales|guidance|cash flow|gross margin|net income|quarter|q1|q2|q3|q4/.test(text)) {
    return {
      slideNumber,
      kind: 'EARNINGS_TABLE',
      label: `${profile.company} earnings tear sheet`,
      visualAnchor: profile.earningsAnchor,
      dataIntegrityNote: 'Use table labels that can be manually checked; avoid invented precise percentages unless already in the source copy.',
    };
  }

  if (/filing|13f|form 4|sec|prospectus|s-1|annual report|10-k|10-q|disclosure|cap table|institution/.test(text)) {
    return {
      slideNumber,
      kind: 'FILING_EXCERPT',
      label: `${profile.company} source document excerpt`,
      visualAnchor: 'a realistic SEC filing / annual-report / ownership-table excerpt with highlighted rows and marginal notes',
      dataIntegrityNote: 'Make the document feel source-based; use short labels and avoid fabricating legal text or signatures.',
    };
  }

  if (/jensen|ceo|founder|management|leader|executive|keynote|gtc/.test(text) && profile.executiveAnchor) {
    return {
      slideNumber,
      kind: 'EXECUTIVE_CONTEXT',
      label: `${profile.company} leadership context`,
      visualAnchor: profile.executiveAnchor,
      dataIntegrityNote: 'Use a respectful public-figure editorial context; do not create a fake analyst or invented finance influencer.',
    };
  }

  if (/risk|watch|warning|pressure|slowdown|crossroads|what next|next/.test(text)) {
    return {
      slideNumber,
      kind: 'RISK_MATRIX',
      label: `${profile.company} what-to-watch risk matrix`,
      visualAnchor: profile.riskAnchor,
      dataIntegrityNote: 'Risk labels may be directional; avoid exact forecasts, price targets, or buy/sell framing.',
    };
  }

  if (/tweet|reddit|social|viral|sentiment|comment/.test(text)) {
    return {
      slideNumber,
      kind: 'SOCIAL_SCREENSHOT',
      label: `${profile.company} sentiment/source screenshot`,
      visualAnchor: 'a realistic anonymized social/news screenshot mock with chart context and editor annotations',
      dataIntegrityNote: 'Use anonymized UI text; do not imply a real person said a quote unless sourced.',
    };
  }

  return {
    slideNumber,
    kind: 'SOURCE_DOCUMENT',
    label: `${profile.company} annotated source board`,
    visualAnchor: `${profile.operatingAnchor}; include an editor-built annotation layer tying the object back to the topic`,
    dataIntegrityNote: 'Keep the artifact specific to the topic and avoid generic market symbolism.',
  };
}

function buildCoverArtifact(input: {
  slideNumber: number;
  text: string;
  ticker?: string;
  profile: TickerEvidenceProfile;
}): EvidenceArtifact {
  const { slideNumber, text, ticker, profile } = input;
  const labelPrefix = ticker ? `${ticker} ` : '';
  if (/inventory|traffic|store|retail|consumer|apparel|lululemon|margin pressure|warning/.test(text)) {
    return {
      slideNumber,
      kind: 'EARNINGS_TABLE',
      label: `${profile.company} retail evidence cover board`,
      visualAnchor: `${profile.earningsAnchor}, integrated with a realistic ${profile.operatingAnchor}`,
      dataIntegrityNote: 'Use real retail evidence categories and avoid unrelated ticker symbols or logo collages.',
    };
  }
  if (/earnings|eps|revenue|sales|guidance|cash flow|gross margin|net income|quarter|q1|q2|q3|q4/.test(text)) {
    return {
      slideNumber,
      kind: 'EARNINGS_TABLE',
      label: `${profile.company} earnings cover tear sheet`,
      visualAnchor: profile.earningsAnchor,
      dataIntegrityNote: 'Use checkable row labels and avoid invented exact percentages unless the source copy already includes them.',
    };
  }
  if (/filing|13f|form 4|sec|prospectus|s-1|annual report|10-k|10-q|disclosure|cap table|institution/.test(text)) {
    return {
      slideNumber,
      kind: 'FILING_EXCERPT',
      label: `${profile.company} filing cover excerpt`,
      visualAnchor: 'a realistic source-document cover with highlighted filing rows, margin notes, and one clear evidence callout',
      dataIntegrityNote: 'Do not fabricate legal text, signatures, or exact ownership figures unless supplied upstream.',
    };
  }
  if (/risk|watch|pressure|slowdown|crossroads|what next|next/.test(text)) {
    return {
      slideNumber,
      kind: 'RISK_MATRIX',
      label: `${profile.company} risk-watch cover matrix`,
      visualAnchor: profile.riskAnchor,
      dataIntegrityNote: 'Frame as education and watch items, not a forecast, price target, or recommendation.',
    };
  }
  return {
    slideNumber,
    kind: 'PRICE_CHART',
    label: `${labelPrefix}${profile.chartLabel}`,
    visualAnchor: profile.chartAnchor,
    dataIntegrityNote: 'Use a source-style chart and leave exact return/final-dollar figures as manually verified text unless the calculation is already confirmed.',
  };
}

function inferTicker(strategy: StrategyDecision): string | undefined {
  const text = `${strategy.topic} ${strategy.hook} ${strategy.searchKeywords.join(' ')}`.toUpperCase();
  const direct = text.match(/\b[A-Z]{2,5}\b/g)?.find((token) => TICKER_PROFILES[token]);
  if (direct) return direct;
  if (/NVIDIA/.test(text)) return 'NVDA';
  if (/LULULEMON/.test(text)) return 'LULU';
  if (/APPLE/.test(text)) return 'AAPL';
  if (/AMAZON/.test(text)) return 'AMZN';
  if (/MICROSOFT/.test(text)) return 'MSFT';
  if (/ALPHABET|GOOGLE/.test(text)) return 'GOOGL';
  return undefined;
}

function normalizeTicker(value?: string): string | undefined {
  const ticker = value?.trim().toUpperCase();
  return ticker && /^[A-Z.]{1,8}$/.test(ticker) ? ticker : undefined;
}
