// queue-bot.js
// Main bot that logs in, monitors stock, enters queues, and waits for user approval to checkout

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const config = require('./config');
const { EventEmitter } = require('events');

// Enable stealth mode
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

class QueueBot extends EventEmitter {
  constructor() {
    super();
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    this.inQueue = false;
    this.atCheckout = false;
    this.currentProduct = null;
    this.queuePosition = null;
    this.status = 'idle'; // idle, logging_in, monitoring, in_queue, at_checkout, error
  }

  async init() {
    console.log('🚀 Initializing Queue Bot...');
    
    const launchOptions = {
      headless: config.HEADLESS ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    };

    if (config.PROXY_URL) {
      launchOptions.args.push(`--proxy-server=${config.PROXY_URL}`);
    }

    this.browser = await puppeteer.launch(launchOptions);
    this.page = await this.browser.newPage();
    
    // Set realistic viewport
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Set realistic user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Handle page events
    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('queue') || url.includes('waitingroom')) {
        this.emit('queue-detected', url);
      }
    });

    console.log('✅ Browser initialized');
    return this;
  }

  async login() {
    console.log('🔐 Attempting login...');
    this.status = 'logging_in';
    this.emit('status-change', { status: this.status, message: 'Logging in...' });

    try {
      await this.page.goto('https://www.walmart.com/account/login', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for login form
      await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // Enter credentials
      await this.page.type('input[type="email"]', config.EMAIL, { delay: 50 });
      await this.page.type('input[type="password"]', config.PASSWORD, { delay: 50 });

      // Click sign in button
      const signInButton = await this.page.$('button[type="submit"]');
      if (signInButton) {
        await signInButton.click();
      } else {
        // Try alternative selector
        const altButton = await this.page.$('[data-automation-id="sign-in-btn"]');
        if (altButton) await altButton.click();
      }

      // Wait for navigation after login
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      
      // Check if login was successful by looking for account indicators
      const isLogged = await this.page.evaluate(() => {
        return document.querySelector('[data-automation-id="account-menu"]') !== null ||
               document.cookie.includes('auth') ||
               window.location.href.includes('walmart.com/account');
      });

      if (isLogged) {
        this.isLoggedIn = true;
        console.log('✅ Login successful!');
        this.status = 'monitoring';
        this.emit('status-change', { status: this.status, message: 'Logged in, monitoring stock...' });
        return true;
      } else {
        throw new Error('Login failed - could not verify successful login');
      }
    } catch (error) {
      console.error('❌ Login error:', error.message);
      this.status = 'error';
      this.emit('status-change', { status: this.status, message: `Login failed: ${error.message}`, error: error.message });
      return false;
    }
  }

  async monitorStock() {
    console.log('👀 Starting stock monitoring...');
    this.status = 'monitoring';
    this.emit('status-change', { status: this.status, message: 'Monitoring stock...' });

    while (this.status === 'monitoring') {
      for (const product of config.products) {
        if (this.atCheckout || this.inQueue) break; // Stop if we're already in queue or at checkout
        
        try {
          console.log(`Checking: ${product.name}`);
          this.emit('checking-product', product);
          
          await this.page.goto(product.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
          });

          // Wait a bit for page to load
          await this.page.waitForTimeout(1000);

          // Check for stock indicators
          const stockStatus = await this.page.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            
            // Common out of stock indicators
            const outOfStockPhrases = [
              'out of stock',
              'currently unavailable',
              'sold out',
              'not available',
              'temporarily out of stock'
            ];

            // Common in stock indicators
            const inStockPhrases = [
              'add to cart',
              'add to list',
              'in stock',
              'available',
              'ship to home'
            ];

            for (const phrase of outOfStockPhrases) {
              if (bodyText.includes(phrase)) return 'out_of_stock';
            }

            for (const phrase of inStockPhrases) {
              if (bodyText.includes(phrase)) return 'in_stock';
            }

            // Check for specific buttons
            const addToCartBtn = document.querySelector('button[data-automation-id="add-to-cart-btn"]') ||
                                 document.querySelector('[data-automation-id="addToCart"]') ||
                                 Array.from(document.querySelectorAll('button')).find(b => 
                                   b.innerText.toLowerCase().includes('add to cart')
                                 );

            if (addToCartBtn) return 'in_stock';

            return 'unknown';
          });

          console.log(`${product.name}: ${stockStatus}`);
          this.emit('stock-status', { product, status: stockStatus });

          if (stockStatus === 'in_stock') {
            console.log(`🎯 STOCK DETECTED: ${product.name}!`);
            this.emit('stock-detected', product);
            await this.enterQueue(product);
            break; // Exit the loop once we found stock
          }

        } catch (error) {
          console.error(`Error checking ${product.name}:`, error.message);
          this.emit('error', { product, error: error.message });
        }

        // Small delay between checks
        await this.page.waitForTimeout(config.CHECK_INTERVAL);
      }

      // Delay before next round of checks
      if (!this.inQueue && !this.atCheckout) {
        await this.page.waitForTimeout(1000);
      }
    }
  }

  async enterQueue(product) {
    console.log(`⏳ Entering queue for: ${product.name}`);
    this.status = 'entering_queue';
    this.inQueue = true;
    this.currentProduct = product;
    this.emit('status-change', { status: this.status, message: `Entering queue for ${product.name}...` });

    try {
      // Look for "Add to Cart" button and click it
      const addToCartSelectors = [
        'button[data-automation-id="add-to-cart-btn"]',
        '[data-automation-id="addToCart"]',
        'button[class*="add-to-cart"]',
        'button[aria-label*="Add to cart"]'
      ];

      let addToCartBtn = null;
      for (const selector of addToCartSelectors) {
        addToCartBtn = await this.page.$(selector);
        if (addToCartBtn) break;
      }

      // If not found by selector, search by text
      if (!addToCartBtn) {
        const buttons = await this.page.$$eval('button', buttons => {
          const target = buttons.find(b => b.innerText.toLowerCase().includes('add to cart'));
          return target ? target.textContent : null;
        });
        
        if (buttons) {
          addToCartBtn = await this.page.evaluateHandle(() => {
            const buttons = document.querySelectorAll('button');
            return Array.from(buttons).find(b => b.innerText.toLowerCase().includes('add to cart'));
          });
        }
      }

      if (addToCartBtn) {
        await addToCartBtn.click();
        console.log('✅ Added to cart, waiting for queue...');
        
        // Wait for queue or cart modal
        await this.page.waitForTimeout(2000);
      } else {
        console.log('⚠️ Could not find Add to Cart button, checking for direct queue...');
      }

      // Monitor for queue entry and checkout page
      this.status = 'in_queue';
      this.emit('status-change', { 
        status: this.status, 
        message: `In queue for ${product.name}`,
        queuePosition: 'Waiting...'
      });

      // Start monitoring for queue progress and checkout
      await this.monitorQueueProgress();

    } catch (error) {
      console.error('Error entering queue:', error.message);
      this.status = 'error';
      this.emit('status-change', { status: this.status, message: `Queue entry failed: ${error.message}`, error: error.message });
      this.inQueue = false;
    }
  }

  async monitorQueueProgress() {
    console.log('🔄 Monitoring queue progress...');
    
    let checkCount = 0;
    const maxChecks = 600; // 10 minutes max (600 * 1000ms)

    while (checkCount < maxChecks && this.inQueue && !this.atCheckout) {
      checkCount++;
      
      try {
        const pageUrl = this.page.url();
        
        // Check if we're on checkout page
        const isCheckoutPage = await this.page.evaluate(() => {
          const url = window.location.href;
          const bodyText = document.body.innerText.toLowerCase();
          
          return url.includes('/checkout') || 
                 url.includes('/payment') ||
                 bodyText.includes('checkout') && bodyText.includes('place order');
        });

        if (isCheckoutPage) {
          console.log('🛒 CHECKOUT PAGE REACHED! Waiting for user approval...');
          this.atCheckout = true;
          this.inQueue = false;
          this.status = 'awaiting_approval';
          this.emit('status-change', { 
            status: this.status, 
            message: 'CHECKOUT READY! Awaiting user approval...',
            requiresApproval: true
          });
          this.emit('checkout-ready', { product: this.currentProduct });
          return;
        }

        // Check for queue position
        const queueInfo = await this.page.evaluate(() => {
          const bodyText = document.body.innerText;
          const positionMatch = bodyText.match(/position\s+#?\s*(\d+)/i);
          const waitMatch = bodyText.match(/(\d+)\s*(minute|second)/i);
          
          return {
            position: positionMatch ? parseInt(positionMatch[1]) : null,
            waitTime: waitMatch ? `${waitMatch[1]} ${waitMatch[2]}` : null,
            isQueue: bodyText.toLowerCase().includes('waiting room') || 
                     bodyText.toLowerCase().includes('you are number') ||
                     bodyText.toLowerCase().includes('your place in line')
          };
        });

        if (queueInfo.isQueue || queueInfo.position) {
          this.queuePosition = queueInfo.position;
          this.emit('status-change', {
            status: 'in_queue',
            message: `In queue - Position: ${queueInfo.position || 'Unknown'}, Wait: ${queueInfo.waitTime || 'Unknown'}`,
            queuePosition: queueInfo.position,
            waitTime: queueInfo.waitTime
          });
        }

        // Check if item went out of stock while in queue
        const stillAvailable = await this.page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return !bodyText.includes('out of stock') && !bodyText.includes('unavailable');
        });

        if (!stillAvailable) {
          console.log('⚠️ Item went out of stock while in queue');
          this.emit('stock-lost', { product: this.currentProduct });
        }

      } catch (error) {
        console.error('Error monitoring queue:', error.message);
      }

      await this.page.waitForTimeout(1000); // Check every second
    }

    if (checkCount >= maxChecks) {
      console.log('⏰ Queue monitoring timeout reached');
      this.emit('timeout', { product: this.currentProduct });
    }
  }

  async proceedToCheckout() {
    if (!this.atCheckout) {
      console.log('⚠️ Not at checkout page yet');
      return false;
    }

    console.log('✅ User approved, proceeding with checkout...');
    this.status = 'checking_out';
    this.emit('status-change', { status: this.status, message: 'Proceeding to checkout...' });

    try {
      // Look for place order button
      const placeOrderSelectors = [
        'button[data-automation-id="place-order-btn"]',
        'button[class*="place-order"]',
        'button[aria-label*="Place order"]'
      ];

      let placeOrderBtn = null;
      for (const selector of placeOrderSelectors) {
        placeOrderBtn = await this.page.$(selector);
        if (placeOrderBtn) break;
      }

      // Search by text if not found
      if (!placeOrderBtn) {
        placeOrderBtn = await this.page.evaluateHandle(() => {
          const buttons = document.querySelectorAll('button');
          return Array.from(buttons).find(b => 
            b.innerText.toLowerCase().includes('place order') ||
            b.innerText.toLowerCase().includes('confirm order')
          );
        });
      }

      if (placeOrderBtn) {
        console.log('🖱️ Clicking Place Order button...');
        await placeOrderBtn.click();
        
        // Wait for confirmation
        await this.page.waitForTimeout(3000);
        
        const isConfirmed = await this.page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return bodyText.includes('thank you') || 
                 bodyText.includes('order confirmed') ||
                 bodyText.includes('confirmation');
        });

        if (isConfirmed) {
          console.log('🎉 ORDER PLACED SUCCESSFULLY!');
          this.status = 'completed';
          this.emit('status-change', { status: this.status, message: 'Order placed successfully!' });
          this.emit('order-complete', { product: this.currentProduct });
          return true;
        } else {
          console.log('⚠️ Order may not have been placed, please verify manually');
          this.status = 'manual_check_required';
          this.emit('status-change', { status: this.status, message: 'Please verify order status manually' });
        }
      } else {
        console.log('⚠️ Could not find Place Order button, manual intervention may be required');
        this.status = 'manual_check_required';
        this.emit('status-change', { status: this.status, message: 'Manual checkout required' });
      }

      return false;
    } catch (error) {
      console.error('Error during checkout:', error.message);
      this.status = 'error';
      this.emit('status-change', { status: this.status, message: `Checkout error: ${error.message}`, error: error.message });
      return false;
    }
  }

  async cancelCheckout() {
    console.log('❌ Checkout cancelled by user');
    this.atCheckout = false;
    this.inQueue = false;
    this.status = 'monitoring';
    this.emit('status-change', { status: this.status, message: 'Checkout cancelled, resuming monitoring...' });
    this.emit('checkout-cancelled');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('👋 Browser closed');
    }
  }
}

module.exports = QueueBot;
