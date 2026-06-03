import type { CopyBundle } from '../agents/copywritingAgent';
import type { StrategyDecision } from '../agents/contentStrategyAgent';
import type { FormatDecision } from '../agents/formatStyleAgent';
import type { ImagePromptSet } from '../agents/imagePromptAgent';
import type { SlotConfig } from '../agents/slotConfig';
import { formatQcSummary, type QcReport } from '../agents/qcGateAgent';
import { getLocalDateKey } from './dateUtils';

const TELEGRAM_RETRY_ATTEMPTS = 4;
const TELEGRAM_TIMEOUT_MS = 30_000;

/** Total daily slots. Telegram labels read "Post x/6". */
export const TOTAL_DAILY_SLOTS = 6;

export interface TelegramDeliveryInput {
  copy: CopyBundle;
  strategy: StrategyDecision;
  format: FormatDecision;
  promptSet: ImagePromptSet;
  slot?: SlotConfig;
  varietyFallbackRatePct?: number;
  /** Optional human-verification block (evidence review flags). */
  reviewBlock?: string;
  /** Optional storyboard premise / composition signature surfaced in the intro. */
  storyboardPremise?: string;
  compositionSignature?: string;
  /** Optional deterministic QC report surfaced in the intro + document. */
  qcReport?: QcReport;
}

export interface TelegramPacket {
  intro: string;
  document: string;
  filename: string;
}

/**
 * Pure formatter: turns a delivery input into the intro message + document body
 * + filename WITHOUT any network I/O. Extracted so the packet format is unit
 * testable and so local formatting failures surface before any send attempt.
 */
export function formatTelegramPacket(input: TelegramDeliveryInput, today: string): TelegramPacket {
  const formatLabel = input.format.formatType.replace(/_/g, ' ');
  const slotLabel = input.slot
    ? `Post ${input.slot.index}/${TOTAL_DAILY_SLOTS} — ${input.slot.persona.replace(/_/g, ' ')}`
    : 'Post';

  const introLines: string[] = [
    `🎬 TheStatsAndStacks — ${today}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `${slotLabel}`,
    `FORMAT: ${formatLabel}`,
    `TOPIC: ${input.strategy.topic}`,
    `HOOK: ${input.strategy.hook}`,
    input.strategy.hookFormulaId ? `HOOK FORMULA: ${input.strategy.hookFormulaId}` : '',
    input.strategy.ctaId ? `CTA STRATEGY: ${input.strategy.ctaId}` : '',
    input.storyboardPremise ? `STORYBOARD: ${input.storyboardPremise}` : '',
    input.compositionSignature ? `COMPOSITION SIGNATURE: ${input.compositionSignature}` : '',
    `SLIDES: ${input.promptSet.slides.length}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    input.qcReport ? formatQcSummary(input.qcReport) : '',
    input.qcReport ? `━━━━━━━━━━━━━━━━━━━━` : '',
    'Primary render target: ChatGPT Images 2.0 (paste the anchor prompt, generate slide 1, then continue in the SAME conversation).',
    'Alternate: Seedream for cinematic image-first scenes.',
    'Slides flagged ⚠️ may garble dense chart text — a clean Canva overlay fallback block is included.',
    'Prompt package attached 👇',
  ].filter(Boolean);

  if (input.reviewBlock) {
    introLines.splice(1, 0, '⚠️ HUMAN REVIEW REQUIRED — see review block in the attached document.');
  }

  if (input.varietyFallbackRatePct !== undefined && input.varietyFallbackRatePct > 25) {
    introLines.unshift(`⚠️ Variety enforcement stressed (${input.varietyFallbackRatePct.toFixed(0)}% fallback rate over 7d) — review may be needed`);
  }

  const sep = '═'.repeat(52);
  const lines: string[] = [
    `THESTATSANDSTACKS — ${today}  |  ${slotLabel}`,
    `FORMAT: ${input.format.formatType}  |  TOPIC: ${input.strategy.topic}  |  ${input.promptSet.slides.length} SLIDES`,
    'PRIMARY: ChatGPT Images 2.0   |   ALTERNATE: Seedream (cinematic image-first scenes)',
    sep,
  ];

  if (input.storyboardPremise) {
    lines.push('', `STORYBOARD PREMISE: ${input.storyboardPremise}`);
  }
  if (input.compositionSignature) {
    lines.push(`COMPOSITION SIGNATURE: ${input.compositionSignature}`);
  }

  if (input.reviewBlock) {
    lines.push('', sep, '⚠️ HUMAN REVIEW REQUIRED', sep, input.reviewBlock);
  }

  if (input.qcReport) {
    lines.push('', sep, `QC REPORT — ${input.qcReport.overall}  |  ENGAGEMENT ${input.qcReport.engagementScore}/100 (${input.qcReport.engagementLabel})`, sep);
    for (const c of input.qcReport.checks) {
      lines.push(`[${c.status}] ${c.label}: ${c.detail}`);
    }
  }

  lines.push('', sep, '');
  lines.push(
    'CHATGPT IMAGES 2.0 WORKFLOW:',
    '1. Paste the packet-level anchor prompt (Slide 1) into a new ChatGPT conversation.',
    '2. Generate slide 1 first.',
    '3. Keep working in the SAME conversation for slides 2..N.',
    '4. For each later slide paste its prompt and use the prior image as reference when useful.',
    '5. Preserve the MUST KEEP list and change ONLY the requested slide content.',
    '',
  );

  for (const slide of input.promptSet.slides) {
    lines.push(`SLIDE ${slide.slideNumber} — ${slide.slideTitle}${slide.canvaFallbackSuggested ? ' ⚠️ Canva fallback may be needed' : ''}`);
    lines.push(`(${slide.recommendedModelLabel})`);
    lines.push('─'.repeat(40));
    lines.push(slide.geminiPrompt);
    if (slide.canvaFallbackSuggested && slide.canvaFallbackData) {
      lines.push('');
      lines.push('── If chart text garbles, regenerate visual-only and overlay this in Canva: ──');
      lines.push(slide.canvaFallbackData);
    }
    lines.push('');
    lines.push('');
  }

  lines.push(sep, 'CAPTION', sep, input.copy.caption, '');
  lines.push(sep, 'HASHTAGS', sep, input.copy.hashtags, '');
  lines.push(sep, 'PINNED COMMENT', sep, input.copy.firstComment, '');

  const filename = `thestatsandstacks-${today}${input.slot ? `-s${input.slot.index}` : ''}.txt`;

  return {
    intro: introLines.join('\n'),
    document: lines.join('\n'),
    filename,
  };
}

export async function sendPromptsToTelegram(input: TelegramDeliveryInput): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TelegramDelivery] Skipped — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.');
    return;
  }

  const today = getLocalDateKey(new Date());
  // Format locally first so any formatting bug surfaces before we hit the API.
  const packet = formatTelegramPacket(input, today);

  await callTelegram(token, 'sendMessage', { chat_id: chatId, text: packet.intro });

  await withTelegramRetry('sendDocument:prompts', async () => {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', `📄 ${packet.filename} — paste each prompt into the model tagged on the slide`);
    form.append(
      'document',
      new Blob([packet.document], { type: 'text/plain' }),
      packet.filename,
    );
    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/sendDocument`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`Telegram sendDocument failed: ${response.status} ${await response.text()}`);
    }
  });

  console.log(`[TelegramDelivery] ✅ Sent intro + ${packet.filename} (${input.promptSet.slides.length} slides).`);
}

async function callTelegram(token: string, method: string, body: Record<string, unknown>): Promise<void> {
  await withTelegramRetry(method, async () => {
    const response = await fetchWithTimeout(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Telegram ${method} failed: ${response.status} ${await response.text()}`);
    }
  });
}

async function withTelegramRetry(label: string, operation: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TELEGRAM_RETRY_ATTEMPTS; attempt++) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      if (attempt === TELEGRAM_RETRY_ATTEMPTS) break;
      const delayMs = 1_500 * attempt * attempt;
      console.warn(`[TelegramDelivery] ${label} attempt ${attempt} failed; retrying in ${delayMs}ms.`);
      await delay(delayMs);
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[TelegramDelivery] ${label} failed after ${TELEGRAM_RETRY_ATTEMPTS} attempts: ${msg}`);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
