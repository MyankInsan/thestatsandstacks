import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Stable, free-tier-eligible Gemini text models the zero-cost pipeline is
 * allowed to use. Pinning to an explicit stable model (not a floating `latest`
 * alias) keeps cost and behavior predictable: Google documents that `*-latest`
 * aliases can hot-swap to preview/experimental variants, which is too loose for
 * a strict $0 workflow. CostGuardAgent enforces this allowlist.
 *
 * gemini-3.5-flash is the current GA flagship flash model; the lite/older flash
 * models are kept as stable, lower-cost alternates a user can pin to via
 * GEMINI_TEXT_MODEL if quota or availability demands it.
 */
export const STABLE_GEMINI_TEXT_MODELS: readonly string[] = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-3.5-flash';

/**
 * Substrings that indicate a non-stable alias or a non-text / billable modality.
 * Any configured text model containing one of these is rejected in zero-cost
 * mode even before the allowlist check, so the failure message is specific.
 */
const FORBIDDEN_MODEL_SUBSTRINGS: readonly string[] = [
  'latest',
  'preview',
  'exp',          // experimental / -exp- variants
  'image',
  'imagen',
  'audio',
  'tts',
  'live',
  'embedding',
  'native-audio',
  'dialog',
];

export interface TextModelSafetyResult {
  safe: boolean;
  failures: string[];
}

/** True when `model` is on the explicit stable free-tier allowlist. */
export function isStableFreeTierTextModel(model: string): boolean {
  return STABLE_GEMINI_TEXT_MODELS.includes(model);
}

/**
 * Deterministic, side-effect-free check used by CostGuardAgent. Returns the
 * specific reasons a configured text model is not zero-cost-safe.
 */
export function checkTextModelSafety(model: string): TextModelSafetyResult {
  const failures: string[] = [];
  const normalized = (model || '').trim().toLowerCase();

  if (!normalized) {
    failures.push('GEMINI_TEXT_MODEL is empty; pin an explicit stable model such as gemini-3.5-flash.');
    return { safe: false, failures };
  }

  for (const bad of FORBIDDEN_MODEL_SUBSTRINGS) {
    if (normalized.includes(bad)) {
      failures.push(`GEMINI_TEXT_MODEL='${model}' contains forbidden token '${bad}' (latest/preview/experimental aliases and non-text modalities are not allowed in zero-cost mode).`);
    }
  }

  if (!isStableFreeTierTextModel(model)) {
    failures.push(`GEMINI_TEXT_MODEL='${model}' is not on the stable free-tier allowlist: ${STABLE_GEMINI_TEXT_MODELS.join(', ')}.`);
  }

  return { safe: failures.length === 0, failures };
}

async function callWithRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 2000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const errMessage = String(err.message || err);
    const isRateLimit = errMessage.includes('429') ||
                        errMessage.includes('RESOURCE_EXHAUSTED') ||
                        errMessage.includes('Quota exceeded') ||
                        errMessage.includes('Too Many Requests');
    const isServerTransient = errMessage.includes('500') ||
                              errMessage.includes('503') ||
                              errMessage.includes('overloaded') ||
                              errMessage.includes('Service Unavailable');

    if ((isRateLimit || isServerTransient) && retries > 0) {
      console.warn(`[Gemini client] Transient error detected (${errMessage}). Retrying in ${delayMs}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return callWithRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

// Single shared Gemini client used by all agents
export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to GitHub Actions secrets or platform/.env.');
  }
  const client = new GoogleGenerativeAI(apiKey);

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'getGenerativeModel') {
        return function(options: any) {
          const model = target.getGenerativeModel(options);
          return new Proxy(model, {
            get(mTarget, mProp) {
              if (mProp === 'generateContent') {
                return async function(...args: any[]) {
                  // Pass positionally (request, requestOptions?) so spreading an
                  // any[] doesn't trip the tuple-spread type error.
                  return callWithRetry(() => mTarget.generateContent(args[0], args[1]));
                };
              }
              return Reflect.get(mTarget, mProp);
            }
          });
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  }) as any;
}

export function getGeminiTextModelName(): string {
  return process.env.GEMINI_TEXT_MODEL || DEFAULT_GEMINI_TEXT_MODEL;
}
