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
const MAX_PHOTOS_PER_ALBUM = 10;

export async function sendPostToTelegram(input: {
  images: GeneratedImage[];
  copy: CopyBundle;
  strategy: StrategyDecision;
  qaReport: QAReport;
  manualPromptPath?: string;
  researchBriefPath?: string;
  visualAssetPlanPath?: string;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TelegramDelivery] Skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).');
    return;
  }

  // 1: Photo album — images display inline, not as file downloads
  await sendPhotoAlbum(token, chatId, input.images, buildAlbumCaption(input.strategy, input.qaReport));

  // 2: Caption — copy-ready labeled message
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildCaptionMessage(input.copy.caption).slice(0, 4096),
  });

  // 3: Hashtags — copy-ready labeled message
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildHashtagsMessage(input.copy.hashtags).slice(0, 4096),
  });

  // 4: Pinned comment — copy-ready labeled message
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildPinnedCommentMessage(input.copy.firstComment).slice(0, 4096),
  });

  // Reference documents (research brief, visual plan, manual prompts)
  const docs: Array<{ path: string | undefined; caption: string }> = [
    { path: input.manualPromptPath,    caption: 'Manual image prompts & style lock' },
    { path: input.researchBriefPath,   caption: 'Research brief & content rationale' },
    { path: input.visualAssetPlanPath, caption: 'Visual source plan & attribution' },
  ];
  for (const doc of docs) {
    if (doc.path && fs.existsSync(doc.path)) {
      await uploadTelegramDocument({
        token,
        chatId,
        filePath: doc.path,
        caption: doc.caption,
        contentType: 'text/markdown',
      });
    }
  }

  console.log(`[TelegramDelivery] ✅ Sent ${input.images.length} slides as inline photos + 3 copy-ready messages.`);
}

export async function sendVideoToTelegram(input: {
  videoPath: string;
  copy: CopyBundle;
  strategy: StrategyDecision;
  qaReport: QAReport;
  durationSeconds: number;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TelegramDelivery] Video skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).');
    return;
  }

  // 1: Send the video file inline (displays in chat, not as a download)
  await withTelegramRetry('sendVideo', async () => {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', buildAlbumCaption(input.strategy, input.qaReport).slice(0, 1024));
    form.append('supports_streaming', 'true');
    form.append('width', '1080');
    form.append('height', '1350');
    form.append('duration', String(Math.round(input.durationSeconds)));
    const buf = fs.readFileSync(input.videoPath);
    form.append(
      'video',
      new Blob([new Uint8Array(buf)], { type: 'video/mp4' }),
      'reel.mp4',
    );
    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/sendVideo`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`Telegram sendVideo failed: ${response.status} ${await response.text()}`);
    }
  });

  // 2-4: Same copy-ready messages as photo delivery
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildCaptionMessage(input.copy.caption).slice(0, 4096),
  });
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildHashtagsMessage(input.copy.hashtags).slice(0, 4096),
  });
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildPinnedCommentMessage(input.copy.firstComment).slice(0, 4096),
  });

  console.log(`[TelegramDelivery] ✅ Sent Reels video + 3 copy-ready messages.`);
}

async function sendPhotoAlbum(
  token: string,
  chatId: string,
  images: GeneratedImage[],
  firstCaption: string,
): Promise<void> {
  const chunks = chunkIntoAlbums(images, MAX_PHOTOS_PER_ALBUM);

  for (const [chunkIdx, chunk] of chunks.entries()) {
    await withTelegramRetry(`sendMediaGroup:chunk${chunkIdx}`, async () => {
      const form = new FormData();
      form.append('chat_id', chatId);

      const mediaArr = chunk.map((img, localIdx) => {
        const globalIdx = chunkIdx * MAX_PHOTOS_PER_ALBUM + localIdx;
        const fieldName = `photo${globalIdx}`;
        const buf = fs.readFileSync(img.localPath);
        form.append(
          fieldName,
          new Blob([new Uint8Array(buf)], { type: 'image/png' }),
          path.basename(img.localPath),
        );
        return {
          type: 'photo',
          media: `attach://${fieldName}`,
          ...(globalIdx === 0 ? { caption: firstCaption.slice(0, 1024) } : {}),
        };
      });

      form.append('media', JSON.stringify(mediaArr));

      const response = await fetchWithTimeout(
        `https://api.telegram.org/bot${token}/sendMediaGroup`,
        { method: 'POST', body: form },
      );
      if (!response.ok) {
        throw new Error(`Telegram sendMediaGroup chunk ${chunkIdx} failed: ${response.status} ${await response.text()}`);
      }
    });
  }
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

