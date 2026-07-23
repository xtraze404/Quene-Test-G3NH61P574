# Walmart Queue Bot

Automated Walmart queue monitoring and checkout bot with real-time dashboard, user-approved checkout, and stealth features.

## Features

- **Auto Login**: Automatically logs into your Walmart account
- **Stock Monitoring**: Continuously monitors multiple products for stock availability
- **Fast Queue Entry**: Immediately enters queue when stock is detected
- **Queue Position Tracking**: Shows your position in line and estimated wait time
- **User-Approved Checkout**: Pauses at checkout page waiting for your approval
- **Real-Time Dashboard**: Web interface showing live status, queue position, and activity log
- **Stealth Mode**: Uses puppeteer-extra with stealth plugin to avoid detection
- **Proxy Support**: Optional proxy configuration for additional anonymity

## Product Watch List

The bot monitors these products:
- Pitch Black ETB
- Pitch Black Booster Bundle
- Pitch Black 3-Pack Blister
- Destined Rivals ETB
- Perfect Order Booster Bundle
- First Partner Series 2
- Prismatic Evolutions SPC

## Installation

```bash
npm install
```

## Configuration

Edit `config.js` with your Walmart credentials:

```javascript
module.exports = {
  EMAIL: 'your-email@example.com',
  PASSWORD: 'your-password',
  
  // Optional settings
  HEADLESS: false,           // Set to true to hide browser window
  PROXY_URL: null,           // e.g., 'http://user:pass@proxy:8080'
  CHECK_INTERVAL: 2000,      // Stock check interval in ms
  DASHBOARD_PORT: 3000       // Dashboard web server port
};
```

## Usage

### Start the Bot with Dashboard

```bash
npm start
```

Then open http://localhost:3000 in your browser.

### Dashboard Controls

1. **Start Bot**: Begins login and stock monitoring
2. **Stop Bot**: Stops monitoring (keeps browser open)
3. **Approve Checkout**: When checkout page is reached, click to complete purchase
4. **Cancel Checkout**: Cancel the checkout process and resume monitoring

### Status Indicators

- **Idle**: Bot is ready but not running
- **Logging In**: Authenticating with Walmart
- **Monitoring**: Checking products for stock
- **In Queue**: Waiting in line (shows position and wait time)
- **Awaiting Approval**: Checkout page ready - waiting for your confirmation
- **Checking Out**: Processing order
- **Completed**: Order placed successfully
- **Error**: Something went wrong

## How It Works

1. **Login**: Bot logs into your Walmart account using provided credentials
2. **Monitor**: Continuously checks all watched products for stock
3. **Detect**: When stock is found, immediately adds item to cart
4. **Queue**: Enters the virtual waiting room if applicable
5. **Checkout Ready**: When checkout page loads, bot pauses and notifies you
6. **User Approval**: You review and approve via dashboard button
7. **Complete**: Bot clicks "Place Order" to finalize purchase

## Environment Variables

Optional overrides:

```bash
PROXY_URL=http://proxy:8080 npm start
DASHBOARD_PORT=8080 npm start
```

## Activity Log

The dashboard shows a real-time log of all events:
- Stock checks
- Stock detections
- Queue entry/position updates
- Checkout ready notifications
- User approvals/cancellations
- Order completions
- Errors and timeouts

## Troubleshooting

### Login Fails
- Verify credentials in config.js
- Check if account requires 2FA (not supported yet)
- Try manual login first to ensure account works

### No Stock Detected
- Products may genuinely be out of stock
- Check if product URLs are still valid
- Reduce CHECK_INTERVAL for faster detection (may increase detection risk)

### Queue Timeout
- Item may have gone out of stock while in queue
- Queue system may have issues
- Bot will automatically resume monitoring after timeout

### Captcha Appears
- Bot uses stealth mode to minimize captchas
- If captcha appears, solve it manually in the browser window
- Consider using residential proxies if captchas persist

## Safety Notes

⚠️ **Use Responsibly**: 
- Don't set check intervals too low (< 1000ms) to avoid rate limiting
- Use proxies if running multiple instances
- Be aware of Walmart's terms of service

## License

MIT
