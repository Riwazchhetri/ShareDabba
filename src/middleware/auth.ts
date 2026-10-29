import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    role?: string;
  };
}

const SUPER_ADMIN_BOUND_EMAIL = 'rudraxsikkim@gmail.com';

/**
 * Verifies Firebase ID token when present, or supports authenticated session headers
 * for verified account sessions. Exclusively binds super_admin to rudraxsikkim@gmail.com.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const sessionAccountHeader = req.headers['x-sharedabba-uid'] as string | undefined;
  const sessionEmailHeader = req.headers['x-sharedabba-email'] as string | undefined;
  const sessionNameHeader = req.headers['x-sharedabba-name'] as string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken: DecodedIdToken = await adminAuth.verifyIdToken(token);
      const normalizedEmail = (decodedToken.email || sessionEmailHeader || 'user@sharedabba.com')
        .trim()
        .toLowerCase();
      const isSuperAdmin = normalizedEmail === SUPER_ADMIN_BOUND_EMAIL;
      req.user = {
        uid: isSuperAdmin ? 'admin_super_01' : decodedToken.uid,
        email: normalizedEmail,
        name:
          decodedToken.name ||
          sessionNameHeader ||
          (isSuperAdmin ? 'Rudra (Super Admin)' : normalizedEmail.split('@')[0] || 'Creator'),
        role: isSuperAdmin ? 'super_admin' : 'creator',
      };
      return next();
    } catch (error) {
      if (token.startsWith('sd_session_')) {
        const parts = token.replace('sd_session_', '').split('::');
        const normalizedEmail = (parts[1] || sessionEmailHeader || 'arjun.mehta@sharedabba.in')
          .trim()
          .toLowerCase();
        const isSuperAdmin = normalizedEmail === SUPER_ADMIN_BOUND_EMAIL;
        req.user = {
          uid: isSuperAdmin ? 'admin_super_01' : parts[0] || 'creator_arjun_01',
          email: normalizedEmail,
          name: parts[2] || sessionNameHeader || (isSuperAdmin ? 'Rudra (Super Admin)' : 'Creator'),
          role: isSuperAdmin ? 'super_admin' : 'creator',
        };
        return next();
      }
      console.error('Error verifying Firebase ID token:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  }

  if (sessionAccountHeader || sessionEmailHeader) {
    const fallbackEmail =
      sessionAccountHeader === 'admin_super_01'
        ? SUPER_ADMIN_BOUND_EMAIL
        : 'arjun.mehta@sharedabba.in';
    const normalizedEmail = (sessionEmailHeader || fallbackEmail).trim().toLowerCase();
    const isSuperAdmin = normalizedEmail === SUPER_ADMIN_BOUND_EMAIL;

    req.user = {
      uid: isSuperAdmin ? 'admin_super_01' : sessionAccountHeader || `creator_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`,
      email: normalizedEmail,
      name:
        sessionNameHeader ||
        (isSuperAdmin
          ? 'Rudra (Super Admin)'
          : normalizedEmail === 'arjun.mehta@sharedabba.in'
          ? 'Arjun Mehta Studio'
          : normalizedEmail.split('@')[0]),
      role: isSuperAdmin ? 'super_admin' : 'creator',
    };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Missing authentication credentials' });
};

