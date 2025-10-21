/**
 * UI Controller - Manages user interface interactions and DNS result display
 * Handles form processing, real-time validation, and result rendering
 */

class UIController {
    constructor() {
        this.dnsEngine = null;
        this.errorDetector = null;
        this.themeAdapter = null;
        
        // DOM element references
        this.elements = {};
        
        // State management
        this.currentDomain = null;
        this.isAnalyzing = false;
        
        // Domain validation regex (allows subdomains)
        this.domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
        
        // Performance optimizations - debouncing
        this.debounceTimers = new Map();
        this.validationDelay = 300; // 300ms delay for validation
        this.loadedSections = new Set();
    }

    /**
     * Initializes the user interface and sets up event listeners
     */
    initializeInterface() {
        // Cache DOM elements
        this.elements = {
            form: document.getElementById('dns-form'),
            domainInput: document.getElementById('domain-input'),
            analyzeBtn: document.getElementById('analyze-btn'),
            clearBtn: document.getElementById('clear-results'),
            resultsSection: document.getElementById('results-section'),
            loadingSection: document.getElementById('loading-section'),
            errorSummary: document.getElementById('error-summary'),
            dnsRecords: document.getElementById('dns-records'),
            domainValidation: document.getElementById('domain-validation'),
            resultsTitle: document.getElementById('results-title'),
            errorList: document.getElementById('error-list')
        };

        // Initialize DNS engine and error detector
        this.dnsEngine = new DNSQueryEngine();
        this.errorDetector = new DNSErrorDetector();

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Sets up all event listeners for the interface
     */
    setupEventListeners() {
        // Form submission
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', (e) => {
                e.preventDefault();
                const domain = this.elements.domainInput.value.trim();
                if (domain && this.validateDomainInput(domain, true)) {
                    this.handleDomainSubmit(domain);
                }
            });
        }

        // Real-time domain validation with debouncing
        if (this.elements.domainInput) {
            this.elements.domainInput.addEventListener('input', (e) => {
                this.debouncedValidation(e.target.value);
            });

            this.elements.domainInput.addEventListener('blur', (e) => {
                this.validateDomainInput(e.target.value, true);
            });
        }

        // Clear results button
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => {
                this.clearResults();
            });
        }
    }

    /**
     * Validates domain input and shows real-time feedback
     * @param {string} domain - Domain to validate
     * @param {boolean} showErrors - Whether to show error messages
     * @returns {boolean} - True if domain is valid
     */
    validateDomainInput(domain, showErrors = false) {
        const validationElement = this.elements.domainValidation;
        
        if (!domain) {
            if (validationElement) {
                validationElement.textContent = '';
                validationElement.className = 'input-validation';
            }
            return false;
        }

        const isValid = this.dnsEngine ? this.dnsEngine.validateDomain(domain) : this.domainRegex.test(domain);
        
        if (validationElement) {
            if (isValid) {
                validationElement.textContent = showErrors ? '' : '✓ Valid domain format';
                validationElement.className = 'input-validation valid';
            } else if (showErrors) {
                validationElement.textContent = '✗ Invalid domain format';
                validationElement.className = 'input-validation invalid';
            } else {
                validationElement.textContent = '';
                validationElement.className = 'input-validation';
            }
        }

        return isValid;
    }

    /**
     * Handles domain submission and initiates DNS analysis
     * @param {string} domain - Domain to analyze
     */
    async handleDomainSubmit(domain) {
        if (this.isAnalyzing) {
            return;
        }

        this.currentDomain = domain;
        this.isAnalyzing = true;

        try {
            // Show loading state
            this.showLoadingState();

            // Perform DNS lookup with enhanced error handling
            const dnsData = await this.performDNSAnalysisWithRetry(domain);
            
            // Analyze for errors
            const errorAnalysis = this.errorDetector.analyzeConfiguration(dnsData, domain);

            // Display results with progressive enhancement
            this.displayResultsWithProgressive(dnsData, errorAnalysis);

        } catch (error) {
            console.error('DNS analysis failed:', error);
            this.handleAnalysisError(error, domain);
        } finally {
            this.isAnalyzing = false;
            this.hideLoadingState();
        }
    }

    /**
     * Performs DNS analysis with retry logic and progressive enhancement
     * @param {string} domain - Domain to analyze
     * @returns {Promise<Object>} - DNS data with partial results support
     */
    async performDNSAnalysisWithRetry(domain) {
        const maxRetries = 2;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const dnsData = await this.dnsEngine.queryAllRecords(domain);
                
                // Check if we got any successful results
                const hasAnyResults = Object.values(dnsData).some(recordData => 
                    recordData && recordData.records && recordData.records.length > 0
                );

                if (hasAnyResults || attempt === maxRetries) {
                    return dnsData;
                }

                // If no results and not last attempt, retry
                throw new Error('No DNS records found, retrying...');

            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries) {
                    // Show retry message
                    this.showRetryMessage(attempt, maxRetries);
                    
                    // Wait before retry with exponential backoff
                    await this.sleep(1000 * attempt);
                } else {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    /**
     * Handles analysis errors with user-friendly messages
     * @param {Error} error - The error that occurred
     * @param {string} domain - Domain that was being analyzed
     */
    handleAnalysisError(error, domain) {
        let userMessage = '';
        let technicalDetails = '';
        let suggestions = [];

        // Categorize error types and provide appropriate messages
        if (error.message.includes('Invalid domain')) {
            userMessage = 'Invalid Domain Format';
            technicalDetails = 'The domain name you entered is not in a valid format.';
            suggestions = [
                'Check for typos in the domain name',
                'Ensure the domain follows standard naming conventions (e.g., example.com)',
                'Remove any special characters except hyphens and dots'
            ];
        } else if (error.message.includes('timeout') || error.message.includes('Network error')) {
            userMessage = 'Network Connection Issue';
            technicalDetails = 'Unable to connect to DNS servers to perform the lookup.';
            suggestions = [
                'Check your internet connection',
                'Try again in a few moments',
                'The domain\'s DNS servers might be temporarily unavailable'
            ];
        } else if (error.message.includes('All DNS providers failed')) {
            userMessage = 'DNS Resolution Failed';
            technicalDetails = 'All DNS providers were unable to resolve this domain.';
            suggestions = [
                'Verify the domain name is spelled correctly',
                'Check if the domain exists and is properly configured',
                'The domain might be newly registered and not yet propagated'
            ];
        } else if (error.message.includes('NXDOMAIN') || error.message.includes('Name Error')) {
            userMessage = 'Domain Not Found';
            technicalDetails = 'This domain name does not exist in the DNS system.';
            suggestions = [
                'Double-check the domain spelling',
                'Verify the domain is registered and active',
                'Try without "www" prefix if you included it'
            ];
        } else {
            userMessage = 'DNS Analysis Error';
            technicalDetails = error.message || 'An unexpected error occurred during DNS analysis.';
            suggestions = [
                'Try analyzing the domain again',
                'Check if the domain name is correct',
                'Contact support if the problem persists'
            ];
        }

        this.showDetailedError(userMessage, technicalDetails, suggestions, domain);
    }

    /**
     * Displays DNS analysis results
     * @param {Object} dnsData - DNS records data
     * @param {Object} errorAnalysis - Error analysis results
     */
    displayResults(dnsData, errorAnalysis) {
        // Update results title
        if (this.elements.resultsTitle) {
            this.elements.resultsTitle.textContent = `DNS Analysis Results for ${this.currentDomain}`;
        }

        // Display error summary
        this.displayErrorSummary(errorAnalysis);

        // Display DNS records
        this.displayDNSRecords(dnsData);

        // Show results section
        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'block';
        }

        // Scroll to results
        if (this.elements.resultsSection) {
            this.elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Displays results with progressive enhancement for partial data
     * @param {Object} dnsData - DNS records data (may be partial)
     * @param {Object} errorAnalysis - Error analysis results
     */
    displayResultsWithProgressive(dnsData, errorAnalysis) {
        // Store DNS data for lazy loading
        this.lastDNSData = dnsData;
        // Count successful and failed record types
        const recordStats = this.analyzeRecordStats(dnsData);
        
        // Update results title with status indicator
        if (this.elements.resultsTitle) {
            const statusIcon = recordStats.hasAnySuccess ? 
                (recordStats.hasAnyFailures ? '⚠️' : '✅') : '❌';
            
            const isSubdomainQuery = this.isSubdomain(this.currentDomain);
            const titlePrefix = isSubdomainQuery ? '🔍 DNS Records for' : 'DNS Analysis Results for';
            
            this.elements.resultsTitle.innerHTML = `
                ${statusIcon} ${titlePrefix} ${this.currentDomain}
                <div class="results-stats">
                    <span class="stat-success">${recordStats.successCount} successful</span>
                    ${recordStats.failureCount > 0 ? `<span class="stat-failure">${recordStats.failureCount} failed</span>` : ''}
                    ${recordStats.emptyCount > 0 ? `<span class="stat-empty">${recordStats.emptyCount} empty</span>` : ''}
                    ${isSubdomainQuery ? '<span class="stat-info">Subdomain query - no issue analysis</span>' : ''}
                </div>
            `;
        }

        // Show partial results notice if applicable
        if (recordStats.hasAnyFailures && recordStats.hasAnySuccess) {
            this.showPartialResultsNotice(recordStats);
        }

        // Display error summary only for main domains, not subdomains
        if (!this.isSubdomain(this.currentDomain)) {
            this.displayErrorSummary(errorAnalysis);
        }

        // Display DNS records with enhanced empty state handling
        this.displayDNSRecordsEnhanced(dnsData);

        // Show results section
        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'block';
        }

        // Scroll to results
        if (this.elements.resultsSection) {
            this.elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Analyzes DNS record statistics for progressive enhancement
     * @param {Object} dnsData - DNS records data
     * @returns {Object} - Statistics about record success/failure
     */
    analyzeRecordStats(dnsData) {
        let successCount = 0;
        let failureCount = 0;
        let emptyCount = 0;
        
        const recordTypes = Object.keys(dnsData);
        
        for (const recordType of recordTypes) {
            const recordData = dnsData[recordType];
            
            if (recordData.error) {
                failureCount++;
            } else if (recordData.records && recordData.records.length > 0) {
                successCount++;
            } else {
                emptyCount++;
            }
        }

        return {
            successCount,
            failureCount,
            emptyCount,
            totalCount: recordTypes.length,
            hasAnySuccess: successCount > 0,
            hasAnyFailures: failureCount > 0,
            hasAnyEmpty: emptyCount > 0
        };
    }

    /**
     * Shows notice about partial results
     * @param {Object} stats - Record statistics
     */
    showPartialResultsNotice(stats) {
        if (this.elements.errorSummary && this.elements.errorList) {
            const existingContent = this.elements.errorList.innerHTML;
            
            const partialNotice = `
                <div class="partial-results-notice">
                    <div class="status-indicator status-warning">⚠️ PARTIAL RESULTS</div>
                    <strong>Some DNS queries failed, but we got partial results</strong>
                    <p>Successfully retrieved ${stats.successCount} record types, but ${stats.failureCount} failed. 
                    This might be due to network issues or DNS server problems.</p>
                    <div class="notice-actions">
                        <button class="btn btn-secondary btn-small" onclick="window.uiController.retryFailedRecords()">
                            🔄 Retry Failed Records
                        </button>
                    </div>
                </div>
            `;

            this.elements.errorList.innerHTML = partialNotice + existingContent;
            this.elements.errorSummary.style.display = 'block';
        }
    }

    /**
     * Displays error summary section
     * @param {Object} errorAnalysis - Error analysis results
     */
    displayErrorSummary(errorAnalysis) {
        if (!this.elements.errorSummary || !this.elements.errorList) {
            return;
        }

        const hasIssues = errorAnalysis.summary.totalIssues > 0;
        
        if (hasIssues) {
            this.elements.errorSummary.style.display = 'block';
            
            // Create summary stats
            const summaryHTML = `
                <div class="error-stats">
                    <span class="stat critical">Critical: ${errorAnalysis.summary.criticalErrors}</span>
                    <span class="stat warning">Warnings: ${errorAnalysis.summary.warnings}</span>
                    <span class="stat info">Info: ${errorAnalysis.summary.infoItems}</span>
                </div>
            `;

            // Create error list
            const allIssues = [...errorAnalysis.errors, ...errorAnalysis.warnings, ...errorAnalysis.info];
            const issuesHTML = allIssues.map(issue => {
                const messageClass = issue.severity === 'error' ? 'error-message' : 
                                   issue.severity === 'warning' ? 'warning-message' : 'info-message';
                
                return `
                    <div class="${messageClass}">
                        <div class="status-indicator status-${issue.severity}">
                            ${issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}
                            ${issue.severity.toUpperCase()}
                        </div>
                        <strong>${issue.message}</strong>
                        <p>${issue.description}</p>
                        <p><strong>Recommendation:</strong> ${issue.recommendation}</p>
                    </div>
                `;
            }).join('');

            this.elements.errorList.innerHTML = summaryHTML + '<div class="error-items">' + issuesHTML + '</div>';
        } else {
            this.elements.errorSummary.style.display = 'none';
        }
    }

    /**
     * Displays DNS records in organized sections
     * @param {Object} dnsData - DNS records organized by type
     */
    displayDNSRecords(dnsData) {
        if (!this.elements.dnsRecords) {
            return;
        }

        const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR', 'SRV'];
        let recordsHTML = '';

        for (const recordType of recordTypes) {
            const recordData = dnsData[recordType];
            
            if (!recordData) {
                continue;
            }

            const hasRecords = recordData.records && recordData.records.length > 0;
            const hasError = recordData.error;

            recordsHTML += `
                <div class="dns-record-section">
                    <div class="collapsible-header" role="button" tabindex="0" aria-expanded="true">
                        <h3 class="collapsible-title">${recordType} Records 
                            <span class="record-count">${hasRecords ? recordData.records.length : 0}</span>
                        </h3>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content expanded">
                        <div class="collapsible-body">
                            ${hasError ? `
                                <div class="error-message">
                                    <strong>Error:</strong> ${recordData.error}
                                </div>
                            ` : ''}
                            ${hasRecords ? `
                                <div class="dns-record-list">
                                    ${recordData.records.map(record => `
                                        <div class="dns-record">
                                            <div class="dns-record-name">${record.name}</div>
                                            <div class="dns-record-value">${record.data}</div>
                                            <div class="dns-record-ttl">TTL: ${record.ttl}s</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : !hasError ? `
                                <div class="empty-state">
                                    <div class="empty-state-icon">📭</div>
                                    <p>No ${recordType} records found</p>
                                </div>
                            ` : ''}
                            <div class="entry-footer">
                                <small>Source: ${recordData.source} | Queried: ${new Date(recordData.timestamp).toLocaleString()}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        this.elements.dnsRecords.innerHTML = recordsHTML;
        
        // Reinitialize theme adapter for new collapsible sections
        if (window.themeAdapter) {
            window.themeAdapter.reinitializeAfterResults();
        }
    }

    /**
     * Displays DNS records with enhanced empty state and error handling
     * @param {Object} dnsData - DNS records organized by type
     */
    displayDNSRecordsEnhanced(dnsData) {
        if (!this.elements.dnsRecords) {
            return;
        }

        const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR', 'SRV'];
        let recordsHTML = '';

        // Add DMARC section first if we have TXT records (to extract DMARC from them)
        const dmarcData = this.extractDMARCFromTXT(dnsData);
        if (dmarcData) {
            const hasRecords = dmarcData.records && dmarcData.records.length > 0;
            const hasError = dmarcData.error;
            const statusClass = hasError ? 'status-error' : hasRecords ? 'status-success' : 'status-empty';
            const statusIcon = hasError ? '❌' : hasRecords ? '✅' : '📭';

            recordsHTML += `
                <div class="dns-record-section ${statusClass}" id="section-DMARC" data-record-type="DMARC">
                    <div class="collapsible-header" role="button" tabindex="0" aria-expanded="false" 
                         onclick="window.uiController.toggleSection('DMARC', this)">
                        <h3 class="collapsible-title">
                            ${statusIcon} DMARC Records 
                            <span class="record-count ${statusClass}">${hasRecords ? dmarcData.records.length : 0}</span>
                        </h3>
                        <span class="collapsible-toggle">▶</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="collapsible-body">
                            <div class="lazy-placeholder" onclick="window.uiController.loadLazySection('DMARC', this)">Click to load DMARC records...</div>
                        </div>
                    </div>
                </div>
            `;
        }

        for (const recordType of recordTypes) {
            const recordData = dnsData[recordType];
            
            if (!recordData) {
                continue;
            }

            const hasRecords = recordData.records && recordData.records.length > 0;
            const hasError = recordData.error;
            const statusClass = hasError ? 'status-error' : hasRecords ? 'status-success' : 'status-empty';
            const statusIcon = hasError ? '❌' : hasRecords ? '✅' : '📭';

            const sectionId = `section-${recordType}`;
            
            recordsHTML += `
                <div class="dns-record-section ${statusClass}" id="${sectionId}" data-record-type="${recordType}">
                    <div class="collapsible-header" role="button" tabindex="0" aria-expanded="false" 
                         onclick="window.uiController.toggleSection('${recordType}', this)">
                        <h3 class="collapsible-title">
                            ${statusIcon} ${recordType} Records 
                            <span class="record-count ${statusClass}">${hasRecords ? recordData.records.length : 0}</span>
                        </h3>
                        <span class="collapsible-toggle">▶</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="collapsible-body">
                            <div class="lazy-placeholder" onclick="window.uiController.loadLazySection('${recordType}', this)">Click to load ${recordType} records...</div>
                        </div>
                    </div>
                </div>
            `;
        }

        this.elements.dnsRecords.innerHTML = recordsHTML;
        
        // Force all sections to start collapsed
        const sections = this.elements.dnsRecords.querySelectorAll('.collapsible-header');
        sections.forEach((header) => {
            const content = header.nextElementSibling;
            const toggle = header.querySelector('.collapsible-toggle');
            
            header.setAttribute('aria-expanded', 'false');
            if (content) {
                content.classList.remove('expanded');
                content.style.display = 'none';
            }
            if (toggle) {
                toggle.textContent = '▶';
            }
        });
        
        // Reinitialize theme adapter for new collapsible sections
        if (window.themeAdapter && window.themeAdapter.reinitializeAfterResults) {
            window.themeAdapter.reinitializeAfterResults();
        }
    }

    /**
     * Gets contextual empty state message for different record types
     * @param {string} recordType - DNS record type
     * @returns {string} - HTML for empty state message
     */
    getEmptyStateMessage(recordType) {
        const emptyStateMessages = {
            'A': {
                icon: '🌐',
                message: 'No IPv4 addresses found',
                explanation: 'This domain doesn\'t have any IPv4 addresses configured.',
                impact: 'Users may not be able to access this domain via IPv4.'
            },
            'AAAA': {
                icon: '🌐',
                message: 'No IPv6 addresses found',
                explanation: 'This domain doesn\'t have any IPv6 addresses configured.',
                impact: 'IPv6-only users may not be able to access this domain.'
            },
            'MX': {
                icon: '📧',
                message: 'No mail servers configured',
                explanation: 'This domain cannot receive email.',
                impact: 'Email sent to this domain will bounce.'
            },
            'TXT': {
                icon: '📝',
                message: 'No text records found',
                explanation: 'No additional text information is configured.',
                impact: 'Missing SPF, DMARC, or verification records.'
            },
            'CNAME': {
                icon: '🔗',
                message: 'No aliases configured',
                explanation: 'This domain doesn\'t use canonical name aliases.',
                impact: 'All subdomains must have their own A/AAAA records.'
            },
            'NS': {
                icon: '🏢',
                message: 'No name servers found',
                explanation: 'No authoritative name servers are configured.',
                impact: 'This is unusual and may indicate a configuration problem.'
            },
            'SOA': {
                icon: '👑',
                message: 'No authority record found',
                explanation: 'No Start of Authority record is configured.',
                impact: 'This may indicate DNS configuration issues.'
            },
            'PTR': {
                icon: '🔄',
                message: 'No reverse DNS records',
                explanation: 'No reverse DNS lookups are configured.',
                impact: 'Some services may flag this domain in security checks.'
            },
            'SRV': {
                icon: '⚙️',
                message: 'No service records found',
                explanation: 'No specific services are advertised via DNS.',
                impact: 'Service discovery may not work for this domain.'
            },
            'DMARC': {
                icon: '🛡️',
                message: 'No DMARC records found',
                explanation: 'DMARC records are typically located at _dmarc.domain.com and provide email authentication policy.',
                impact: 'Email spoofing protection may not be configured.'
            }
        };

        const config = emptyStateMessages[recordType] || {
            icon: '📭',
            message: `No ${recordType} records found`,
            explanation: `This domain doesn't have any ${recordType} records configured.`,
            impact: 'This may or may not be expected depending on your use case.'
        };

        return `
            <div class="empty-state enhanced">
                <div class="empty-state-icon">${config.icon}</div>
                <h4>${config.message}</h4>
                <p class="empty-explanation">${config.explanation}</p>
                <p class="empty-impact"><strong>Impact:</strong> ${config.impact}</p>
                ${recordType === 'A' || recordType === 'MX' ? `
                    <div class="empty-actions">
                        <button class="btn btn-secondary btn-small" onclick="window.uiController.showRecordHelp('${recordType}')">
                            ❓ How to add ${recordType} records
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Shows loading state during DNS analysis
     */
    showLoadingState() {
        if (this.elements.loadingSection) {
            this.elements.loadingSection.style.display = 'block';
        }

        if (this.elements.analyzeBtn) {
            this.elements.analyzeBtn.classList.add('loading');
            this.elements.analyzeBtn.disabled = true;
        }

        // Hide previous results
        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'none';
        }
    }

    /**
     * Hides loading state after DNS analysis
     */
    hideLoadingState() {
        if (this.elements.loadingSection) {
            this.elements.loadingSection.style.display = 'none';
        }

        if (this.elements.analyzeBtn) {
            this.elements.analyzeBtn.classList.remove('loading');
            this.elements.analyzeBtn.disabled = false;
        }
    }

    /**
     * Shows error message to user
     * @param {string} message - Error message to display
     */
    showError(message) {
        if (this.elements.errorSummary && this.elements.errorList) {
            this.elements.errorSummary.style.display = 'block';
            this.elements.errorList.innerHTML = `
                <div class="error-item critical">
                    <div class="error-header">
                        <span class="error-type">ERROR</span>
                        <span class="error-message">DNS Analysis Failed</span>
                    </div>
                    <div class="error-description">${message}</div>
                </div>
            `;
        }

        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'block';
        }
    }

    /**
     * Shows detailed error with user-friendly message and suggestions
     * @param {string} title - Error title
     * @param {string} details - Technical details
     * @param {Array} suggestions - Array of suggestion strings
     * @param {string} domain - Domain that failed
     */
    showDetailedError(title, details, suggestions, domain) {
        if (this.elements.errorSummary && this.elements.errorList) {
            this.elements.errorSummary.style.display = 'block';
            
            const suggestionsHTML = suggestions.map(suggestion => 
                `<li>${suggestion}</li>`
            ).join('');

            this.elements.errorList.innerHTML = `
                <div class="error-item critical">
                    <div class="error-header">
                        <div class="status-indicator status-error">❌ ERROR</div>
                        <strong>${title}</strong>
                    </div>
                    <div class="error-description">
                        <p><strong>Domain:</strong> ${domain}</p>
                        <p>${details}</p>
                        <div class="error-suggestions">
                            <strong>What you can try:</strong>
                            <ul>${suggestionsHTML}</ul>
                        </div>
                        <div class="error-actions">
                            <button class="btn btn-secondary btn-small" onclick="window.uiController.retryAnalysis('${domain}')">
                                🔄 Try Again
                            </button>
                            <button class="btn btn-secondary btn-small" onclick="window.uiController.clearResults()">
                                ✨ Clear & Start Over
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'block';
        }
    }

    /**
     * Shows retry message during DNS analysis attempts
     * @param {number} attempt - Current attempt number
     * @param {number} maxAttempts - Maximum number of attempts
     */
    showRetryMessage(attempt, maxAttempts) {
        if (this.elements.loadingSection) {
            const loadingText = this.elements.loadingSection.querySelector('.loading-text');
            if (loadingText) {
                loadingText.innerHTML = `
                    <span class="loading-spinner"></span>
                    Retrying DNS analysis... (Attempt ${attempt + 1} of ${maxAttempts})
                `;
            }
        }
    }

    /**
     * Retries DNS analysis for a domain
     * @param {string} domain - Domain to retry analysis for
     */
    async retryAnalysis(domain) {
        if (this.isAnalyzing) {
            return;
        }

        // Clear previous error display
        if (this.elements.errorSummary) {
            this.elements.errorSummary.style.display = 'none';
        }

        // Set domain in input and retry
        if (this.elements.domainInput) {
            this.elements.domainInput.value = domain;
        }

        await this.handleDomainSubmit(domain);
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
     * Retries failed DNS records only
     */
    async retryFailedRecords() {
        if (!this.currentDomain || this.isAnalyzing) {
            return;
        }

        this.isAnalyzing = true;
        
        try {
            // Show loading state
            this.showLoadingState();

            // Get current results to identify failed record types
            const failedRecordTypes = this.getFailedRecordTypes();
            
            if (failedRecordTypes.length === 0) {
                return;
            }

            // Query only the failed record types
            const retryResults = await this.dnsEngine.querySpecificRecords(
                this.currentDomain, 
                failedRecordTypes
            );

            // Merge with existing results and redisplay
            this.mergeAndRedisplayResults(retryResults);

        } catch (error) {
            console.error('Retry failed:', error);
            this.showError('Retry failed: ' + error.message);
        } finally {
            this.isAnalyzing = false;
            this.hideLoadingState();
        }
    }

    /**
     * Retries a specific DNS record type
     * @param {string} recordType - DNS record type to retry
     */
    async retryRecordType(recordType) {
        if (!this.currentDomain || this.isAnalyzing) {
            return;
        }

        this.isAnalyzing = true;

        try {
            // Show loading for this specific record type
            this.showRecordTypeLoading(recordType);

            // Query the specific record type
            const result = await this.dnsEngine.queryDNS(this.currentDomain, recordType);
            
            // Update just this record type in the display
            this.updateRecordTypeDisplay(recordType, result);

        } catch (error) {
            console.error(`Retry ${recordType} failed:`, error);
            this.updateRecordTypeDisplay(recordType, {
                domain: this.currentDomain,
                recordType: recordType,
                records: [],
                error: error.message,
                timestamp: new Date().toISOString(),
                source: 'retry-failed'
            });
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * Shows help information for adding DNS records
     * @param {string} recordType - DNS record type to show help for
     */
    showRecordHelp(recordType) {
        const helpContent = this.getRecordHelpContent(recordType);
        
        // Create modal or expandable help section
        const helpHTML = `
            <div class="record-help-modal" id="record-help-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>How to add ${recordType} records</h3>
                        <button class="modal-close" onclick="document.getElementById('record-help-modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        ${helpContent}
                    </div>
                </div>
            </div>
        `;

        // Add to page
        document.body.insertAdjacentHTML('beforeend', helpHTML);
    }

    /**
     * Gets help content for specific record types
     * @param {string} recordType - DNS record type
     * @returns {string} - HTML help content
     */
    getRecordHelpContent(recordType) {
        const helpContent = {
            'A': `
                <p><strong>A records</strong> point your domain to an IPv4 address.</p>
                <h4>Common steps:</h4>
                <ol>
                    <li>Log into your domain registrar or DNS provider</li>
                    <li>Find the DNS management section</li>
                    <li>Add a new A record with:
                        <ul>
                            <li><strong>Name:</strong> @ (for root domain) or subdomain</li>
                            <li><strong>Type:</strong> A</li>
                            <li><strong>Value:</strong> Your server's IPv4 address (e.g., 192.0.2.1)</li>
                            <li><strong>TTL:</strong> 300-3600 seconds</li>
                        </ul>
                    </li>
                    <li>Save the changes</li>
                </ol>
                <p><strong>Example:</strong> @ A 192.0.2.1</p>
            `,
            'MX': `
                <p><strong>MX records</strong> tell email servers where to deliver mail for your domain.</p>
                <h4>Common steps:</h4>
                <ol>
                    <li>Log into your domain registrar or DNS provider</li>
                    <li>Find the DNS management section</li>
                    <li>Add MX records with:
                        <ul>
                            <li><strong>Name:</strong> @ (for root domain)</li>
                            <li><strong>Type:</strong> MX</li>
                            <li><strong>Priority:</strong> 10 (lower = higher priority)</li>
                            <li><strong>Value:</strong> Your mail server hostname</li>
                        </ul>
                    </li>
                    <li>Save the changes</li>
                </ol>
                <p><strong>Example:</strong> @ MX 10 mail.example.com</p>
                <p><strong>Popular email providers:</strong></p>
                <ul>
                    <li><strong>Google Workspace:</strong> aspmx.l.google.com</li>
                    <li><strong>Microsoft 365:</strong> yourdomain-com.mail.protection.outlook.com</li>
                </ul>
            `
        };

        return helpContent[recordType] || `
            <p>Help for ${recordType} records is not available yet.</p>
            <p>Please consult your DNS provider's documentation for specific instructions.</p>
        `;
    }

    /**
     * Gets failed record types from current display
     * @returns {Array} - Array of failed record type names
     */
    getFailedRecordTypes() {
        const failedTypes = [];
        const recordSections = document.querySelectorAll('.dns-record-section.status-error');
        
        recordSections.forEach(section => {
            const title = section.querySelector('.collapsible-title');
            if (title) {
                const recordType = title.textContent.split(' ')[1]; // Extract type from "❌ A Records"
                if (recordType) {
                    failedTypes.push(recordType);
                }
            }
        });

        return failedTypes;
    }

    /**
     * Shows loading state for a specific record type
     * @param {string} recordType - Record type being loaded
     */
    showRecordTypeLoading(recordType) {
        const section = document.querySelector(`.dns-record-section .collapsible-title:contains("${recordType}")`);
        if (section) {
            const parent = section.closest('.dns-record-section');
            const body = parent.querySelector('.collapsible-body');
            if (body) {
                body.innerHTML = `
                    <div class="loading-state">
                        <span class="loading-spinner"></span>
                        Retrying ${recordType} records...
                    </div>
                `;
            }
        }
    }

    /**
     * Updates display for a specific record type
     * @param {string} recordType - Record type to update
     * @param {Object} recordData - New record data
     */
    updateRecordTypeDisplay(recordType, recordData) {
        // Find the section for this record type and update it
        const sections = document.querySelectorAll('.dns-record-section');
        
        for (const section of sections) {
            const title = section.querySelector('.collapsible-title');
            if (title && title.textContent.includes(`${recordType} Records`)) {
                // Update the entire section with new data
                const hasRecords = recordData.records && recordData.records.length > 0;
                const hasError = recordData.error;
                const statusClass = hasError ? 'status-error' : hasRecords ? 'status-success' : 'status-empty';
                const statusIcon = hasError ? '❌' : hasRecords ? '✅' : '📭';

                // Update section class
                section.className = `dns-record-section ${statusClass}`;
                
                // Update title
                title.innerHTML = `
                    ${statusIcon} ${recordType} Records 
                    <span class="record-count ${statusClass}">${hasRecords ? recordData.records.length : 0}</span>
                `;

                // Update body content
                const body = section.querySelector('.collapsible-body');
                if (body) {
                    body.innerHTML = `
                        ${hasError ? `
                            <div class="error-message">
                                <div class="status-indicator status-error">❌ ERROR</div>
                                <strong>Failed to retrieve ${recordType} records</strong>
                                <p>${recordData.error}</p>
                                <div class="error-actions">
                                    <button class="btn btn-secondary btn-small" onclick="window.uiController.retryRecordType('${recordType}')">
                                        🔄 Retry ${recordType} Records
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                        ${hasRecords ? `
                            <div class="dns-record-list">
                                ${recordData.records.map(record => `
                                    <div class="dns-record">
                                        <div class="dns-record-name">${record.name}</div>
                                        <div class="dns-record-value">${record.data}</div>
                                        <div class="dns-record-ttl">TTL: ${record.ttl}s</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : !hasError ? this.getEmptyStateMessage(recordType) : ''}
                        <div class="entry-footer">
                            <small>Source: ${recordData.source || 'N/A'} | Queried: ${new Date(recordData.timestamp).toLocaleString()}</small>
                        </div>
                    `;
                }
                break;
            }
        }
    }

    /**
     * Merges retry results with existing results and redisplays
     * @param {Object} retryResults - Results from retry attempt
     */
    mergeAndRedisplayResults(retryResults) {
        // This would merge the retry results with existing cached results
        // For now, just trigger a full redisplay
        if (this.currentDomain) {
            this.handleDomainSubmit(this.currentDomain);
        }
    }

    /**
     * Clears all results and resets the interface
     */
    clearResults() {
        // Hide results section
        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'none';
        }

        // Clear results content
        if (this.elements.dnsRecords) {
            this.elements.dnsRecords.innerHTML = '';
        }

        if (this.elements.errorList) {
            this.elements.errorList.innerHTML = '';
        }

        if (this.elements.errorSummary) {
            this.elements.errorSummary.style.display = 'none';
        }

        // Clear domain input
        if (this.elements.domainInput) {
            this.elements.domainInput.value = '';
        }

        // Clear validation message
        if (this.elements.domainValidation) {
            this.elements.domainValidation.textContent = '';
            this.elements.domainValidation.className = 'input-validation';
        }

        // Reset state
        this.currentDomain = null;
        this.isAnalyzing = false;

        // Focus on input
        if (this.elements.domainInput) {
            this.elements.domainInput.focus();
        }
    }

    /**
     * Debounced domain validation to prevent excessive validation calls
     * @param {string} domain - Domain to validate
     */
    debouncedValidation(domain) {
        // Clear existing timer
        if (this.debounceTimers.has('validation')) {
            clearTimeout(this.debounceTimers.get('validation'));
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.validateDomainInput(domain);
            this.debounceTimers.delete('validation');
        }, this.validationDelay);

        this.debounceTimers.set('validation', timer);
    }

    /**
     * Lazy loading for DNS record sections - loads content when section is expanded
     * @param {string} recordType - DNS record type
     * @param {Element} section - Section element
     * @param {Object} recordData - DNS record data
     */
    lazyLoadSection(recordType, section, recordData) {
        if (this.loadedSections.has(recordType)) {
            return;
        }

        const content = section.querySelector('.collapsible-body');
        if (!content) return;

        // Show loading state
        content.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>Loading ${recordType} records...</span>
            </div>
        `;

        // Simulate processing delay for better UX
        setTimeout(() => {
            this.renderRecordContent(recordType, recordData, content);
            this.loadedSections.add(recordType);
        }, 100);
    }

    /**
     * Renders content for a specific record type
     * @param {string} recordType - DNS record type
     * @param {Object} recordData - DNS record data
     * @param {Element} container - Container element
     */
    renderRecordContent(recordType, recordData, container) {
        const hasRecords = recordData.records && recordData.records.length > 0;
        const hasError = recordData.error;

        let content = '';

        if (hasError) {
            content = `
                <div class="error-message">
                    <div class="status-indicator status-error">❌ ERROR</div>
                    <strong>Failed to retrieve ${recordType} records</strong>
                    <p>${recordData.error}</p>
                    <div class="error-actions">
                        <button class="btn btn-secondary btn-small" onclick="window.uiController.retryRecordType('${recordType}')">
                            🔄 Retry ${recordType} Records
                        </button>
                    </div>
                </div>
            `;
        } else if (hasRecords) {
            content = `
                <div class="dns-record-list">
                    ${recordData.records.map(record => `
                        <div class="dns-record">
                            <div class="dns-record-name">${record.name}</div>
                            <div class="dns-record-value">${record.data}</div>
                            <div class="dns-record-ttl">TTL: ${record.ttl}s</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            content = this.getEmptyStateContent(recordType);
        }

        content += `
            <div class="entry-footer">
                <small>Source: ${recordData.source || 'N/A'} | Queried: ${new Date(recordData.timestamp).toLocaleString()}</small>
            </div>
        `;

        container.innerHTML = content;
    }

    /**
     * Gets cache statistics from DNS engine
     * @returns {Object} - Cache statistics
     */
    getCacheStats() {
        return this.dnsEngine ? this.dnsEngine.getCacheStats() : null;
    }

    /**
     * Clears DNS cache
     */
    clearCache() {
        if (this.dnsEngine) {
            this.dnsEngine.clearCache();
        }
    }

    /**
     * Checks if a domain is a subdomain (has more than 2 parts)
     * @param {string} domain - Domain to check
     * @returns {boolean} - True if it's a subdomain
     */
    isSubdomain(domain) {
        if (!domain) return false;
        
        // Remove trailing dot if present
        const cleanDomain = domain.replace(/\.$/, '');
        const parts = cleanDomain.split('.');
        
        // Consider it a subdomain if it has more than 2 parts
        // e.g., www.example.com (3 parts) or mail.google.com (3 parts)
        return parts.length > 2;
    }

    /**
     * Toggles DNS record section and lazy loads content if needed
     * @param {string} recordType - DNS record type
     * @param {Element} header - Header element that was clicked
     */
    toggleSection(recordType, header) {
        const section = header.closest('.dns-record-section');
        const content = section ? section.querySelector('.collapsible-content') : null;
        const toggle = header ? header.querySelector('.collapsible-toggle') : null;
        const body = content ? content.querySelector('.collapsible-body') : null;
        
        if (!section || !content || !toggle) {
            return;
        }
        
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            // Collapsing
            header.setAttribute('aria-expanded', 'false');
            content.style.display = 'none';
            content.classList.remove('expanded');
            toggle.textContent = '▶';
        } else {
            // Expanding - check if we need to lazy load
            if (body && body.querySelector('.lazy-placeholder')) {
                const recordData = this.getStoredRecordData(recordType);
                
                if (recordData) {
                    const generatedContent = this.generateRecordContent(recordType, recordData);
                    body.innerHTML = generatedContent;
                    this.loadedSections.add(recordType);
                } else {
                    body.innerHTML = '<div class="error-message">No data available for ' + recordType + ' records</div>';
                }
            }
            
            header.setAttribute('aria-expanded', 'true');
            content.style.display = 'block';
            content.classList.add('expanded');
            toggle.textContent = '▼';
        }
    }

    /**
     * Generates record content HTML
     * @param {string} recordType - DNS record type
     * @param {Object} recordData - DNS record data
     * @returns {string} - HTML content
     */
    generateRecordContent(recordType, recordData) {
        const hasRecords = recordData.records && recordData.records.length > 0;
        const hasError = recordData.error;

        let content = '';

        if (hasError) {
            content = `
                <div class="error-message">
                    <div class="status-indicator status-error">❌ ERROR</div>
                    <strong>Failed to retrieve ${recordType} records</strong>
                    <p>${recordData.error}</p>
                    <div class="error-actions">
                        <button class="btn btn-secondary btn-small" onclick="window.uiController.retryRecordType('${recordType}')">
                            🔄 Retry ${recordType} Records
                        </button>
                    </div>
                </div>
            `;
        } else if (hasRecords) {
            const listClass = recordType === 'TXT' ? 'dns-record-list txt-records' : 'dns-record-list';
            content = `
                <div class="${listClass}">
                    ${recordData.records.map(record => `
                        <div class="dns-record">
                            <div class="dns-record-name">${record.name}</div>
                            <div class="dns-record-value">${record.data}</div>
                            <div class="dns-record-ttl">TTL: ${record.ttl}s</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            content = this.getEmptyStateMessage(recordType);
        }

        content += `
            <div class="entry-footer">
                <small>Source: ${recordData.source || 'N/A'} | Queried: ${new Date(recordData.timestamp).toLocaleString()}</small>
            </div>
        `;

        return content;
    }

    /**
     * Gets stored record data for lazy loading
     * @param {string} recordType - DNS record type
     * @returns {Object|null} - Record data or null
     */
    getStoredRecordData(recordType) {
        if (recordType === 'DMARC') {
            return this.extractDMARCFromTXT(this.lastDNSData);
        }
        return this.lastDNSData ? this.lastDNSData[recordType] : null;
    }

    /**
     * Extracts DMARC records from TXT records
     * @param {Object} dnsData - DNS data
     * @returns {Object|null} - DMARC record data or null
     */
    extractDMARCFromTXT(dnsData) {
        if (!dnsData || !dnsData.TXT || !dnsData.TXT.records) {
            return {
                records: [],
                error: 'DMARC records are located at _dmarc.domain.com and not visible in main domain query',
                timestamp: new Date().toISOString(),
                source: 'extracted'
            };
        }

        const dmarcRecords = dnsData.TXT.records.filter(record => 
            record.data.toLowerCase().includes('v=dmarc1')
        );

        if (dmarcRecords.length === 0) {
            return {
                records: [],
                error: null,
                timestamp: new Date().toISOString(),
                source: 'extracted',
                note: 'DMARC records are typically located at _dmarc.domain.com'
            };
        }

        return {
            records: dmarcRecords,
            timestamp: new Date().toISOString(),
            source: 'extracted from TXT'
        };
    }

    /**
     * Loads a lazy section when clicked
     * @param {string} recordType - DNS record type
     * @param {Element} placeholder - Placeholder element that was clicked
     */
    loadLazySection(recordType, placeholder) {
        const section = placeholder.closest('.dns-record-section');
        const recordData = this.getStoredRecordData(recordType);
        
        if (recordData) {
            // Replace placeholder with actual content
            const body = placeholder.closest('.collapsible-body');
            const generatedContent = this.generateRecordContent(recordType, recordData);
            
            body.innerHTML = generatedContent;
            this.loadedSections.add(recordType);
            
            // Ensure the section is expanded
            const header = section.querySelector('.collapsible-header');
            const content = section.querySelector('.collapsible-content');
            const toggle = header.querySelector('.collapsible-toggle');
            
            header.setAttribute('aria-expanded', 'true');
            content.classList.add('expanded');
            content.style.display = 'block';
            toggle.textContent = '▼';
        } else {
            // Show error if no data available
            placeholder.innerHTML = 'No data available for ' + recordType + ' records';
            placeholder.style.color = '#dc2626';
        }
    }
}

/**
 * Global function to toggle DNS record sections
 * @param {string} recordType - Type of DNS record to toggle
 */
function toggleRecordSection(recordType) {
    const content = document.getElementById(`records-${recordType}`);
    const header = content?.previousElementSibling;
    const icon = header?.querySelector('.toggle-icon');
    
    if (content) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        
        if (icon) {
            icon.textContent = isVisible ? '▶' : '▼';
        }
    }
}

// Initialize UI Controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const uiController = new UIController();
    uiController.initializeInterface();
    
    // Make it globally available for debugging
    window.uiController = uiController;
});

// Export for use in other modules
window.UIController = UIController;