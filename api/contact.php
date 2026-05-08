<?php
/**
 * Contact Form Handler
 * Production-grade PHP backend for form submission
 * @version 2.0.0
 */

// ============================================
// CONFIGURATION
// ============================================

// Error reporting (disable in production)
error_reporting(0);
ini_set('display_errors', 0);

// Set JSON content type
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// CORS headers (adjust for your domain)
header('Access-Control-Allow-Origin: https://yourdomain.com');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

// Session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_secure', 1);
session_start();

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

define('MAIL_TO', 'info@luminousx.co.za');
define('MAIL_FROM', 'noreply@luminousx.co.za');
define('MAIL_FROM_NAME', 'Luminous X Contact Form');
define('COMPANY_NAME', 'Luminous X (Pty) Ltd');

// Rate limiting
define('RATE_LIMIT_WINDOW', 3600); // 1 hour
define('RATE_LIMIT_MAX', 5); // Max 5 submissions per hour

// Validation rules
define('MIN_NAME_LENGTH', 2);
define('MAX_NAME_LENGTH', 100);
define('MIN_SUBJECT_LENGTH', 3);
define('MAX_SUBJECT_LENGTH', 200);
define('MIN_MESSAGE_LENGTH', 10);
define('MAX_MESSAGE_LENGTH', 2000);

// Spam detection
define('MAX_URLS_IN_MESSAGE', 3);
define('BLOCKED_KEYWORDS', ['viagra', 'casino', 'porn', 'xxx']);

// Logging
define('LOG_DIR', __DIR__ . '/../logs/');
define('LOG_FILE', LOG_DIR . 'contact_errors.log');

// ============================================
// LOGGING FUNCTION
// ============================================

/**
 * Log error message
 * @param string $message Error message
 * @param array $context Additional context
 */
function logError($message, $context = []) {
    if (!is_dir(LOG_DIR)) {
        mkdir(LOG_DIR, 0755, true);
    }
    
    $logEntry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'message' => $message,
        'context' => $context,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    
    error_log(json_encode($logEntry) . PHP_EOL, 3, LOG_FILE);
}

// ============================================
// RESPONSE FUNCTIONS
// ============================================

/**
 * Send JSON response
 * @param bool $success Success status
 * @param string $message Response message
 * @param int $statusCode HTTP status code
 */
function sendResponse($success, $message, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'timestamp' => time()
    ]);
    exit;
}

/**
 * Send error response
 * @param string $message Error message
 * @param int $statusCode HTTP status code
 */
function sendError($message, $statusCode = 400) {
    sendResponse(false, $message, $statusCode);
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate email format
 * @param string $email Email to validate
 * @return bool
 */
function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Sanitize input
 * @param string $input Input to sanitize
 * @return string
 */
function sanitizeInput($input) {
    $input = trim($input);
    $input = strip_tags($input);
    $input = htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
    return $input;
}

/**
 * Check for spam content
 * @param string $content Content to check
 * @return bool True if spam detected
 */
function isSpam($content) {
    $content = strtolower($content);
    
    // Check for blocked keywords
    foreach (BLOCKED_KEYWORDS as $keyword) {
        if (strpos($content, $keyword) !== false) {
            return true;
        }
    }
    
    // Count URLs
    $urlCount = preg_match_all('/https?:\/\/[^\s]+/', $content);
    if ($urlCount > MAX_URLS_IN_MESSAGE) {
        return true;
    }
    
    // Check for excessive capital letters
    $upperCount = strlen(preg_replace('/[^A-Z]/', '', $content));
    $totalLength = strlen(preg_replace('/[^a-zA-Z]/', '', $content));
    if ($totalLength > 0 && ($upperCount / $totalLength) > 0.5) {
        return true;
    }
    
    return false;
}

/**
 * Check rate limit
 * @param string $ip IP address
 * @return bool True if allowed
 */
function checkRateLimit($ip) {
    $rateKey = 'rate_limit_' . md5($ip);
    $windowStart = time() - RATE_LIMIT_WINDOW;
    
    if (!isset($_SESSION[$rateKey])) {
        $_SESSION[$rateKey] = [];
    }
    
    // Clean old entries
    $_SESSION[$rateKey] = array_filter($_SESSION[$rateKey], function($timestamp) use ($windowStart) {
        return $timestamp > $windowStart;
    });
    
    // Check limit
    if (count($_SESSION[$rateKey]) >= RATE_LIMIT_MAX) {
        return false;
    }
    
    // Add current submission
    $_SESSION[$rateKey][] = time();
    return true;
}

// ============================================
// CSRF PROTECTION
// ============================================

/**
 * Validate CSRF token
 * @param string $token Token to validate
 * @return bool
 */
function validateCsrfToken($token) {
    if (!isset($_SESSION['csrf_token']) || !$token) {
        return false;
    }
    
    $storedToken = $_SESSION['csrf_token'];
    $tokenValid = hash_equals($storedToken, $token);
    
    // One-time use token
    unset($_SESSION['csrf_token']);
    
    return $tokenValid;
}

/**
 * Generate new CSRF token
 * @return string
 */
function generateCsrfToken() {
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token'] = $token;
    return $token;
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

/**
 * Send email
 * @param array $data Form data
 * @return bool
 */
function sendEmail($data) {
    $to = MAIL_TO;
    $subject = "Contact Form: " . $data['subject'];
    
    // Email body
    $body = "
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #06A3DA; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #333; }
            .value { margin-top: 5px; color: #666; }
            .footer { background: #091E3E; color: white; padding: 10px; text-align: center; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h2>New Contact Form Submission</h2>
            </div>
            <div class='content'>
                <div class='field'>
                    <div class='label'>Name:</div>
                    <div class='value'>" . htmlspecialchars($data['name']) . "</div>
                </div>
                <div class='field'>
                    <div class='label'>Email:</div>
                    <div class='value'>" . htmlspecialchars($data['email']) . "</div>
                </div>
                <div class='field'>
                    <div class='label'>Subject:</div>
                    <div class='value'>" . htmlspecialchars($data['subject']) . "</div>
                </div>
                <div class='field'>
                    <div class='label'>Message:</div>
                    <div class='value'>" . nl2br(htmlspecialchars($data['message'])) . "</div>
                </div>
                <div class='field'>
                    <div class='label'>Submitted From:</div>
                    <div class='value'>IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'Unknown') . "<br>
                    User Agent: " . htmlspecialchars($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown') . "</div>
                </div>
            </div>
            <div class='footer'>
                <p>This message was sent from the contact form on " . COMPANY_NAME . " website.</p>
            </div>
        </div>
    </body>
    </html>
    ";
    
    // Email headers
    $headers = [];
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Content-type: text/html; charset=UTF-8";
    $headers[] = "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">";
    $headers[] = "Reply-To: " . $data['email'];
    $headers[] = "X-Mailer: PHP/" . phpversion();
    $headers[] = "X-Priority: 3";
    $headers[] = "X-Auto-Response-Suppress: OOF, DR, RN, NRN";
    
    // Send email
    return mail($to, $subject, $body, implode("\r\n", $headers));
}

/**
 * Send auto-reply to user
 * @param array $data Form data
 * @return bool
 */
function sendAutoReply($data) {
    $to = $data['email'];
    $subject = "Thank you for contacting " . COMPANY_NAME;
    
    $body = "
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #06A3DA; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { background: #091E3E; color: white; padding: 10px; text-align: center; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h2>Thank You for Contacting Us!</h2>
            </div>
            <div class='content'>
                <p>Dear " . htmlspecialchars($data['name']) . ",</p>
                <p>Thank you for reaching out to " . COMPANY_NAME . ". We have received your message and one of our team members will get back to you within 24-48 hours.</p>
                <p>Here's a copy of your message for reference:</p>
                <div style='background: #fff; padding: 15px; border-left: 3px solid #06A3DA; margin: 15px 0;'>
                    <strong>Subject:</strong> " . htmlspecialchars($data['subject']) . "<br><br>
                    <strong>Message:</strong><br>" . nl2br(htmlspecialchars($data['message'])) . "
                </div>
                <p>In the meantime, feel free to:</p>
                <ul>
                    <li>Visit our website for more information about our services</li>
                    <li>Call us directly at 073 252 9507 for urgent inquiries</li>
                    <li>Follow us on social media for updates and tech insights</li>
                </ul>
                <p>Best regards,<br>
                <strong>" . COMPANY_NAME . " Team</strong></p>
            </div>
            <div class='footer'>
                <p>&copy; " . date('Y') . " " . COMPANY_NAME . ". All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    ";
    
    $headers = [];
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Content-type: text/html; charset=UTF-8";
    $headers[] = "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">";
    $headers[] = "X-Mailer: PHP/" . phpversion();
    
    return mail($to, $subject, $body, implode("\r\n", $headers));
}

// ============================================
// MAIN HANDLER
// ============================================

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

// Verify AJAX request
if (empty($_SERVER['HTTP_X_REQUESTED_WITH']) || 
    strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) !== 'xmlhttprequest') {
    sendError('Invalid request', 400);
}

// Get and validate input
$input = json_decode(file_get_contents('php://input'), true);
$isJsonRequest = ($input !== null);

if ($isJsonRequest) {
    $name = sanitizeInput($input['name'] ?? '');
    $email = sanitizeInput($input['email'] ?? '');
    $subject = sanitizeInput($input['subject'] ?? '');
    $message = sanitizeInput($input['message'] ?? '');
    $csrfToken = $input['csrf_token'] ?? '';
} else {
    $name = sanitizeInput($_POST['name'] ?? '');
    $email = sanitizeInput($_POST['email'] ?? '');
    $subject = sanitizeInput($_POST['subject'] ?? '');
    $message = sanitizeInput($_POST['message'] ?? '');
    $csrfToken = $_POST['csrf_token'] ?? '';
}

// Validate CSRF token
if (!validateCsrfToken($csrfToken)) {
    logError('CSRF validation failed', ['token' => substr($csrfToken, 0, 10)]);
    sendError('Security validation failed. Please refresh the page and try again.', 403);
}

// Validate required fields
if (empty($name) || empty($email) || empty($subject) || empty($message)) {
    sendError('All fields are required.');
}

// Validate name
if (strlen($name) < MIN_NAME_LENGTH || strlen($name) > MAX_NAME_LENGTH) {
    sendError('Name must be between ' . MIN_NAME_LENGTH . ' and ' . MAX_NAME_LENGTH . ' characters.');
}

// Validate email
if (!validateEmail($email)) {
    sendError('Please enter a valid email address.');
}

// Validate subject
if (strlen($subject) < MIN_SUBJECT_LENGTH || strlen($subject) > MAX_SUBJECT_LENGTH) {
    sendError('Subject must be between ' . MIN_SUBJECT_LENGTH . ' and ' . MAX_SUBJECT_LENGTH . ' characters.');
}

// Validate message length
if (strlen($message) < MIN_MESSAGE_LENGTH || strlen($message) > MAX_MESSAGE_LENGTH) {
    sendError('Message must be between ' . MIN_MESSAGE_LENGTH . ' and ' . MAX_MESSAGE_LENGTH . ' characters.');
}

// Check for spam
if (isSpam($message) || isSpam($subject) || isSpam($name)) {
    logError('Spam detected', ['name' => $name, 'email' => $email]);
    sendError('Your message has been flagged as potential spam. Please revise your message.', 400);
}

// Check rate limit
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
if (!checkRateLimit($clientIp)) {
    logError('Rate limit exceeded', ['ip' => $clientIp]);
    sendError('Too many messages. Please try again later.', 429);
}

// Prepare data for email
$emailData = [
    'name' => $name,
    'email' => $email,
    'subject' => $subject,
    'message' => $message
];

// Send emails
$adminEmailSent = sendEmail($emailData);
$autoReplySent = sendAutoReply($emailData);

// Log submission
$logData = [
    'name' => $name,
    'email' => $email,
    'subject' => $subject,
    'ip' => $clientIp
];

if ($adminEmailSent && $autoReplySent) {
    logError('Form submission successful', $logData);
    sendResponse(true, 'Thank you for your message! We\'ll get back to you within 24-48 hours.');
} elseif ($adminEmailSent) {
    logError('Auto-reply failed but admin email sent', $logData);
    sendResponse(true, 'Your message has been received. We\'ll contact you soon.');
} else {
    logError('Failed to send emails', $logData);
    sendError('Unable to send message. Please try again later or call us directly.', 500);
}
?>