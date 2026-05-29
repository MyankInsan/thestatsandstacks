import {
  type SlotIndex,
  type SlotConfig,
  SLOT_CONFIGS,
  resolveSlotFromCron,
  isVancouverInDst,
} from './slotConfig';
import type { ContentHistoryEntry } from '../services/contentHistory';

export interface SlotContext {
  slotIndex: SlotIndex;
  config: SlotConfig;
  todayDateKey: string;
  todayPriorEntries: ContentHistoryEntry[];
  triggerSource: 'cron' | 'workflow_dispatch_override' | 'wall_clock_fallback';
  forceAngleId?: string;
}

export class SlotContextAgent {
  execute(input: {
    contentHistory: ContentHistoryEntry[];
    todayDateKey: string;
    now?: Date;
  }): SlotContext {
    const now = input.now ?? new Date();
    const isDst = isVancouverInDst(now);

    let slotIndex: SlotIndex | null = null;
    let triggerSource: SlotContext['triggerSource'] = 'cron';

    const slotOverride = process.env.SLOT_OVERRIDE;
    const eventName = process.env.GITHUB_EVENT_NAME;
    const scheduledStr = process.env.GITHUB_EVENT_SCHEDULE;

    if (eventName === 'workflow_dispatch') {
      if (!slotOverride) {
        throw new Error(
          'Manual dispatch requires SLOT_OVERRIDE=1|2|3|4|5|6. Without it, the slot is ambiguous. Re-run with the env set.',
        );
      }
      const parsed = Number(slotOverride);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 6) {
        throw new Error(`Invalid SLOT_OVERRIDE='${slotOverride}'. Must be 1-6.`);
      }
      slotIndex = parsed as SlotIndex;
      triggerSource = 'workflow_dispatch_override';
    } else if (scheduledStr) {
      slotIndex = resolveSlotFromCron(scheduledStr, isDst);
      if (!slotIndex) {
        throw new Error(
          `Cron '${scheduledStr}' did not map to any slot in Vancouver ${isDst ? 'PDT' : 'PST'}. Check workflow yaml.`,
        );
      }
    } else if (slotOverride) {
      const parsed = Number(slotOverride);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 6) {
        slotIndex = parsed as SlotIndex;
        triggerSource = 'workflow_dispatch_override';
      }
    }

    if (!slotIndex) {
      slotIndex = nearestSlotByWallClock(now);
      triggerSource = 'wall_clock_fallback';
      console.warn(
        `[SlotContextAgent] No SLOT_OVERRIDE or GITHUB_EVENT_SCHEDULE detected; using wall-clock fallback slot ${slotIndex}.`,
      );
    }

    const config = SLOT_CONFIGS[slotIndex];

    const todayPriorEntries = input.contentHistory.filter((e) => e.date === input.todayDateKey);

    return {
      slotIndex,
      config,
      todayDateKey: input.todayDateKey,
      todayPriorEntries,
      triggerSource,
      forceAngleId: process.env.FORCE_ANGLE || undefined,
    };
  }
}

function nearestSlotByWallClock(now: Date): SlotIndex {
  const vancouverHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Vancouver',
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );

  if (vancouverHour < 8) return 1;
  if (vancouverHour < 10) return 2;
  if (vancouverHour < 12) return 3;
  if (vancouverHour < 14) return 4;
  if (vancouverHour < 15) return 5;
  return 6;
}
