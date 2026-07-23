/**
 * Stock Dashboard - Real-time web dashboard for monitoring stock status
 * Provides a web interface to check and monitor product availability
 */

const http = require('http');
const { StockChecker, PRODUCTS } = require('./stock-checker');

// Configuration
const CONFIG = {
  port: process.env.DASHBOARD_PORT || 3000,
  refreshInterval: parseInt(process.env.REFRESH_INTERVAL) || 30000, // 30 seconds default
  proxy: process.env.PROXY_URL || null,
};

class StockDashboard {
  constructor(config = CONFIG) {
    this.config = config;
    this.server = null;
    this.lastCheckResults = null;
    this.lastCheckTime = null;
    this.isChecking = false;
    this.checkHistory = [];
    
    this.stockChecker = new StockChecker({
      proxy: config.proxy,
      timeout: 10000,
      retries: 2,
    });
  }

  /**
   * Start the dashboard server
   */
  async start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`\n🚀 Stock Dashboard started at http://localhost:${this.config.port}`);
          console.log(`📊 Monitoring ${PRODUCTS.length} products`);
          console.log(`🔄 Auto-refresh every ${this.config.refreshInterval / 1000}s\n`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the dashboard server
   */
  stop() {
    if (this.server) {
      this.server.close();
      console.log('\n🛑 Dashboard stopped');
    }
  }

  /**
   * Handle HTTP requests
   */
  handleRequest(req, res) {
    const url = req.url;

    if (url === '/' || url === '/index.html') {
      this.serveHTML(res);
    } else if (url === '/api/status') {
      this.serveStatusAPI(res);
    } else if (url === '/api/check' && req.method === 'POST') {
      this.triggerCheck(res);
    } else if (url === '/api/history') {
      this.serveHistory(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  /**
   * Serve the main HTML dashboard
   */
  serveHTML(res) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Monitor Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      color: white;
      margin-bottom: 30px;
    }
    header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    .status-bar {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      padding: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
    }
    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    .status-indicator.checking { background: #fbbf24; }
    .status-indicator.idle { background: #10b981; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .refresh-btn {
      background: white;
      color: #667eea;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
      transition: transform 0.2s;
    }
    .refresh-btn:hover { transform: scale(1.05); }
    .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .product-card {
      background: white;
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
    .product-card:hover { transform: translateY(-5px); }
    .product-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }
    .product-name {
      font-size: 1.1rem;
      font-weight: bold;
      color: #1f2937;
    }
    .product-short {
      font-size: 0.8rem;
      color: #6b7280;
      margin-top: 5px;
    }
    .stock-badge {
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: bold;
      text-transform: uppercase;
    }
    .stock-in { background: #d1fae5; color: #065f46; }
    .stock-out { background: #fee2e2; color: #991b1b; }
    .stock-error { background: #fef3c7; color: #92400e; }
    .stock-checking { background: #dbeafe; color: #1e40af; }
    .product-url {
      font-size: 0.8rem;
      color: #667eea;
      word-break: break-all;
      margin-bottom: 10px;
    }
    .product-url a {
      color: inherit;
      text-decoration: none;
    }
    .product-url a:hover { text-decoration: underline; }
    .product-meta {
      display: flex;
      gap: 15px;
      font-size: 0.85rem;
      color: #6b7280;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .summary-bar {
      background: white;
      border-radius: 10px;
      padding: 20px;
      margin-top: 20px;
      display: flex;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 20px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-value {
      font-size: 2rem;
      font-weight: bold;
      color: #667eea;
    }
    .summary-label {
      font-size: 0.9rem;
      color: #6b7280;
      margin-top: 5px;
    }
    .history-section {
      background: white;
      border-radius: 15px;
      padding: 20px;
      margin-top: 20px;
    }
    .history-section h3 {
      margin-bottom: 15px;
      color: #1f2937;
    }
    .history-list {
      max-height: 300px;
      overflow-y: auto;
    }
    .history-item {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 0.85rem;
    }
    .history-item:last-child { border-bottom: none; }
    .loading {
      text-align: center;
      padding: 50px;
      color: white;
    }
    .spinner {
      border: 4px solid rgba(255,255,255,0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📦 Stock Monitor Dashboard</h1>
      <p>Real-time product availability tracking</p>
    </header>

    <div class="status-bar">
      <div class="status-item">
        <div class="status-indicator ${this.isChecking ? 'checking' : 'idle'}" id="statusIndicator"></div>
        <span id="statusText">${this.isChecking ? 'Checking...' : 'Ready'}</span>
      </div>
      <div class="status-item">
        <span>Last Check: <strong id="lastCheck">${this.lastCheckTime ? new Date(this.lastCheckTime).toLocaleTimeString() : 'Never'}</strong></span>
      </div>
      <button class="refresh-btn" onclick="triggerCheck()" id="refreshBtn" ${this.isChecking ? 'disabled' : ''}>
        🔄 Refresh Now
      </button>
    </div>

    <div class="summary-bar" id="summaryBar">
      <div class="summary-item">
        <div class="summary-value">${PRODUCTS.length}</div>
        <div class="summary-label">Total Products</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" id="inStockCount">-</div>
        <div class="summary-label">In Stock</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" id="outOfStockCount">-</div>
        <div class="summary-label">Out of Stock</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" id="errorCount">-</div>
        <div class="summary-label">Errors</div>
      </div>
    </div>

    <div class="products-grid" id="productsGrid">
      ${this.renderProductCards()}
    </div>

    <div class="history-section">
      <h3>📜 Check History</h3>
      <div class="history-list" id="historyList">
        ${this.renderHistory()}
      </div>
    </div>
  </div>

  <script>
    let isChecking = ${this.isChecking};

    function updateDashboard(data) {
      const grid = document.getElementById('productsGrid');
      grid.innerHTML = data.products.map((p, i) => \`
        <div class="product-card">
          <div class="product-header">
            <div>
              <div class="product-name">\${p.name}</div>
              <div class="product-short">\${p.shortName}</div>
            </div>
            <span class="stock-badge stock-\${p.status}">\${p.statusText}</span>
          </div>
          <div class="product-url"><a href="\${p.url}" target="_blank">\${p.url}</a></div>
          <div class="product-meta">
            \${p.responseTime ? \`<div class="meta-item">⏱️ \${p.responseTime}ms</div>\` : ''}
            \${p.statusCode ? \`<div class="meta-item">HTTP \${p.statusCode}</div>\` : ''}
            \${p.error ? \`<div class="meta-item">⚠️ \${p.error}</div>\` : ''}
          </div>
        </div>
      \`).join('');

      document.getElementById('inStockCount').textContent = data.summary.inStock;
      document.getElementById('outOfStockCount').textContent = data.summary.outOfStock;
      document.getElementById('errorCount').textContent = data.summary.errors;
      document.getElementById('lastCheck').textContent = new Date(data.timestamp).toLocaleTimeString();
      
      const indicator = document.getElementById('statusIndicator');
      const statusText = document.getElementById('statusText');
      const refreshBtn = document.getElementById('refreshBtn');
      
      indicator.className = 'status-indicator ' + (data.isChecking ? 'checking' : 'idle');
      statusText.textContent = data.isChecking ? 'Checking...' : 'Ready';
      refreshBtn.disabled = data.isChecking;
      
      isChecking = data.isChecking;
    }

    function triggerCheck() {
      if (isChecking) return;
      
      fetch('/api/check', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
          updateDashboard(data);
          setTimeout(fetchStatus, 1000);
        })
        .catch(err => console.error('Check failed:', err));
    }

    function fetchStatus() {
      fetch('/api/status')
        .then(r => r.json())
        .then(data => updateDashboard(data))
        .catch(err => console.error('Status fetch failed:', err));
    }

    // Initial load and auto-refresh
    fetchStatus();
    setInterval(fetchStatus, ${this.config.refreshInterval});
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Render product cards HTML
   */
  renderProductCards() {
    if (!this.lastCheckResults) {
      return PRODUCTS.map(product => `
        <div class="product-card">
          <div class="product-header">
            <div>
              <div class="product-name">${product.name}</div>
              <div class="product-short">${product.shortName}</div>
            </div>
            <span class="stock-badge stock-checking">Waiting...</span>
          </div>
          <div class="product-url"><a href="${product.url}" target="_blank">${product.url}</a></div>
        </div>
      `).join('');
    }

    return this.lastCheckResults.map(result => {
      const status = result.isInStock ? 'in' : result.success ? 'out' : 'error';
      const statusText = result.isInStock ? '✅ In Stock' : result.success ? '❌ Out' : '⚠️ Error';
      
      return `
        <div class="product-card">
          <div class="product-header">
            <div>
              <div class="product-name">${result.name}</div>
              <div class="product-short">${result.shortName}</div>
            </div>
            <span class="stock-badge stock-${status}">${statusText}</span>
          </div>
          <div class="product-url"><a href="${result.url}" target="_blank">${result.url}</a></div>
          <div class="product-meta">
            ${result.responseTime ? `<div class="meta-item">⏱️ ${result.responseTime}ms</div>` : ''}
            ${result.statusCode ? `<div class="meta-item">HTTP ${result.statusCode}</div>` : ''}
            ${result.error ? `<div class="meta-item">⚠️ ${result.error}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render history HTML
   */
  renderHistory() {
    if (this.checkHistory.length === 0) {
      return '<div class="history-item">No checks performed yet.</div>';
    }

    return this.checkHistory.slice(-10).reverse().map(item => `
      <div class="history-item">
        <strong>${new Date(item.timestamp).toLocaleString()}</strong> - 
        ${item.summary.inStock} in stock, ${item.summary.outOfStock} out, ${item.summary.errors} errors
      </div>
    `).join('');
  }

  /**
   * Serve status API
   */
  async serveStatusAPI(res) {
    const summary = this.getSummary();
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      products: this.formatProductsForAPI(),
      summary,
      timestamp: this.lastCheckTime,
      isChecking: this.isChecking,
    }));
  }

  /**
   * Trigger a stock check
   */
  async triggerCheck(res) {
    if (this.isChecking) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Already checking' }));
      return;
    }

    this.isChecking = true;
    
    try {
      await this.performCheck();
    } catch (error) {
      console.error('Check failed:', error);
    } finally {
      this.isChecking = false;
    }

    const summary = this.getSummary();
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      products: this.formatProductsForAPI(),
      summary,
      timestamp: this.lastCheckTime,
      isChecking: false,
    }));
  }

  /**
   * Perform stock check
   */
  async performCheck() {
    this.lastCheckResults = await this.stockChecker.checkAllProducts();
    this.lastCheckTime = new Date().toISOString();
    
    const summary = this.getSummary();
    this.checkHistory.push({
      timestamp: this.lastCheckTime,
      summary,
    });

    // Keep only last 100 checks
    if (this.checkHistory.length > 100) {
      this.checkHistory.shift();
    }
  }

  /**
   * Format products for API
   */
  formatProductsForAPI() {
    if (!this.lastCheckResults) {
      return PRODUCTS.map(p => ({
        name: p.name,
        shortName: p.shortName,
        url: p.url,
        status: 'checking',
        statusText: 'Waiting...',
      }));
    }

    return this.lastCheckResults.map(r => ({
      name: r.name,
      shortName: r.shortName,
      url: r.url,
      isInStock: r.isInStock,
      status: r.isInStock ? 'in' : r.success ? 'out' : 'error',
      statusText: r.isInStock ? '✅ In Stock' : r.success ? '❌ Out' : '⚠️ Error',
      responseTime: r.responseTime,
      statusCode: r.statusCode,
      error: r.error,
    }));
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    if (!this.lastCheckResults) {
      return { inStock: 0, outOfStock: 0, errors: 0 };
    }

    const inStock = this.lastCheckResults.filter(r => r.isInStock).length;
    const errors = this.lastCheckResults.filter(r => !r.success).length;
    const outOfStock = this.lastCheckResults.length - inStock - errors;

    return { inStock, outOfStock, errors };
  }

  /**
   * Serve history API
   */
  serveHistory(res) {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(this.checkHistory.slice(-50)));
  }
}

// Run the dashboard
if (require.main === module) {
  const dashboard = new StockDashboard(CONFIG);
  
  dashboard.start()
    .then(() => {
      // Perform initial check
      dashboard.performCheck();
      
      // Set up auto-refresh
      setInterval(() => {
        if (!dashboard.isChecking) {
          dashboard.performCheck();
        }
      }, CONFIG.refreshInterval);
    })
    .catch(error => {
      console.error('Failed to start dashboard:', error);
      process.exit(1);
    });
}

module.exports = StockDashboard;
