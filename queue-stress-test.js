/**
 * Walmart Queue - Stress Test
 * Measures system capacity by sending concurrent requests
 */

const axios = require('axios');

// Configuration
const CONFIG = {
  // Update this with your queue endpoint
  queueEndpoint: 'https://example.com/queue/stress-test',
  concurrentRequests: [10, 50, 100, 250, 500], // Ramp up load
  requestsPerBatch: 100,
  timeout: 15000,
  delayBetweenBatches: 2000, // ms
};

class QueueStressTest {
  constructor(config = CONFIG) {
    this.config = config;
    this.results = [];
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalDuration: 0,
      responseTimings: [],
      errors: {},
    };
  }

  /**
   * Send a single join request
   */
  async sendJoinRequest(batchId, requestId) {
    const startTime = Date.now();

    try {
      const response = await axios.post(`${this.config.queueEndpoint}/join`, {
        userId: `user-batch-${batchId}-req-${requestId}`,
        batchId,
        timestamp: new Date().toISOString(),
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        statusCode: response.status,
        duration,
        position: response.data.position,
        queueLength: response.data.queueLength,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorCode = error.response?.status || 'UNKNOWN';

      return {
        success: false,
        statusCode: errorCode,
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Run a stress test batch
   */
  async runBatch(concurrentLevel, batchId) {
    console.log(
      `\n📊 Batch ${batchId}: Sending ${concurrentLevel} concurrent requests...`
    );

    const requests = [];
    for (let i = 0; i < concurrentLevel; i++) {
      requests.push(this.sendJoinRequest(batchId, i));
    }

    const startTime = Date.now();
    const responses = await Promise.allSettled(requests);
    const batchDuration = Date.now() - startTime;

    const batchResults = responses.map((response) => {
      if (response.status === 'fulfilled') {
        return response.value;
      }
      return {
        success: false,
        error: response.reason.message,
        duration: 0,
      };
    });

    // Update metrics
    this.updateMetrics(batchResults, batchDuration);

    return {
      batchId,
      concurrentLevel,
      duration: batchDuration,
      results: batchResults,
    };
  }

  /**
   * Update aggregate metrics
   */
  updateMetrics(batchResults, batchDuration) {
    batchResults.forEach((result) => {
      this.metrics.totalRequests++;

      if (result.success) {
        this.metrics.successfulRequests++;
        this.metrics.responseTimings.push(result.duration);
      } else {
        this.metrics.failedRequests++;
        const errorType = result.error || 'UNKNOWN';
        this.metrics.errors[errorType] =
          (this.metrics.errors[errorType] || 0) + 1;
      }
    });

    this.metrics.totalDuration += batchDuration;
  }

  /**
   * Run the complete stress test
   */
  async runFullTest() {
    console.log(`\n🚀 Starting Queue Stress Test`);
    console.log(`🎯 Target: ${this.config.queueEndpoint}`);
    console.log(`📈 Concurrency Levels: ${this.config.concurrentRequests.join(', ')}`);
    console.log('='.repeat(60) + '\n');

    for (let i = 0; i < this.config.concurrentRequests.length; i++) {
      const concurrentLevel = this.config.concurrentRequests[i];
      const batchResult = await this.runBatch(concurrentLevel, i + 1);
      this.results.push(batchResult);

      if (i < this.config.concurrentRequests.length - 1) {
        console.log(
          `⏱️  Waiting ${this.config.delayBetweenBatches}ms before next batch...`
        );
        await this.delay(this.config.delayBetweenBatches);
      }
    }

    this.printDetailedResults();
    return this.results;
  }

  /**
   * Calculate statistics
   */
  calculateStats(timings) {
    if (timings.length === 0)
      return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 };

    const sorted = timings.sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Math.round(sum / sorted.length),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Print detailed results
   */
  printDetailedResults() {
    console.log('='.repeat(60));
    console.log('📊 STRESS TEST RESULTS\n');

    // Per-batch results
    console.log('Per-Batch Breakdown:');
    console.log('-'.repeat(60));

    this.results.forEach((batch) => {
      const successful = batch.results.filter((r) => r.success).length;
      const failed = batch.results.filter((r) => !r.success).length;
      const successRate =
        ((successful / batch.results.length) * 100).toFixed(2);

      console.log(`\nBatch ${batch.batchId} (${batch.concurrentLevel} concurrent):`);
      console.log(
        `  Results: ${successful}/${batch.results.length} successful (${successRate}%)`
      );
      console.log(`  Duration: ${batch.duration}ms`);
      console.log(`  Throughput: ${(batch.results.length / (batch.duration / 1000)).toFixed(2)} req/s`);
    });

    // Aggregate statistics
    console.log('\n' + '-'.repeat(60));
    console.log('Aggregate Statistics:');
    console.log('-'.repeat(60));

    const stats = this.calculateStats(this.metrics.responseTimings);

    console.log(`\n📈 Overall Performance:`);
    console.log(`  Total Requests: ${this.metrics.totalRequests}`);
    console.log(`  Successful: ${this.metrics.successfulRequests}`);
    console.log(`  Failed: ${this.metrics.failedRequests}`);
    console.log(
      `  Success Rate: ${((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2)}%`
    );

    console.log(`\n⏱️  Response Times (successful requests):`);
    console.log(`  Min: ${stats.min}ms`);
    console.log(`  Max: ${stats.max}ms`);
    console.log(`  Average: ${stats.avg}ms`);
    console.log(`  Median: ${stats.median}ms`);
    console.log(`  P95: ${stats.p95}ms`);
    console.log(`  P99: ${stats.p99}ms`);

    console.log(`\n📊 Throughput:`);
    const avgThroughput = (
      this.metrics.totalRequests /
      (this.metrics.totalDuration / 1000)
    ).toFixed(2);
    console.log(`  Average: ${avgThroughput} req/s`);

    if (Object.keys(this.metrics.errors).length > 0) {
      console.log(`\n❌ Errors Encountered:`);
      Object.entries(this.metrics.errors).forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Recommendations
    this.printRecommendations();
  }

  /**
   * Print performance recommendations
   */
  printRecommendations() {
    const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    const avgResponseTime = this.metrics.responseTimings.length > 0
      ? this.metrics.responseTimings.reduce((a, b) => a + b, 0) /
        this.metrics.responseTimings.length
      : 0;

    console.log('💡 Recommendations:\n');

    if (successRate < 0.95) {
      console.log(
        '⚠️  Low success rate detected. Consider:\n' +
        '    - Increasing server capacity\n' +
        '    - Implementing request throttling\n' +
        '    - Adding redundancy/load balancing\n'
      );
    }

    if (avgResponseTime > 1000) {
      console.log(
        '⚠️  High average response time detected. Consider:\n' +
        '    - Optimizing database queries\n' +
        '    - Implementing caching\n' +
        '    - Adding more backend workers\n'
      );
    }

    if (this.metrics.failedRequests === 0) {
      console.log('✅ All requests succeeded! System appears stable.\n');
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run the test
if (require.main === module) {
  const tester = new QueueStressTest();
  tester
    .runFullTest()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = QueueStressTest;
