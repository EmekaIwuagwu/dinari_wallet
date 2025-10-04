/**
 * Dinari Wallet - Utility Functions
 * Helper functions for formatting, validation, and UI operations
 */

const DinariUtils = (function() {
  'use strict';

  /**
   * Format number with commas (1234567.89 -> "1,234,567.89")
   * @param {number|string} num
   * @param {number} decimals - Decimal places to show (default: 2)
   * @returns {string}
   */
  function formatNumber(num, decimals = 2) {
    const number = Number(num);
    if (isNaN(number)) return '0.00';
    
    return number.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Format token amount with symbol (50.123456 -> "50.12 DNT")
   * @param {number|string} amount
   * @param {string} symbol - Token symbol ('DNT' or 'AFC')
   * @param {number} decimals - Decimal places (default: 2)
   * @returns {string}
   */
  function formatTokenAmount(amount, symbol, decimals = 2) {
    return `${formatNumber(amount, decimals)} ${symbol}`;
  }

  /**
   * Format large token amounts (1325.50 -> "1.33K", 1000000 -> "1.00M")
   * @param {number|string} amount
   * @param {number} decimals
   * @returns {string}
   */
  function formatLargeAmount(amount, decimals = 2) {
    const num = Number(amount);
    if (isNaN(num)) return '0';

    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(decimals) + 'B';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(decimals) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(decimals) + 'K';
    } else {
      return num.toFixed(decimals);
    }
  }

  /**
   * Copy text to clipboard
   * @param {string} text
   * @returns {Promise<boolean>} Success status
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (fallbackError) {
        console.error('Failed to copy:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Show toast notification
   * @param {string} message
   * @param {string} type - 'success', 'error', 'info'
   * @param {number} duration - Milliseconds (default: 3000)
   */
  function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add styles
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 24px',
      borderRadius: 'var(--radius-md)',
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '10000',
      animation: 'slideUp 0.3s ease',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    });

    // Set background color based on type
    if (type === 'success') {
      toast.style.background = 'hsl(var(--african-green))';
    } else if (type === 'error') {
      toast.style.background = 'hsl(var(--destructive))';
    } else {
      toast.style.background = 'hsl(var(--primary))';
    }

    document.body.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate hex string
   * @param {string} hex
   * @param {number} length - Expected length in characters (optional)
   * @returns {boolean}
   */
  function validateHex(hex, length = null) {
    const hexRegex = length 
      ? new RegExp(`^[a-fA-F0-9]{${length}}$`)
      : /^[a-fA-F0-9]+$/;
    return hexRegex.test(hex);
  }

  /**
   * Sanitize input (prevent XSS)
   * @param {string} str
   * @returns {string}
   */
  function sanitizeInput(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Debounce function
   * @param {Function} func
   * @param {number} wait - Milliseconds
   * @returns {Function}
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Format file size (1024 -> "1 KB")
   * @param {number} bytes
   * @returns {string}
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Generate random ID
   * @param {number} length
   * @returns {string}
   */
  function generateId(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Sleep/delay function
   * @param {number} ms - Milliseconds
   * @returns {Promise}
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format percentage
   * @param {number} value
   * @param {number} total
   * @param {number} decimals
   * @returns {string}
   */
  function formatPercentage(value, total, decimals = 2) {
    if (total === 0) return '0%';
    const percentage = (value / total) * 100;
    return percentage.toFixed(decimals) + '%';
  }

  /**
   * Validate transaction amount
   * @param {string} amount
   * @returns {Object} {valid, error, value}
   */
  function validateAmount(amount) {
    const num = Number(amount);
    
    if (isNaN(num)) {
      return { valid: false, error: 'Invalid number format', value: 0 };
    }
    
    if (num <= 0) {
      return { valid: false, error: 'Amount must be greater than 0', value: 0 };
    }
    
    if (num > 1000000000) {
      return { valid: false, error: 'Amount too large', value: 0 };
    }
    
    // Check for too many decimal places (max 8 for satoshi precision)
    const decimalPart = amount.toString().split('.')[1];
    if (decimalPart && decimalPart.length > 8) {
      return { valid: false, error: 'Maximum 8 decimal places allowed', value: 0 };
    }
    
    return { valid: true, error: null, value: num };
  }

  /**
   * Create loading spinner element
   * @returns {HTMLElement}
   */
  function createSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    return spinner;
  }

  /**
   * Show loading modal
   * @param {string} message
   */
  function showLoading(message = 'Processing...') {
    const modal = document.getElementById('loadingModal');
    const messageEl = document.getElementById('loadingMessage');
    if (modal && messageEl) {
      messageEl.textContent = message;
      modal.classList.remove('hidden');
    }
  }

  /**
   * Hide loading modal
   */
  function hideLoading() {
    const modal = document.getElementById('loadingModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * Format blockchain explorer URL (if you have one)
   * @param {string} type - 'tx', 'block', 'address'
   * @param {string} value
   * @returns {string|null}
   */
  function getExplorerUrl(type, value) {
    // Placeholder - implement when you have a block explorer
    return null;
  }

  /**
   * Validate password strength
   * @param {string} password
   * @returns {Object} {strong, score, suggestions}
   */
  function validatePasswordStrength(password) {
    const result = {
      strong: false,
      score: 0,
      suggestions: []
    };

    if (password.length < 8) {
      result.suggestions.push('Password must be at least 8 characters');
      return result;
    }

    let score = 0;

    // Length
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;

    // Uppercase
    if (/[A-Z]/.test(password)) score += 1;
    else result.suggestions.push('Add uppercase letters');

    // Lowercase
    if (/[a-z]/.test(password)) score += 1;
    else result.suggestions.push('Add lowercase letters');

    // Numbers
    if (/\d/.test(password)) score += 1;
    else result.suggestions.push('Add numbers');

    // Special characters
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else result.suggestions.push('Add special characters');

    result.score = score;
    result.strong = score >= 4;

    return result;
  }

  /**
   * Parse query parameters from URL
   * @returns {Object}
   */
  function parseQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    });
    
    return params;
  }

  /**
   * Calculate estimated USD value (mock function)
   * In production, you'd fetch real exchange rates
   * @param {number} dntAmount
   * @param {number} afcAmount
   * @returns {number}
   */
  function estimateUSDValue(dntAmount, afcAmount) {
    // Mock exchange rates - replace with real API call
    const DNT_USD = 0.10; // $0.10 per DNT
    const AFC_USD = 1.00; // $1.00 per AFC
    
    return (dntAmount * DNT_USD) + (afcAmount * AFC_USD);
  }

  /**
   * Check if dark mode is preferred
   * @returns {boolean}
   */
  function prefersDarkMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Safe JSON parse with fallback
   * @param {string} jsonString
   * @param {any} fallback
   * @returns {any}
   */
  function safeJSONParse(jsonString, fallback = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      return fallback;
    }
  }

  /**
   * Format address for QR code (add prefix if needed)
   * @param {string} address
   * @returns {string}
   */
  function formatAddressForQR(address) {
    // Could add "dinari:" prefix for wallet apps
    return address;
  }

  /**
   * Compare versions (e.g., "1.0.0" vs "1.0.1")
   * @param {string} v1
   * @param {string} v2
   * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }

  // Public API
  return {
    // Formatting
    formatNumber,
    formatTokenAmount,
    formatLargeAmount,
    formatPercentage,
    formatFileSize,
    formatAddressForQR,
    
    // Validation
    validateEmail,
    validateHex,
    validateAmount,
    validatePasswordStrength,
    
    // UI Helpers
    copyToClipboard,
    showToast,
    showLoading,
    hideLoading,
    createSpinner,
    
    // Utilities
    sanitizeInput,
    debounce,
    generateId,
    sleep,
    safeJSONParse,
    parseQueryParams,
    getExplorerUrl,
    estimateUSDValue,
    prefersDarkMode,
    compareVersions
  };
})();

// Make available globally
window.DinariUtils = DinariUtils;