/**
 * Stock Checker Module with Proxy Support
 * Checks stock status for Walmart product links
 */

const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

// Product watch list
const PRODUCTS = [
  {
    name: 'Pitch Black ETB',
    url: 'https://howl.link/q1j4voxlrvikp',
    shortName: 'PB-ETB'
  },
  {
    name: 'Pitch Black Booster Bundle',
    url: 'https://howl.link/in9qai8e3xwhu',
    shortName: 'PB-Bundle'
  },
  {
    name: 'Pitch Black 3-Pack Blister',
    url: 'https://howl.link/9s9kyw9tod4w3',
    shortName: 'PB-3Pack'
  },
  {
    name: 'Destined Rivals ETB',
    url: 'https://howl.link/h4529vaypp9w2',
    shortName: 'DR-ETB'
  },
  {
    name: 'Perfect Order Booster Bundle',
    url: 'https://walmrt.us/4lQBOtq',
    shortName: 'PO-Bundle'
  },
  {
    name: 'First Partner Series 2',
    url: 'https://howl.link/gnrvqulwfgi0j',
    shortName: 'FP-S2'
  },
  {
    name: 'Prismatic Evolutions SPC',
    url: 'https://walmart.com/ip/15494520186',
    shortName: 'PE-SPC'
  }
];

class StockChecker {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 10000,
      retries: config.retries || 2,
      proxy: config.proxy || null,
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };
    this.results = [];
  }

  /**
   * Create axios instance with optional proxy
   */
  createClient() {
    const headers = {
      'User-Agent': this.config.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    const clientConfig = {
      timeout: this.config.timeout,
      headers,
      maxRedirects: 5,
    };

    // Add proxy if configured
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

  /**
   * Check stock status for a single product
   */
  async checkStock(product) {
    const client = this.createClient();
    let lastError = null;
    let attempt = 0;

    while (attempt < this.config.retries) {
      try {
        attempt++;
        const startTime = Date.now();
        
        const response = await client.get(product.url, {
          validateStatus: () => true // Accept all status codes
        });
        
        const duration = Date.now() - startTime;
        const isInStock = this.parseStockStatus(response, product.url);

        return {
          success: true,
          name: product.name,
          shortName: product.shortName,
          url: product.url,
          isInStock,
          statusCode: response.status,
          responseTime: duration,
          timestamp: new Date().toISOString(),
          attempts: attempt,
        };
      } catch (error) {
        lastError = error;
        if (attempt < this.config.retries) {
          await this.delay(1000 * attempt);
        }
      }
    }

    return {
      success: false,
      name: product.name,
      shortName: product.shortName,
      url: product.url,
      isInStock: false,
      error: lastError?.message || 'Unknown error',
      statusCode: lastError?.response?.status || null,
      timestamp: new Date().toISOString(),
      attempts: this.config.retries,
    };
  }

  /**
   * Parse stock status from response
   */
  parseStockStatus(response, url) {
    // Handle redirects - if we got here, the link is active
    if (response.status >= 200 && response.status < 400) {
      const html = response.data?.toString?.() || '';
      
      // Common out of stock indicators
      const outOfStockPatterns = [
        /out\s*of\s*stock/i,
        /currently\s*unavailable/i,
        /not\s*available/i,
        /sold\s*out/i,
        /no\s*longer\s*available/i,
      ];

      // Common in stock indicators
      const inStockPatterns = [
        /add\s*to\s*cart/i,
        /in\s*stock/i,
        /available/i,
        /pick\s*up/i,
        /shipping/i,
      ];

      // Check for out of stock first (higher priority)
      for (const pattern of outOfStockPatterns) {
        if (pattern.test(html)) {
          return false;
        }
      }

      // Check for in stock indicators
      for (const pattern of inStockPatterns) {
        if (pattern.test(html)) {
          return true;
        }
      }

      // If it's a howl.link redirect, assume it's valid if we got a redirect
      if (url.includes('howl.link') || url.includes('walmrt.us')) {
        return response.status < 400;
      }

      // Default to true if no clear indicator and page loaded
      return response.status === 200;
    }

    return false;
  }

  /**
   * Check all products
   */
  async checkAllProducts() {
    console.log('\n🔍 Checking stock status...\n');
    
    const startTime = Date.now();
    const checkPromises = PRODUCTS.map((product, index) => {
      console.log(`[${index + 1}/${PRODUCTS.length}] Checking: ${product.name}`);
      return this.checkStock(product);
    });

    this.results = await Promise.all(checkPromises);
    const duration = (Date.now() - startTime) / 1000;

    this.printResults(duration);
    return this.results;
  }

  /**
   * Print results
   */
  printResults(duration) {
    const inStockCount = this.results.filter(r => r.isInStock).length;
    const failedCount = this.results.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(70));
    console.log('📦 STOCK STATUS REPORT');
    console.log('='.repeat(70));

    this.results.forEach((result, index) => {
      const status = result.isInStock ? '✅ IN STOCK' : result.success ? '❌ OUT OF STOCK' : '⚠️  ERROR';
      console.log(`\n${index + 1}. ${result.name} (${result.shortName})`);
      console.log(`   Status: ${status}`);
      console.log(`   URL: ${result.url}`);
      if (result.success) {
        console.log(`   Response Time: ${result.responseTime}ms`);
        console.log(`   HTTP Status: ${result.statusCode}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('\n' + '-'.repeat(70));
    console.log('📊 SUMMARY');
    console.log('-'.repeat(70));
    console.log(`   Total Products: ${this.results.length}`);
    console.log(`   In Stock: ${inStockCount}`);
    console.log(`   Out of Stock: ${this.results.length - inStockCount - failedCount}`);
    console.log(`   Errors: ${failedCount}`);
    console.log(`   Check Duration: ${duration.toFixed(2)}s`);
    console.log('='.repeat(70) + '\n');
  }

  /**
   * Get results as JSON
   */
  getResultsJSON() {
    return JSON.stringify(this.results, null, 2);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { StockChecker, PRODUCTS };
