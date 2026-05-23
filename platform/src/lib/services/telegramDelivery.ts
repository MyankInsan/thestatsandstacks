import type { CopyBundle } from '../agents/copywritingAgent';
import type { StrategyDecision } from '../agents/contentStrategyAgent';
import type { FormatDecision } from '../agents/formatStyleAgent';
import type { ImagePromptSet } from '../agents/imagePromptAgent';
import { getLocalDateKey } from './dateUtils';

const TELEGRAM_RETRY_ATTEMPTS = 4;
const TELEGRAM_TIMEOUT_MS = 30_000;

export async function sendPromptsToTelegram(input: {
  copy: CopyBundle;
  strategy: StrategyDecision;
  format: FormatDecision;
  promptSet: ImagePromptSet;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TelegramDelivery] Skipped — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.');
    return;
  }

  const today = getLocalDateKey(new Date());
  const formatLabel = input.format.formatType.replace(/_/g, ' ');

  const intro = [
    `🎬 TheStatsAndStacks — ${today}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `FORMAT: ${formatLabel}`,
    `TOPIC: ${input.strategy.topic}`,
    `SLIDES: ${input.promptSet.slides.length}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Prompt package attached 👇`,
  ].join('\n');

  await callTelegram(token, 'sendMessage', { chat_id: chatId, text: intro });

  const sep = '═'.repeat(52);
  const lines: string[] = [
    `THESTATSANDSTACKS — ${today}`,
    `FORMAT: ${input.format.formatType}  |  TOPIC: ${input.strategy.topic}  |  ${input.promptSet.slides.length} SLIDES`,
    sep,
    '',
  ];

  for (const slide of input.promptSet.slides) {
    lines.push(`SLIDE ${slide.slideNumber} — ${slide.slideTitle}`);
    lines.push('─'.repeat(40));
    lines.push(slide.geminiPrompt);
    lines.push('');
    lines.push('');
  }

  lines.push(sep, 'CAPTION', sep, input.copy.caption, '');
  lines.push(sep, 'HASHTAGS', sep, input.copy.hashtags, '');
  lines.push(sep, 'PINNED COMMENT', sep, input.copy.firstComment, '');

  const docContent = lines.join('\n');
  const filename = `thestatsandstacks-${today}.txt`;

  await withTelegramRetry('sendDocument:prompts', async () => {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', `📄 ${filename} — paste each prompt into Gemini Imagen`);
    form.append(
      'document',
      new Blob([docContent], { type: 'text/plain' }),
      filename,
    );
    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/sendDocument`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`Telegram sendDocument failed: ${response.status} ${await response.text()}`);
    }
  });

  console.log(`[TelegramDelivery] ✅ Sent intro + ${filename} (${input.promptSet.slides.length} slides).`);
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
  return new Promise(resolve => setTimeout(resolve, ms));
}
