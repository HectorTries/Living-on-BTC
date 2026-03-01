# Living on BTC

A simple web application to track and visualize the benefits of living on Bitcoin. Calculate your savings on the Bitcoin standard and join the world's largest database of BTC livers.

## Features

### 1. BTC Savings Backtest (`backtest.html`)
- Calculate how much cheaper your life would be if you started living on Bitcoin
- Input your start date and optional income
- See real calculations using historical BTC prices from CryptoCompare API
- Visualize savings with interactive charts

### 2. Verify BTC Livers (`verify.html`)
- Submit individuals (via X/Twitter handles) living on Bitcoin
- Add them to a public database
- Auto-calculate estimated savings based on start date
- Prevent duplicate submissions

### 3. Global Leaderboard (`leaderboard.html`)
- View all verified BTC livers
- Sort by earliest adopters or highest savings
- Paginated results

## Tech Stack

- **Frontend:** Plain HTML/CSS/JavaScript (no framework)
- **Backend:** Supabase (PostgreSQL + REST API)
- **BTC Prices:** CryptoCompare API (free, no API key required)
- **Charts:** Chart.js

## Project Structure

```
Living-on-BTC/
├── index.html          # Landing page
├── backtest.html       # BTC savings calculator
├── verify.html         # Submit BTC livers
├── leaderboard.html    # Global rankings
├── css/
│   └── styles.css      # Shared styles
└── js/
    ├── btc-price.js       # BTC price utilities
    └── supabase-config.js # Database configuration
```

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to the SQL Editor and run this schema:

```sql
-- Create the btc_livers table
CREATE TABLE btc_livers (
    id SERIAL PRIMARY KEY,
    x_username VARCHAR(50) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified BOOLEAN DEFAULT FALSE,
    estimated_savings DECIMAL(10,2),
    btc_price_at_start DECIMAL(20,2),
    notes TEXT,
    country VARCHAR(100)
);

-- Enable Row Level Security
ALTER TABLE btc_livers ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read verified users
CREATE POLICY "Anyone can read verified users" ON btc_livers
    FOR SELECT USING (verified = true);

-- Policy: Anyone can submit (anonymous inserts)
CREATE POLICY "Anyone can submit" ON btc_livers
    FOR INSERT WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_btc_livers_start_date ON btc_livers(start_date);
CREATE INDEX idx_btc_livers_verified ON btc_livers(verified);
```

### 2. Configure Supabase Credentials

1. In your Supabase dashboard, go to **Settings > API**
2. Copy your **Project URL** and **anon/public key**
3. Open `js/supabase-config.js` and update:

```javascript
const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL',      // e.g., https://abc123.supabase.co
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
    tableName: 'btc_livers'
};
```

### 3. Deploy

The app is static HTML/CSS/JS, so you can deploy it anywhere:

**Vercel (Recommended):**
```bash
npm i -g vercel
cd Living-on-BTC
vercel
```

**Netlify:**
1. Drag and drop the `Living-on-BTC` folder to [netlify.com/drop](https://app.netlify.com/drop)

**GitHub Pages:**
1. Push to a GitHub repository
2. Enable GitHub Pages in repository settings

## Demo Mode

If Supabase is not configured, the app runs in **demo mode** with sample data. This is useful for testing the UI before setting up the backend.

## Calculation Methodology

### Savings Formula

```
cheaperBy = ((currentBtcPrice / btcPriceAtStart) - 1) * 100%
```

### Assumptions

| Parameter | Value | Notes |
|-----------|-------|-------|
| Savings Rate | 30% | Percentage of income saved |
| Default Income | $50,000 | Used if not specified |
| Annual Inflation | 3% | USD purchasing power decrease |

### Estimated BTC Accumulated

If the user DCA'd (Dollar Cost Averaged) monthly:

```javascript
for each month since start:
    btcBought = (monthlyIncome * 0.30 / 12) / btcPriceAtMonth
    totalBtc += btcBought
```

## API Rate Limits

- **CryptoCompare:** Free tier allows ~100 requests/minute
- Built-in caching and rate limiting in `btc-price.js`

## Moderation

New submissions are set to `verified: false` by default. To verify users:

1. Go to Supabase Dashboard > Table Editor > btc_livers
2. Find the submission and set `verified` to `true`

Future enhancement: Add admin authentication for moderators.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use and modify for your own projects.

## Contact

- Twitter: [@LiveonBTC](https://x.com/LiveonBTC)

---

**Goal:** Build the world's largest database of individuals living on Bitcoin! 🚀
