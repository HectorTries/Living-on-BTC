/**
 * BTC Price Utilities
 * Handles fetching historical and current Bitcoin prices
 */

const BTCPrice = {
    // Price cache to avoid repeated API calls
    cache: new Map(),
    lastApiCall: 0,
    API_RATE_LIMIT: 100, // ms between calls
    
    // Default assumptions
    DEFAULT_INCOME: 50000, // $50K USD baseline
    SAVINGS_RATE: 0.30, // 30% savings rate
    ANNUAL_INFLATION: 0.03, // 3% average USD inflation
    
    /**
     * Get historical BTC price for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string} currency - Currency code (USD, EUR, etc.)
     * @returns {number|null} Price or null on error
     */
    async getHistoricalPrice(date, currency = 'USD') {
        const cacheKey = `${date}-${currency}`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Rate limiting
        const now = Date.now();
        const waitTime = Math.max(0, this.API_RATE_LIMIT - (now - this.lastApiCall));
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastApiCall = Date.now();
        
        // Don't allow future dates
        const requestDate = new Date(date);
        const today = new Date();
        if (requestDate > today) {
            requestDate.setTime(today.getTime());
        }
        
        const timestamp = Math.floor(requestDate.getTime() / 1000);
        const apiUrl = `https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=${currency.toUpperCase()}&ts=${timestamp}`;
        
        try {
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                if (response.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.getHistoricalPrice(date, currency);
                }
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const data = await response.json();
            let price = null;
            
            if (data && data.BTC && data.BTC[currency.toUpperCase()]) {
                price = data.BTC[currency.toUpperCase()];
            }
            
            if (price) {
                this.cache.set(cacheKey, price);
                return price;
            }
            
            throw new Error(`Could not parse price for ${date}`);
        } catch (error) {
            console.error('Error fetching BTC price:', error);
            return null;
        }
    },
    
    /**
     * Get current BTC price
     * @param {string} currency - Currency code
     * @returns {number|null}
     */
    async getCurrentPrice(currency = 'USD') {
        const cacheKey = `current-${currency}`;
        const cached = this.cache.get(cacheKey);
        
        // Cache current price for 5 minutes
        if (cached && cached.timestamp > Date.now() - 300000) {
            return cached.price;
        }
        
        try {
            const response = await fetch(
                `https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=${currency.toUpperCase()}`
            );
            
            if (!response.ok) throw new Error('Failed to fetch current price');
            
            const data = await response.json();
            const price = data[currency.toUpperCase()];
            
            if (price) {
                this.cache.set(cacheKey, { price, timestamp: Date.now() });
                return price;
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching current price:', error);
            return null;
        }
    },
    
    /**
     * Calculate how much cheaper life is in BTC terms
     * 
     * Formula:
     * - Monthly BTC savings at start = (income * savings_rate) / 12 / btc_price_start
     * - Monthly BTC savings now = (income * savings_rate) / 12 / btc_price_now
     * - Life is cheaper by = (btc_price_now / btc_price_start - 1) * 100%
     * - Adjusted for inflation = subtract cumulative USD inflation
     * 
     * @param {string} startDate - When user started living on BTC
     * @param {number} annualIncome - Annual income in USD (optional)
     * @param {string} currency - Currency code
     * @returns {Object} Calculation results
     */
    async calculateSavings(startDate, annualIncome = null, currency = 'USD') {
        const income = annualIncome || this.DEFAULT_INCOME;
        const startDateObj = new Date(startDate);
        const today = new Date();
        
        // Get prices
        const priceAtStart = await this.getHistoricalPrice(startDate, currency);
        const currentPrice = await this.getCurrentPrice(currency);
        
        if (!priceAtStart || !currentPrice) {
            throw new Error('Could not fetch BTC prices');
        }
        
        // Calculate time elapsed
        const yearsElapsed = (today - startDateObj) / (365.25 * 24 * 60 * 60 * 1000);
        const monthsElapsed = Math.floor(yearsElapsed * 12);
        
        // Monthly savings in fiat
        const monthlySavingsFiat = (income * this.SAVINGS_RATE) / 12;
        
        // BTC purchasing power comparison
        const btcAtStart = monthlySavingsFiat / priceAtStart;
        const btcNow = monthlySavingsFiat / currentPrice;
        
        // BTC price appreciation
        const btcAppreciation = ((currentPrice / priceAtStart) - 1) * 100;
        
        // Cumulative USD inflation
        const cumulativeInflation = (Math.pow(1 + this.ANNUAL_INFLATION, yearsElapsed) - 1) * 100;
        
        // Real purchasing power gain (BTC appreciation minus inflation)
        const realGain = btcAppreciation - cumulativeInflation;
        
        // How much cheaper is life in BTC terms?
        // If BTC appreciated 500%, your savings buy 5x more goods when measured in BTC value
        const cheaperBy = btcAppreciation;
        
        // Estimated total BTC accumulated (if DCA'd monthly)
        let estimatedBtcAccumulated = 0;
        for (let m = 0; m < monthsElapsed; m++) {
            const monthDate = new Date(startDateObj);
            monthDate.setMonth(monthDate.getMonth() + m);
            // Approximate with linear interpolation between start and current
            const fraction = m / monthsElapsed;
            const estimatedPrice = priceAtStart + (currentPrice - priceAtStart) * fraction;
            estimatedBtcAccumulated += monthlySavingsFiat / estimatedPrice;
        }
        
        // Current value of accumulated BTC
        const accumulatedValue = estimatedBtcAccumulated * currentPrice;
        
        // What it would have been worth in a traditional savings account (0% real return)
        const traditionalValue = monthlySavingsFiat * monthsElapsed * (1 + (this.ANNUAL_INFLATION * yearsElapsed / 2));
        
        // Additional wealth generated
        const additionalWealth = accumulatedValue - traditionalValue;
        
        return {
            startDate,
            yearsElapsed: yearsElapsed.toFixed(2),
            monthsElapsed,
            
            // Prices
            btcPriceAtStart: priceAtStart,
            currentBtcPrice: currentPrice,
            btcAppreciation: btcAppreciation.toFixed(1),
            
            // Savings analysis
            monthlySavingsFiat,
            annualIncome: income,
            savingsRate: this.SAVINGS_RATE * 100,
            
            // BTC perspective
            btcPerMonthAtStart: btcAtStart.toFixed(8),
            btcPerMonthNow: btcNow.toFixed(8),
            
            // Results
            cheaperByPercent: cheaperBy.toFixed(1),
            realGainPercent: realGain.toFixed(1),
            cumulativeInflation: cumulativeInflation.toFixed(1),
            
            // Wealth accumulation
            estimatedBtcAccumulated: estimatedBtcAccumulated.toFixed(8),
            accumulatedValueUsd: accumulatedValue.toFixed(2),
            traditionalValueUsd: traditionalValue.toFixed(2),
            additionalWealth: additionalWealth.toFixed(2),
            
            currency
        };
    },
    
    /**
     * Calculate estimated savings percentage for the leaderboard
     * Simplified version that returns just the "cheaper by" percentage
     * @param {string} startDate 
     * @returns {number}
     */
    async getEstimatedSavingsPercent(startDate) {
        try {
            const priceAtStart = await this.getHistoricalPrice(startDate, 'USD');
            const currentPrice = await this.getCurrentPrice('USD');
            
            if (!priceAtStart || !currentPrice) return 0;
            
            return ((currentPrice / priceAtStart) - 1) * 100;
        } catch {
            return 0;
        }
    }
};

// Export
window.BTCPrice = BTCPrice;
