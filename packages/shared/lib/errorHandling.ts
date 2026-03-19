// Global Error Handling & Performance Utilities
import { Alert, Platform } from 'react-native';

// ============================================
// ERROR TYPES
// ============================================

export type ErrorCode = 
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'PAYMENT_ERROR'
  | 'LOCATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: string;
  originalError?: any;
  retryable?: boolean;
}

// ============================================
// ERROR MESSAGES (User-friendly)
// ============================================

const ERROR_MESSAGES: Record<ErrorCode, string> = {
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

export function createError(
  code: ErrorCode,
  customMessage?: string,
  originalError?: any
): AppError {
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

export function parseError(error: any): AppError {
  // Handle null/undefined
  if (!error) {
    return createError('UNKNOWN_ERROR');
  }

  // Handle string errors
  if (typeof error === 'string') {
    return createError('UNKNOWN_ERROR', error);
  }

  // Handle network errors
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return createError('NETWORK_ERROR', undefined, error);
  }

  // Handle Supabase auth errors
  if (error.message?.includes('JWT') || error.message?.includes('token') || error.code === 'PGRST301') {
    return createError('AUTH_ERROR', undefined, error);
  }

  // Handle permission errors
  if (error.code === '42501' || error.message?.includes('permission')) {
    return createError('PERMISSION_ERROR', undefined, error);
  }

  // Handle not found
  if (error.code === 'PGRST116' || error.message?.includes('not found')) {
    return createError('NOT_FOUND', undefined, error);
  }

  // Handle validation errors
  if (error.code === '23505' || error.code?.startsWith('22') || error.code?.startsWith('23')) {
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

export function showError(error: AppError, onRetry?: () => void): void {
  const buttons = [];

  if (error.retryable && onRetry) {
    buttons.push({
      text: 'Retry',
      onPress: onRetry,
    });
  }

  buttons.push({ text: 'OK', style: 'cancel' as const });

  Alert.alert('Oops!', error.message, buttons);
}

// ============================================
// ERROR LOGGING (for analytics/debugging)
// ============================================

export function logError(error: AppError, context?: string): void {
  const logData = {
    code: error.code,
    message: error.message,
    context,
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
    originalError: error.originalError?.message || error.originalError,
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

export async function safeAsync<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (error: AppError) => void;
    showAlert?: boolean;
    context?: string;
  }
): Promise<{ data: T | null; error: AppError | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    const appError = parseError(err);
    logError(appError, options?.context);

    if (options?.showAlert !== false) {
      showError(appError);
    }

    options?.onError?.(appError);
    return { data: null, error: appError };
  }
}

// ============================================
// PERFORMANCE UTILITIES
// ============================================

/**
 * Debounce function to limit rapid calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
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
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
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
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
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
export function createCache<K, V>(maxAge: number = 60000) {
  const cache = new Map<K, { value: V; timestamp: number }>();

  return {
    get(key: K): V | undefined {
      const entry = cache.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.timestamp > maxAge) {
        cache.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: K, value: V): void {
      cache.set(key, { value, timestamp: Date.now() });
    },
    clear(): void {
      cache.clear();
    },
  };
}

/**
 * Measure execution time
 */
export function measureTime(label: string): () => void {
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

const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicate concurrent identical requests
 */
export async function dedupeRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  const promise = fn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}
