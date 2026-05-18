import fs from 'fs';
import path from 'path';
import { GeneratedImage } from '../agents/imageGenerationAgent';
import { CopyBundle } from '../agents/copywritingAgent';
import { StrategyDecision } from '../agents/contentStrategyAgent';
import { QAReport } from '../agents/visionQAAgent';

const TELEGRAM_RETRY_ATTEMPTS = 4;

export function buildAlbumCaption(strategy: StrategyDecision, qaReport: QAReport): string {
  return `TheStatsAndStacks\n${strategy.topic}\n${strategy.format} · QA ${(qaReport.overallScore * 100).toFixed(0)}%`;
}

export function buildCaptionMessage(caption: string): string {
  return `📝 CAPTION — copy this into Instagram:\n\n${caption}`;
}

export function buildHashtagsMessage(hashtags: string): string {
  return `#️⃣ HASHTAGS — copy these:\n\n${hashtags}`;
}

export function buildPinnedCommentMessage(firstComment: string): string {
  return `📌 PIN THIS COMMENT — post after publishing:\n\n${firstComment}`;
}

export function chunkIntoAlbums<T>(items: T[], maxPerAlbum: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += maxPerAlbum) {
    chunks.push(items.slice(i, i + maxPerAlbum));
  }
  return chunks;
}
const TELEGRAM_TIMEOUT_MS = 30_000;

export async function sendPostToTelegram(input: {
  images: GeneratedImage[],
  copy: CopyBundle,
  strategy: StrategyDecision,
  qaReport: QAReport,
  manualPromptPath?: string,
  researchBriefPath?: string,
  visualAssetPlanPath?: string,
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TelegramDelivery] Skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).');
    return;
  }
  const mediaSummary = buildMediaSummary(input.images.length);

  const summary = [
    `TheStatsAndStacks daily post`,
    `Topic: ${input.strategy.topic}`,
    `Format: ${input.strategy.format} (${mediaSummary})`,
    `QA Score: ${(input.qaReport.overallScore * 100).toFixed(0)}%`,
    '',
    input.copy.caption,
    '',
    input.copy.hashtags,
  ].join('\n');

  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: summary.slice(0, 3900),
  });

  for (const image of input.images) {
    await uploadTelegramDocument({
      token,
      chatId,
      filePath: image.localPath,
      caption: `Slide ${image.slideNumber}`,
      contentType: image.mimeType,
    });
  }

  if (input.manualPromptPath && fs.existsSync(input.manualPromptPath)) {
    await uploadTelegramDocument({
      token,
      chatId,
      filePath: input.manualPromptPath,
      caption: 'Manual prompts and style lock',
      contentType: 'text/markdown',
    });
  }

  if (input.researchBriefPath && fs.existsSync(input.researchBriefPath)) {
    await uploadTelegramDocument({
      token,
      chatId,
      filePath: input.researchBriefPath,
      caption: 'Research brief and content rationale',
      contentType: 'text/markdown',
    });
  }

  if (input.visualAssetPlanPath && fs.existsSync(input.visualAssetPlanPath)) {
    await uploadTelegramDocument({
      token,
      chatId,
      filePath: input.visualAssetPlanPath,
      caption: 'Visual source plan and attribution notes',
      contentType: 'text/markdown',
    });
  }

  console.log(`[TelegramDelivery] ✅ Sent ${input.images.length} picture slides to Telegram.`);
}

async function callTelegram(token: string, method: string, body: Record<string, unknown>) {
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

async function uploadTelegramDocument(input: {
  token: string,
  chatId: string,
  filePath: string,
  caption: string,
  contentType: string,
}) {
  const stats = fs.statSync(input.filePath);
  if (stats.size > 49 * 1024 * 1024) {
    throw new Error(`Telegram upload skipped because ${path.basename(input.filePath)} is larger than the Bot API upload limit.`);
  }

  await withTelegramRetry(`sendDocument:${path.basename(input.filePath)}`, async () => {
    const fileBuffer = fs.readFileSync(input.filePath);
    const form = new FormData();
    form.append('chat_id', input.chatId);
    form.append('caption', input.caption);
    form.append(
      'document',
      new Blob([new Uint8Array(fileBuffer)], { type: input.contentType }),
      path.basename(input.filePath)
    );

    const response = await fetchWithTimeout(`https://api.telegram.org/bot${input.token}/sendDocument`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Telegram sendDocument failed: ${response.status} ${await response.text()}`);
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
      console.warn(`[TelegramDelivery] ${label} failed on attempt ${attempt}; retrying in ${delayMs}ms.`);
      await delay(delayMs);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[TelegramDelivery] ${label} failed after ${TELEGRAM_RETRY_ATTEMPTS} attempts: ${message}`);
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

function buildMediaSummary(imageCount: number): string {
  return imageCount > 0 ? `${imageCount} picture slide${imageCount === 1 ? '' : 's'}` : 'no media';
}
