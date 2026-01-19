"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createError = createError;
exports.parseError = parseError;
exports.showError = showError;
exports.logError = logError;
exports.safeAsync = safeAsync;
exports.debounce = debounce;
exports.throttle = throttle;
exports.retryWithBackoff = retryWithBackoff;
exports.createCache = createCache;
exports.measureTime = measureTime;
exports.dedupeRequest = dedupeRequest;
// Global Error Handling & Performance Utilities
const react_native_1 = require("react-native");
// ============================================
// ERROR MESSAGES (User-friendly)
// ============================================
const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network connection issue. Please check your internet and try again.',
    AUTH_ERROR: 'Authentication failed. Please sign in again.',
    VALIDATION_ERROR: 'Please check your input and try again.',
    PERMISSION_ERROR: 'Permission denied. Please check your app settings.',
    NOT_FOUND: 'The requested resource was not found.',
    SERVER_ERROR: 'Server error. Our team has been notified. Please try again later.',
    PAYMENT_ERROR: 'Payment processing failed. Please try again or use a different method.',
    LOCATION_ERROR: 'Unable to get your location. Please enable location services.',
    UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};
// ============================================
// ERROR FACTORY
// ============================================
function createError(code, customMessage, originalError) {
    return {
        code,
        message: customMessage || ERROR_MESSAGES[code],
        originalError,
        retryable: ['NETWORK_ERROR', 'SERVER_ERROR', 'LOCATION_ERROR'].includes(code),
    };
}
// ============================================
// ERROR PARSER (from Supabase/API errors)
// ============================================
function parseError(error) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // Handle null/undefined
    if (!error) {
        return createError('UNKNOWN_ERROR');
    }
    // Handle string errors
    if (typeof error === 'string') {
        return createError('UNKNOWN_ERROR', error);
    }
    // Handle network errors
    if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('fetch')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('network'))) {
        return createError('NETWORK_ERROR', undefined, error);
    }
    // Handle Supabase auth errors
    if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('JWT')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('token')) || error.code === 'PGRST301') {
        return createError('AUTH_ERROR', undefined, error);
    }
    // Handle permission errors
    if (error.code === '42501' || ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('permission'))) {
        return createError('PERMISSION_ERROR', undefined, error);
    }
    // Handle not found
    if (error.code === 'PGRST116' || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('not found'))) {
        return createError('NOT_FOUND', undefined, error);
    }
    // Handle validation errors
    if (error.code === '23505' || ((_g = error.code) === null || _g === void 0 ? void 0 : _g.startsWith('22')) || ((_h = error.code) === null || _h === void 0 ? void 0 : _h.startsWith('23'))) {
        return createError('VALIDATION_ERROR', error.message, error);
    }
    // Handle API errors with status codes
    if (error.status >= 500) {
        return createError('SERVER_ERROR', undefined, error);
    }
    return createError('UNKNOWN_ERROR', error.message, error);
}
// ============================================
// ERROR DISPLAY
// ============================================
function showError(error, onRetry) {
    const buttons = [];
    if (error.retryable && onRetry) {
        buttons.push({
            text: 'Retry',
            onPress: onRetry,
        });
    }
    buttons.push({ text: 'OK', style: 'cancel' });
    react_native_1.Alert.alert('Oops!', error.message, buttons);
}
// ============================================
// ERROR LOGGING (for analytics/debugging)
// ============================================
function logError(error, context) {
    var _a;
    const logData = {
        code: error.code,
        message: error.message,
        context,
        timestamp: new Date().toISOString(),
        platform: react_native_1.Platform.OS,
        originalError: ((_a = error.originalError) === null || _a === void 0 ? void 0 : _a.message) || error.originalError,
    };
    // Log to console in development
    if (__DEV__) {
        console.error('🚨 App Error:', logData);
    }
    // In production, send to error tracking service (Sentry, Bugsnag, etc.)
    // Example: Sentry.captureException(error.originalError, { extra: logData });
}
// ============================================
// ASYNC ERROR WRAPPER
// ============================================
async function safeAsync(fn, options) {
    var _a;
    try {
        const data = await fn();
        return { data, error: null };
    }
    catch (err) {
        const appError = parseError(err);
        logError(appError, options === null || options === void 0 ? void 0 : options.context);
        if ((options === null || options === void 0 ? void 0 : options.showAlert) !== false) {
            showError(appError);
        }
        (_a = options === null || options === void 0 ? void 0 : options.onError) === null || _a === void 0 ? void 0 : _a.call(options, appError);
        return { data: null, error: appError };
    }
}
// ============================================
// PERFORMANCE UTILITIES
// ============================================
/**
 * Debounce function to limit rapid calls
 */
function debounce(func, wait) {
    let timeoutId = null;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
        }, wait);
    };
}
/**
 * Throttle function to limit call frequency
 */
function throttle(func, limit) {
    let inThrottle = false;
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}
/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
/**
 * Cache wrapper for expensive operations
 */
function createCache(maxAge = 60000) {
    const cache = new Map();
    return {
        get(key) {
            const entry = cache.get(key);
            if (!entry)
                return undefined;
            if (Date.now() - entry.timestamp > maxAge) {
                cache.delete(key);
                return undefined;
            }
            return entry.value;
        },
        set(key, value) {
            cache.set(key, { value, timestamp: Date.now() });
        },
        clear() {
            cache.clear();
        },
    };
}
/**
 * Measure execution time
 */
function measureTime(label) {
    const start = performance.now();
    return () => {
        const duration = performance.now() - start;
        if (__DEV__) {
            console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        }
    };
}
// ============================================
// REQUEST DEDUPLICATION
// ============================================
const pendingRequests = new Map();
/**
 * Deduplicate concurrent identical requests
 */
async function dedupeRequest(key, fn) {
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
    }
    const promise = fn().finally(() => {
        pendingRequests.delete(key);
    });
    pendingRequests.set(key, promise);
    return promise;
}
