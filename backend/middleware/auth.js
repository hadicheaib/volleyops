const jwt = require('jsonwebtoken');
const db  = require('../db');

/**
 * Verifies the JWT access token in the Authorization header.
 * Attaches `req.user = { id, name, email, role }` on success.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Make sure the user still exists and is active
    const user = db.prepare(
      `SELECT id, name, email, role, is_active FROM users WHERE id = ?`
    ).get(payload.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware factory: only allow requests from users with one of the given roles.
 * Must be used AFTER `authenticate`.
 *
 * Usage: router.get('/admin-only', authenticate, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
