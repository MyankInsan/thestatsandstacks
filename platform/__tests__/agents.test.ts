import test from 'node:test';
import assert from 'node:assert/strict';
import { PublisherAgent } from '../src/lib/agents/publisherAgent';

test('PublisherAgent rejects publish if confidence score is below 0.85', async () => {
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

  assert.equal(result.success, false);
  assert.match(result.error || '', /Confidence score below threshold/);
});

test('PublisherAgent passes and attempts publish if confidence is high', async () => {
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

  assert.equal(result.success, true);
});
