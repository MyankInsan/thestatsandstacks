import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { BaseAgent } from './interfaces';
import { GeneratedVideo } from './videoGenerationAgent';

export interface VideoQAReport {
  isValid: boolean;
  confidenceScore: number;
  failures: string[];
  metadata?: {
    durationSeconds?: number;
    width?: number;
    height?: number;
    videoCodec?: string;
    audioCodec?: string;
    sizeBytes?: number;
  };
}

const TELEGRAM_SAFE_UPLOAD_BYTES = 45 * 1024 * 1024;

export class VideoQAAgent extends BaseAgent {
  constructor() {
    super('VideoQAAgent');
  }

  async execute(input: { video: GeneratedVideo | null }): Promise<VideoQAReport> {
    console.log(`[${this.name}] Inspecting video...`);

    if (!input.video) {
      return {
        isValid: false,
        confidenceScore: 0,
        failures: ['No video was generated.'],
      };
    }

    const failures: string[] = [];
    const metadata: VideoQAReport['metadata'] = {};

    if (!fs.existsSync(input.video.localPath)) {
      return {
        isValid: false,
        confidenceScore: 0.1,
        failures: ['Video file is missing.'],
      };
    }

    const stats = fs.statSync(input.video.localPath);
    metadata.sizeBytes = stats.size;
    if (stats.size < 100_000) failures.push('Video file is unexpectedly small.');
    if (stats.size > TELEGRAM_SAFE_UPLOAD_BYTES) {
      failures.push('Video is too large for reliable Telegram bot delivery.');
    }
    if (path.extname(input.video.localPath).toLowerCase() !== '.mp4') {
      failures.push('Video file is not an MP4.');
    }

    const probe = probeVideo(input.video.localPath);
    if (probe) {
      metadata.durationSeconds = probe.durationSeconds;
      metadata.width = probe.width;
      metadata.height = probe.height;
      metadata.videoCodec = probe.videoCodec;
      metadata.audioCodec = probe.audioCodec;

      if (!probe.videoCodec) failures.push('No video stream was detected.');
      if (probe.videoCodec && probe.videoCodec !== 'h264') failures.push(`Unexpected video codec: ${probe.videoCodec}.`);
      if (probe.audioCodec && probe.audioCodec !== 'aac') failures.push(`Unexpected audio codec: ${probe.audioCodec}.`);
      if (!probe.durationSeconds || probe.durationSeconds < 3) failures.push('Video is shorter than Instagram Reel minimum expectations.');
      if (probe.durationSeconds && probe.durationSeconds > 90) failures.push('Video is longer than the automation target of 90 seconds.');
      if (probe.width !== input.video.width || probe.height !== input.video.height) {
        failures.push(`Unexpected dimensions: ${probe.width || '?'}x${probe.height || '?'}.`);
      }
    } else {
      failures.push('ffprobe is not installed or could not read metadata; falling back to file-size QA only.');
    }

    const metadataProbeMissingOnly = failures.length === 1 && failures[0].startsWith('ffprobe is not installed');
    const isValid = failures.length === 0 || (metadataProbeMissingOnly && stats.size >= 100_000);

    return {
      isValid,
      confidenceScore: isValid ? (metadataProbeMissingOnly ? 0.82 : 0.96) : 0.35,
      failures: isValid && metadataProbeMissingOnly ? [] : failures,
      metadata,
    };
  }
}

interface ProbeResult {
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
}

function probeVideo(filePath: string): ProbeResult | null {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_format',
    '-show_streams',
    '-print_format', 'json',
    filePath,
  ], { encoding: 'utf-8' });

  if (result.status !== 0 || !result.stdout) return null;

  try {
    const parsed = JSON.parse(result.stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        duration?: string;
      }>;
    };
    const videoStream = parsed.streams?.find((stream) => stream.codec_type === 'video');
    const audioStream = parsed.streams?.find((stream) => stream.codec_type === 'audio');
    const duration = Number(parsed.format?.duration || videoStream?.duration);

    return {
      durationSeconds: Number.isFinite(duration) ? duration : undefined,
      width: videoStream?.width,
      height: videoStream?.height,
      videoCodec: videoStream?.codec_name,
      audioCodec: audioStream?.codec_name,
    };
  } catch {
    return null;
  }
}
