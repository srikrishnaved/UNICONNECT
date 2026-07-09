// Per-IP in-memory rate limiter — shared within a single worker instance.
// Supabase Edge Functions may run multiple worker processes; each maintains
// its own counter. For a low-traffic internal app this is sufficient.

interface Entry {
  count: number;
  resetAt: number; // epoch ms when the window expires
}

const store = new Map<string, Entry>();

const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkRateLimit(ip: string, limit: number = LIMIT): { allowed: boolean } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    return { allowed: false };
  }

  entry.count += 1;
  return { allowed: true };
}

export function rateLimitResponse(cors: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
    { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
  );
}
