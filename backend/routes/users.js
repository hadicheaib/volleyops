const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return true; }
  return false;
}

// ─── GET /api/users ───────────────────────────────────────────────────────────
// Admin: all users. Coach: users in their teams. Others: 403.
router.get('/', requireRole('admin', 'coach'), (req, res) => {
  const { role, search, is_active, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql    = `
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
           tr.id AS team_request_id, tr.team_id AS requested_team_id,
           COALESCE(at.name, t.name)   AS requested_team_name,
           CASE WHEN at.id IS NOT NULL THEN 'active'
                ELSE t.status
           END AS requested_team_status
    FROM users u
    LEFT JOIN teams at ON (at.coach_id = u.id OR at.assistant_coach_id = u.id)
    LEFT JOIN team_requests tr ON tr.user_id = u.id AND tr.status = 'pending'
    LEFT JOIN teams t ON t.id = tr.team_id
    WHERE 1=1
  `;
  const params = [];

  if (role) { sql += ` AND role = ?`; params.push(role); }
  if (is_active != null) { sql += ` AND is_active = ?`; params.push(is_active === 'true' ? 1 : 0); }
  if (search) {
    sql += ` AND (name LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM (${sql})`).get(...params).n;
  sql += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const users = db.prepare(sql).all(...params);
  res.json({ users, total, page: Number(page), limit: Number(limit) });
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const targetId = Number(req.params.id);

  // Users can only fetch their own record unless admin/coach
  if (targetId !== req.user.id && !['admin', 'coach'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const user = db.prepare(
    `SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?`
  ).get(targetId);

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'coach', 'assistant_coach', 'player']),
  body('is_active').optional().isBoolean(),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const targetId = Number(req.params.id);
  const isAdmin  = req.user.role === 'admin';

  if (targetId !== req.user.id && !isAdmin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(targetId);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { name, email, role, is_active } = req.body;

  // Only admins may change role or is_active
  const newName      = name      ?? existing.name;
  const newEmail     = email     ?? existing.email;
  const newRole      = isAdmin && role      != null ? role      : existing.role;
  const newIsActive  = isAdmin && is_active != null ? (is_active ? 1 : 0) : existing.is_active;

  // Check email uniqueness if changed
  if (newEmail !== existing.email) {
    const clash = db.prepare(`SELECT id FROM users WHERE email = ? AND id != ?`).get(newEmail, targetId);
    if (clash) return res.status(409).json({ error: 'Email already in use' });
  }

  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, role = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newName, newEmail, newRole, newIsActive, targetId);

  // If activating a coach/asst_coach (is_active going 0 → 1), fulfil their team_request
  if (isAdmin && is_active === true && existing.is_active === 0 &&
      (existing.role === 'coach' || existing.role === 'assistant_coach')) {
    const teamReq = db.prepare(`SELECT * FROM team_requests WHERE user_id = ? AND status = 'pending'`).get(targetId);
    if (teamReq) {
      const coachField = existing.role === 'coach' ? 'coach_id' : 'assistant_coach_id';
      // Only assign if slot still open
      const teamRow = db.prepare(`SELECT ${coachField} FROM teams WHERE id = ?`).get(teamReq.team_id);
      if (teamRow && !teamRow[coachField]) {
        db.prepare(`UPDATE teams SET ${coachField} = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`)
          .run(targetId, teamReq.team_id);
      }
      db.prepare(`UPDATE team_requests SET status = 'approved' WHERE id = ?`).run(teamReq.id);
    }
  }

  res.json(db.prepare(`SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?`).get(targetId));
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
router.delete('/:id', requireRole('admin'), (req, res) => {
  const targetId = Number(req.params.id);

  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const user = db.prepare(`SELECT id FROM users WHERE id = ?`).get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`DELETE FROM users WHERE id = ?`).run(targetId);
  res.json({ message: 'User deleted' });
});

module.exports = router;
