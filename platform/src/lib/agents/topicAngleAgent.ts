import fs from 'fs';
import path from 'path';
import type { TopicCategory } from './portraitLibrary';
import type { TrendResearchResult } from './interfaces';
import { lruPick } from '../services/lruPicker';

export type AngleId =
  | 'CAP_TABLE_INSTITUTIONAL'
  | 'F13_DELTA'
  | 'SOVEREIGN_WEALTH'
  | 'US_GOV_HOLDINGS'
  | 'POLITICIAN_DISCLOSURES'
  | 'INSIDER_CLUSTERS'
  | 'FOUNDER_CONCENTRATION'
  | 'CANADIAN_PENSION'
  | 'INDEX_REBALANCE'
  | 'BUYBACK_SCOREBOARD'
  | 'DIVIDEND_KINGS'
  | 'SECTOR_CAP_TABLE'
  | 'ETF_XRAY'
  | 'HYPOTHETICAL_REVERSAL'
  | 'COMPARISON_LADDER'
  | 'FEE_TEARDOWN'
  | 'TAX_DRAG_MAP'
  | 'BEHAVIORAL_RECEIPT'
  | 'REACTIVE_SENTIMENT'
  | 'CATALYST_NEWS'
  | 'EARNINGS_REACTION';

export interface TopicAngle {
  id: AngleId;
  titlePattern: string;
  dataSourceHint: string;
  slideSkeleton: string[];
  complianceFooter: string;
  dataFreshnessTtlDays: number;
  topicCategory: TopicCategory;
  manualTriggerOnly?: boolean;
  preferredVisualStyle?: string;
}

let ANGLE_CACHE: TopicAngle[] | null = null;

export function loadAngles(): TopicAngle[] {
  if (ANGLE_CACHE) return ANGLE_CACHE;
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'data', 'topicAngles.json'),
    path.join(process.cwd(), 'data', 'topicAngles.json'),
    path.join(process.cwd(), 'platform', 'data', 'topicAngles.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as { angles: TopicAngle[] };
      ANGLE_CACHE = parsed.angles;
      return ANGLE_CACHE;
    }
  }
  ANGLE_CACHE = [];
  return ANGLE_CACHE;
}

export function getAngle(id: AngleId): TopicAngle | undefined {
  return loadAngles().find((a) => a.id === id);
}

export interface TopicAngleAgentInput {
  preferredAngleIds: AngleId[];
  recentAngleIds: AngleId[];
  forceAngleId?: AngleId;
  trendCandidates: TrendResearchResult['topics'];
}

export interface TopicAngleAgentOutput {
  angleCandidates: Array<{
    angleId: AngleId;
    title: string;
    rationale: string;
    seededFromTrend?: string;
    sourceUrls: string[];
    triggerSource: 'angle';
  }>;
}

export class TopicAngleAgent {
  async execute(input: TopicAngleAgentInput): Promise<TopicAngleAgentOutput> {
    const angles = loadAngles();

    if (input.forceAngleId) {
      const forced = angles.find((a) => a.id === input.forceAngleId);
      if (forced) {
        const seed = pickSeedFromTrends(input.trendCandidates);
        return {
          angleCandidates: [{
            angleId: forced.id,
            title: renderTitle(forced.titlePattern, seed),
            rationale: `Manual override via FORCE_ANGLE=${forced.id}.`,
            seededFromTrend: seed?.title,
            sourceUrls: seed?.sourceUrls ?? [],
            triggerSource: 'angle',
          }],
        };
      }
    }

    const eligible = input.preferredAngleIds.filter((id) => {
      const angle = angles.find((a) => a.id === id);
      if (!angle) return false;
      if (angle.manualTriggerOnly) return false;
      return true;
    });

    if (eligible.length === 0) return { angleCandidates: [] };

    const ranked = [
      lruPick(eligible, input.recentAngleIds, 30),
      ...eligible.filter((id) => id !== lruPick(eligible, input.recentAngleIds, 30)),
    ].filter((id): id is AngleId => Boolean(id)).slice(0, 3);

    return {
      angleCandidates: ranked.map((id, i) => {
        const angle = angles.find((a) => a.id === id)!;
        const seed = pickSeedFromTrends(input.trendCandidates);
        return {
          angleId: id,
          title: renderTitle(angle.titlePattern, seed),
          rationale: i === 0 ? 'Top-ranked angle for this slot (LRU-fresh)' : 'Backup angle candidate',
          seededFromTrend: seed?.title,
          sourceUrls: seed?.sourceUrls ?? [],
          triggerSource: 'angle',
        };
      }),
    };
  }
}

function pickSeedFromTrends(trends: TrendResearchResult['topics']) {
  return trends.length > 0 ? trends[0] : undefined;
}

function renderTitle(pattern: string, seed?: { title: string }): string {
  if (!seed) return pattern;
  return pattern
    .replace(/\{MegaCap\}|\{Co\}|\{stock\}|\{Investor\}/g, extractEntityFromTrend(seed.title) ?? 'a major company')
    .replace(/\{[A-Z][A-Za-z\/\s]+\}/g, (m) => m.slice(1, -1));
}

function extractEntityFromTrend(title: string): string | null {
  const match = title.match(/\(([A-Z]{1,5})\)/);
  if (match) return match[1];
  const tickerLike = title.match(/\b([A-Z]{2,5})\b/);
  return tickerLike ? tickerLike[1] : null;
}
