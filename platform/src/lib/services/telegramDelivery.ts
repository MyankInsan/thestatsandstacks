import fs from 'fs';
import path from 'path';
import { GeneratedImage } from '../agents/imageGenerationAgent';
import { CopyBundle } from '../agents/copywritingAgent';
import { StrategyDecision } from '../agents/contentStrategyAgent';
import { QAReport } from '../agents/visionQAAgent';

export async function sendPostToTelegram(input: {
  images: GeneratedImage[],
  copy: CopyBundle,
  strategy: StrategyDecision,
  qaReport: QAReport,
  manualPromptPath?: string,
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TelegramDelivery] Skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).');
    return;
  }

  const summary = [
    `TheStatsAndStacks daily post`,
    `Topic: ${input.strategy.topic}`,
    `Format: ${input.strategy.format} (${input.images.length} slides)`,
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

  console.log(`[TelegramDelivery] ✅ Sent ${input.images.length} slides to Telegram.`);
}

async function callTelegram(token: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${await response.text()}`);
  }
}

async function uploadTelegramDocument(input: {
  token: string,
  chatId: string,
  filePath: string,
  caption: string,
  contentType: string,
}) {
  const fileBuffer = fs.readFileSync(input.filePath);
  const form = new FormData();
  form.append('chat_id', input.chatId);
  form.append('caption', input.caption);
  form.append(
    'document',
    new Blob([new Uint8Array(fileBuffer)], { type: input.contentType }),
    path.basename(input.filePath)
  );

  const response = await fetch(`https://api.telegram.org/bot${input.token}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Telegram sendDocument failed: ${response.status} ${await response.text()}`);
  }
}
