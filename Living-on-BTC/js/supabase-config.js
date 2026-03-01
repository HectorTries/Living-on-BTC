/**
 * Supabase Configuration for Living on BTC
 * 
 * Setup Instructions:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Create a table called "btc_livers" with this SQL:
 * 
 * CREATE TABLE btc_livers (
 *     id SERIAL PRIMARY KEY,
 *     x_username VARCHAR(50) UNIQUE NOT NULL,
 *     start_date DATE NOT NULL,
 *     added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *     verified BOOLEAN DEFAULT FALSE,
 *     estimated_savings DECIMAL(10,2),
 *     btc_price_at_start DECIMAL(20,2),
 *     notes TEXT,
 *     country VARCHAR(100)
 * );
 * 
 * -- Enable Row Level Security
 * ALTER TABLE btc_livers ENABLE ROW LEVEL SECURITY;
 * 
 * -- Policy for anonymous reads (everyone can see verified users)
 * CREATE POLICY "Anyone can read verified users" ON btc_livers
 *     FOR SELECT USING (verified = true);
 * 
 * -- Policy for anonymous inserts (rate limited via Supabase settings)
 * CREATE POLICY "Anyone can submit" ON btc_livers
 *     FOR INSERT WITH CHECK (true);
 * 
 * -- Admin policy (for verification via dashboard)
 * -- Use Supabase dashboard for admin operations
 * 
 * 3. Get your project URL and anon key from Project Settings > API
 * 4. Replace the values below
 */

const SUPABASE_CONFIG = {
    // Replace with your Supabase project URL
    url: 'YOUR_SUPABASE_URL',
    
    // Replace with your Supabase anon/public key
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
    
    // Table name
    tableName: 'btc_livers'
};

// Initialize Supabase client
let supabase = null;

function initSupabase() {
    if (supabase) return supabase;
    
    if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || 
        SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn('Supabase not configured. Using demo mode.');
        return null;
    }
    
    // Load Supabase JS from CDN if not already loaded
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase JS library not loaded. Add the script tag.');
        return null;
    }
    
    supabase = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
    );
    
    return supabase;
}

/**
 * BTC Livers Database Operations
 */
const BTCLivers = {
    /**
     * Add a new BTC liver to the database
     * @param {Object} userData - { x_username, start_date, notes?, country? }
     * @returns {Object} - { success, data?, error? }
     */
    async add(userData) {
        const client = initSupabase();
        
        if (!client) {
            // Demo mode - return mock success
            return {
                success: true,
                demo: true,
                data: {
                    id: Date.now(),
                    ...userData,
                    added_at: new Date().toISOString(),
                    verified: false
                }
            };
        }
        
        try {
            const { data, error } = await client
                .from(SUPABASE_CONFIG.tableName)
                .insert([{
                    x_username: userData.x_username.replace('@', '').toLowerCase(),
                    start_date: userData.start_date,
                    notes: userData.notes || null,
                    country: userData.country || null,
                    btc_price_at_start: userData.btc_price_at_start || null,
                    estimated_savings: userData.estimated_savings || null
                }])
                .select()
                .single();
            
            if (error) {
                // Handle duplicate entry
                if (error.code === '23505') {
                    return {
                        success: false,
                        error: 'This X username is already in our database!'
                    };
                }
                throw error;
            }
            
            return { success: true, data };
        } catch (error) {
            console.error('Error adding BTC liver:', error);
            return {
                success: false,
                error: error.message || 'Failed to add entry'
            };
        }
    },
    
    /**
     * Get all verified BTC livers
     * @param {Object} options - { limit?, orderBy?, ascending? }
     * @returns {Object} - { success, data?, error?, count? }
     */
    async getAll(options = {}) {
        const client = initSupabase();
        const limit = options.limit || 100;
        const orderBy = options.orderBy || 'start_date';
        const ascending = options.ascending ?? true;
        
        if (!client) {
            // Demo mode - return mock data
            return {
                success: true,
                demo: true,
                data: getDemoData(),
                count: getDemoData().length
            };
        }
        
        try {
            const { data, error, count } = await client
                .from(SUPABASE_CONFIG.tableName)
                .select('*', { count: 'exact' })
                .eq('verified', true)
                .order(orderBy, { ascending })
                .limit(limit);
            
            if (error) throw error;
            
            return { success: true, data, count };
        } catch (error) {
            console.error('Error fetching BTC livers:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch data'
            };
        }
    },
    
    /**
     * Check if a username already exists
     * @param {string} username 
     * @returns {boolean}
     */
    async exists(username) {
        const client = initSupabase();
        const cleanUsername = username.replace('@', '').toLowerCase();
        
        if (!client) {
            // Demo mode - check against demo data
            return getDemoData().some(u => 
                u.x_username.toLowerCase() === cleanUsername
            );
        }
        
        try {
            const { data, error } = await client
                .from(SUPABASE_CONFIG.tableName)
                .select('id')
                .eq('x_username', cleanUsername)
                .single();
            
            return !!data;
        } catch {
            return false;
        }
    },
    
    /**
     * Get statistics about BTC livers
     * @returns {Object} - { totalCount, earliestLiver, averageSavings }
     */
    async getStats() {
        const client = initSupabase();
        
        if (!client) {
            const demo = getDemoData();
            return {
                success: true,
                demo: true,
                stats: {
                    totalCount: demo.length,
                    earliestDate: demo.reduce((earliest, user) => 
                        user.start_date < earliest ? user.start_date : earliest, 
                        demo[0]?.start_date || new Date().toISOString()
                    ),
                    verifiedCount: demo.filter(u => u.verified).length
                }
            };
        }
        
        try {
            const { count } = await client
                .from(SUPABASE_CONFIG.tableName)
                .select('*', { count: 'exact', head: true })
                .eq('verified', true);
            
            const { data: earliest } = await client
                .from(SUPABASE_CONFIG.tableName)
                .select('start_date')
                .eq('verified', true)
                .order('start_date', { ascending: true })
                .limit(1)
                .single();
            
            return {
                success: true,
                stats: {
                    totalCount: count || 0,
                    earliestDate: earliest?.start_date || null,
                    verifiedCount: count || 0
                }
            };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Demo data for when Supabase is not configured
 */
function getDemoData() {
    return [
        {
            id: 1,
            x_username: 'saylor',
            start_date: '2020-08-11',
            added_at: '2024-01-15T10:00:00Z',
            verified: true,
            estimated_savings: 892.5,
            country: 'United States'
        },
        {
            id: 2,
            x_username: 'jack',
            start_date: '2017-01-01',
            added_at: '2024-01-10T08:30:00Z',
            verified: true,
            estimated_savings: 4521.3,
            country: 'United States'
        },
        {
            id: 3,
            x_username: 'nayaborrero',
            start_date: '2019-03-15',
            added_at: '2024-02-01T14:20:00Z',
            verified: true,
            estimated_savings: 1256.8,
            country: 'Mexico'
        },
        {
            id: 4,
            x_username: 'BitcoinMagazine',
            start_date: '2018-06-01',
            added_at: '2024-01-20T11:45:00Z',
            verified: true,
            estimated_savings: 2145.6,
            country: 'United States'
        },
        {
            id: 5,
            x_username: 'BitcoinBroski',
            start_date: '2021-11-01',
            added_at: '2024-03-05T09:15:00Z',
            verified: true,
            estimated_savings: 312.4,
            country: 'El Salvador'
        }
    ];
}

// Export for use in other files
window.BTCLivers = BTCLivers;
window.initSupabase = initSupabase;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
