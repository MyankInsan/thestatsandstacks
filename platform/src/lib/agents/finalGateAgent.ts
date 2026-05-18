// platform/src/lib/agents/finalGateAgent.ts
import { BaseAgent } from './interfaces';
import type { CopyBundle } from './copywritingAgent';

export interface FinalGateResult {
  passed: boolean;
  failedChecks: string[];
  revisedCopy?: CopyBundle;
}

const BANNED_WORDS = ['explodes', 'moons', 'blasts off', 'skyrockets', "can't miss", 'moon shot', 'to the moon'];
const DISCLOSURE_PHRASES = ['educational only', 'not financial advice', 'educational general information'];
const MAX_CAPTION_CHARS = 1100;
const MAX_HASHTAGS = 5;

export class FinalGateAgent extends BaseAgent {
  constructor() {
    super('FinalGateAgent');
  }

  async execute(input: { copy: CopyBundle }): Promise<FinalGateResult> {
    const checks = runChecks(input.copy);
    if (checks.length === 0) {
      console.log(`[${this.name}] ✅ Final gate passed.`);
      return { passed: true, failedChecks: [] };
    }
    console.warn(`[${this.name}] ❌ Final gate failed:`, checks);
    return { passed: false, failedChecks: checks };
  }
}

function runChecks(copy: CopyBundle): string[] {
  const failures: string[] = [];
  const captionLower = copy.caption.toLowerCase();

  const foundBanned = BANNED_WORDS.find((w) => captionLower.includes(w));
  if (foundBanned) failures.push(`Caption contains banned hype word: "${foundBanned}"`);

  const hasDisclosure = DISCLOSURE_PHRASES.some((p) => captionLower.includes(p));
  if (!hasDisclosure) failures.push('Caption is missing the required educational disclosure phrase.');

  if (copy.caption.length > MAX_CAPTION_CHARS) {
    failures.push(`caption length ${copy.caption.length} exceeds ${MAX_CAPTION_CHARS} character limit.`);
  }

  const hashtagCount = (copy.hashtags.match(/#\S+/g) ?? []).length;
  if (hashtagCount > MAX_HASHTAGS) {
    failures.push(`hashtag count ${hashtagCount} exceeds ${MAX_HASHTAGS} limit.`);
  }

  return failures;
}
