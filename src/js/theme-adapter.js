/**
 * Theme Adapter - Ensures visual consistency with Hugo theme
 * Handles theme-specific styling and responsive design patterns
 */

class ThemeAdapter {
    constructor() {
        this.themeConfig = {
            breakpoints: {
                mobile: '768px',
                tablet: '1024px',
                desktop: '1200px'
            },
            animations: {
                duration: '0.3s',
                easing: 'ease-in-out'
            }
        };
    }

    /**
     * Initializes theme-specific adaptations
     */
    initialize() {
        this.applyResponsiveDesign();
        this.setupThemeClasses();
        this.initializeAnimations();
    }

    /**
     * Applies responsive design patterns matching Hugo theme
     */
    applyResponsiveDesign() {
        // Add responsive classes based on viewport
        const updateResponsiveClasses = () => {
            const width = window.innerWidth;
            const body = document.body;
            
            // Remove existing responsive classes
            body.classList.remove('mobile', 'tablet', 'desktop');
            
            // Add appropriate class
            if (width < 768) {
                body.classList.add('mobile');
            } else if (width < 1024) {
                body.classList.add('tablet');
            } else {
                body.classList.add('desktop');
            }
        };

        // Initial application
        updateResponsiveClasses();
        
        // Update on resize
        window.addEventListener('resize', updateResponsiveClasses);
    }

    /**
     * Sets up Hugo theme-specific CSS classes
     */
    setupThemeClasses() {
        // Ensure container classes are applied
        const containers = document.querySelectorAll('.container');
        containers.forEach(container => {
            if (!container.classList.contains('hugo-container')) {
                container.classList.add('hugo-container');
            }
        });

        // Apply theme-specific button classes
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            if (!button.classList.contains('hugo-btn')) {
                button.classList.add('hugo-btn');
            }
        });

        // Apply form styling
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (!form.classList.contains('hugo-form')) {
                form.classList.add('hugo-form');
            }
        });
    }

    /**
     * Initializes theme-consistent animations
     */
    initializeAnimations() {
        // Add smooth transitions to interactive elements
        const interactiveElements = document.querySelectorAll('button, input, .record-header');
        interactiveElements.forEach(element => {
            element.style.transition = `all ${this.themeConfig.animations.duration} ${this.themeConfig.animations.easing}`;
        });

        // Setup collapsible sections animation
        this.setupCollapsibleAnimations();
    }

    /**
     * Sets up animations for collapsible DNS record sections
     */
    setupCollapsibleAnimations() {
        // This will be called after DNS results are rendered
        // The actual collapsible functionality is handled in ui-controller.js
        // This method ensures proper theme-consistent animations
    }
    
    /**
     * Initializes collapsible sections with Hugo theme styling
     */
    initializeCollapsibleSections() {
        const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
        
        collapsibleHeaders.forEach(header => {
            const content = header.nextElementSibling;
            const toggle = header.querySelector('.collapsible-toggle');
            
            if (content && toggle) {
                header.addEventListener('click', () => {
                    const isExpanded = content.classList.contains('expanded');
                    
                    if (isExpanded) {
                        content.classList.remove('expanded');
                        toggle.style.transform = 'rotate(0deg)';
                        header.setAttribute('aria-expanded', 'false');
                    } else {
                        content.classList.add('expanded');
                        toggle.style.transform = 'rotate(180deg)';
                        header.setAttribute('aria-expanded', 'true');
                    }
                });
                
                // Set initial ARIA attributes
                header.setAttribute('role', 'button');
                header.setAttribute('aria-expanded', 'true');
                header.setAttribute('tabindex', '0');
                
                // Keyboard support
                header.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        header.click();
                    }
                });
            }
        });
    }

    /**
     * Applies Hugo PaperMod theme color scheme and dark mode support
     */
    applyColorScheme() {
        // Check for saved theme preference or system preference
        const savedTheme = localStorage.getItem('pref-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.body.classList.add('dark');
        }
        
        // Add theme toggle functionality
        this.setupThemeToggle();
    }
    
    /**
     * Sets up theme toggle functionality matching Hugo PaperMod
     */
    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                if (document.body.classList.contains('dark')) {
                    document.body.classList.remove('dark');
                    localStorage.setItem('pref-theme', 'light');
                } else {
                    document.body.classList.add('dark');
                    localStorage.setItem('pref-theme', 'dark');
                }
            });
        }
    }

    /**
     * Ensures proper typography matching Hugo PaperMod theme
     */
    applyTypography() {
        // Hugo PaperMod font stack is already applied via CSS
        // Just ensure proper text sizing and spacing
        
        // Apply consistent spacing for content
        const content = document.querySelector('.main-content');
        if (content) {
            content.style.marginTop = 'var(--content-gap)';
            content.style.marginBottom = 'var(--content-gap)';
        }
    }

    /**
     * Handles theme-specific form styling
     */
    styleFormElements() {
        // Style input fields
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
        inputs.forEach(input => {
            input.classList.add('hugo-input');
        });

        // Style buttons
        const buttons = document.querySelectorAll('button, .btn');
        buttons.forEach(button => {
            button.classList.add('hugo-button');
        });

        // Add focus styles
        const focusableElements = document.querySelectorAll('input, button, textarea, select');
        focusableElements.forEach(element => {
            element.addEventListener('focus', () => {
                element.classList.add('hugo-focus');
            });
            
            element.addEventListener('blur', () => {
                element.classList.remove('hugo-focus');
            });
        });
    }

    /**
     * Adds loading animations consistent with Hugo theme
     */
    addLoadingAnimations() {
        // Create CSS for loading spinner
        const style = document.createElement('style');
        style.textContent = `
            .loading-spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid var(--color-primary, #007acc);
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .fade-in {
                animation: fadeIn 0.5s ease-in;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .slide-down {
                animation: slideDown 0.3s ease-out;
            }
            
            @keyframes slideDown {
                from { max-height: 0; opacity: 0; }
                to { max-height: 500px; opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Handles dark mode support matching Hugo PaperMod theme
     */
    setupDarkModeSupport() {
        // Listen for system color scheme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const savedTheme = localStorage.getItem('pref-theme');
            if (!savedTheme) {
                if (e.matches) {
                    document.body.classList.add('dark');
                } else {
                    document.body.classList.remove('dark');
                }
            }
        });
    }

    /**
     * Adds accessibility enhancements consistent with Hugo theme
     */
    enhanceAccessibility() {
        // Add ARIA labels to interactive elements
        const buttons = document.querySelectorAll('button:not([aria-label])');
        buttons.forEach(button => {
            const text = button.textContent.trim();
            if (text) {
                button.setAttribute('aria-label', text);
            }
        });

        // Add focus indicators
        const focusableElements = document.querySelectorAll('button, input, textarea, select, a');
        focusableElements.forEach(element => {
            element.addEventListener('focus', () => {
                element.style.outline = '2px solid var(--color-primary, #007acc)';
                element.style.outlineOffset = '2px';
            });
            
            element.addEventListener('blur', () => {
                element.style.outline = '';
                element.style.outlineOffset = '';
            });
        });

        // Add keyboard navigation for collapsible sections
        const recordHeaders = document.querySelectorAll('.record-header');
        recordHeaders.forEach(header => {
            header.setAttribute('tabindex', '0');
            header.setAttribute('role', 'button');
            
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    header.click();
                }
            });
        });
    }

    /**
     * Applies mobile-specific optimizations
     */
    optimizeForMobile() {
        // Add touch-friendly sizing
        const touchTargets = document.querySelectorAll('button, .record-header, input');
        touchTargets.forEach(target => {
            target.style.minHeight = '44px';
            target.style.minWidth = '44px';
        });

        // Optimize form inputs for mobile
        const inputs = document.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
            input.setAttribute('autocomplete', 'off');
            input.setAttribute('autocorrect', 'off');
            input.setAttribute('autocapitalize', 'off');
            input.setAttribute('spellcheck', 'false');
        });
    }

    /**
     * Initializes all theme adaptations
     */
    initializeAll() {
        this.initialize();
        this.applyColorScheme();
        this.applyTypography();
        this.styleFormElements();
        this.addLoadingAnimations();
        this.setupDarkModeSupport();
        this.enhanceAccessibility();
        this.optimizeForMobile();
    }
    
    /**
     * Re-initializes collapsible sections after DNS results are loaded
     */
    reinitializeAfterResults() {
        this.initializeCollapsibleSections();
        this.enhanceAccessibility();
    }
}

// Initialize theme adapter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const themeAdapter = new ThemeAdapter();
    themeAdapter.initializeAll();
    
    // Make it globally available
    window.themeAdapter = themeAdapter;
});

// Export for use in other modules
window.ThemeAdapter = ThemeAdapter;