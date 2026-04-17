const express = require('express');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'coach', 'assistant_coach'));

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
}

function canAccessBoard(user, board) {
  if (user.role === 'admin') return true;
  if (board.created_by === user.id) return true;
  return board.coach_id === user.id || board.assistant_coach_id === user.id;
}

function hydrateBoard(board) {
  return {
    ...board,
    markers: JSON.parse(board.markers || '[]'),
    arrows: JSON.parse(board.arrows || '[]'),
    zones: JSON.parse(board.zones || '[]'),
    match_context: JSON.parse(board.match_context || '{}'),
  };
}

router.get('/', (req, res) => {
  const { team_id, created_by } = req.query;
  let sql = `
    SELECT
      tb.*,
      t.name AS team_name,
      t.coach_id,
      t.assistant_coach_id,
      u.name AS created_by_name
    FROM tactics_boards tb
    LEFT JOIN teams t ON t.id = tb.team_id
    JOIN users u ON u.id = tb.created_by
    WHERE 1 = 1
  `;
  const params = [];

  if (req.user.role === 'coach') {
    sql += ` AND (tb.created_by = ? OR t.coach_id = ?)`;
    params.push(req.user.id, req.user.id);
  } else if (req.user.role === 'assistant_coach') {
    sql += ` AND (tb.created_by = ? OR t.assistant_coach_id = ?)`;
    params.push(req.user.id, req.user.id);
  }

  if (team_id) {
    sql += ` AND tb.team_id = ?`;
    params.push(Number(team_id));
  }

  if (created_by) {
    sql += ` AND tb.created_by = ?`;
    params.push(Number(created_by));
  }

  sql += ` ORDER BY tb.updated_at DESC`;
  const boards = db.prepare(sql).all(...params).map(hydrateBoard);
  res.json({ boards });
});

router.post('/', [
  body('name').trim().notEmpty(),
  body('team_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('formation').optional().isIn(['6-2', '5-1', '4-2', 'custom']),
  body('markers').optional().isArray(),
  body('arrows').optional().isArray(),
  body('zones').optional().isArray(),
  body('match_context').optional().isObject(),
  body('notes').optional().trim(),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const result = db.prepare(`
    INSERT INTO tactics_boards (
      name, team_id, created_by, markers, arrows, zones, formation, match_context, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.body.name,
    req.body.team_id ?? null,
    req.user.id,
    JSON.stringify(req.body.markers || []),
    JSON.stringify(req.body.arrows || []),
    JSON.stringify(req.body.zones || []),
    req.body.formation || '6-2',
    JSON.stringify(req.body.match_context || {}),
    req.body.notes || '',
  );

  const created = db.prepare(`
    SELECT
      tb.*,
      t.name AS team_name,
      t.coach_id,
      t.assistant_coach_id
    FROM tactics_boards tb
    LEFT JOIN teams t ON t.id = tb.team_id
    WHERE tb.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(hydrateBoard(created));
});

router.get('/:id', (req, res) => {
  const boardId = Number(req.params.id);
  const board = db.prepare(`
    SELECT
      tb.*,
      t.name AS team_name,
      t.coach_id,
      t.assistant_coach_id
    FROM tactics_boards tb
    LEFT JOIN teams t ON t.id = tb.team_id
    WHERE tb.id = ?
  `).get(boardId);

  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canAccessBoard(req.user, board)) return res.status(403).json({ error: 'Access denied' });

  res.json(hydrateBoard(board));
});

router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('team_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('formation').optional().isIn(['6-2', '5-1', '4-2', 'custom']),
  body('markers').optional().isArray(),
  body('arrows').optional().isArray(),
  body('zones').optional().isArray(),
  body('match_context').optional().isObject(),
  body('notes').optional().trim(),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const boardId = Number(req.params.id);
  const board = db.prepare(`
    SELECT
      tb.*,
      t.coach_id,
      t.assistant_coach_id
    FROM tactics_boards tb
    LEFT JOIN teams t ON t.id = tb.team_id
    WHERE tb.id = ?
  `).get(boardId);

  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canAccessBoard(req.user, board)) return res.status(403).json({ error: 'Access denied' });

  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.team_id !== undefined) updates.team_id = req.body.team_id;
  if (req.body.formation !== undefined) updates.formation = req.body.formation;
  if (req.body.markers !== undefined) updates.markers = JSON.stringify(req.body.markers);
  if (req.body.arrows !== undefined) updates.arrows = JSON.stringify(req.body.arrows);
  if (req.body.zones !== undefined) updates.zones = JSON.stringify(req.body.zones);
  if (req.body.match_context !== undefined) {
    updates.match_context = JSON.stringify(req.body.match_context);
  }
  if (req.body.notes !== undefined) updates.notes = req.body.notes;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const setClause = Object.keys(updates).map((field) => `${field} = ?`).join(', ');
  db.prepare(`
    UPDATE tactics_boards
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ?
  `).run(...Object.values(updates), boardId);

  const updated = db.prepare(`
    SELECT
      tb.*,
      t.name AS team_name,
      t.coach_id,
      t.assistant_coach_id
    FROM tactics_boards tb
    LEFT JOIN teams t ON t.id = tb.team_id
    WHERE tb.id = ?
  `).get(boardId);

  res.json(hydrateBoard(updated));
});

router.delete('/:id', (req, res) => {
  const boardId = Number(req.params.id);
  const board = db.prepare(`
    SELECT
      tb.*,
      t.coach_id,
      t.assistant_coach_id
    FROM tactics_boards tb
    LEFT JOIN teams t ON t.id = tb.team_id
    WHERE tb.id = ?
  `).get(boardId);

  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canAccessBoard(req.user, board)) return res.status(403).json({ error: 'Access denied' });

  db.prepare(`DELETE FROM tactics_boards WHERE id = ?`).run(boardId);
  res.json({ message: 'Board deleted' });
});

module.exports = router;
