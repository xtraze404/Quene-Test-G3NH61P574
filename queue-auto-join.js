/**
 * Walmart Queue - Auto Join Test
 * Automatically joins the queue for multiple test links
 */

const axios = require('axios');

// Configuration
const CONFIG = {
  // Update these with your actual Walmart queue endpoints
  queueLinks: [
    'https://example.com/queue/test-1',
    'https://example.com/queue/test-2',
    'https://example.com/queue/test-3',
  ],
  timeout: 10000,
  retries: 3,
};

class QueueAutoJoinTest {
  constructor(config = CONFIG) {
    this.config = config;
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Join a single queue
   */
  async joinQueue(queueUrl, userId = `user-${Date.now()}`) {
    const client = axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'Queue-Test-Bot/1.0',
      },
    });

    let lastError = null;
    let attempt = 0;

    while (attempt < this.config.retries) {
      try {
        attempt++;
        const response = await client.post(`${queueUrl}/join`, {
          userId,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          queueUrl,
          userId,
          statusCode: response.status,
          queuePosition: response.data.position,
          estimatedWaitTime: response.data.estimatedWait,
          timestamp: new Date().toISOString(),
          attempts: attempt,
        };
      } catch (error) {
        lastError = error;
        console.log(
          `Attempt ${attempt}/${this.config.retries} failed for ${queueUrl}:`,
          error.message
        );
        if (attempt < this.config.retries) {
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    return {
      success: false,
      queueUrl,
      userId,
      error: lastError.message,
      statusCode: lastError.response?.status || null,
      timestamp: new Date().toISOString(),
      attempts: attempt,
    };
  }

  /**
   * Join all queues
   */
  async joinAllQueues() {
    console.log(`\n🚀 Starting Auto-Join Queue Test`);
    console.log(`📍 Testing ${this.config.queueLinks.length} queue endpoint(s)`);
    console.log('-----------------------------------\n');

    this.startTime = Date.now();

    const joinPromises = this.config.queueLinks.map((queueUrl, index) => {
      console.log(`[${index + 1}/${this.config.queueLinks.length}] Joining: ${queueUrl}`);
      return this.joinQueue(queueUrl);
    });

    const results = await Promise.allSettled(joinPromises);

    this.results = results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        error: result.reason.message,
        timestamp: new Date().toISOString(),
      };
    });

    this.endTime = Date.now();

    this.printResults();
    return this.results;
  }

  /**
   * Print test results
   */
  printResults() {
    const duration = (this.endTime - this.startTime) / 1000;
    const successCount = this.results.filter((r) => r.success).length;
    const failureCount = this.results.filter((r) => !r.success).length;

    console.log('\n-----------------------------------');
    console.log('✅ AUTO-JOIN TEST RESULTS\n');

    this.results.forEach((result, index) => {
      if (result.success) {
        console.log(`[${index + 1}] ✓ SUCCESS: ${result.queueUrl}`);
        console.log(`    Position: ${result.queuePosition}`);
        console.log(`    Est. Wait: ${result.estimatedWaitTime}s`);
        console.log(`    Attempts: ${result.attempts}\n`);
      } else {
        console.log(`[${index + 1}] ✗ FAILED: ${result.queueUrl}`);
        console.log(`    Error: ${result.error}`);
        console.log(`    Attempts: ${result.attempts}\n`);
      }
    });

    console.log('-----------------------------------');
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Tests: ${this.results.length}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failureCount}`);
    console.log(`   Success Rate: ${((successCount / this.results.length) * 100).toFixed(2)}%`);
    console.log(`   Duration: ${duration.toFixed(2)}s\n`);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run the test
if (require.main === module) {
  const tester = new QueueAutoJoinTest();
  tester
    .joinAllQueues()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = QueueAutoJoinTest;
