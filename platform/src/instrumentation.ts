export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron');
    const { runDailyWorkflow } = await import('./lib/queue/workflow');

    // ═══════════════════════════════════════════════════════
    // DAILY 8:00 AM CRON JOB (Vancouver time)
    // This runs automatically every morning.
    // No buttons. No manual work. Just wake up to an email.
    // ═══════════════════════════════════════════════════════
    cron.schedule('0 8 * * *', async () => {
      console.log('');
      console.log('⏰ ════════════════════════════════════════════');
      console.log('⏰  8:00 AM CRON TRIGGERED — Starting Daily Pipeline');
      console.log('⏰ ════════════════════════════════════════════');
      console.log('');
      
      try {
        const result = await runDailyWorkflow();
        console.log('⏰ Daily pipeline completed successfully!', result);
      } catch (error) {
        console.error('⏰ Daily pipeline FAILED:', error);
      }
    }, {
      timezone: 'America/Vancouver'
    });

    console.log('');
    console.log('✅ ════════════════════════════════════════════');
    console.log('✅  TheStatsAndStacks is ONLINE');
    console.log('✅  Daily pipeline scheduled for 8:00 AM PST');
    console.log('✅  Posts will be emailed to your phone');
    console.log('✅ ════════════════════════════════════════════');
    console.log('');
  }
}
