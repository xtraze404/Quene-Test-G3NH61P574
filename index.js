// index.js
// Main entry point for Walmart Queue Bot

const QueueBot = require('./queue-bot');
const DashboardServer = require('./dashboard-server');
const config = require('./config');

async function main() {
  console.log('🚀 Starting Walmart Queue Bot...\n');
  
  // Initialize bot
  const bot = new QueueBot();
  await bot.init();
  
  // Initialize dashboard
  const dashboard = new DashboardServer(bot);
  dashboard.start(config.DASHBOARD_PORT);
  
  console.log('\n✅ Bot and Dashboard initialized successfully!');
  console.log(`🌐 Open http://localhost:${config.DASHBOARD_PORT} in your browser`);
  console.log('\n📝 Next steps:');
  console.log('   1. Update config.js with your Walmart credentials');
  console.log('   2. Click "Start Bot" on the dashboard');
  console.log('   3. Monitor stock and wait for queue entry');
  console.log('   4. Approve checkout when ready\n');
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    await bot.close();
    await dashboard.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down...');
    await bot.close();
    await dashboard.stop();
    process.exit(0);
  });
}

// Run the application
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
