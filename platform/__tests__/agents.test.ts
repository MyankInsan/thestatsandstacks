import { PublisherAgent } from '../src/lib/agents/publisherAgent';

describe('Publisher Agent Fail-Safe Logic', () => {
  it('should reject publish if confidence score is below 0.85', async () => {
    const agent = new PublisherAgent();
    
    const result = await agent.execute({
      packaging: {
        finalCaption: 'Test caption',
        hashtags: ['#test'],
        cta: 'Save',
        altText: 'Alt',
        confidenceScore: 0.60, // Low confidence!
        readyToPublish: true
      },
      imageUrls: ['url1']
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Confidence score below threshold');
  });

  it('should pass and attempt publish if confidence is high', async () => {
    const agent = new PublisherAgent();
    
    const result = await agent.execute({
      packaging: {
        finalCaption: 'Test caption',
        hashtags: ['#test'],
        cta: 'Save',
        altText: 'Alt',
        confidenceScore: 0.95, // High confidence!
        readyToPublish: true
      },
      imageUrls: ['url1']
    });

    expect(result.success).toBe(true);
  });
});
