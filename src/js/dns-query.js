/**
 * DNS Query Engine with DNS-over-HTTPS (DoH) API Integration
 * Supports Cloudflare, Google, and Quad9 DoH providers
 */

class DNSQueryEngine {
    constructor() {
        // DoH API endpoints with fallback order
        this.dohProviders = {
            cloudflare: 'https://cloudflare-dns.com/dns-query',
            google: 'https://dns.google/dns-query',
            quad9: 'https://dns.quad9.net/dns-query'
        };

        // Fallback provider order
        this.fallbackOrder = ['cloudflare', 'google', 'quad9'];

        // DNS record type mappings to numeric values
        this.recordTypes = {
            A: 1,
            NS: 2,
            CNAME: 5,
            SOA: 6,
            PTR: 12,
            MX: 15,
            TXT: 16,
            AAAA: 28,
            SRV: 33
        };

        // Domain validation regex pattern
        this.domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

        // Configuration
        this.timeout = 10000; // 10 seconds timeout
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second initial delay

        // Performance optimizations - DNS result caching
        this.cache = new Map();
        this.cacheStats = { hits: 0, misses: 0 };
        this.maxCacheSize = 50;
        this.defaultCacheTTL = 300000; // 5 minutes
    }

    /**
     * Validates domain name format
     * @param {string} domain - Domain name to validate
     * @returns {boolean} - True if domain is valid
     */
    validateDomain(domain) {
        if (!domain || typeof domain !== 'string') {
            return false;
        }

        // Remove trailing dot if present
        const cleanDomain = domain.replace(/\.$/, '');
        
        // Check length constraints
        if (cleanDomain.length === 0 || cleanDomain.length > 253) {
            return false;
        }

        // Check each label length (max 63 characters)
        const labels = cleanDomain.split('.');
        for (const label of labels) {
            if (label.length === 0 || label.length > 63) {
                return false;
            }
        }

        return this.domainRegex.test(cleanDomain);
    }

    /**
     * Performs DNS query for a specific record type using DoH API with fallback
     * @param {string} domain - Domain name to query
     * @param {string} recordType - DNS record type (A, AAAA, CNAME, etc.)
     * @param {string} preferredProvider - Preferred DoH provider (default: 'cloudflare')
     * @returns {Promise<Object>} - DNS query result
     */
    async queryDNS(domain, recordType = 'A', preferredProvider = 'cloudflare') {
        // Validate domain
        if (!this.validateDomain(domain)) {
            throw new Error(`Invalid domain name: ${domain}`);
        }

        // Validate record type
        if (!this.recordTypes[recordType]) {
            throw new Error(`Unsupported DNS record type: ${recordType}`);
        }

        // Create provider order with preferred provider first
        const providerOrder = [preferredProvider, ...this.fallbackOrder.filter(p => p !== preferredProvider)];
        
        let lastError = null;
        
        // Try each provider in order
        for (const provider of providerOrder) {
            if (!this.dohProviders[provider]) {
                continue;
            }

            try {
                const result = await this.queryWithRetry(domain, recordType, provider);
                return result;
            } catch (error) {
                lastError = error;
                console.warn(`DNS query failed with ${provider}: ${error.message}`);
                continue;
            }
        }

        // If all providers failed, throw the last error
        throw new Error(`All DNS providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Performs DNS query with retry logic and timeout
     * @param {string} domain - Domain name to query
     * @param {string} recordType - DNS record type
     * @param {string} provider - DoH provider to use
     * @returns {Promise<Object>} - DNS query result
     */
    async queryWithRetry(domain, recordType, provider) {
        let lastError = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.performQuery(domain, recordType, provider);
            } catch (error) {
                lastError = error;
                
                // Don't retry on validation errors or client errors (4xx)
                if (error.message.includes('Invalid domain') || 
                    error.message.includes('Unsupported') ||
                    (error.message.includes('DoH API request failed') && error.message.includes('4'))) {
                    throw error;
                }

                // If this is the last attempt, throw the error
                if (attempt === this.maxRetries) {
                    throw error;
                }

                // Wait before retrying with exponential backoff
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    /**
     * Performs the actual DNS query with timeout
     * @param {string} domain - Domain name to query
     * @param {string} recordType - DNS record type
     * @param {string} provider - DoH provider to use
     * @returns {Promise<Object>} - DNS query result
     */
    async performQuery(domain, recordType, provider) {
        const url = new URL(this.dohProviders[provider]);
        url.searchParams.set('name', domain);
        url.searchParams.set('type', this.recordTypes[recordType]);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/dns-json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`DoH API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return this.parseDoHResponse(data, domain, recordType, provider);

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`DNS query timeout after ${this.timeout}ms`);
            }
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error(`Network error: Unable to reach ${provider} DoH API`);
            }
            
            throw error;
        }
    }

    /**
     * Sleep utility for retry delays
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Queries all supported DNS record types for a domain with fallback support and caching
     * @param {string} domain - Domain name to query
     * @param {string} preferredProvider - Preferred DoH provider (default: 'cloudflare')
     * @returns {Promise<Object>} - Object containing all DNS records by type
     */
    async queryAllRecords(domain, preferredProvider = 'cloudflare') {
        if (!this.validateDomain(domain)) {
            throw new Error(`Invalid domain name: ${domain}`);
        }

        // Check cache first
        const cacheKey = `${domain.toLowerCase()}:ALL`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            this.cacheStats.hits++;
            return { ...cached, fromCache: true };
        }
        this.cacheStats.misses++;

        const results = {};
        const recordTypes = Object.keys(this.recordTypes);
        let hasAnySuccess = false;
        let totalFailures = 0;

        // Query all record types concurrently with limited concurrency to avoid overwhelming APIs
        const batchSize = 3; // Process 3 record types at a time
        const batches = [];
        
        for (let i = 0; i < recordTypes.length; i += batchSize) {
            batches.push(recordTypes.slice(i, i + batchSize));
        }

        for (const batch of batches) {
            const promises = batch.map(async (recordType) => {
                try {
                    const result = await this.queryDNS(domain, recordType, preferredProvider);
                    hasAnySuccess = true;
                    return { recordType, result, success: true };
                } catch (error) {
                    totalFailures++;
                    // Return enhanced error info for better user feedback
                    return { 
                        recordType, 
                        result: {
                            domain,
                            recordType,
                            records: [],
                            error: this.categorizeError(error.message),
                            originalError: error.message,
                            timestamp: new Date().toISOString(),
                            source: 'failed',
                            failedProviders: this.fallbackOrder,
                            retryable: this.isRetryableError(error.message)
                        },
                        success: false
                    };
                }
            });

            const batchResponses = await Promise.all(promises);
            
            // Organize results by record type
            batchResponses.forEach(({ recordType, result }) => {
                results[recordType] = result;
            });
        }

        // If no records were successfully retrieved, throw an error
        if (!hasAnySuccess && totalFailures === recordTypes.length) {
            throw new Error(`Failed to retrieve any DNS records for ${domain}. All ${totalFailures} record type queries failed.`);
        }

        // Cache successful results
        if (hasAnySuccess) {
            this.setCache(cacheKey, results);
        }

        return results;
    }

    /**
     * Categorizes error messages for better user understanding
     * @param {string} errorMessage - Original error message
     * @returns {string} - User-friendly error message
     */
    categorizeError(errorMessage) {
        if (errorMessage.includes('timeout')) {
            return 'Request timed out - DNS server may be slow or unreachable';
        }
        
        if (errorMessage.includes('Network error')) {
            return 'Network connection failed - check your internet connection';
        }
        
        if (errorMessage.includes('Name Error') || errorMessage.includes('NXDOMAIN')) {
            return 'Domain not found - verify the domain name is correct';
        }
        
        if (errorMessage.includes('Server Failure')) {
            return 'DNS server error - the authoritative server is having issues';
        }
        
        if (errorMessage.includes('Refused')) {
            return 'DNS query refused - the server declined to answer';
        }
        
        if (errorMessage.includes('All DNS providers failed')) {
            return 'All DNS providers unavailable - try again later';
        }
        
        // Return original message if no specific category matches
        return errorMessage;
    }

    /**
     * Determines if an error is retryable
     * @param {string} errorMessage - Error message to analyze
     * @returns {boolean} - True if error is likely retryable
     */
    isRetryableError(errorMessage) {
        const retryableErrors = [
            'timeout',
            'Network error',
            'Server Failure',
            'All DNS providers failed'
        ];
        
        return retryableErrors.some(error => errorMessage.includes(error));
    }

    /**
     * Queries specific DNS record types for a domain
     * @param {string} domain - Domain name to query
     * @param {string[]} recordTypes - Array of DNS record types to query
     * @param {string} preferredProvider - Preferred DoH provider (default: 'cloudflare')
     * @returns {Promise<Object>} - Object containing requested DNS records by type
     */
    async querySpecificRecords(domain, recordTypes, preferredProvider = 'cloudflare') {
        if (!this.validateDomain(domain)) {
            throw new Error(`Invalid domain name: ${domain}`);
        }

        if (!Array.isArray(recordTypes) || recordTypes.length === 0) {
            throw new Error('Record types must be a non-empty array');
        }

        // Validate all record types
        for (const recordType of recordTypes) {
            if (!this.recordTypes[recordType]) {
                throw new Error(`Unsupported DNS record type: ${recordType}`);
            }
        }

        const results = {};

        // Query specified record types concurrently
        const promises = recordTypes.map(async (recordType) => {
            try {
                const result = await this.queryDNS(domain, recordType, preferredProvider);
                return { recordType, result, success: true };
            } catch (error) {
                return { 
                    recordType, 
                    result: {
                        domain,
                        recordType,
                        records: [],
                        error: this.categorizeError(error.message),
                        originalError: error.message,
                        timestamp: new Date().toISOString(),
                        source: 'failed',
                        retryable: this.isRetryableError(error.message)
                    },
                    success: false
                };
            }
        });

        const responses = await Promise.all(promises);
        
        // Organize results by record type
        responses.forEach(({ recordType, result }) => {
            results[recordType] = result;
        });

        return results;
    }

    /**
     * Parses DoH JSON response into standardized format
     * @param {Object} response - Raw DoH API response
     * @param {string} domain - Original domain queried
     * @param {string} recordType - DNS record type queried
     * @param {string} provider - DoH provider used
     * @returns {Object} - Parsed DNS record data
     */
    parseDoHResponse(response, domain, recordType, provider) {
        const result = {
            domain,
            recordType,
            records: [],
            timestamp: new Date().toISOString(),
            source: provider
        };

        // Check for DNS response status
        if (response.Status !== 0) {
            const statusMessages = {
                1: 'Format Error',
                2: 'Server Failure', 
                3: 'Name Error (NXDOMAIN)',
                4: 'Not Implemented',
                5: 'Refused'
            };
            
            result.error = statusMessages[response.Status] || `DNS Error (Status: ${response.Status})`;
            return result;
        }

        // Parse answer section
        if (response.Answer && Array.isArray(response.Answer)) {
            result.records = response.Answer
                .filter(record => record.type === this.recordTypes[recordType])
                .map(record => ({
                    name: record.name,
                    type: recordType,
                    ttl: record.TTL,
                    data: record.data
                }));
        }

        // Add additional sections if present
        if (response.Authority && Array.isArray(response.Authority)) {
            result.authority = response.Authority.map(record => ({
                name: record.name,
                type: this.getRecordTypeName(record.type),
                ttl: record.TTL,
                data: record.data
            }));
        }

        if (response.Additional && Array.isArray(response.Additional)) {
            result.additional = response.Additional.map(record => ({
                name: record.name,
                type: this.getRecordTypeName(record.type),
                ttl: record.TTL,
                data: record.data
            }));
        }

        return result;
    }

    /**
     * Gets record type name from numeric value
     * @param {number} typeNumber - Numeric DNS record type
     * @returns {string} - Record type name
     */
    getRecordTypeName(typeNumber) {
        for (const [name, number] of Object.entries(this.recordTypes)) {
            if (number === typeNumber) {
                return name;
            }
        }
        return `TYPE${typeNumber}`;
    }

    /**
     * Tests connectivity to all DoH providers
     * @returns {Promise<Object>} - Provider status results
     */
    async testProviders() {
        const testDomain = 'example.com';
        const testRecordType = 'A';
        const results = {};

        for (const provider of this.fallbackOrder) {
            try {
                const startTime = Date.now();
                await this.performQuery(testDomain, testRecordType, provider);
                const responseTime = Date.now() - startTime;
                
                results[provider] = {
                    status: 'available',
                    responseTime: responseTime,
                    error: null
                };
            } catch (error) {
                results[provider] = {
                    status: 'unavailable',
                    responseTime: null,
                    error: error.message
                };
            }
        }

        return results;
    }

    /**
     * Gets the fastest available DoH provider
     * @returns {Promise<string>} - Name of fastest provider
     */
    async getFastestProvider() {
        const providerTests = await this.testProviders();
        
        const availableProviders = Object.entries(providerTests)
            .filter(([_, result]) => result.status === 'available')
            .sort(([_, a], [__, b]) => a.responseTime - b.responseTime);

        if (availableProviders.length === 0) {
            throw new Error('No DoH providers are currently available');
        }

        return availableProviders[0][0];
    }

    /**
     * Sets custom timeout for DNS queries
     * @param {number} timeoutMs - Timeout in milliseconds
     */
    setTimeout(timeoutMs) {
        if (timeoutMs < 1000 || timeoutMs > 30000) {
            throw new Error('Timeout must be between 1000ms and 30000ms');
        }
        this.timeout = timeoutMs;
    }

    /**
     * Sets maximum retry attempts
     * @param {number} maxRetries - Maximum number of retry attempts
     */
    setMaxRetries(maxRetries) {
        if (maxRetries < 0 || maxRetries > 10) {
            throw new Error('Max retries must be between 0 and 10');
        }
        this.maxRetries = maxRetries;
    }

    /**
     * Gets supported DNS record types
     * @returns {string[]} - Array of supported record type names
     */
    getSupportedRecordTypes() {
        return Object.keys(this.recordTypes);
    }

    /**
     * Gets available DoH providers
     * @returns {string[]} - Array of available provider names
     */
    getAvailableProviders() {
        return Object.keys(this.dohProviders);
    }

    /**
     * Gets data from cache if not expired
     * @param {string} key - Cache key
     * @returns {Object|null} - Cached data or null
     */
    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Sets data in cache with TTL
     * @param {string} key - Cache key
     * @param {Object} data - Data to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    setCache(key, data, ttl = null) {
        // Calculate TTL from DNS record TTLs or use default
        const cacheTTL = ttl || this.calculateCacheTTL(data);
        
        // Ensure cache size limit
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data: data,
            expiresAt: Date.now() + cacheTTL,
            cachedAt: Date.now()
        });
    }

    /**
     * Calculates cache TTL based on DNS record TTLs
     * @param {Object} data - DNS data
     * @returns {number} - TTL in milliseconds
     */
    calculateCacheTTL(data) {
        let minTTL = this.defaultCacheTTL;

        for (const recordType in data) {
            const recordData = data[recordType];
            if (recordData && recordData.records) {
                for (const record of recordData.records) {
                    if (record.ttl) {
                        const recordTTLMs = record.ttl * 1000;
                        minTTL = Math.min(minTTL, recordTTLMs);
                    }
                }
            }
        }

        // Minimum 30 seconds, maximum 10 minutes
        return Math.max(30000, Math.min(600000, minTTL));
    }

    /**
     * Clears DNS cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheStats = { hits: 0, misses: 0 };
    }

    /**
     * Gets cache statistics
     * @returns {Object} - Cache statistics
     */
    getCacheStats() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        return {
            ...this.cacheStats,
            hitRate: total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(1) + '%' : '0%',
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize
        };
    }
}

// Export for use in other modules
window.DNSQueryEngine = DNSQueryEngine;