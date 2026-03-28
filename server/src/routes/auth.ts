import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

interface LoginRequest {
  email: string;
  password?: string; // Optional for demo
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 * For demo: any email in the users table works (password verification not implemented)
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body as LoginRequest;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Look up user in database
    const result = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    } as LoginResponse);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /auth/logout
 * For now just returns success (token is stored client-side)
 * In production, this would invalidate the token by adding it to a blacklist (stored in Redis)
 */
router.post('/auth/logout', (req: Request, res: Response) => {
  // Token invalidation would happen client-side by removing localStorage token
  // Server-side token blacklisting would use Redis
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /auth/me
 * Returns current user info from JWT
 */
router.get('/auth/me', (req: Request, res: Response) => {
  // Auth middleware will have already validated the token
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user });
});

export default router;
