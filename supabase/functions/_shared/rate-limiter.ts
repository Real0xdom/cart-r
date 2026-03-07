// Shared Rate Limiter for Supabase Edge Functions
// In-memory rate limiting per IP with configurable limits

const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 60 * 1000;     // 1 minute
const DEFAULT_MAX_REQUESTS = 30;          // 30 requests per minute

export interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
}

/**
 * Check if a request is rate limited.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(
  clientIp: string,
  config?: RateLimitConfig
): boolean {
  const windowMs = config?.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = config?.maxRequests || DEFAULT_MAX_REQUESTS;
  const now = Date.now();
  const record = ipRequestCounts.get(clientIp);

  if (!record || now > record.resetAt) {
    ipRequestCounts.set(clientIp, { count: 1, resetAt: now + windowMs });
    return true;
  }

  record.count++;
  return record.count <= maxRequests;
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
}

/**
 * Create a 429 rate-limited response
 */
export function rateLimitedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': '60',
      },
    }
  );
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now > record.resetAt) {
      ipRequestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000);
