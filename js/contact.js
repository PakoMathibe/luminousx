/**
 * Contact Form Handler
 * Production-grade form validation and submission
 * @version 2.0.0
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    
    const CONFIG = {
        FORM_ID: 'contactForm',
        SUBMIT_BTN_ID: 'submitBtn',
        BTN_TEXT_ID: 'btnText',
        BTN_SPINNER_ID: 'btnSpinner',
        ALERT_CONTAINER_ID: 'alertContainer',
        
        // Validation rules
        MAX_MESSAGE_LENGTH: 2000,
        MIN_MESSAGE_LENGTH: 10,
        RATE_LIMIT_DELAY: 30000, // 30 seconds between submissions
        DEBOUNCE_DELAY: 300,
        
        // API endpoint
        API_URL: 'api/contact.php',
        
        // CSRF refresh interval (30 minutes)
        CSRF_REFRESH_INTERVAL: 30 * 60 * 1000
    };

    // Form state
    let isSubmitting = false;
    let lastSubmissionTime = 0;
    let csrfToken = null;
    let csrfRefreshTimer = null;

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Generate CSRF token
     * @returns {string} CSRF token
     */
    function generateCsrfToken() {
        return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, function() {
            return (Math.random() * 16 | 0).toString(16);
        }) + '-' + Date.now();
    }

    /**
     * Set CSRF token in form and storage
     */
    function setCsrfToken() {
        const token = generateCsrfToken();
        const tokenInput = document.getElementById('csrf_token');
        if (tokenInput) {
            tokenInput.value = token;
        }
        sessionStorage.setItem('csrf_token', token);
        csrfToken = token;
        
        // Schedule token refresh
        if (csrfRefreshTimer) {
            clearTimeout(csrfRefreshTimer);
        }
        csrfRefreshTimer = setTimeout(() => {
            setCsrfToken();
        }, CONFIG.CSRF_REFRESH_INTERVAL);
    }

    /**
     * Validate CSRF token
     * @returns {boolean} True if valid
     */
    function validateCsrfToken() {
        const formToken = document.getElementById('csrf_token')?.value;
        const storedToken = sessionStorage.getItem('csrf_token');
        return formToken && storedToken && formToken === storedToken;
    }

    /**
     * Show alert message
     * @param {string} message - Alert message
     * @param {string} type - Alert type (success, danger, warning, info)
     * @param {number} duration - Auto-dismiss duration in ms
     */
    function showAlert(message, type = 'danger', duration = 5000) {
        const alertContainer = document.getElementById(CONFIG.ALERT_CONTAINER_ID);
        if (!alertContainer) return;

        const alertId = 'alert-' + Date.now();
        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show shadow-lg" role="alert">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
                <span>${escapeHtml(message)}</span>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        alertContainer.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto-dismiss after duration
        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                const bsAlert = new bootstrap.Alert(alertElement);
                bsAlert.close();
            }
        }, duration);

        // Scroll to alert
        alertContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
        return emailRegex.test(email);
    }

    /**
     * Validate form inputs
     * @returns {Object} Validation result
     */
    function validateForm() {
        const name = document.getElementById('name');
        const email = document.getElementById('email');
        const subject = document.getElementById('subject');
        const message = document.getElementById('message');
        
        let isValid = true;
        const errors = {};

        // Validate name
        if (!name.value.trim()) {
            errors.name = 'Please enter your name';
            isValid = false;
        } else if (name.value.trim().length < 2) {
            errors.name = 'Name must be at least 2 characters';
            isValid = false;
        } else if (name.value.trim().length > 100) {
            errors.name = 'Name must not exceed 100 characters';
            isValid = false;
        }

        // Validate email
        if (!email.value.trim()) {
            errors.email = 'Please enter your email address';
            isValid = false;
        } else if (!isValidEmail(email.value.trim())) {
            errors.email = 'Please enter a valid email address (e.g., name@example.com)';
            isValid = false;
        }

        // Validate subject
        if (!subject.value.trim()) {
            errors.subject = 'Please enter a subject';
            isValid = false;
        } else if (subject.value.trim().length < 3) {
            errors.subject = 'Subject must be at least 3 characters';
            isValid = false;
        } else if (subject.value.trim().length > 200) {
            errors.subject = 'Subject must not exceed 200 characters';
            isValid = false;
        }

        // Validate message
        if (!message.value.trim()) {
            errors.message = 'Please enter your message';
            isValid = false;
        } else if (message.value.trim().length < CONFIG.MIN_MESSAGE_LENGTH) {
            errors.message = `Message must be at least ${CONFIG.MIN_MESSAGE_LENGTH} characters`;
            isValid = false;
        } else if (message.value.trim().length > CONFIG.MAX_MESSAGE_LENGTH) {
            errors.message = `Message must not exceed ${CONFIG.MAX_MESSAGE_LENGTH} characters`;
            isValid = false;
        }

        // Display errors
        displayValidationErrors(errors);
        
        return { isValid, errors };
    }

    /**
     * Display validation errors
     * @param {Object} errors - Error messages
     */
    function displayValidationErrors(errors) {
        // Reset all validation states
        const fields = ['name', 'email', 'subject', 'message'];
        fields.forEach(field => {
            const input = document.getElementById(field);
            const errorDiv = document.getElementById(`${field}Error`);
            if (input && errorDiv) {
                input.classList.remove('is-invalid');
                errorDiv.textContent = '';
            }
        });

        // Display new errors
        Object.keys(errors).forEach(field => {
            const input = document.getElementById(field);
            const errorDiv = document.getElementById(`${field}Error`);
            if (input && errorDiv) {
                input.classList.add('is-invalid');
                errorDiv.textContent = errors[field];
            }
        });
    }

    /**
     * Clear form validation states
     */
    function clearValidation() {
        const fields = ['name', 'email', 'subject', 'message'];
        fields.forEach(field => {
            const input = document.getElementById(field);
            const errorDiv = document.getElementById(`${field}Error`);
            if (input && errorDiv) {
                input.classList.remove('is-invalid');
                errorDiv.textContent = '';
            }
        });
    }

    /**
     * Reset form to initial state
     */
    function resetForm() {
        const form = document.getElementById(CONFIG.FORM_ID);
        if (form) {
            form.reset();
            clearValidation();
            
            // Reset char counter
            const charCount = document.getElementById('charCount');
            if (charCount) {
                charCount.textContent = '0 / 2000 characters';
            }
        }
    }

    /**
     * Update character counter for message field
     */
    function updateCharCount() {
        const message = document.getElementById('message');
        const charCount = document.getElementById('charCount');
        if (message && charCount) {
            const length = message.value.length;
            const remaining = CONFIG.MAX_MESSAGE_LENGTH - length;
            charCount.textContent = `${length} / ${CONFIG.MAX_MESSAGE_LENGTH} characters`;
            
            if (remaining < 50) {
                charCount.classList.add('text-warning');
            } else {
                charCount.classList.remove('text-warning');
            }
            
            if (remaining < 0) {
                charCount.classList.add('text-danger');
                message.classList.add('is-invalid');
            } else {
                charCount.classList.remove('text-danger');
                if (!message.classList.contains('is-invalid')) {
                    message.classList.remove('is-invalid');
                }
            }
        }
    }

    /**
     * Set button loading state
     * @param {boolean} loading - Loading state
     */
    function setButtonLoading(loading) {
        const submitBtn = document.getElementById(CONFIG.SUBMIT_BTN_ID);
        const btnText = document.getElementById(CONFIG.BTN_TEXT_ID);
        const btnSpinner = document.getElementById(CONFIG.BTN_SPINNER_ID);
        
        if (submitBtn) {
            submitBtn.disabled = loading;
        }
        if (btnText) {
            btnText.textContent = loading ? 'Sending...' : 'Send Message';
        }
        if (btnSpinner) {
            if (loading) {
                btnSpinner.classList.remove('d-none');
            } else {
                btnSpinner.classList.add('d-none');
            }
        }
    }

    /**
     * Submit form via AJAX
     * @param {FormData} formData - Form data
     * @returns {Promise} Fetch promise
     */
    async function submitForm(formData) {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    /**
     * Check rate limiting
     * @returns {boolean} True if allowed
     */
    function checkRateLimit() {
        const now = Date.now();
        if (lastSubmissionTime && (now - lastSubmissionTime) < CONFIG.RATE_LIMIT_DELAY) {
            const waitSeconds = Math.ceil((CONFIG.RATE_LIMIT_DELAY - (now - lastSubmissionTime)) / 1000);
            showAlert(`Please wait ${waitSeconds} seconds before sending another message.`, 'warning');
            return false;
        }
        return true;
    }

    /**
     * Handle form submission
     * @param {Event} event - Submit event
     */
    async function handleSubmit(event) {
        event.preventDefault();
        
        // Check rate limit
        if (!checkRateLimit()) {
            return;
        }
        
        // Check if already submitting
        if (isSubmitting) {
            showAlert('Please wait, your message is being sent...', 'info');
            return;
        }
        
        // Validate form
        const { isValid, errors } = validateForm();
        if (!isValid) {
            showAlert('Please correct the errors in the form.', 'warning');
            return;
        }
        
        // Validate CSRF token
        if (!validateCsrfToken()) {
            showAlert('Security token expired. Please refresh the page and try again.', 'danger');
            setCsrfToken(); // Refresh token
            return;
        }
        
        // Prepare form data
        const form = event.target;
        const formData = new FormData(form);
        
        // Add additional data
        formData.append('timestamp', Date.now());
        formData.append('user_agent', navigator.userAgent);
        
        // Submit
        isSubmitting = true;
        setButtonLoading(true);
        
        try {
            const result = await submitForm(formData);
            
            if (result.success) {
                // Success!
                showAlert(result.message || 'Your message has been sent successfully! We\'ll get back to you soon.', 'success', 8000);
                resetForm();
                lastSubmissionTime = Date.now();
                
                // Refresh CSRF token
                setCsrfToken();
                
                // Optional: Track conversion (if using analytics)
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'form_submission', {
                        'event_category': 'contact',
                        'event_label': 'contact_form'
                    });
                }
            } else {
                throw new Error(result.message || 'Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            
            // Handle different error types
            if (error.message.includes('CSRF')) {
                showAlert('Security verification failed. Please refresh the page and try again.', 'danger');
                setCsrfToken();
            } else if (error.message.includes('rate limit')) {
                showAlert('Too many requests. Please wait a moment before trying again.', 'warning');
            } else if (error.message.includes('spam')) {
                showAlert('Your message appears to be spam. Please revise your message.', 'warning');
            } else {
                showAlert(error.message || 'An unexpected error occurred. Please try again later or call us directly.', 'danger');
            }
        } finally {
            isSubmitting = false;
            setButtonLoading(false);
        }
    }

    /**
     * Initialize real-time validation
     */
    function initRealtimeValidation() {
        const name = document.getElementById('name');
        const email = document.getElementById('email');
        const subject = document.getElementById('subject');
        const message = document.getElementById('message');
        
        const validateField = (field, validator) => {
            field.addEventListener('input', () => {
                if (field.value.trim()) {
                    const isValid = validator(field.value);
                    if (isValid) {
                        field.classList.remove('is-invalid');
                        const errorDiv = document.getElementById(`${field.id}Error`);
                        if (errorDiv) errorDiv.textContent = '';
                    }
                }
            });
            
            field.addEventListener('blur', () => {
                if (!field.value.trim()) {
                    field.classList.add('is-invalid');
                    const errorDiv = document.getElementById(`${field.id}Error`);
                    if (errorDiv) errorDiv.textContent = `Please enter your ${field.id}`;
                }
            });
        };
        
        if (name) validateField(name, (val) => val.length >= 2);
        if (email) validateField(email, isValidEmail);
        if (subject) validateField(subject, (val) => val.length >= 3);
        if (message) {
            message.addEventListener('input', () => {
                updateCharCount();
                if (message.value.length >= CONFIG.MIN_MESSAGE_LENGTH && 
                    message.value.length <= CONFIG.MAX_MESSAGE_LENGTH) {
                    message.classList.remove('is-invalid');
                }
            });
        }
    }

    /**
     * Initialize form
     */
    function init() {
        const form = document.getElementById(CONFIG.FORM_ID);
        if (!form) return;
        
        // Set CSRF token
        setCsrfToken();
        
        // Add submit handler
        form.addEventListener('submit', handleSubmit);
        
        // Initialize real-time validation
        initRealtimeValidation();
        
        // Initialize character counter
        const message = document.getElementById('message');
        if (message) {
            message.addEventListener('input', updateCharCount);
        }
        
        // Prevent double submission on enter key
        form.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (!isSubmitting) {
                    form.dispatchEvent(new Event('submit'));
                }
            }
        });
        
        console.log('Contact form initialized successfully');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();