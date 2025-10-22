/**
 * DNS Error Detection and Analysis Engine
 * Analyzes DNS records to identify configuration issues and security concerns
 */

class DNSErrorDetector {
    constructor() {
        // Common DNS error types and their severity levels
        this.errorTypes = {
            MISSING_RECORD: 'missing_record',
            INVALID_TTL: 'invalid_ttl',
            CIRCULAR_CNAME: 'circular_cname',
            INVALID_MX: 'invalid_mx',
            MISSING_SECURITY: 'missing_security',
            PROPAGATION_ISSUE: 'propagation_issue',
            CONFIGURATION_ERROR: 'configuration_error'
        };

        this.severityLevels = {
            CRITICAL: 'critical',
            WARNING: 'warning',
            INFO: 'info'
        };

        // TTL validation thresholds (in seconds)
        this.ttlThresholds = {
            MIN_RECOMMENDED: 300,     // 5 minutes
            MAX_RECOMMENDED: 86400,   // 24 hours
            VERY_LOW: 60,            // 1 minute
            VERY_HIGH: 604800        // 7 days
        };

        // Common security record patterns
        this.securityRecordPatterns = {
            SPF: /^v=spf1\s/i,
            DMARC: /^v=dmarc1\s/i,
            DKIM: /^v=DKIM1\s/i
        };
    }

    /**
     * Detects missing critical DNS records
     * @param {Object} dnsRecords - DNS records organized by type
     * @param {string} domain - Domain being analyzed
     * @returns {Array} - Array of detected missing record errors
     */
    detectMissingRecords(dnsRecords, domain) {
        const errors = [];
        const warnings = [];

        // Check for missing A/AAAA records (critical for web presence)
        const hasA = dnsRecords.A && dnsRecords.A.records && dnsRecords.A.records.length > 0;
        const hasAAAA = dnsRecords.AAAA && dnsRecords.AAAA.records && dnsRecords.AAAA.records.length > 0;

        if (!hasA && !hasAAAA) {
            errors.push({
                type: this.errorTypes.MISSING_RECORD,
                severity: this.severityLevels.CRITICAL,
                message: 'No A or AAAA records found',
                description: 'Domain has no IP address records, making it unreachable via web browsers',
                recommendation: 'Add at least one A record (IPv4) or AAAA record (IPv6) pointing to your server',
                affectedRecords: ['A', 'AAAA']
            });
        } else if (!hasA) {
            warnings.push({
                type: this.errorTypes.MISSING_RECORD,
                severity: this.severityLevels.WARNING,
                message: 'No A records found',
                description: 'Domain lacks IPv4 connectivity, may not be accessible to all users',
                recommendation: 'Consider adding A records for broader compatibility',
                affectedRecords: ['A']
            });
        } else if (!hasAAAA) {
            warnings.push({
                type: this.errorTypes.MISSING_RECORD,
                severity: this.severityLevels.INFO,
                message: 'No AAAA records found',
                description: 'Domain lacks IPv6 connectivity',
                recommendation: 'Consider adding AAAA records for IPv6 support',
                affectedRecords: ['AAAA']
            });
        }

        // Check for missing MX records (important for email)
        const hasMX = dnsRecords.MX && dnsRecords.MX.records && dnsRecords.MX.records.length > 0;
        if (!hasMX) {
            warnings.push({
                type: this.errorTypes.MISSING_RECORD,
                severity: this.severityLevels.WARNING,
                message: 'No MX records found',
                description: 'Domain cannot receive email without MX records',
                recommendation: 'Add MX records if you want to receive email at this domain',
                affectedRecords: ['MX']
            });
        }

        // Check for missing NS records
        const hasNS = dnsRecords.NS && dnsRecords.NS.records && dnsRecords.NS.records.length > 0;
        if (!hasNS) {
            errors.push({
                type: this.errorTypes.MISSING_RECORD,
                severity: this.severityLevels.CRITICAL,
                message: 'No NS records found',
                description: 'Domain has no authoritative name servers defined',
                recommendation: 'Ensure NS records are properly configured at your domain registrar',
                affectedRecords: ['NS']
            });
        }

        return [...errors, ...warnings];
    }

    /**
     * Validates TTL values across all DNS records
     * @param {Object} dnsRecords - DNS records organized by type
     * @returns {Array} - Array of TTL-related warnings and errors
     */
    analyzeTTL(dnsRecords) {
        const issues = [];

        for (const [recordType, recordData] of Object.entries(dnsRecords)) {
            if (!recordData.records || recordData.records.length === 0) {
                continue;
            }

            for (const record of recordData.records) {
                const ttl = record.ttl;

                if (ttl < this.ttlThresholds.VERY_LOW) {
                    issues.push({
                        type: this.errorTypes.INVALID_TTL,
                        severity: this.severityLevels.WARNING,
                        message: `Very low TTL value (${ttl}s) for ${recordType} record`,
                        description: 'Extremely low TTL values can cause excessive DNS queries and poor performance',
                        recommendation: `Consider increasing TTL to at least ${this.ttlThresholds.MIN_RECOMMENDED}s`,
                        affectedRecords: [recordType],
                        recordName: record.name,
                        currentValue: ttl
                    });
                } else if (ttl < this.ttlThresholds.MIN_RECOMMENDED) {
                    issues.push({
                        type: this.errorTypes.INVALID_TTL,
                        severity: this.severityLevels.INFO,
                        message: `Low TTL value (${ttl}s) for ${recordType} record`,
                        description: 'Low TTL values increase DNS query frequency',
                        recommendation: `Consider using TTL of ${this.ttlThresholds.MIN_RECOMMENDED}s or higher for better performance`,
                        affectedRecords: [recordType],
                        recordName: record.name,
                        currentValue: ttl
                    });
                }

                if (ttl > this.ttlThresholds.VERY_HIGH) {
                    issues.push({
                        type: this.errorTypes.INVALID_TTL,
                        severity: this.severityLevels.INFO,
                        message: `Very high TTL value (${ttl}s) for ${recordType} record`,
                        description: 'Very high TTL values can delay DNS changes propagation',
                        recommendation: `Consider using TTL of ${this.ttlThresholds.MAX_RECOMMENDED}s or lower for faster updates`,
                        affectedRecords: [recordType],
                        recordName: record.name,
                        currentValue: ttl
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Detects circular CNAME references
     * @param {Object} dnsRecords - DNS records organized by type
     * @param {string} domain - Original domain being analyzed
     * @returns {Array} - Array of circular CNAME errors
     */
    detectCircularCNAME(dnsRecords, domain) {
        const errors = [];
        
        if (!dnsRecords.CNAME || !dnsRecords.CNAME.records || dnsRecords.CNAME.records.length === 0) {
            return errors;
        }

        const cnameChain = new Set();
        const visited = new Set();

        for (const cnameRecord of dnsRecords.CNAME.records) {
            const recordName = cnameRecord.name.toLowerCase();
            const targetName = cnameRecord.data.toLowerCase();

            // Reset for each CNAME record
            cnameChain.clear();
            visited.clear();

            // Check for immediate self-reference
            if (recordName === targetName) {
                errors.push({
                    type: this.errorTypes.CIRCULAR_CNAME,
                    severity: this.severityLevels.CRITICAL,
                    message: `CNAME record points to itself: ${recordName}`,
                    description: 'CNAME record creates an immediate circular reference',
                    recommendation: 'Update CNAME record to point to a different target',
                    affectedRecords: ['CNAME'],
                    recordName: recordName,
                    target: targetName
                });
                continue;
            }

            // Check for potential circular chains
            cnameChain.add(recordName);
            let currentTarget = targetName;

            // Follow CNAME chain up to 10 levels to detect cycles
            for (let depth = 0; depth < 10; depth++) {
                if (cnameChain.has(currentTarget)) {
                    errors.push({
                        type: this.errorTypes.CIRCULAR_CNAME,
                        severity: this.severityLevels.CRITICAL,
                        message: `Circular CNAME reference detected in chain starting from ${recordName}`,
                        description: `CNAME chain creates a loop: ${Array.from(cnameChain).join(' → ')} → ${currentTarget}`,
                        recommendation: 'Break the circular reference by updating one of the CNAME records',
                        affectedRecords: ['CNAME'],
                        recordName: recordName,
                        chainLength: depth + 1
                    });
                    break;
                }

                // Look for the next CNAME in the chain
                const nextCname = dnsRecords.CNAME.records.find(
                    record => record.name.toLowerCase() === currentTarget
                );

                if (!nextCname) {
                    // Chain ends here, no circular reference
                    break;
                }

                cnameChain.add(currentTarget);
                currentTarget = nextCname.data.toLowerCase();
            }
        }

        return errors;
    }

    /**
     * Validates MX record configurations
     * @param {Object} dnsRecords - DNS records organized by type
     * @returns {Array} - Array of MX record validation errors
     */
    validateMXRecords(dnsRecords) {
        const errors = [];

        if (!dnsRecords.MX || !dnsRecords.MX.records || dnsRecords.MX.records.length === 0) {
            return errors;
        }

        const mxRecords = dnsRecords.MX.records;
        const priorities = new Set();

        for (const mxRecord of mxRecords) {
            const mxData = mxRecord.data.split(' ');
            
            if (mxData.length < 2) {
                errors.push({
                    type: this.errorTypes.CONFIGURATION_ERROR,
                    severity: this.severityLevels.CRITICAL,
                    message: `Invalid MX record format: ${mxRecord.data}`,
                    description: 'MX record must contain priority and mail server hostname',
                    recommendation: 'Fix MX record format: "priority hostname"',
                    affectedRecords: ['MX'],
                    recordName: mxRecord.name
                });
                continue;
            }

            const priority = parseInt(mxData[0]);
            const mailServer = mxData[1];

            // Check for valid priority
            if (isNaN(priority) || priority < 0 || priority > 65535) {
                errors.push({
                    type: this.errorTypes.CONFIGURATION_ERROR,
                    severity: this.severityLevels.CRITICAL,
                    message: `Invalid MX priority: ${mxData[0]}`,
                    description: 'MX priority must be a number between 0 and 65535',
                    recommendation: 'Use a valid priority value (lower numbers have higher priority)',
                    affectedRecords: ['MX'],
                    recordName: mxRecord.name,
                    currentValue: mxData[0]
                });
            }

            // Check for duplicate priorities
            if (priorities.has(priority)) {
                errors.push({
                    type: this.errorTypes.CONFIGURATION_ERROR,
                    severity: this.severityLevels.WARNING,
                    message: `Duplicate MX priority: ${priority}`,
                    description: 'Multiple MX records with the same priority can cause unpredictable mail routing',
                    recommendation: 'Use unique priorities for each MX record',
                    affectedRecords: ['MX'],
                    recordName: mxRecord.name,
                    priority: priority
                });
            }
            priorities.add(priority);

            // Trailing dots on MX records are completely valid and normal - no check needed
        }

        return errors;
    }



    /**
     * Validates security-related DNS records (SPF, DKIM, DMARC)
     * @param {Object} dnsRecords - DNS records organized by type
     * @param {string} domain - Domain being analyzed
     * @returns {Array} - Array of security-related issues
     */
    validateSecurityRecords(dnsRecords, domain) {
        const issues = [];

        if (!dnsRecords.TXT || !dnsRecords.TXT.records || dnsRecords.TXT.records.length === 0) {
            issues.push({
                type: this.errorTypes.MISSING_SECURITY,
                severity: this.severityLevels.WARNING,
                message: 'No TXT records found',
                description: 'Domain has no TXT records, which are required for email security (SPF, DMARC)',
                recommendation: 'Add TXT records for SPF and DMARC to improve email security',
                affectedRecords: ['TXT']
            });
            return issues;
        }

        const txtRecords = dnsRecords.TXT.records;
        let hasSPF = false;
        let hasDMARC = false;
        let hasDKIM = false;

        // Check for SPF records - look for v=spf1 anywhere in the TXT record
        const spfRecords = txtRecords.filter(record => 
            record.data.toLowerCase().includes('v=spf1')
        );

        if (spfRecords.length === 0) {
            issues.push({
                type: this.errorTypes.MISSING_SECURITY,
                severity: this.severityLevels.WARNING,
                message: 'No SPF record found',
                description: 'SPF (Sender Policy Framework) records help prevent email spoofing',
                recommendation: 'Add an SPF record like "v=spf1 include:_spf.google.com ~all" or appropriate for your email provider',
                affectedRecords: ['TXT'],
                securityType: 'SPF'
            });
        } else {
            hasSPF = true;
            
            // Validate SPF record syntax
            for (const spfRecord of spfRecords) {
                const spfIssues = this.validateSPFRecord(spfRecord);
                issues.push(...spfIssues);
            }

            // Check for multiple SPF records (RFC violation)
            if (spfRecords.length > 1) {
                issues.push({
                    type: this.errorTypes.CONFIGURATION_ERROR,
                    severity: this.severityLevels.CRITICAL,
                    message: `Multiple SPF records found (${spfRecords.length})`,
                    description: 'Having multiple SPF records violates RFC 7208 and can cause email delivery issues',
                    recommendation: 'Combine all SPF mechanisms into a single TXT record',
                    affectedRecords: ['TXT'],
                    securityType: 'SPF',
                    recordCount: spfRecords.length
                });
            }
        }

        // Check for DMARC records - they should be at _dmarc.domain.com (not visible in main domain query)
        const dmarcRecords = txtRecords.filter(record => 
            /v=dmarc1/i.test(record.data)
        );

        if (dmarcRecords.length === 0) {
            // Don't report as missing since DMARC records are at _dmarc subdomain
            issues.push({
                type: this.errorTypes.MISSING_SECURITY,
                severity: this.severityLevels.INFO,
                message: 'DMARC record location note',
                description: `DMARC records are located at _dmarc.${domain} and won't appear in this main domain query`,
                recommendation: `DMARC records should be configured at _dmarc.${domain} with content like "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}". This tool cannot detect DMARC records as they exist on a subdomain.`,
                affectedRecords: ['TXT'],
                securityType: 'DMARC',
                expectedLocation: `_dmarc.${domain}`
            });
        } else {
            hasDMARC = true;
            
            // If we found DMARC records in the main domain (unusual but possible), validate them
            for (const dmarcRecord of dmarcRecords) {
                const dmarcIssues = this.validateDMARCRecord(dmarcRecord);
                issues.push(...dmarcIssues);
            }
        }

        // Check for DKIM records - only look for records that contain _domainkey in the name or v=DKIM1 in data
        const dkimRecords = txtRecords.filter(record => 
            record.name.toLowerCase().includes('_domainkey') || 
            record.data.toLowerCase().includes('v=dkim1')
        );

        if (dkimRecords.length > 0) {
            hasDKIM = true;
            
            // Validate DKIM record syntax
            for (const dkimRecord of dkimRecords) {
                const dkimIssues = this.validateDKIMRecord(dkimRecord);
                issues.push(...dkimIssues);
            }
        } else {
            // Only report missing DKIM if we don't see any _domainkey records
            const domainKeyRecords = txtRecords.filter(record => 
                record.name.toLowerCase().includes('_domainkey')
            );
            
            if (domainKeyRecords.length === 0) {
                issues.push({
                    type: this.errorTypes.MISSING_SECURITY,
                    severity: this.severityLevels.INFO,
                    message: 'No DKIM records found in current query',
                    description: 'DKIM records are typically found at selector._domainkey.domain.com and may not appear in the main domain query. This is normal if DKIM is configured at subdomains.',
                    recommendation: 'DKIM records are usually at selector._domainkey.domain.com (e.g., default._domainkey.domain.com). Check with your email provider for the correct selector. This may already be configured but not visible in this query.',
                    affectedRecords: ['TXT'],
                    securityType: 'DKIM'
                });
            }
        }

        // Overall email security assessment
        if (hasSPF && hasDMARC && hasDKIM) {
            issues.push({
                type: this.errorTypes.MISSING_SECURITY,
                severity: this.severityLevels.INFO,
                message: 'Complete email security configuration detected',
                description: 'Domain has SPF, DMARC, and DKIM records configured',
                recommendation: 'Regularly monitor DMARC reports to ensure proper email authentication',
                affectedRecords: ['TXT'],
                securityType: 'COMPLETE'
            });
        }

        return issues;
    }

    /**
     * Validates SPF record syntax and configuration
     * @param {Object} spfRecord - SPF TXT record
     * @returns {Array} - Array of SPF-specific issues
     */
    validateSPFRecord(spfRecord) {
        const issues = [];
        const spfData = spfRecord.data;

        // Check for common SPF syntax issues - be more lenient, just check if v=spf1 exists anywhere
        const normalizedSPF = spfData.toLowerCase().trim();
        if (!normalizedSPF.includes('v=spf1')) {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.CRITICAL,
                message: 'Invalid SPF record format',
                description: 'SPF record must contain "v=spf1"',
                recommendation: 'Ensure SPF record contains "v=spf1" followed by mechanisms',
                affectedRecords: ['TXT'],
                recordName: spfRecord.name,
                currentValue: spfData
            });
        }

        // Check for proper termination (all, ~all, -all, ?all)
        const terminators = ['all', '~all', '-all', '?all'];
        const hasTerminator = terminators.some(term => spfData.includes(term));
        
        if (!hasTerminator) {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.WARNING,
                message: 'SPF record lacks proper termination',
                description: 'SPF record should end with an "all" mechanism',
                recommendation: 'Add "~all" (soft fail) or "-all" (hard fail) at the end of your SPF record',
                affectedRecords: ['TXT'],
                recordName: spfRecord.name
            });
        }

        // Check for too many DNS lookups (SPF has a 10 lookup limit)
        const lookupMechanisms = (spfData.match(/\b(include:|a:|mx:|exists:|redirect=)/g) || []).length;
        if (lookupMechanisms > 10) {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.CRITICAL,
                message: `SPF record exceeds DNS lookup limit (${lookupMechanisms}/10)`,
                description: 'SPF records are limited to 10 DNS lookups to prevent abuse',
                recommendation: 'Reduce the number of include:, a:, mx:, exists:, and redirect= mechanisms',
                affectedRecords: ['TXT'],
                recordName: spfRecord.name,
                lookupCount: lookupMechanisms
            });
        }

        return issues;
    }

    /**
     * Validates DMARC record syntax and configuration
     * @param {Object} dmarcRecord - DMARC TXT record
     * @returns {Array} - Array of DMARC-specific issues
     */
    validateDMARCRecord(dmarcRecord) {
        const issues = [];
        const dmarcData = dmarcRecord.data;

        // Parse DMARC record into key-value pairs
        const dmarcPairs = {};
        const pairs = dmarcData.split(';').map(pair => pair.trim());
        
        for (const pair of pairs) {
            const [key, value] = pair.split('=').map(s => s.trim());
            if (key && value) {
                dmarcPairs[key] = value;
            }
        }

        // Check required version tag - be case insensitive
        if (!dmarcPairs.v || dmarcPairs.v.toLowerCase() !== 'dmarc1') {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.CRITICAL,
                message: 'Invalid DMARC version',
                description: 'DMARC record must start with "v=DMARC1"',
                recommendation: 'Ensure DMARC record begins with "v=DMARC1;"',
                affectedRecords: ['TXT'],
                recordName: dmarcRecord.name
            });
        }

        // Check policy tag
        const validPolicies = ['none', 'quarantine', 'reject'];
        if (!dmarcPairs.p || !validPolicies.includes(dmarcPairs.p)) {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.CRITICAL,
                message: 'Invalid or missing DMARC policy',
                description: 'DMARC record must have a valid policy (p=none, p=quarantine, or p=reject)',
                recommendation: 'Add a policy tag like "p=quarantine" to your DMARC record',
                affectedRecords: ['TXT'],
                recordName: dmarcRecord.name,
                currentPolicy: dmarcPairs.p
            });
        }

        // Recommend stronger policy if using 'none'
        if (dmarcPairs.p === 'none') {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.INFO,
                message: 'DMARC policy set to "none"',
                description: 'Policy "none" provides monitoring but no protection against email spoofing',
                recommendation: 'Consider upgrading to "p=quarantine" or "p=reject" for better protection',
                affectedRecords: ['TXT'],
                recordName: dmarcRecord.name
            });
        }

        // Check for reporting addresses
        if (!dmarcPairs.rua && !dmarcPairs.ruf) {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.WARNING,
                message: 'No DMARC reporting addresses configured',
                description: 'DMARC reports help monitor email authentication',
                recommendation: 'Add "rua=mailto:dmarc@yourdomain.com" for aggregate reports',
                affectedRecords: ['TXT'],
                recordName: dmarcRecord.name
            });
        }

        return issues;
    }

    /**
     * Validates DKIM record syntax and configuration
     * @param {Object} dkimRecord - DKIM TXT record
     * @returns {Array} - Array of DKIM-specific issues
     */
    validateDKIMRecord(dkimRecord) {
        const issues = [];
        const dkimData = dkimRecord.data;

        // Parse DKIM record into key-value pairs
        const dkimPairs = {};
        const pairs = dkimData.split(';').map(pair => pair.trim());
        
        for (const pair of pairs) {
            const [key, value] = pair.split('=').map(s => s.trim());
            if (key && value) {
                dkimPairs[key] = value;
            }
        }

        // Check required version tag - be case insensitive
        if (!dkimPairs.v || dkimPairs.v.toLowerCase() !== 'dkim1') {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.CRITICAL,
                message: 'Invalid DKIM version',
                description: 'DKIM record must start with "v=DKIM1"',
                recommendation: 'Ensure DKIM record begins with "v=DKIM1;"',
                affectedRecords: ['TXT'],
                recordName: dkimRecord.name
            });
        }

        // Check for public key
        if (!dkimPairs.p) {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.CRITICAL,
                message: 'Missing DKIM public key',
                description: 'DKIM record must contain a public key (p= tag)',
                recommendation: 'Add the public key provided by your email service provider',
                affectedRecords: ['TXT'],
                recordName: dkimRecord.name
            });
        } else if (dkimPairs.p.length < 100) {
            issues.push({
                type: this.errorTypes.CONFIGURATION_ERROR,
                severity: this.severityLevels.WARNING,
                message: 'DKIM public key appears too short',
                description: 'DKIM public keys are typically much longer',
                recommendation: 'Verify the public key is complete and correctly copied',
                affectedRecords: ['TXT'],
                recordName: dkimRecord.name,
                keyLength: dkimPairs.p.length
            });
        }

        return issues;
    }

    /**
     * Checks DNS propagation consistency across multiple servers
     * @param {string} domain - Domain to check
     * @param {Array} recordTypes - Record types to check for consistency
     * @returns {Promise<Array>} - Array of propagation issues
     */
    async checkPropagationConsistency(domain, recordTypes = ['A', 'AAAA', 'MX', 'NS']) {
        const issues = [];
        
        // This would require querying multiple DNS servers
        // For now, we'll create a placeholder that could be implemented with multiple DoH providers
        
        issues.push({
            type: this.errorTypes.PROPAGATION_ISSUE,
            severity: this.severityLevels.INFO,
            message: 'DNS propagation check not implemented',
            description: 'Propagation consistency checking requires querying multiple DNS servers',
            recommendation: 'Use external tools like whatsmydns.net to check DNS propagation',
            affectedRecords: recordTypes
        });

        return issues;
    }

    /**
     * Performs comprehensive DNS configuration error detection
     * @param {Object} dnsRecords - DNS records organized by type
     * @param {string} domain - Domain being analyzed
     * @returns {Object} - Complete error analysis report
     */
    analyzeConfiguration(dnsRecords, domain) {
        const analysis = {
            domain: domain,
            timestamp: new Date().toISOString(),
            errors: [],
            warnings: [],
            info: [],
            summary: {
                totalIssues: 0,
                criticalErrors: 0,
                warnings: 0,
                infoItems: 0
            }
        };

        // Collect all error detection results
        const allIssues = [
            ...this.detectMissingRecords(dnsRecords, domain),
            ...this.analyzeTTL(dnsRecords),
            ...this.detectCircularCNAME(dnsRecords, domain),
            ...this.validateMXRecords(dnsRecords),
            ...this.validateSecurityRecords(dnsRecords, domain)
        ];

        // Categorize issues by severity
        for (const issue of allIssues) {
            switch (issue.severity) {
                case this.severityLevels.CRITICAL:
                    analysis.errors.push(issue);
                    analysis.summary.criticalErrors++;
                    break;
                case this.severityLevels.WARNING:
                    analysis.warnings.push(issue);
                    analysis.summary.warnings++;
                    break;
                case this.severityLevels.INFO:
                    analysis.info.push(issue);
                    analysis.summary.infoItems++;
                    break;
            }
        }

        analysis.summary.totalIssues = allIssues.length;

        return analysis;
    }

    /**
     * Performs comprehensive security analysis of DNS records
     * @param {Object} dnsRecords - DNS records organized by type
     * @param {string} domain - Domain being analyzed
     * @returns {Object} - Security analysis report
     */
    analyzeSecurityConfiguration(dnsRecords, domain) {
        const securityAnalysis = {
            domain: domain,
            timestamp: new Date().toISOString(),
            emailSecurity: {
                spf: { configured: false, issues: [] },
                dmarc: { configured: false, issues: [] },
                dkim: { configured: false, issues: [] }
            },
            recommendations: [],
            overallScore: 0,
            maxScore: 100
        };

        const securityIssues = this.validateSecurityRecords(dnsRecords, domain);
        
        // Analyze security issues and populate the report
        for (const issue of securityIssues) {
            if (issue.securityType) {
                switch (issue.securityType) {
                    case 'SPF':
                        if (issue.type !== this.errorTypes.MISSING_SECURITY) {
                            securityAnalysis.emailSecurity.spf.configured = true;
                        }
                        securityAnalysis.emailSecurity.spf.issues.push(issue);
                        break;
                    case 'DMARC':
                        if (issue.type !== this.errorTypes.MISSING_SECURITY) {
                            securityAnalysis.emailSecurity.dmarc.configured = true;
                        }
                        securityAnalysis.emailSecurity.dmarc.issues.push(issue);
                        break;
                    case 'DKIM':
                        if (issue.type !== this.errorTypes.MISSING_SECURITY) {
                            securityAnalysis.emailSecurity.dkim.configured = true;
                        }
                        securityAnalysis.emailSecurity.dkim.issues.push(issue);
                        break;
                }
            }
        }

        // Calculate security score
        let score = 0;
        if (securityAnalysis.emailSecurity.spf.configured) score += 40;
        if (securityAnalysis.emailSecurity.dmarc.configured) score += 40;
        if (securityAnalysis.emailSecurity.dkim.configured) score += 20;

        securityAnalysis.overallScore = score;

        // Generate recommendations
        if (!securityAnalysis.emailSecurity.spf.configured) {
            securityAnalysis.recommendations.push({
                priority: 'high',
                category: 'email_security',
                title: 'Configure SPF Record',
                description: 'Add an SPF record to prevent email spoofing and improve deliverability',
                implementation: `Add TXT record: "v=spf1 include:_spf.youremailprovider.com ~all"`
            });
        }

        if (!securityAnalysis.emailSecurity.dmarc.configured) {
            securityAnalysis.recommendations.push({
                priority: 'high',
                category: 'email_security',
                title: 'Configure DMARC Record',
                description: 'Add a DMARC record to enable email authentication reporting',
                implementation: `Add TXT record at _dmarc.${domain}: "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}"`
            });
        }

        if (!securityAnalysis.emailSecurity.dkim.configured) {
            securityAnalysis.recommendations.push({
                priority: 'medium',
                category: 'email_security',
                title: 'Configure DKIM Record',
                description: 'Set up DKIM signing with your email provider for cryptographic authentication',
                implementation: 'Contact your email provider for DKIM setup instructions and public key'
            });
        }

        return securityAnalysis;
    }

    /**
     * Gets a summary of all detected issues organized by category
     * @param {Object} analysisResult - Result from analyzeConfiguration()
     * @returns {Object} - Categorized issue summary
     */
    getIssueSummary(analysisResult) {
        const summary = {
            critical: {
                count: analysisResult.summary.criticalErrors,
                categories: {}
            },
            warnings: {
                count: analysisResult.summary.warnings,
                categories: {}
            },
            info: {
                count: analysisResult.summary.infoItems,
                categories: {}
            }
        };

        // Categorize issues
        const allIssues = [...analysisResult.errors, ...analysisResult.warnings, ...analysisResult.info];
        
        for (const issue of allIssues) {
            const category = issue.type;
            const severity = issue.severity;
            
            if (!summary[severity].categories[category]) {
                summary[severity].categories[category] = [];
            }
            summary[severity].categories[category].push(issue);
        }

        return summary;
    }

    /**
     * Generates actionable recommendations based on detected issues
     * @param {Object} analysisResult - Result from analyzeConfiguration()
     * @returns {Array} - Array of prioritized recommendations
     */
    generateRecommendations(analysisResult) {
        const recommendations = [];
        const allIssues = [...analysisResult.errors, ...analysisResult.warnings, ...analysisResult.info];

        // Group issues by type for better recommendations
        const issuesByType = {};
        for (const issue of allIssues) {
            if (!issuesByType[issue.type]) {
                issuesByType[issue.type] = [];
            }
            issuesByType[issue.type].push(issue);
        }

        // Generate recommendations based on issue types
        for (const [issueType, issues] of Object.entries(issuesByType)) {
            const firstIssue = issues[0];
            let priority = 'medium';
            
            if (firstIssue.severity === this.severityLevels.CRITICAL) {
                priority = 'high';
            } else if (firstIssue.severity === this.severityLevels.INFO) {
                priority = 'low';
            }

            recommendations.push({
                priority: priority,
                category: issueType,
                title: this.getRecommendationTitle(issueType),
                description: this.getRecommendationDescription(issueType, issues),
                affectedCount: issues.length,
                issues: issues.map(issue => ({
                    message: issue.message,
                    recommendation: issue.recommendation
                }))
            });
        }

        // Sort by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

        return recommendations;
    }

    /**
     * Gets a user-friendly title for recommendation categories
     * @param {string} issueType - Type of issue
     * @returns {string} - Human-readable title
     */
    getRecommendationTitle(issueType) {
        const titles = {
            [this.errorTypes.MISSING_RECORD]: 'Add Missing DNS Records',
            [this.errorTypes.INVALID_TTL]: 'Optimize TTL Values',
            [this.errorTypes.CIRCULAR_CNAME]: 'Fix CNAME Configuration',
            [this.errorTypes.INVALID_MX]: 'Fix Mail Exchange Records',
            [this.errorTypes.MISSING_SECURITY]: 'Improve Email Security',
            [this.errorTypes.PROPAGATION_ISSUE]: 'Check DNS Propagation',
            [this.errorTypes.CONFIGURATION_ERROR]: 'Fix Configuration Errors'
        };
        
        return titles[issueType] || 'Address DNS Issues';
    }

    /**
     * Gets a detailed description for recommendation categories
     * @param {string} issueType - Type of issue
     * @param {Array} issues - Array of issues of this type
     * @returns {string} - Detailed description
     */
    getRecommendationDescription(issueType, issues) {
        const descriptions = {
            [this.errorTypes.MISSING_RECORD]: `${issues.length} critical DNS record(s) are missing, which may affect domain functionality`,
            [this.errorTypes.INVALID_TTL]: `${issues.length} DNS record(s) have suboptimal TTL values that may impact performance`,
            [this.errorTypes.CIRCULAR_CNAME]: `${issues.length} CNAME record(s) create circular references that prevent resolution`,
            [this.errorTypes.INVALID_MX]: `${issues.length} mail exchange record(s) have configuration issues`,
            [this.errorTypes.MISSING_SECURITY]: `${issues.length} email security feature(s) are not configured, leaving the domain vulnerable`,
            [this.errorTypes.PROPAGATION_ISSUE]: `${issues.length} DNS propagation issue(s) detected across different servers`,
            [this.errorTypes.CONFIGURATION_ERROR]: `${issues.length} DNS configuration error(s) need to be corrected`
        };
        
        return descriptions[issueType] || `${issues.length} DNS issue(s) require attention`;
    }
}

// Export for use in other modules
window.DNSErrorDetector = DNSErrorDetector;