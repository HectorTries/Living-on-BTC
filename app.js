/* LivingOnBTC — Shared app script
   Loaded by all pages. Provides:
   - Theme toggle (light/dark) with localStorage persistence
   - Bitcoin price fetching (CoinGecko API, cached)
   - Number/date/currency formatters
   - Country DATA + exchange rates (for Labour calculator)
   - Skip-link focus handling
   - Service worker registration
   - Google Analytics (shared across pages)
*/

(function () {
    'use strict';

    /* ============================================
       ANALYTICS
       ============================================ */
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'G-C25ZWRJKXL');

    /* ============================================
       THEME TOGGLE
       ============================================ */
    const ThemeManager = {
        STORAGE_KEY: 'livingonbtc-theme',

        init() {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Default to dark unless explicitly saved or system strongly prefers light
            if (saved === 'light') {
                document.body.classList.add('light-mode');
            } else if (!saved && systemPrefersLight && !systemPrefersDark) {
                document.body.classList.add('light-mode');
            }

            this.updateToggleButton();
        },

        toggle() {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem(this.STORAGE_KEY, isLight ? 'light' : 'dark');
            this.updateToggleButton();
        },

        updateToggleButton() {
            const btn = document.getElementById('theme-toggle');
            if (!btn) return;
            const isLight = document.body.classList.contains('light-mode');
            const icon = btn.querySelector('i');
            const label = btn.querySelector('.theme-label');
            if (isLight) {
                if (icon) icon.className = 'fas fa-sun';
                if (label) label.textContent = 'Light';
                btn.setAttribute('aria-label', 'Switch to dark mode');
            } else {
                if (icon) icon.className = 'fas fa-moon';
                if (label) label.textContent = 'Dark';
                btn.setAttribute('aria-label', 'Switch to light mode');
            }
        }
    };

    /* ============================================
       NUMBER FORMATTERS (locale-aware)
       ============================================ */
    const Format = {
        // Compact: 1.5K, 2.3M, 4.1B
        compact(value, currency) {
            if (value == null || isNaN(value)) return '—';
            const abs = Math.abs(value);
            let formatted;
            if (abs >= 1e12) formatted = (value / 1e12).toFixed(2) + 'T';
            else if (abs >= 1e9) formatted = (value / 1e9).toFixed(2) + 'B';
            else if (abs >= 1e6) formatted = (value / 1e6).toFixed(2) + 'M';
            else if (abs >= 1e3) formatted = (value / 1e3).toFixed(1) + 'K';
            else formatted = value.toFixed(0);
            return currency ? currency + formatted : formatted;
        },

        // Standard with commas: 1,234,567
        number(value, decimals = 0) {
            if (value == null || isNaN(value)) return '—';
            return Number(value).toLocaleString('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },

        // Currency: $1,234.56
        currency(value, symbol = '$', decimals = 2) {
            if (value == null || isNaN(value)) return '—';
            return symbol + this.number(value, decimals);
        },

        // BTC amount: 0.00123456 BTC
        btc(value, decimals = 8) {
            if (value == null || isNaN(value)) return '—';
            return this.number(value, decimals) + ' BTC';
        },

        // Sats: 123,456 sats
        sats(value) {
            if (value == null || isNaN(value)) return '—';
            return this.number(Math.round(value)) + ' sats';
        },

        // Percentage: 12.5%
        percent(value, decimals = 1) {
            if (value == null || isNaN(value)) return '—';
            return this.number(value, decimals) + '%';
        },

        // Duration: 2.5 years, 6.2 months, 14 days
        duration(totalDays) {
            if (totalDays == null || isNaN(totalDays)) return '—';
            if (totalDays < 0) return '0 days';
            if (totalDays < 31) return Math.round(totalDays) + ' days';
            const months = totalDays / 30.4375;
            if (months < 24) return months.toFixed(1) + ' months';
            const years = months / 12;
            return years.toFixed(1) + ' years';
        },

        // Hours: 1,234 hrs (or 51 days, 10 hrs)
        hours(totalHours) {
            if (totalHours == null || isNaN(totalHours)) return '—';
            if (totalHours < 24) return Math.round(totalHours) + ' hrs';
            const days = totalHours / 24;
            if (days < 365) return days.toFixed(1) + ' days';
            const years = days / 365;
            return years.toFixed(1) + ' years';
        },

        // Date in YYYY-MM format
        yearMonth(date) {
            return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        },

        // Friendly: "Jan 2024"
        monthYear(date) {
            return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        }
    };

    /* ============================================
       BITCOIN PRICE (CoinGecko primary, Binance fallback)
       ============================================ */
    const PriceCache = {
        _cache: new Map(),
        _pending: new Map(),
        COINGECKO: 'https://api.coingecko.com/api/v3/simple/price',
        BINANCE: 'https://api.binance.com/api/v3/ticker/price',
        FX: 'https://api.frankfurter.dev/v1/latest?from=USD',
        TTL_MS: 5 * 60 * 1000, // 5 minutes

        async getBtcPrice(currency = 'usd') {
            currency = currency.toLowerCase();
            const cached = this._cache.get(currency);
            if (cached && Date.now() - cached.ts < this.TTL_MS) return cached.price;

            if (this._pending.has(currency)) return this._pending.get(currency);

            const promise = (async () => {
                let price = null;
                // Primary: CoinGecko
                try {
                    const r = await fetch(`${this.COINGECKO}?ids=bitcoin&vs_currencies=${currency}`);
                    if (r.ok) {
                        const d = await r.json();
                        const p = d.bitcoin?.[currency];
                        if (p) price = p;
                    }
                } catch (e) { /* fall through */ }

                // Fallback: Binance (direct pair, then BTC/USD x ECB FX)
                if (!price) {
                    try {
                        const pair = currency === 'usd' ? 'BTCUSDT' : `BTC${currency.toUpperCase()}`;
                        const r = await fetch(`${this.BINANCE}?symbol=${pair}`);
                        if (r.ok) {
                            const d = await r.json();
                            price = parseFloat(d.price);
                        }
                    } catch (e) { /* fall through */ }
                    if (!price && currency !== 'usd') {
                        try {
                            const [usdRes, fxRes] = await Promise.all([
                                fetch(`${this.BINANCE}?symbol=BTCUSDT`),
                                fetch(`${this.FX}&to=${currency.toUpperCase()}`)
                            ]);
                            const usdData = await usdRes.json();
                            const fxData = await fxRes.json();
                            const rate = fxData.rates?.[currency.toUpperCase()];
                            if (usdData.price && rate) price = parseFloat(usdData.price) * rate;
                        } catch (e) { /* give up */ }
                    }
                }

                if (!price) throw new Error('No price in response');
                this._cache.set(currency, { price, ts: Date.now() });
                this._pending.delete(currency);
                return price;
            })();

            this._pending.set(currency, promise);
            return promise;
        }
    };

    /* ============================================
       COUNTRY DATA (for Labour calculator)
       ============================================ */
    const CountryData = {
        // Average working hours per week (used for monthly calc)
        workingHours: {
            uk: 36.6,
            us: 40.0,
            turkey: 40.0,
            mexico: 40.0,
            canada: 37.5,
            japan: 38.0,
            brazil: 40.0,
            india: 48.0,
            germany: 35.0,
            france: 35.3,
            australia: 38.0
        },

        // Approximate USD exchange rates (kept conservative)
        exchangeRates: {
            usd: 1.0,
            gbp: 0.79,   // USD to GBP
            try: 32.0,   // USD to TRY
            mxn: 17.0,   // USD to MXN
            cad: 1.37,   // USD to CAD
            jpy: 150.0,  // USD to JPY
            brl: 5.0,    // USD to BRL
            inr: 83.0,   // USD to INR
            eur: 0.92,   // USD to EUR
            aud: 1.52    // USD to AUD
        },

        list: [
            { code: 'uk', name: 'United Kingdom', flag: '🇬🇧', currency: '£', code2: 'GBP' },
            { code: 'us', name: 'United States', flag: '🇺🇸', currency: '$', code2: 'USD' },
            { code: 'turkey', name: 'Turkey', flag: '🇹🇷', currency: '₺', code2: 'TRY' },
            { code: 'mexico', name: 'Mexico', flag: '🇲🇽', currency: 'MX$', code2: 'MXN' },
            { code: 'canada', name: 'Canada', flag: '🇨🇦', currency: 'C$', code2: 'CAD' },
            { code: 'japan', name: 'Japan', flag: '🇯🇵', currency: '¥', code2: 'JPY' },
            { code: 'brazil', name: 'Brazil', flag: '🇧🇷', currency: 'R$', code2: 'BRL' },
            { code: 'india', name: 'India', flag: '🇮🇳', currency: '₹', code2: 'INR' },
            { code: 'germany', name: 'Germany', flag: '🇩🇪', currency: '€', code2: 'EUR' },
            { code: 'france', name: 'France', flag: '🇫🇷', currency: '€', code2: 'EUR' },
            { code: 'australia', name: 'Australia', flag: '🇦🇺', currency: 'A$', code2: 'AUD' }
        ],

        get(code) {
            return this.list.find(c => c.code === code);
        }
    };

    /* ============================================
       SKIP LINK (move focus to main on click)
       ============================================ */
    function initSkipLink() {
        const link = document.querySelector('.skip-link');
        if (!link) return;
        link.addEventListener('click', e => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.setAttribute('tabindex', '-1');
                target.focus();
                target.scrollIntoView();
            }
        });
    }

    /* ============================================
       THEME BUTTON BIND
       ============================================ */
    function initThemeButton() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => ThemeManager.toggle());
    }

    /* ============================================
       SERVICE WORKER
       ============================================ */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('SW registered:', reg.scope))
                    .catch(err => console.warn('SW registration failed:', err));
            });
        }
    }

    /* ============================================
       INIT
       ============================================ */
    function init() {
        ThemeManager.init();
        initThemeButton();
        initSkipLink();
        registerServiceWorker();
    }

    // Expose public API
    window.LivingOnBTC = {
        Theme: ThemeManager,
        Format,
        Price: PriceCache,
        Countries: CountryData,
        init
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();