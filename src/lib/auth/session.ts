import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import db from '../db/client';

const SESSION_COOKIE_NAME = 'secure_session_token';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

/**
 * Creates a new session in the database and sets a secure cookie in the client.
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const hashedToken = createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + SESSION_EXPIRY_MS;

  // Save the hashed token to the database to prevent session hijacking if DB is compromised
  db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(hashedToken, userId, expiresAt);

  // Set the cookie securely
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(expiresAt),
  });

  return token;
}

/**
 * Validates the session cookie.
 * If valid, returns the user and expiration time. If invalid/expired, cleans up and returns null.
 */
export async function validateSession(): Promise<{ user: SessionUser; expiresAt: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  // Hash the incoming token to match database record
  const hashedToken = createHash('sha256').update(token).digest('hex');

  // Securely query with parameter binding to prevent SQLi
  const sessionRow = db.prepare(`
    SELECT s.expires_at, u.id, u.name, u.email, u.role, u.avatar_url
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(hashedToken) as { expires_at: number; id: string; name: string; email: string; role: string; avatar_url: string | null } | undefined;

  if (!sessionRow) {
    // If cookie is invalid on server, clear it
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  // Check for expiration
  if (Date.now() > sessionRow.expires_at) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(hashedToken);
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return {
    user: {
      id: sessionRow.id,
      name: sessionRow.name,
      email: sessionRow.email,
      role: sessionRow.role,
      avatar_url: sessionRow.avatar_url,
    },
    expiresAt: sessionRow.expires_at,
  };
}

/**
 * Destroys the current user session in the database and clears the browser cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;

  const hashedToken = createHash('sha256').update(token).digest('hex');
  db.prepare('DELETE FROM sessions WHERE id = ?').run(hashedToken);
  
  cookieStore.delete(SESSION_COOKIE_NAME);
}
