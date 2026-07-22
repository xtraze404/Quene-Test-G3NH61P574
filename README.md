# Walmart Queue Test Suite

A comprehensive testing suite for the Walmart queue system with auto-join functionality and stress testing capabilities.

## Features

- **Auto-Join Test**: Automatically joins multiple queue endpoints and validates the response
- **Stress Test**: Ramps up concurrent requests to measure system capacity and performance
- **Detailed Reporting**: Comprehensive metrics including response times, success rates, and throughput

## Installation

```bash
npm install
```

## Usage

### Run Auto-Join Test

Tests that the queue system can handle automatic joining from multiple sources:

```bash
npm test
```

**What it tests:**
- Joining multiple queue endpoints
- Retry logic with exponential backoff
- Queue position validation
- Estimated wait time accuracy

### Run Stress Test

Measures maximum capacity by sending increasingly concurrent requests:

```bash
npm run stress
```

**What it measures:**
- Success rate at various concurrency levels
- Response time percentiles (min, max, avg, median, p95, p99)
- Throughput (requests per second)
- Error rates and types
- System stability under load

### Run All Tests

```bash
npm run test:all
```

## Configuration

Edit the test files to configure:

### queue-auto-join.js
```javascript
const CONFIG = {
  queueLinks: [
    'https://example.com/queue/test-1',
    'https://example.com/queue/test-2',
    // Add more queue endpoints...
  ],
  timeout: 10000,
  retries: 3,
};
```

### queue-stress-test.js
```javascript
const CONFIG = {
  queueEndpoint: 'https://example.com/queue/stress-test',
  concurrentRequests: [10, 50, 100, 250, 500], // Concurrency levels to test
  timeout: 15000,
  delayBetweenBatches: 2000, // ms between test batches
};
```

## Output Examples

### Auto-Join Test Output
```
🚀 Starting Auto-Join Queue Test
📍 Testing 3 queue endpoint(s)
-----------------------------------

[1/3] Joining: https://example.com/queue/test-1
[2/3] Joining: https://example.com/queue/test-2
[3/3] Joining: https://example.com/queue/test-3

-----------------------------------
✅ AUTO-JOIN TEST RESULTS

[1] ✓ SUCCESS: https://example.com/queue/test-1
    Position: 5
    Est. Wait: 120s
    Attempts: 1

📊 SUMMARY:
   Total Tests: 3
   Successful: 3
   Failed: 0
   Success Rate: 100.00%
   Duration: 2.45s
```

### Stress Test Output
```
📊 Batch 1: Sending 10 concurrent requests...
📊 Batch 2: Sending 50 concurrent requests...
...

============================================================
📊 STRESS TEST RESULTS

Per-Batch Breakdown:
------------------------------------------------------------

Batch 1 (10 concurrent):
  Results: 10/10 successful (100.00%)
  Duration: 245ms
  Throughput: 40.82 req/s

Batch 2 (50 concurrent):
  Results: 49/50 successful (98.00%)
  Duration: 1203ms
  Throughput: 41.56 req/s

Aggregate Statistics:
------------------------------------------------------------

📈 Overall Performance:
  Total Requests: 910
  Successful: 880
  Failed: 30
  Success Rate: 96.70%

⏱️  Response Times (successful requests):
  Min: 145ms
  Max: 2850ms
  Average: 645ms
  Median: 580ms
  P95: 1250ms
  P99: 1890ms

📊 Throughput:
  Average: 42.34 req/s

💡 Recommendations:
⚠️  High average response time detected. Consider:
    - Optimizing database queries
    - Implementing caching
    - Adding more backend workers
```

## Interpreting Results

### Success Rate
- **95-100%**: Excellent - system is stable
- **90-95%**: Good - minor issues under load
- **<90%**: Poor - system needs optimization

### Response Times
- **Min/Max**: Shows range of performance
- **Average**: Typical response time
- **Median**: 50th percentile - real-world experience
- **P95/P99**: Tail latencies - what 5% and 1% of users experience

### Throughput
Requests per second the system can handle. Compare this metric:
- Against expected peak traffic
- Across different concurrency levels for degradation patterns

## Performance Tuning Tips

1. **High Response Times**: 
   - Add database indexes
   - Implement caching (Redis)
   - Optimize query performance

2. **High Error Rate**:
   - Check server logs
   - Increase timeout values
   - Add circuit breakers

3. **Low Throughput**:
   - Increase server resources (CPU, RAM)
   - Enable connection pooling
   - Use load balancing

4. **Scalability Issues**:
   - Implement queue sharding
   - Use asynchronous processing
   - Add message queues (RabbitMQ, Kafka)

## Requirements

- Node.js 12+
- Axios for HTTP requests
- Access to queue endpoints

## License

MIT
