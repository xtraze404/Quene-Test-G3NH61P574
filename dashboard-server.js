// dashboard-server.js
// Web dashboard with real-time status and checkout approval controls

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const config = require('./config');

class DashboardServer {
  constructor(bot) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.bot = bot;
    this.currentStatus = {
      status: 'idle',
      message: 'Initializing...',
      product: null,
      queuePosition: null,
      waitTime: null,
      requiresApproval: false,
      timestamp: new Date().toISOString()
    };
    this.history = [];
    
    this.setupRoutes();
    this.setupWebSocket();
    this.attachBotListeners();
  }

  setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.static('public'));

    // API: Get current status
    this.app.get('/api/status', (req, res) => {
      res.json(this.currentStatus);
    });

    // API: Get product list
    this.app.get('/api/products', (req, res) => {
      res.json(config.products);
    });

    // API: Get history
    this.app.get('/api/history', (req, res) => {
      res.json(this.history.slice(-50)); // Last 50 events
    });

    // API: Approve checkout
    this.app.post('/api/approve-checkout', (req, res) => {
      if (this.bot && this.currentStatus.requiresApproval) {
        console.log('👍 User approved checkout via dashboard');
        this.addToHistory('checkout_approved', 'User approved checkout');
        this.bot.proceedToCheckout();
        res.json({ success: true, message: 'Checkout approved' });
      } else {
        res.status(400).json({ success: false, message: 'No checkout pending approval' });
      }
    });

    // API: Cancel checkout
    this.app.post('/api/cancel-checkout', (req, res) => {
      if (this.bot && this.currentStatus.requiresApproval) {
        console.log('👎 User cancelled checkout via dashboard');
        this.addToHistory('checkout_cancelled', 'User cancelled checkout');
        this.bot.cancelCheckout();
        res.json({ success: true, message: 'Checkout cancelled' });
      } else {
        res.status(400).json({ success: false, message: 'No checkout pending approval' });
      }
    });

    // API: Start bot
    this.app.post('/api/start', async (req, res) => {
      if (this.bot) {
        try {
          const loginSuccess = await this.bot.login();
          if (loginSuccess) {
            this.bot.monitorStock();
            res.json({ success: true, message: 'Bot started' });
          } else {
            res.status(500).json({ success: false, message: 'Login failed' });
          }
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
      } else {
        res.status(500).json({ success: false, message: 'Bot not initialized' });
      }
    });

    // API: Stop bot
    this.app.post('/api/stop', async (req, res) => {
      if (this.bot) {
        this.bot.status = 'stopped';
        res.json({ success: true, message: 'Bot stopped' });
      } else {
        res.status(500).json({ success: false, message: 'Bot not initialized' });
      }
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('🔌 Dashboard client connected');
      
      // Send current status immediately
      ws.send(JSON.stringify({ type: 'status', data: this.currentStatus }));
      
      ws.on('close', () => {
        console.log('🔌 Dashboard client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  attachBotListeners() {
    if (!this.bot) return;

    this.bot.on('status-change', (statusData) => {
      this.currentStatus = {
        ...this.currentStatus,
        ...statusData,
        timestamp: new Date().toISOString()
      };
      
      this.broadcast({ type: 'status', data: this.currentStatus });
      this.addToHistory('status_change', statusData.message);
    });

    this.bot.on('checking-product', (product) => {
      this.broadcast({ type: 'checking', product });
    });

    this.bot.on('stock-status', (data) => {
      this.broadcast({ type: 'stock-status', data });
      this.addToHistory('stock_check', `${data.product.name}: ${data.status}`);
    });

    this.bot.on('stock-detected', (product) => {
      this.broadcast({ type: 'stock-detected', product });
      this.addToHistory('stock_detected', `STOCK FOUND: ${product.name}`, 'success');
    });

    this.bot.on('queue-detected', (url) => {
      this.broadcast({ type: 'queue-detected', url });
    });

    this.bot.on('checkout-ready', (data) => {
      this.broadcast({ type: 'checkout-ready', data });
      this.addToHistory('checkout_ready', `CHECKOUT READY for ${data.product.name}!`, 'warning');
    });

    this.bot.on('order-complete', (data) => {
      this.broadcast({ type: 'order-complete', data });
      this.addToHistory('order_complete', `ORDER PLACED: ${data.product.name}`, 'success');
    });

    this.bot.on('checkout-cancelled', () => {
      this.broadcast({ type: 'checkout-cancelled' });
      this.addToHistory('checkout_cancelled', 'Checkout cancelled by user');
    });

    this.bot.on('stock-lost', (data) => {
      this.broadcast({ type: 'stock-lost', data });
      this.addToHistory('stock_lost', `Stock lost for ${data.product.name}`, 'error');
    });

    this.bot.on('timeout', (data) => {
      this.broadcast({ type: 'timeout', data });
      this.addToHistory('timeout', `Queue timeout for ${data.product.name}`, 'error');
    });

    this.bot.on('error', (data) => {
      this.broadcast({ type: 'error', data });
      this.addToHistory('error', data.error, 'error');
    });
  }

  broadcast(message) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  addToHistory(event, message, level = 'info') {
    this.history.push({
      timestamp: new Date().toISOString(),
      event,
      message,
      level
    });
    
    // Keep only last 100 entries
    if (this.history.length > 100) {
      this.history.shift();
    }
  }

  start(port = config.DASHBOARD_PORT) {
    this.server.listen(port, () => {
      console.log(`🌐 Dashboard running at http://localhost:${port}`);
    });
    return this.server;
  }

  stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.wss.close(() => {
          console.log('🛑 Dashboard stopped');
          resolve();
        });
      });
    });
  }
}

module.exports = DashboardServer;
