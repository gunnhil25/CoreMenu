import crypto from "crypto";
import { cookies, headers } from "next/headers";

export const SESSION_COOKIE_NAME = "coremenu_session";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "user";
  sessionVersion: number;
  exp: number;
}

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    "coremenu-default-selfhosted-auth-secret-change-me"
  );
}

/**
 * Hashes a plaintext password using memory-hard scrypt with a random 16-byte salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash in constant time.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith("scrypt$")) {
    return false;
  }

  const parts = storedHash.split("$");
  if (parts.length !== 3) return false;

  const [, salt, hashHex] = parts;
  if (!salt || !/^[0-9a-f]+$/i.test(hashHex)) return false;

  const expectedBuf = Buffer.from(hashHex, "hex");
  const actualBuf = crypto.scryptSync(password, salt, expectedBuf.length);

  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Creates a signed HMAC-SHA256 session token.
 */
export function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlMs,
  };
  const data = Buffer.from(JSON.stringify(fullPayload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Verifies an HMAC-SHA256 session token and returns its payload if valid and unexpired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;

  const data = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.userId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.sessionVersion !== "number" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

let testSessionOverride: SessionPayload | null | undefined = undefined;

export function setTestSession(payload: SessionPayload | null | undefined): void {
  testSessionOverride = payload;
}

async function shouldUseSecureCookie(): Promise<boolean> {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  try {
    const hdrs = await headers();
    return hdrs.get("x-forwarded-proto") === "https";
  } catch {
    return false;
  }
}

export async function setSessionCookie(
  payload: Omit<SessionPayload, "exp">,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const token = createSessionToken(payload, ttlMs);
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlMs,
  };

  if (process.env.NODE_ENV === "test") {
    testSessionOverride = fullPayload;
  }

  try {
    const cookieStore = await cookies();
    const secure = await shouldUseSecureCookie();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: Math.floor(ttlMs / 1000),
    });
  } catch {
    // Outside Next.js HTTP request context (e.g. Vitest)
  }
}

export async function clearSessionCookie(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    testSessionOverride = null;
  }

  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Outside Next.js HTTP request context
  }
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  if (process.env.NODE_ENV === "test" && testSessionOverride !== undefined) {
    if (!testSessionOverride) return null;
    return testSessionOverride.exp > Date.now() ? testSessionOverride : null;
  }

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!raw) return null;
    return verifySessionToken(raw);
  } catch {
    return null;
  }
}
