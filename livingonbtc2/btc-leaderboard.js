/**
 * Bitcoin Standard Leaderboard Widget
 * A standalone JavaScript module that renders a leaderboard of Bitcoin adopters
 * showing how much cheaper things are in sats since their adoption
 */
(function() {
    'use strict';

    // Static profile data with publicly available Bitcoin adoption dates
    const PROFILES = [
        {
            name: "Satoshi Nakamoto",
            handle: "@satoshi",
            twitterUrl: "https://twitter.com/satoshi",
            adoptionDate: "2009-01-03", // Genesis block
            adoptionPrice: 0
        },
        {
            name: "Michael Saylor",
            handle: "@saylor",
            twitterUrl: "https://twitter.com/saylor",
            adoptionDate: "2020-08-11", // MicroStrategy first purchase
            adoptionPrice: 11500
        },
        {
            name: "Max Keiser",
            handle: "@maxkeiser", 
            twitterUrl: "https://twitter.com/maxkeiser",
            adoptionDate: "2011-01-01", // Early public Bitcoin advocate
            adoptionPrice: 30
        },
        {
            name: "Anthony Pompliano",
            handle: "@apompliano",
            twitterUrl: "https://twitter.com/apompliano",
            adoptionDate: "2017-05-01", // Started podcast and public advocacy
            adoptionPrice: 1500
        },
        {
            name: "Saifedean Ammous",
            handle: "@saifedean",
            twitterUrl: "https://twitter.com/saifedean",
            adoptionDate: "2013-01-01", // Bitcoin Standard book research period
            adoptionPrice: 200
        },
        {
            name: "Jack Mallers",
            handle: "@jackmallers",
            twitterUrl: "https://twitter.com/jackmallers",
            adoptionDate: "2018-01-01", // Strike development period
            adoptionPrice: 6500
        },
        {
            name: "Lyn Alden",
            handle: "@lynaldencontact",
            twitterUrl: "https://twitter.com/lynaldencontact",
            adoptionDate: "2020-04-01", // Public Bitcoin analysis period
            adoptionPrice: 7000
        },
        {
            name: "Preston Pysh",
            handle: "@prestonpysh",
            twitterUrl: "https://twitter.com/prestonpysh",
            adoptionDate: "2019-01-01", // Bitcoin Standard advocacy period
            adoptionPrice: 3500
        }
    ];

    const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
    const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

    let currentBtcPrice = 0;
    let lastUpdateTime = null;

    /**
     * Fetch Bitcoin price from CoinGecko API
     */
    async function fetchBitcoinPrice() {
        try {
            const response = await fetch(COINGECKO_API);
            const data = await response.json();
            return data.bitcoin.usd;
        } catch (error) {
            console.error('Error fetching Bitcoin price:', error);
            return 45000; // Fallback price
        }
    }

    /**
     * Calculate how much cheaper things are for a profile
     */
    function calculateCheaperMultiplier(adoptionPrice, currentPrice) {
        if (adoptionPrice === 0) {
            // Special case for Satoshi - use $0.01 as effective adoption price
            // This makes him virtually unbeatable while being realistic
            return currentPrice / 0.01;
        }
        return currentPrice / adoptionPrice;
    }

    /**
     * Sort profiles by how much cheaper things have become
     */
    function sortProfilesByPerformance(profiles, currentPrice) {
        return profiles.map(profile => ({
            ...profile,
            cheaperPct: calculateCheaperMultiplier(profile.adoptionPrice, currentPrice)
        })).sort((a, b) => b.cheaperPct - a.cheaperPct);
    }

    /**
     * Format timestamp for display
     */
    function formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    /**
     * Detect if we need a relative path for calculator
     */
    function getCalculatorPath() {
        const currentPath = window.location.pathname;
        const isInBlogFolder = currentPath.includes('/blog/');
        return isInBlogFolder ? '../calculator (1).html' : 'calculator (1).html';
    }

    /**
     * Check if we're on the leaderboard page
     */
    function isLeaderboardPage() {
        const currentPath = window.location.pathname;
        return currentPath.includes('Bitcoin Standard Leaderboard.html');
    }

    /**
     * Create the sidebar leaderboard HTML structure
     */
    function createSidebarHTML() {
        const calculatorPath = getCalculatorPath();
        
        return `
            <div id="btc-leaderboard">
                <h2>₿ Standard Leaderboard</h2>
                <div class="subtitle">How much cheaper has life become?</div>
                
                <div class="calculator-link">
                    <a href="${calculatorPath}" class="calc-btn">
                        <span class="calculator-icon">🧮</span>
                        Calculate Your BTC Standard
                    </a>
                </div>
                
                <ul id="leaderboard-list">
                    <!-- Dynamic content will be inserted here -->
                </ul>
                
                <div class="updated">
                    <span id="last-updated">Loading...</span>
                </div>
            </div>
        `;
    }

    /**
     * Create the full page leaderboard HTML structure
     */
    function createFullPageHTML() {
        const calculatorPath = getCalculatorPath();
        
        return `
            <div id="btc-leaderboard-full">
                <div class="leaderboard-header">
                    <h1><i class="fab fa-bitcoin"></i> Bitcoin Standard Leaderboard</h1>
                    <p class="subtitle">See how much cheaper life has become for Bitcoin advocates since their adoption</p>
                    
                    <div class="calculator-link">
                        <a href="${calculatorPath}" class="calc-btn">
                            <span class="calculator-icon">🧮</span>
                            Calculate Your Own BTC Standard
                        </a>
                    </div>
                </div>
                
                <div class="leaderboard-container">
                    <ul id="leaderboard-list-full">
                        <!-- Dynamic content will be inserted here -->
                    </ul>
                </div>
                
                <div class="updated">
                    <span id="last-updated-full">Loading...</span>
                </div>
            </div>
        `;
    }

    /**
     * Inject CSS styles for the leaderboard
     */
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Sidebar Leaderboard Styles */
            #btc-leaderboard {
                position: fixed;
                top: 20px;
                right: -320px;
                width: 320px;
                height: calc(100vh - 40px);
                background: rgba(26, 31, 54, 0.97);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 16px 0 0 16px;
                padding: 1.5rem;
                backdrop-filter: blur(10px);
                box-shadow: -8px 0 30px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #fff;
                overflow-y: auto;
                transition: right 0.3s ease-in-out;
            }

            #btc-leaderboard:hover {
                right: 0;
            }

            /* Enhanced trigger tab */
            #btc-leaderboard::before {
                content: '₿ Leaderboard';
                position: absolute;
                left: -80px;
                top: 50%;
                transform: translateY(-50%);
                background: linear-gradient(135deg, #f7931a, #ff8c00);
                color: white;
                font-size: 0.85rem;
                font-weight: 700;
                padding: 12px 8px;
                border-radius: 12px 0 0 12px;
                border: 2px solid #f7931a;
                border-right: none;
                backdrop-filter: blur(10px);
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 
                    -4px 0 20px rgba(247, 147, 26, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                writing-mode: vertical-rl;
                text-orientation: mixed;
                letter-spacing: 1px;
                animation: pulseGlow 2s ease-in-out infinite alternate;
            }

            @keyframes pulseGlow {
                0% {
                    box-shadow: 
                        -4px 0 20px rgba(247, 147, 26, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
                }
                100% {
                    box-shadow: 
                        -4px 0 30px rgba(247, 147, 26, 0.6),
                        -2px 0 15px rgba(247, 147, 26, 0.4),
                        inset 0 1px 0 rgba(255, 255, 255, 0.3);
                }
            }

            #btc-leaderboard:hover::before {
                content: '✨ Open ₿';
                background: linear-gradient(135deg, #ff8c00, #f7931a);
                transform: translateY(-50%) translateX(-5px);
                box-shadow: 
                    -6px 0 35px rgba(247, 147, 26, 0.7),
                    -3px 0 20px rgba(247, 147, 26, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.4);
                animation: none;
            }

            /* Full Page Leaderboard Styles */
            #btc-leaderboard-full {
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                color: #fff;
                font-family: 'Segoe UI', Arial, sans-serif;
            }

            .leaderboard-header {
                text-align: center;
                margin-bottom: 3rem;
            }

            .leaderboard-header h1 {
                font-size: 2.5rem;
                margin-bottom: 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
                color: #fff;
            }

            .leaderboard-header h1 i {
                color: #f7931a;
            }

            .leaderboard-container {
                background: rgba(26, 31, 54, 0.97);
                border-radius: 16px;
                padding: 2rem;
                border: 1px solid rgba(255, 255, 255, 0.12);
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
            }

            /* Shared Styles */
            #btc-leaderboard h2, #btc-leaderboard-full h2 {
                margin: 0 0 1rem 0;
                font-size: 1.3rem;
                color: #fff;
                display: flex;
                align-items: center;
                gap: 8px;
                border-bottom: 2px solid #f7931a;
                padding-bottom: 0.5rem;
            }

            #btc-leaderboard h2::before {
                content: '₿';
                color: #f7931a;
                font-size: 1.5rem;
            }

            .subtitle {
                font-size: 0.85rem;
                color: #aabbcc;
                margin: -0.5rem 0 1rem 0;
                text-align: center;
                font-style: italic;
            }

            .leaderboard-header .subtitle {
                font-size: 1.1rem;
                margin: 0 0 2rem 0;
                max-width: 600px;
                margin-left: auto;
                margin-right: auto;
            }

            .calculator-link {
                margin-bottom: 1.5rem;
                text-align: center;
            }

            .calc-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: linear-gradient(135deg, #f7931a, #ff8c00);
                color: white;
                padding: 10px 16px;
                border-radius: 8px;
                text-decoration: none;
                font-size: 0.9rem;
                font-weight: 600;
                transition: all 0.3s ease;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .calc-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(247, 147, 26, 0.4);
                color: white;
                text-decoration: none;
            }

            .calculator-icon {
                font-size: 1rem;
            }

            #leaderboard-list, #leaderboard-list-full {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            #leaderboard-list li, #leaderboard-list-full li {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.8rem 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                transition: all 0.2s ease;
            }

            #leaderboard-list-full li {
                padding: 1.2rem 0;
            }

            #leaderboard-list li:hover, #leaderboard-list-full li:hover {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                padding-left: 0.5rem;
                padding-right: 0.5rem;
            }

            #leaderboard-list li:last-child, #leaderboard-list-full li:last-child {
                border-bottom: none;
            }

            #leaderboard-list a, #leaderboard-list-full a {
                display: flex;
                align-items: center;
                gap: 10px;
                text-decoration: none;
                color: #fff;
                font-weight: 500;
                transition: color 0.2s ease;
                flex: 1;
            }

            #leaderboard-list-full a {
                gap: 15px;
            }

            #leaderboard-list a:hover, #leaderboard-list-full a:hover {
                color: #f7931a;
            }

            .percent {
                font-size: 0.85rem;
                font-weight: 600;
                color: #4ade80;
                text-align: right;
                white-space: nowrap;
            }

            #leaderboard-list-full .percent {
                font-size: 1rem;
            }

            .percent.negative {
                color: #ef4444;
            }

            .updated {
                display: block;
                text-align: center;
                color: #aabbcc;
                font-size: 0.8rem;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }

            /* Mobile responsiveness */
            @media (max-width: 768px) {
                #btc-leaderboard {
                    position: fixed;
                    top: auto;
                    bottom: 0;
                    right: 0;
                    left: 0;
                    width: 100%;
                    height: 50vh;
                    border-radius: 16px 16px 0 0;
                    transform: translateY(calc(100% - 60px));
                    transition: transform 0.3s ease-in-out;
                }

                #btc-leaderboard:hover {
                    transform: translateY(0);
                }

                #btc-leaderboard::before {
                    content: '₿ Bitcoin Standard Leaderboard - Tap to Open';
                    left: 50%;
                    top: -35px;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #f7931a, #ff8c00);
                    color: white;
                    font-size: 0.8rem;
                    font-weight: 700;
                    padding: 8px 16px;
                    border-radius: 20px 20px 8px 8px;
                    border: 2px solid #f7931a;
                    border-bottom: none;
                    writing-mode: initial;
                    text-orientation: initial;
                    letter-spacing: 0.5px;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                    box-shadow: 
                        0 -4px 20px rgba(247, 147, 26, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
                    animation: pulseGlow 2s ease-in-out infinite alternate;
                }

                #btc-leaderboard:hover::before {
                    content: '✨ Swipe up to see how much cheaper life became ✨';
                    background: linear-gradient(135deg, #ff8c00, #f7931a);
                    transform: translateX(-50%) translateY(-3px);
                    box-shadow: 
                        0 -6px 35px rgba(247, 147, 26, 0.7),
                        0 -3px 20px rgba(247, 147, 26, 0.5),
                        inset 0 1px 0 rgba(255, 255, 255, 0.4);
                    animation: none;
                }

                .calc-btn {
                    font-size: 0.85rem;
                    padding: 8px 12px;
                }

                #btc-leaderboard-full {
                    padding: 1rem;
                }

                .leaderboard-header h1 {
                    font-size: 2rem;
                }

                .leaderboard-container {
                    padding: 1rem;
                }
            }

            @media (max-width: 480px) {
                #btc-leaderboard {
                    padding: 1rem;
                    height: 60vh;
                }

                #btc-leaderboard h2 {
                    font-size: 1.1rem;
                }

                .calc-btn {
                    font-size: 0.8rem;
                    padding: 6px 10px;
                }

                #btc-leaderboard::before {
                    max-width: calc(100% - 2rem);
                }

                .leaderboard-header h1 {
                    font-size: 1.8rem;
                    flex-direction: column;
                    gap: 10px;
                }
            }

            /* Scrollbar styling */
            #btc-leaderboard::-webkit-scrollbar, #btc-leaderboard-full::-webkit-scrollbar {
                width: 6px;
            }

            #btc-leaderboard::-webkit-scrollbar-track, #btc-leaderboard-full::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
            }

            #btc-leaderboard::-webkit-scrollbar-thumb, #btc-leaderboard-full::-webkit-scrollbar-thumb {
                background: #f7931a;
                border-radius: 3px;
            }

            #btc-leaderboard::-webkit-scrollbar-thumb:hover, #btc-leaderboard-full::-webkit-scrollbar-thumb:hover {
                background: #fbb034;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Render the leaderboard with current data
     */
    function renderLeaderboard() {
        console.log('Rendering leaderboard...');
        const isFullPage = isLeaderboardPage();
        console.log('Is full page mode:', isFullPage);
        
        const container = document.getElementById(isFullPage ? 'btc-leaderboard-full' : 'btc-leaderboard');
        console.log('Container found:', !!container);
        if (!container) {
            console.error('Container not found!');
            return;
        }

        const listElement = document.getElementById(isFullPage ? 'leaderboard-list-full' : 'leaderboard-list');
        const updatedElement = document.getElementById(isFullPage ? 'last-updated-full' : 'last-updated');
        
        console.log('List element found:', !!listElement);
        console.log('Updated element found:', !!updatedElement);

        if (!listElement || !updatedElement) {
            console.error('Required elements not found!');
            return;
        }

        // Sort profiles by performance
        const sortedProfiles = sortProfilesByPerformance(PROFILES, currentBtcPrice);
        console.log('Sorted profiles:', sortedProfiles.length);

        // Generate list items
        const listHTML = sortedProfiles.map(profile => {
            const isPositive = profile.cheaperPct >= 1;
            const percentClass = isPositive ? 'percent' : 'percent negative';
            
            let percentText;
            if (isPositive) {
                const multiplier = profile.cheaperPct;
                if (multiplier >= 10) {
                    percentText = `${multiplier.toFixed(0)}x cheaper`;
                } else if (multiplier >= 2) {
                    percentText = `${multiplier.toFixed(1)}x cheaper`;
                } else {
                    const percent = ((multiplier - 1) * 100).toFixed(0);
                    percentText = `${percent}% cheaper`;
                }
            } else {
                const multiplier = Math.abs(profile.cheaperPct);
                if (multiplier >= 2) {
                    percentText = `${multiplier.toFixed(1)}x more expensive`;
                } else {
                    const percent = ((multiplier - 1) * 100).toFixed(0);
                    percentText = `${percent}% more expensive`;
                }
            }

            return `
                <li>
                    <a href="${profile.twitterUrl}" target="_blank" rel="noopener">
                        <span>${profile.name}</span>
                    </a>
                    <span class="${percentClass}">${percentText}</span>
                </li>
            `;
        }).join('');

        console.log('Generated HTML length:', listHTML.length);
        listElement.innerHTML = listHTML;
        updatedElement.textContent = `Last updated: ${formatTime(lastUpdateTime)}`;
        console.log('DOM updated successfully');
    }

    /**
     * Update the leaderboard data and render
     */
    async function updateLeaderboard() {
        console.log('Updating leaderboard...');
        try {
            currentBtcPrice = await fetchBitcoinPrice();
            console.log('Bitcoin price fetched:', currentBtcPrice);
            lastUpdateTime = new Date();
            renderLeaderboard();
            console.log('Leaderboard rendered successfully');
        } catch (error) {
            console.error('Error updating leaderboard:', error);
        }
    }

    /**
     * Initialize the leaderboard widget
     */
    function initLeaderboard() {
        console.log('Initializing leaderboard...');
        
        // Inject styles
        injectStyles();

        // Check if we're on the full leaderboard page
        const isFullPage = isLeaderboardPage();
        console.log('Is full page:', isFullPage);
        
        if (isFullPage) {
            // For full page, check if the container already exists
            const existingContainer = document.getElementById('btc-leaderboard-full');
            console.log('Existing container found:', !!existingContainer);
            
            if (existingContainer) {
                // Use existing HTML structure, just update the content
                console.log('Using existing HTML structure');
                updateLeaderboard();
            } else {
                // Create and inject HTML if container doesn't exist
                console.log('Creating new HTML structure');
                const leaderboardHTML = createFullPageHTML();
                const mainContent = document.querySelector('.container') || document.body;
                mainContent.innerHTML = leaderboardHTML;
                updateLeaderboard();
            }
        } else {
            // For other pages, add as sidebar
            console.log('Creating sidebar');
            const leaderboardHTML = createSidebarHTML();
            document.body.insertAdjacentHTML('beforeend', leaderboardHTML);
            updateLeaderboard();
        }

        // Set up periodic updates
        setInterval(updateLeaderboard, UPDATE_INTERVAL);
    }

    /**
     * Initialize when DOM is ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Simple initialization - just update the leaderboard if we're on the right page
            if (isLeaderboardPage()) {
                console.log('Bitcoin Standard Leaderboard page detected');
                updateLeaderboard();
                setInterval(updateLeaderboard, UPDATE_INTERVAL);
            } else {
                initLeaderboard();
            }
        });
    } else {
        // Simple initialization - just update the leaderboard if we're on the right page
        if (isLeaderboardPage()) {
            console.log('Bitcoin Standard Leaderboard page detected');
            updateLeaderboard();
            setInterval(updateLeaderboard, UPDATE_INTERVAL);
        } else {
            initLeaderboard();
        }
    }

    // Expose public API
    window.BtcLeaderboard = {
        update: updateLeaderboard,
        getCurrentPrice: () => currentBtcPrice,
        getProfiles: () => PROFILES
    };

})();
