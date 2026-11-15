import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDbStore } from '../db.ts';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(process.env.GEMINI_API_KEY || 'internradar-local-dev-secret-key')
    .digest('hex');

const COOKIE_NAME = 'internradar_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionPayload {
  userId: string;
  email: string;
  isDemo: boolean;
  exp: number;
}

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    email: string;
    isDemo: boolean;
  };
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE_NAME) {
      return decodeURIComponent(v.join('='));
    }
  }
  return null;
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

async function hydrateRequestUser(req: AuthedRequest) {
  const token = extractToken(req);
  if (!token) return;
  const payload = verifySessionToken(token);
  if (!payload) return;
  const exists = await getDbStore().findAuthUserById(payload.userId);
  if (exists) {
    req.user = {
      id: exists.id,
      email: exists.email,
      isDemo: Boolean(exists.is_demo),
    };
  }
}

export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    await hydrateRequestUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    await hydrateRequestUser(req);
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
