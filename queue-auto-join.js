/**
 * Walmart Queue - Fast Auto Join with Stealth Mode
 * Optimized for fast entry when queue launches with captcha handling
 */

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const StealthBrowser = require('./stealth-browser');

// Configuration
const CONFIG = {
  // Product links to monitor
  queueLinks: [
    { name: 'Pitch Black ETB', url: 'https://howl.link/q1j4voxlrvikp' },
    { name: 'Pitch Black Booster Bundle', url: 'https://howl.link/in9qai8e3xwhu' },
    { name: 'Pitch Black 3-Pack Blister', url: 'https://howl.link/9s9kyw9tod4w3' },
    { name: 'Destined Rivals ETB', url: 'https://howl.link/h4529vaypp9w2' },
    { name: 'Perfect Order Booster Bundle', url: 'https://walmrt.us/4lQBOtq' },
    { name: 'First Partner Series 2', url: 'https://howl.link/gnrvqulwfgi0j' },
    { name: 'Prismatic Evolutions SPC', url: 'https://walmart.com/ip/15494520186' },
  ],
  timeout: 5000,
  retries: 2,
  proxy: process.env.PROXY_URL || null,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  stealthMode: process.env.STEALTH_MODE !== 'false',
  headless: process.env.HEADLESS === 'true',
  autoCheckout: process.env.AUTO_CHECKOUT === 'true',
};

class QueueFastJoin {
  constructor(config = CONFIG) {
    this.config = { ...CONFIG, ...config };
    this.results = [];
    this.startTime = null;
    this.endTime = null;
    this.browser = null;
    this.queueStatus = {};
  }

  createClient() {
    const headers = {
      'User-Agent': this.config.userAgent,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
    };

    const clientConfig = {
      timeout: this.config.timeout,
      headers,
      maxRedirects: 5,
    };

    if (this.config.proxy) {
      const proxyUrl = this.config.proxy;
      if (proxyUrl.startsWith('https://')) {
        clientConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      } else if (proxyUrl.startsWith('http://')) {
        clientConfig.httpAgent = new HttpProxyAgent(proxyUrl);
      }
    }

    return axios.create(clientConfig);
  }

  async initBrowser() {
    if (this.config.stealthMode) {
      this.browser = new StealthBrowser({
        headless: this.config.headless,
        proxy: this.config.proxy,
        userAgent: this.config.userAgent,
        timeout: 30000,
      });
      await this.browser.launch();
      console.log('🛡️  Stealth mode enabled');
    }
  }

  async fastJoinQueue(queueLink) {
    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt < this.config.retries) {
      try {
        attempt++;
        
        if (this.browser) {
          const result = await this.browser.fastEntry(queueLink.url);
          
          if (result.success) {
            const content = await this.browser.getContent();
            const status = this.detectQueueStatus(content);
            
            if (this.config.autoCheckout && status.inStock) {
              await this.browser.autoCheckout({});
            }
            
            return {
              success: true,
              name: queueLink.name,
              url: queueLink.url,
              statusCode: 200,
              queuePosition: status.position,
              estimatedWaitTime: status.waitTime,
              inQueue: status.inQueue,
              inStock: status.inStock,
              timestamp: new Date().toISOString(),
              attempts: attempt,
              responseTime: Date.now() - startTime,
              hasCaptcha: result.hasCaptcha,
            };
          }
        }
        
        const client = this.createClient();
        const response = await client.get(queueLink.url, {
          validateStatus: () => true,
          maxRedirects: 5,
        });
        
        const duration = Date.now() - startTime;
        const status = this.detectQueueStatus(response.data?.toString?.() || '');
        
        return {
          success: true,
          name: queueLink.name,
          url: queueLink.url,
          statusCode: response.status,
          queuePosition: status.position,
          estimatedWaitTime: status.waitTime,
          inQueue: status.inQueue,
          inStock: status.inStock,
          timestamp: new Date().toISOString(),
          attempts: attempt,
          responseTime: duration,
        };
      } catch (error) {
        lastError = error;
        if (attempt < this.config.retries) {
          await this.delay(500 * attempt);
        }
      }
    }

    return {
      success: false,
      name: queueLink.name,
      url: queueLink.url,
      error: lastError?.message || 'Unknown error',
      statusCode: lastError?.response?.status || null,
      timestamp: new Date().toISOString(),
      attempts: attempt,
    };
  }

  detectQueueStatus(content) {
    const status = {
      inQueue: false,
      inStock: false,
      position: null,
      waitTime: null,
    };

    const queuePatterns = [
      /you are (\d+) (?:in )?line/i,
      /position.*?(\d+)/i,
      /queue.*?position.*?(\d+)/i,
      /waiting room/i,
      /please wait/i,
    ];

    const inStockPatterns = [
      /add\s*to\s*cart/i,
      /in\s*stock/i,
      /available\s*(?:for)?\s*(?:pickup|delivery)/i,
      /buy\s*now/i,
      /checkout/i,
    ];

    const outOfStockPatterns = [
      /out\s*of\s*stock/i,
      /currently\s*unavailable/i,
      /sold\s*out/i,
      /not\s*available/i,
    ];

    for (const pattern of queuePatterns) {
      const match = content.match(pattern);
      if (match) {
        status.inQueue = true;
        status.position = match[1] ? parseInt(match[1]) : 'unknown';
        break;
      }
    }

    for (const pattern of outOfStockPatterns) {
      if (pattern.test(content)) {
        status.inStock = false;
        return status;
      }
    }

    for (const pattern of inStockPatterns) {
      if (pattern.test(content)) {
        status.inStock = true;
        return status;
      }
    }

    if (!status.inQueue) {
      status.inStock = true;
    }

    return status;
  }

  async joinAllQueues() {
    console.log(`\n⚡ Starting Fast Queue Join`);
    console.log(`📍 Monitoring ${this.config.queueLinks.length} products`);
    if (this.config.proxy) {
      console.log(`🔒 Using proxy: ${this.config.proxy}`);
    }
    if (this.config.stealthMode) {
      console.log(`🛡️  Stealth mode: ENABLED`);
    }
    if (this.config.autoCheckout) {
      console.log(`🛒 Auto-checkout: ENABLED`);
    }
    console.log('-----------------------------------\n');

    await this.initBrowser();

    this.startTime = Date.now();

    const results = [];
    for (let i = 0; i < this.config.queueLinks.length; i++) {
      const queueLink = this.config.queueLinks[i];
      console.log(`[${i + 1}/${this.config.queueLinks.length}] Joining: ${queueLink.name}`);
      
      const result = await this.fastJoinQueue(queueLink);
      results.push(result);
      
      if (i < this.config.queueLinks.length - 1) {
        await this.delay(this.browser ? 100 : 50);
      }
    }

    this.results = results;
    this.endTime = Date.now();

    this.printResults();
    return this.results;
  }

  getQueueStatus() {
    return this.queueStatus;
  }

  printResults() {
    const duration = (this.endTime - this.startTime) / 1000;
    const successCount = this.results.filter((r) => r.success).length;
    const inStockCount = this.results.filter(r => r.inStock).length;
    const inQueueCount = this.results.filter(r => r.inQueue).length;

    console.log('\n-----------------------------------');
    console.log('⚡ FAST QUEUE JOIN RESULTS\n');

    this.results.forEach((result, index) => {
      if (result.success) {
        const status = result.inStock ? '✅ IN STOCK' : result.inQueue ? '⏳ IN QUEUE' : '❌ OUT OF STOCK';
        console.log(`[${index + 1}] ${status}: ${result.name}`);
        console.log(`    URL: ${result.url}`);
        if (result.inQueue) {
          console.log(`    Position: ${result.queuePosition}`);
          console.log(`    Est. Wait: ${result.estimatedWaitTime}s`);
        }
        console.log(`    Response Time: ${result.responseTime}ms`);
        if (result.hasCaptcha) {
          console.log(`    ⚠️  Captcha detected`);
        }
        console.log();
      } else {
        console.log(`[${index + 1}] ✗ FAILED: ${result.name}`);
        console.log(`    Error: ${result.error}`);
        console.log();
      }
    });

    console.log('-----------------------------------');
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Products: ${this.results.length}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   In Stock: ${inStockCount}`);
    console.log(`   In Queue: ${inQueueCount}`);
    console.log(`   Duration: ${duration.toFixed(2)}s\n`);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

if (require.main === module) {
  const tester = new QueueFastJoin();
  tester
    .joinAllQueues()
    .then(async () => {
      await tester.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Test failed:', error);
      await tester.close();
      process.exit(1);
    });
}

module.exports = QueueFastJoin;
