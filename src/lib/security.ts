import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import type { SessionClaims } from "./types";

const ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(input: string) {
  const base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sessionSecret() {
  return (
    process.env.GESTECC_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "gestecc-dev-session-secret"
  );
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, iterationValue, salt, hash] = storedHash.split("$");
  if (scheme !== "pbkdf2" || !iterationValue || !salt || !hash) return false;

  const iterations = Number(iterationValue);
  const expected = Buffer.from(hash, "hex");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function signSession(claims: Omit<SessionClaims, "exp">) {
  const payload: SessionClaims = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  };
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", sessionSecret()).update(body).digest();
  return `${body}.${base64Url(signature)}`;
}

export function verifySession(token: string | null | undefined): SessionClaims | null {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = base64Url(createHmac("sha256", sessionSecret()).update(body).digest());
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(decodeBase64Url(body)) as SessionClaims;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function tokenFromHeader(header: string | null) {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}
