/**
 * Main Application Module
 * Handles all interactive functionality for the website
 * @version 2.0.0
 * @requires jQuery, WOW.js, OwlCarousel, jQuery.counterUp
 */

(function($) {
    'use strict';

    // ============================================
    // CONFIGURATION & CONSTANTS
    // ============================================
    
    const CONFIG = {
        // Spinner configuration
        SPINNER_DELAY: 100, // Increased from 1ms for better UX
        SPINNER_SELECTOR: '#spinner',
        
        // Navbar configuration
        NAVBAR_SCROLL_THRESHOLD: 45,
        NAVBAR_SELECTOR: '.navbar',
        STICKY_CLASS: 'sticky-top shadow-sm',
        
        // Back to top button
        BACK_TO_TOP_THRESHOLD: 100,
        BACK_TO_TOP_SELECTOR: '.back-to-top',
        SCROLL_DURATION: 1500,
        SCROLL_EASING: 'easeInOutExpo',
        
        // Counter configuration
        COUNTER_DELAY: 10,
        COUNTER_DURATION: 2000,
        
        // Dropdown configuration
        DROPDOWN_BREAKPOINT: 992,
        
        // Performance
        DEBOUNCE_DELAY: 100,
        THROTTLE_DELAY: 16 // ~60fps
    };

    // Module state
    let isScrolling = false;
    let resizeTimeout = null;
    let scrollTimeout = null;

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Debounce function to limit rate of execution
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Throttle function to limit execution frequency
     * @param {Function} func - Function to throttle
     * @param {number} limit - Limit in milliseconds
     * @returns {Function} Throttled function
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Safe DOM element check
     * @param {string} selector - CSS selector
     * @returns {boolean} True if element exists
     */
    function elementExists(selector) {
        return $(selector).length > 0;
    }

    /**
     * Check if element is in viewport
     * @param {HTMLElement} element - DOM element
     * @returns {boolean} True if element is visible
     */
    function isInViewport(element) {
        if (!element || !element.getBoundingClientRect) return false;
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // ============================================
    // CORE FUNCTIONALITY MODULES
    // ============================================

    /**
     * Spinner Manager
     * Handles the loading spinner visibility
     */
    const SpinnerManager = {
        /**
         * Initialize spinner with proper error handling
         */
        init: function() {
            try {
                // Ensure spinner exists before trying to remove it
                if (!elementExists(CONFIG.SPINNER_SELECTOR)) {
                    console.warn('Spinner element not found');
                    return;
                }

                // Small delay to ensure spinner is visible before hiding
                setTimeout(() => {
                    $(CONFIG.SPINNER_SELECTOR).removeClass('show');
                }, CONFIG.SPINNER_DELAY);

                // Optional: Add fallback to hide spinner on window load
                $(window).on('load', () => {
                    setTimeout(() => {
                        $(CONFIG.SPINNER_SELECTOR).removeClass('show');
                    }, 100);
                });
            } catch (error) {
                console.error('Spinner initialization failed:', error);
                // Ensure spinner is hidden even if error occurs
                $(CONFIG.SPINNER_SELECTOR).removeClass('show');
            }
        }
    };

    /**
     * Navigation Manager
     * Handles sticky navbar and dropdown functionality
     */
    const NavigationManager = {
        /**
         * Initialize sticky navbar
         */
        initStickyNavbar: function() {
            if (!elementExists(CONFIG.NAVBAR_SELECTOR)) return;

            const $navbar = $(CONFIG.NAVBAR_SELECTOR);
            let lastScrollTop = 0;

            const handleScroll = throttle(() => {
                const scrollTop = $(window).scrollTop();
                
                // Prevent excessive updates
                if (isScrolling) return;
                isScrolling = true;

                if (scrollTop > CONFIG.NAVBAR_SCROLL_THRESHOLD) {
                    $navbar.addClass(CONFIG.STICKY_CLASS);
                    
                    // Optional: Add hide-on-scroll behavior for mobile
                    if (window.innerWidth < 768) {
                        if (scrollTop > lastScrollTop && scrollTop > 100) {
                            $navbar.addClass('navbar-hidden');
                        } else {
                            $navbar.removeClass('navbar-hidden');
                        }
                    }
                } else {
                    $navbar.removeClass(CONFIG.STICKY_CLASS);
                    $navbar.removeClass('navbar-hidden');
                }
                
                lastScrollTop = scrollTop;
                isScrolling = false;
            }, CONFIG.THROTTLE_DELAY);

            $(window).on('scroll', handleScroll);
        },

        /**
         * Initialize dropdown hover functionality
         * Gracefully degrades on touch devices
         */
        initDropdownHover: function() {
            const $dropdown = $('.dropdown');
            const $dropdownToggle = $('.dropdown-toggle');
            const $dropdownMenu = $('.dropdown-menu');
            const showClass = 'show';

            if ($dropdown.length === 0) return;

            const enableHoverDropdown = () => {
                $dropdown.off('mouseenter mouseleave');
                $dropdown.hover(
                    function() {
                        const $this = $(this);
                        $this.addClass(showClass);
                        $this.find($dropdownToggle).attr('aria-expanded', 'true');
                        $this.find($dropdownMenu).addClass(showClass);
                    },
                    function() {
                        const $this = $(this);
                        $this.removeClass(showClass);
                        $this.find($dropdownToggle).attr('aria-expanded', 'false');
                        $this.find($dropdownMenu).removeClass(showClass);
                    }
                );
            };

            const disableHoverDropdown = () => {
                $dropdown.off('mouseenter mouseleave');
                // Ensure no stuck dropdown states
                $dropdown.removeClass(showClass);
                $dropdown.find($dropdownMenu).removeClass(showClass);
            };

            const handleDropdownMode = () => {
                if (window.matchMedia(`(min-width: ${CONFIG.DROPDOWN_BREAKPOINT}px)`).matches) {
                    enableHoverDropdown();
                } else {
                    disableHoverDropdown();
                }
            };

            // Initialize
            handleDropdownMode();
            
            // Handle resize with debounce
            $(window).on('resize', debounce(handleDropdownMode, CONFIG.DEBOUNCE_DELAY));
        },

        /**
         * Initialize all navigation features
         */
        init: function() {
            this.initStickyNavbar();
            this.initDropdownHover();
        }
    };

    /**
     * Counter Manager
     * Handles number counter animations
     */
    const CounterManager = {
        /**
         * Initialize counters with lazy loading
         */
        init: function() {
            const $counters = $('[data-toggle="counter-up"]');
            
            if ($counters.length === 0) return;
            
            // Check if counterUp plugin is available
            if (typeof $.fn.counterUp === 'undefined') {
                console.error('counterUp plugin not loaded');
                return;
            }

            // Lazy initialize counters when they come into view
            const initCounters = () => {
                $counters.each(function() {
                    const $counter = $(this);
                    if (!isInViewport(this) || $counter.data('counter-initialized')) {
                        return;
                    }
                    
                    $counter.data('counter-initialized', true);
                    $counter.counterUp({
                        delay: CONFIG.COUNTER_DELAY,
                        time: CONFIG.COUNTER_DURATION,
                        begin: 0
                    });
                });
            };

            // Initialize visible counters
            initCounters();

            // Initialize counters on scroll with throttling
            $(window).on('scroll', throttle(initCounters, CONFIG.THROTTLE_DELAY));
        }
    };

    /**
     * Back to Top Button Manager
     * Handles scroll-to-top functionality
     */
    const BackToTopManager = {
        /**
         * Initialize back to top button
         */
        init: function() {
            const $backToTop = $(CONFIG.BACK_TO_TOP_SELECTOR);
            
            if ($backToTop.length === 0) return;

            // Show/hide button based on scroll position
            const toggleButton = throttle(() => {
                const scrollTop = $(window).scrollTop();
                
                if (scrollTop > CONFIG.BACK_TO_TOP_THRESHOLD) {
                    $backToTop.fadeIn(CONFIG.SCROLL_DURATION / 3);
                } else {
                    $backToTop.fadeOut(CONFIG.SCROLL_DURATION / 3);
                }
            }, CONFIG.THROTTLE_DELAY);

            // Smooth scroll to top
            const scrollToTop = (e) => {
                e.preventDefault();
                
                // Animate scroll with modern method
                try {
                    $('html, body').animate({
                        scrollTop: 0
                    }, CONFIG.SCROLL_DURATION, CONFIG.SCROLL_EASING);
                } catch (error) {
                    // Fallback for older browsers
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
            };

            $(window).on('scroll', toggleButton);
            $backToTop.on('click', scrollToTop);
            
            // Initial check
            toggleButton();
        }
    };

    /**
     * Carousel Manager
     * Handles all carousel initializations
     */
    const CarouselManager = {
        /**
         * Initialize testimonial carousel
         */
        initTestimonialCarousel: function() {
            const $testimonialCarousel = $('.testimonial-carousel');
            
            if ($testimonialCarousel.length === 0) return;
            
            if (typeof $.fn.owlCarousel === 'undefined') {
                console.error('OwlCarousel plugin not loaded');
                return;
            }

            $testimonialCarousel.owlCarousel({
                autoplay: true,
                autoplayTimeout: 5000,
                autoplayHoverPause: true,
                smartSpeed: 1500,
                dots: true,
                loop: true,
                center: true,
                nav: false,
                responsive: {
                    0: { items: 1 },
                    576: { items: 1 },
                    768: { items: 2 },
                    992: { items: 3 }
                },
                onInitialized: function(event) {
                    // Add accessibility attributes
                    $('.owl-dot').attr('role', 'button').attr('aria-label', 'Go to slide');
                }
            });
        },

        /**
         * Initialize vendor carousel
         */
        initVendorCarousel: function() {
            const $vendorCarousel = $('.vendor-carousel');
            
            if ($vendorCarousel.length === 0) return;
            
            if (typeof $.fn.owlCarousel === 'undefined') return;

            $vendorCarousel.owlCarousel({
                loop: true,
                margin: 45,
                dots: false,
                nav: false,
                autoplay: true,
                autoplayTimeout: 3000,
                autoplayHoverPause: true,
                smartSpeed: 1000,
                responsive: {
                    0: { items: 2 },
                    576: { items: 4 },
                    768: { items: 6 },
                    992: { items: 8 }
                }
            });
        },

        /**
         * Initialize all carousels
         */
        init: function() {
            this.initTestimonialCarousel();
            this.initVendorCarousel();
        }
    };

    /**
     * Animation Manager
     * Handles WOW.js animations
     */
    const AnimationManager = {
        /**
         * Initialize WOW.js with error handling
         */
        init: function() {
            try {
                if (typeof WOW === 'undefined') {
                    console.warn('WOW.js not loaded, animations disabled');
                    return;
                }

                // Check if user prefers reduced motion
                const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                
                if (prefersReducedMotion) {
                    // Disable animations for users who prefer reduced motion
                    return;
                }

                new WOW({
                    boxClass: 'wow',
                    animateClass: 'animated',
                    offset: 0,
                    mobile: true,
                    live: true,
                    scrollContainer: null,
                    resetAnimation: false
                }).init();
            } catch (error) {
                console.error('WOW.js initialization failed:', error);
            }
        }
    };

    /**
     * Resize Manager
     * Handles window resize events
     */
    const ResizeManager = {
        /**
         * Initialize resize handlers
         */
        init: function() {
            const handleResize = debounce(() => {
                // Recalculate any dynamic layouts here
                document.documentElement.style.setProperty('--vw', `${window.innerWidth / 100}px`);
                
                // Dispatch custom event for other modules
                window.dispatchEvent(new CustomEvent('resize-complete'));
            }, CONFIG.DEBOUNCE_DELAY);

            // Set initial viewport width variable
            document.documentElement.style.setProperty('--vw', `${window.innerWidth / 100}px`);
            
            $(window).on('resize', handleResize);
        }
    };

    /**
     * Performance Monitor
     * Optional: Monitor performance in development
     */
    const PerformanceMonitor = {
        /**
         * Initialize performance monitoring (development only)
         */
        init: function() {
            if (window.console && window.console.time) {
                window.addEventListener('load', () => {
                    console.timeEnd('Page Load Time');
                });
                console.time('Page Load Time');
            }
        }
    };

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Main initialization function
     * Ensures DOM is ready before initializing modules
     */
    function init() {
        // Mark initialization start for performance tracking
        if (window.performance && window.performance.mark) {
            performance.mark('init-start');
        }

        // Initialize all modules
        SpinnerManager.init();
        NavigationManager.init();
        CounterManager.init();
        BackToTopManager.init();
        CarouselManager.init();
        AnimationManager.init();
        ResizeManager.init();
        
        // Optional performance monitoring
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            PerformanceMonitor.init();
        }

        // Dispatch initialization complete event
        $(document).trigger('app:initialized');
        
        // Mark initialization end
        if (window.performance && window.performance.mark) {
            performance.mark('init-end');
            performance.measure('init-duration', 'init-start', 'init-end');
        }
    }

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        $(document).ready(init);
    } else {
        // DOM already loaded, initialize immediately
        init();
    }

    // Handle page unload for cleanup
    $(window).on('beforeunload', function() {
        // Clean up any pending timeouts or intervals
        if (resizeTimeout) clearTimeout(resizeTimeout);
        if (scrollTimeout) clearTimeout(scrollTimeout);
        
        // Remove event listeners
        $(window).off('scroll');
        $(window).off('resize');
    });

})(jQuery);

// ============================================
// EXPORTS (for module bundlers)
// ============================================

// For ES6 modules or CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG: CONFIG,
        init: init
    };
}

// For AMD modules
if (typeof define === 'function' && define.amd) {
    define(['jquery'], function($) {
        return {
            init: init
        };
    });
}