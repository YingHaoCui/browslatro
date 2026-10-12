import type { IncomingMessage } from "node:http";
import { timingSafeEqual } from "node:crypto";

export function allowedOrigin(
  req: IncomingMessage,
  origins: readonly string[],
): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  return (
    origins.includes(origin) ||
    origin === `http://${req.headers.host}` ||
    origin === `https://${req.headers.host}`
  );
}

export function authenticated(req: IncomingMessage, token: string): boolean {
  if (!token) return true;
  const actual = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
