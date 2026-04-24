import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const agentQueue = new Queue('agent-workflows', { connection });

// This worker processes steps in the autonomous flow
export const agentWorker = new Worker('agent-workflows', async (job: Job) => {
  console.log(`Processing job ${job.id} of type ${job.name}`);
  
  switch (job.name) {
    case 'trend-research':
      // Call TrendResearchAgent
      console.log('Running trend research...');
      break;
    case 'content-strategy':
      // Call ContentStrategyAgent
      console.log('Deciding content strategy...');
      break;
    default:
      console.log(`Unknown job type: ${job.name}`);
  }
}, { connection });

export async function scheduleDailyWorkflow() {
  await agentQueue.add('trend-research', {}, {
    repeat: {
      pattern: '0 8 * * *', // Every day at 8 AM
    }
  });
}
