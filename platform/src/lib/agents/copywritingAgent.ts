import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';
import { getGeminiClient } from '../services/gemini';

export interface CopyBundle {
  caption: string;
  hashtags: string;
  cta: string;
  firstComment: string;
  altText: string;
}

export class CopywritingAgent extends BaseAgent {
  constructor() {
    super('CopywritingAgent');
  }

  async execute(input: { strategy: StrategyDecision }): Promise<CopyBundle> {
    console.log(`[${this.name}] ✍️  Writing caption, hashtags, and comments...`);

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `You are the head copywriter for "TheStatsAndStacks", a premium Canadian personal finance Instagram brand.

Write Instagram copy that is:
- HOOK-DRIVEN: First line must stop the scroll
- SAVE-WORTHY: People should want to bookmark this
- SHARE-WORTHY: People should want to send this to friends
- SEARCHABLE: Use terms people actually search for on Instagram
- CREDIBLE: Smart, clear, no hype, no fake guru energy
- CONCISE: Every word earns its place

CAPTION STRUCTURE:
1. Hook line (bold, attention-grabbing, use an emoji sparingly)
2. 2-3 short paragraphs of value
3. Clear CTA (save, share, follow, or comment)

HASHTAG RULES:
- Use 15-20 hashtags max
- Mix of large (100K+ posts), medium (10K-100K), and niche (under 10K)
- Always include #TheStatsAndStacks
- Focus on Canadian finance hashtags
- No banned or spammy hashtags

FIRST COMMENT:
- Write an engaging question that encourages discussion
- Should feel natural, not forced

ALT TEXT:
- Describe the visual content for accessibility

Topic: ${input.strategy.topic}
Hook: ${input.strategy.hook}
Format: ${input.strategy.format} (${input.strategy.slideCount} slides)
Target Audience: ${input.strategy.targetAudience}
Search Keywords: ${input.strategy.searchKeywords.join(', ')}

Slide breakdown:
${input.strategy.slideBreakdown.join('\n')}

Write the full copy package. Output ONLY valid JSON (no markdown, no code fences):
{
  "caption": "the full caption with line breaks using actual newlines",
  "hashtags": "all hashtags as a single string",
  "cta": "the call to action",
  "firstComment": "the first comment to post",
  "altText": "accessibility description"
}`,
    });

    const text = response.text?.trim();
    if (!text) throw new Error('No content from Gemini');

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned) as CopyBundle;

    console.log(`[${this.name}] ✅ Caption written (${result.caption.length} chars)`);
    return result;
  }
}
