import { GoogleGenerativeAI } from '@google/generative-ai';

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
                  return callWithRetry(() => mTarget.generateContent(...args));
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
  return process.env.GEMINI_TEXT_MODEL || 'gemini-flash-latest';
}

