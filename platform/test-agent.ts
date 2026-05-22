import 'dotenv/config';
import { StrategyDecision } from './src/lib/agents/contentStrategyAgent';
import { ImagePromptAgent } from './src/lib/agents/imagePromptAgent';

async function test() {
  const agent = new ImagePromptAgent();
  const dummyStrategy: StrategyDecision = {
    topic: 'Testing Topic: AI in Finance',
    hook: 'AI is taking over Wall Street',
    format: 'CAROUSEL',
    slideCount: 3,
    slideBreakdown: [
      'Slide 1: AI is taking over Wall Street | Huge investments',
      'Slide 2: 70% of trades are algorithmic | Flash crashes',
      'Slide 3: Save this post to learn more'
    ],
    reasoning: 'Testing the agent',
    targetAudience: 'Tech enthusiasts',
    searchKeywords: ['AI', 'Finance']
  };

  const start = Date.now();
  const result = await agent.execute({ strategy: dummyStrategy });
  const end = Date.now();

  console.log('--- PHOTO VARIANTS ---');
  for (const variant of result.photoVariants) {
    console.log(`\n=== Aesthetic: ${variant.aestheticName} ===`);
    for (const prompt of variant.prompts) {
      console.log(`Slide ${prompt.slideNumber}:\n${prompt.dallePrompt}\n`);
    }
  }

  console.log('--- VIDEO VARIANTS ---');
  for (const variant of result.videoVariants) {
    console.log(`\n=== Aesthetic: ${variant.aestheticName} ===`);
    for (const clip of variant.videoPrompts) {
      console.log(`Clip ${clip.clipNumber} (${clip.durationSeconds}s): ${clip.prompt}\n`);
    }
  }

  console.log(`Finished in ${end - start}ms`);
}

test().catch(console.error);
