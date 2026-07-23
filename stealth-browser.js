/**
 * Stealth Browser Module
 * Handles captcha solving and stealth browsing with puppeteer-extra
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Enable stealth mode
puppeteer.use(StealthPlugin());

class StealthBrowser {
  constructor(config = {}) {
    this.config = {
      headless: config.headless || false, // Set to false for captcha solving
      proxy: config.proxy || null,
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: config.viewport || { width: 1920, height: 1080 },
      timeout: config.timeout || 60000,
      ...config
    };
    this.browser = null;
    this.page = null;
  }

  /**
   * Launch browser with stealth settings
   */
  async launch() {
    const launchOptions = {
      headless: this.config.headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: this.config.viewport,
      ignoreHTTPSErrors: true,
    };

    // Add proxy if configured
    if (this.config.proxy) {
      launchOptions.args.push(`--proxy-server=${this.config.proxy}`);
    }

    this.browser = await puppeteer.launch(launchOptions);
    return this.browser;
  }

  /**
   * Create new page with stealth settings
   */
  async createPage() {
    if (!this.browser) {
      await this.launch();
    }

    this.page = await this.browser.newPage();

    // Set user agent
    await this.page.setUserAgent(this.config.userAgent);

    // Bypass automation detection
    await this.page.evaluateOnNewDocument(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override plugins to look more realistic
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Remove automation flags
      delete navigator.__proto__.webdriver;
    });

    // Set cookies to appear more human
    await this.page.setCookie({
      name: 'session',
      value: Math.random().toString(36).substring(2),
      domain: '.walmart.com',
    });

    return this.page;
  }

  /**
   * Navigate to URL with human-like behavior
   */
  async navigate(url, options = {}) {
    if (!this.page) {
      await this.createPage();
    }

    const {
      waitUntil = 'networkidle2',
      timeout = this.config.timeout,
      randomDelay = true,
    } = options;

    // Random delay before navigation (human-like)
    if (randomDelay) {
      await this.delay(this.randomInt(1000, 3000));
    }

    try {
      await this.page.goto(url, {
        waitUntil,
        timeout,
      });
      return true;
    } catch (error) {
      console.error(`Navigation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle captcha detection and solving
   */
  async handleCaptcha() {
    if (!this.page) return false;

    const captchaSelectors = [
      // reCAPTCHA
      '#recaptcha-token',
      'iframe[src*="recaptcha"]',
      '.g-recaptcha',
      
      // hCaptcha
      'iframe[src*="hcaptcha"]',
      '.h-captcha',
      
      // Cloudflare Turnstile
      'iframe[src*="turnstile"]',
      '[data-sitekey]',
      
      // Hold to verify
      '.verify-button',
      '.hold-to-verify',
      '[class*="verify"]',
      
      // Image captcha
      'img[alt*="captcha"]',
      'img[src*="captcha"]',
    ];

    for (const selector of captchaSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          console.log(`🔒 Captcha detected: ${selector}`);
          
          // Check if it's a "hold to verify" button
          const isHoldVerify = await this.isHoldToVerify(element);
          if (isHoldVerify) {
            return await this.handleHoldToVerify(element);
          }
          
          // Check if it's an image captcha
          const isImageCaptcha = await this.isImageCaptcha(element);
          if (isImageCaptcha) {
            return await this.handleImageCaptcha(element);
          }
          
          // For iframe-based captchas, we need manual intervention
          console.log('⚠️  Manual captcha solving may be required');
          return await this.waitForCaptchaSolve();
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    return false; // No captcha detected
  }

  /**
   * Check if element is a "hold to verify" button
   */
  async isHoldToVerify(element) {
    try {
      const text = await this.page.evaluate(el => el.textContent.toLowerCase(), element);
      return text.includes('hold') || text.includes('verify') || text.includes('press');
    } catch {
      return false;
    }
  }

  /**
   * Handle "hold to verify" captcha
   */
  async handleHoldToVerify(element) {
    console.log('🖱️  Handling "hold to verify" captcha...');
    
    try {
      // Simulate holding the button
      await element.hover();
      await this.page.mouse.down();
      
      // Hold for random duration (2-4 seconds)
      const holdDuration = this.randomInt(2000, 4000);
      await this.delay(holdDuration);
      
      await this.page.mouse.up();
      
      console.log('✅ Hold verification completed');
      await this.delay(1000);
      return true;
    } catch (error) {
      console.error('❌ Hold verification failed:', error.message);
      return false;
    }
  }

  /**
   * Check if element is an image captcha
   */
  async isImageCaptcha(element) {
    try {
      const tagName = await this.page.evaluate(el => el.tagName.toLowerCase(), element);
      return tagName === 'img';
    } catch {
      return false;
    }
  }

  /**
   * Handle image captcha (takes screenshot for manual solving)
   */
  async handleImageCaptcha(element) {
    console.log('📸 Image captcha detected - taking screenshot...');
    
    try {
      const screenshot = await element.screenshot({
        encoding: 'base64',
      });
      
      console.log('📷 Screenshot captured. Manual solving required.');
      console.log('💡 Tip: Use OCR service or solve manually');
      
      // Save screenshot to file
      const fs = require('fs');
      const filename = `captcha-${Date.now()}.png`;
      fs.writeFileSync(filename, Buffer.from(screenshot, 'base64'));
      console.log(`💾 Screenshot saved to: ${filename}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to capture captcha:', error.message);
      return false;
    }
  }

  /**
   * Wait for captcha to be solved (manual or automatic)
   */
  async waitForCaptchaSolve(timeout = 120000) {
    console.log('⏳ Waiting for captcha resolution...');
    
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      await this.delay(2000);
      
      // Check if captcha is still present
      const stillPresent = await this.handleCaptcha();
      if (!stillPresent) {
        console.log('✅ Captcha solved!');
        return true;
      }
    }
    
    console.error('❌ Captcha timeout');
    return false;
  }

  /**
   * Fast entry optimization - minimize delays
   */
  async fastEntry(url) {
    if (!this.page) {
      await this.createPage();
    }

    console.log(`⚡ Fast entry to: ${url}`);
    
    const startTime = Date.now();
    
    // Minimal delay for fast entry
    await this.delay(this.randomInt(100, 500));
    
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      
      const loadTime = Date.now() - startTime;
      console.log(`✅ Page loaded in ${loadTime}ms`);
      
      // Quick captcha check
      const hasCaptcha = await this.handleCaptcha();
      
      return {
        success: true,
        loadTime,
        hasCaptcha,
        url,
      };
    } catch (error) {
      console.error('❌ Fast entry failed:', error.message);
      return {
        success: false,
        error: error.message,
        url,
      };
    }
  }

  /**
   * Auto-checkout when product is in stock
   */
  async autoCheckout(checkoutConfig) {
    const {
      addToCartSelector = '[data-automation="addToCartButton"]',
      checkoutSelector = '[data-automation="checkoutButton"]',
      maxWaitTime = 60000,
    } = checkoutConfig;

    console.log('🛒 Starting auto-checkout process...');

    try {
      // Wait for and click add to cart
      await this.page.waitForSelector(addToCartSelector, { timeout: maxWaitTime });
      await this.page.click(addToCartSelector);
      console.log('✅ Added to cart');
      
      await this.delay(this.randomInt(500, 1500));
      
      // Wait for and click checkout
      await this.page.waitForSelector(checkoutSelector, { timeout: maxWaitTime });
      await this.page.click(checkoutSelector);
      console.log('✅ Proceeded to checkout');
      
      return true;
    } catch (error) {
      console.error('❌ Auto-checkout failed:', error.message);
      return false;
    }
  }

  /**
   * Get current page content
   */
  async getContent() {
    if (!this.page) return '';
    return await this.page.content();
  }

  /**
   * Take screenshot
   */
  async screenshot(filename = null) {
    if (!this.page) return null;
    
    const options = { fullPage: true };
    if (filename) {
      options.path = filename;
    } else {
      options.encoding = 'base64';
    }
    
    return await this.page.screenshot(options);
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Utility: Random integer between min and max
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Utility: Delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = StealthBrowser;
