const express = require('express');
const db      = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function pushNotification(io, userId, type, title, body_) {
  if (!io || !userId) return;
  try {
    db.prepare(`INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)`)
      .run(userId, type, title, body_);
    io.to(`user:${userId}`).emit('notification', { type, title, body: body_ });
  } catch {}
}

// ─── GET /api/team-requests ───────────────────────────────────────────────────
// Admin only: list all pending team requests with user + team info.
router.get('/', requireRole('admin'), (req, res) => {
  const { status = 'pending' } = req.query;
  const rows = db.prepare(`
    SELECT tr.id, tr.status, tr.created_at,
           u.id   AS user_id,  u.name  AS user_name,  u.email AS user_email,
           u.role AS user_role, u.is_active,
           t.id   AS team_id,  t.name  AS team_name,  t.status AS team_status
    FROM team_requests tr
    JOIN users u ON u.id = tr.user_id
    JOIN teams t ON t.id = tr.team_id
    WHERE tr.status = ?
    ORDER BY tr.created_at DESC
  `).all(status);
  res.json({ requests: rows, total: rows.length });
});

// ─── PATCH /api/team-requests/:id ─────────────────────────────────────────────
// Admin only: approve or reject a team request.
// Approving also activates the user and assigns them to the team.
router.patch('/:id', requireRole('admin'), (req, res) => {
  const { action } = req.body; // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
  }

  const request = db.prepare(`
    SELECT tr.*, u.name AS user_name, u.role AS user_role, t.name AS team_name
    FROM team_requests tr
    JOIN users u ON u.id = tr.user_id
    JOIN teams t ON t.id = tr.team_id
    WHERE tr.id = ?
  `).get(Number(req.params.id));

  if (!request) return res.status(404).json({ error: 'Team request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

  const io = req.app.get('io');

  if (action === 'approve') {
    const coachField = request.user_role === 'coach' ? 'coach_id' : 'assistant_coach_id';
    if (!['coach_id', 'assistant_coach_id'].includes(coachField)) {
      return res.status(400).json({ error: 'Invalid user role for team assignment' });
    }
    const teamRow = db.prepare(`SELECT ${coachField} FROM teams WHERE id = ?`).get(request.team_id);

    if (teamRow && teamRow[coachField]) {
      return res.status(409).json({ error: `Team already has a ${request.user_role === 'coach' ? 'head coach' : 'assistant coach'}.` });
    }

    // Assign coach to team and activate user
    db.prepare(`UPDATE teams SET ${coachField} = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`)
      .run(request.user_id, request.team_id);
    db.prepare(`UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE id = ?`)
      .run(request.user_id);
    db.prepare(`UPDATE team_requests SET status = 'approved' WHERE id = ?`).run(request.id);

    pushNotification(io, request.user_id, 'account_approved',
      'Account Approved!',
      `Your account has been approved. You are now assigned to ${request.team_name}.`);
  } else {
    db.prepare(`UPDATE team_requests SET status = 'rejected' WHERE id = ?`).run(request.id);
    pushNotification(io, request.user_id, 'account_rejected',
      'Account Not Approved',
      `Your request to join ${request.team_name} was not approved. Please contact the administrator.`);
  }

  res.json({ message: `Request ${action}d successfully` });
});

module.exports = router;
