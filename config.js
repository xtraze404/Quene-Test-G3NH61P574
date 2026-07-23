// config.js
// Configuration for Walmart Queue Bot

module.exports = {
  // --- ACCOUNT CREDENTIALS ---
  // Enter your Walmart.com account details here
  EMAIL: 'your-email@example.com', 
  PASSWORD: 'your-password',

  // --- PRODUCT WATCH LIST ---
  products: [
    {
      name: 'Pitch Black ETB',
      url: 'https://howl.link/q1j4voxlrvikp'
    },
    {
      name: 'Pitch Black Booster Bundle',
      url: 'https://howl.link/in9qai8e3xwhu'
    },
    {
      name: 'Pitch Black 3-Pack Blister',
      url: 'https://howl.link/9s9kyw9tod4w3'
    },
    {
      name: 'Destined Rivals ETB',
      url: 'https://howl.link/h4529vaypp9w2'
    },
    {
      name: 'Perfect Order Booster Bundle',
      url: 'https://walmrt.us/4lQBOtq'
    },
    {
      name: 'First Partner Series 2',
      url: 'https://howl.link/gnrvqulwfgi0j'
    },
    {
      name: 'Prismatic Evolutions SPC',
      url: 'https://walmart.com/ip/15494520186'
    }
  ],

  // --- SETTINGS ---
  HEADLESS: false, // Set to true to hide browser window (not recommended for first run)
  PROXY_URL: process.env.PROXY_URL || null, // Optional: http://user:pass@host:port
  CHECK_INTERVAL: 2000, // How often to check for stock (ms)
  DASHBOARD_PORT: process.env.DASHBOARD_PORT || 3000
};
