const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const SKILL_FIELDS = ['serving','passing','setting','hitting','blocking','defense','athleticism','coachability'];

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return true; }
  return false;
}

function computeOverall(row) {
  const scores = SKILL_FIELDS.map(f => row[f]).filter(v => v != null);
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

// ─── GET /api/evaluations ─────────────────────────────────────────────────────
// Query params: tryout_id, player_id, season
router.get('/', authenticate, requireRole('admin', 'coach', 'assistant_coach'), (req, res) => {
  const { tryout_id, player_id, season } = req.query;

  let sql = `
    SELECT e.*,
           p.name AS player_name, p.position,
           u.name AS evaluator_name,
           t.name AS tryout_name
    FROM player_evaluations e
    JOIN players p ON p.id = e.player_id
    JOIN users   u ON u.id = e.evaluated_by
    LEFT JOIN tryouts t ON t.id = e.tryout_id
    WHERE 1=1
  `;
  const params = [];

  if (tryout_id)  { sql += ` AND e.tryout_id = ?`;  params.push(Number(tryout_id)); }
  if (player_id)  { sql += ` AND e.player_id = ?`;  params.push(Number(player_id)); }
  if (season)     { sql += ` AND e.season = ?`;     params.push(season); }

  sql += ` ORDER BY e.updated_at DESC`;
  const rows = db.prepare(sql).all(...params);
  const evaluations = rows.map(r => ({ ...r, overall: computeOverall(r) }));
  res.json({ evaluations });
});

// ─── POST /api/evaluations ────────────────────────────────────────────────────
// Create or update (upsert by tryout_id + player_id + evaluated_by)
router.post('/', authenticate, requireRole('admin', 'coach', 'assistant_coach'), [
  body('player_id').isInt({ min: 1 }),
  body('tryout_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('season').optional().trim(),
  ...SKILL_FIELDS.map(f => body(f).optional({ nullable: true }).isInt({ min: 1, max: 10 })),
  body('notes').optional().trim(),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const { player_id, tryout_id = null, season = null, notes = null } = req.body;
  const skills = {};
  SKILL_FIELDS.forEach(f => { skills[f] = req.body[f] != null ? Number(req.body[f]) : null; });

  db.prepare(`
    INSERT INTO player_evaluations
      (player_id, tryout_id, evaluated_by, season,
       serving, passing, setting, hitting, blocking, defense, athleticism, coachability, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tryout_id, player_id, evaluated_by) DO UPDATE SET
      season = excluded.season,
      serving = excluded.serving, passing = excluded.passing,
      setting = excluded.setting, hitting = excluded.hitting,
      blocking = excluded.blocking, defense = excluded.defense,
      athleticism = excluded.athleticism, coachability = excluded.coachability,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).run(
    Number(player_id), tryout_id ? Number(tryout_id) : null, req.user.id, season,
    skills.serving, skills.passing, skills.setting, skills.hitting,
    skills.blocking, skills.defense, skills.athleticism, skills.coachability, notes
  );

  const row = db.prepare(`
    SELECT e.*, p.name AS player_name, p.position, u.name AS evaluator_name
    FROM player_evaluations e
    JOIN players p ON p.id = e.player_id
    JOIN users   u ON u.id = e.evaluated_by
    WHERE e.player_id = ? AND e.evaluated_by = ?
    ${tryout_id ? 'AND e.tryout_id = ?' : 'AND e.tryout_id IS NULL'}
    ORDER BY e.updated_at DESC LIMIT 1
  `).get(...[Number(player_id), req.user.id, ...(tryout_id ? [Number(tryout_id)] : [])]);

  res.json({ evaluation: { ...row, overall: computeOverall(row) } });
});

// ─── GET /api/evaluations/summary ────────────────────────────────────────────
// Aggregate per-player averages across all evaluators for a tryout
router.get('/summary', authenticate, requireRole('admin', 'coach', 'assistant_coach'), (req, res) => {
  const { tryout_id, season } = req.query;
  if (!tryout_id && !season) return res.status(400).json({ error: 'tryout_id or season required' });

  const params = [];
  let filter = '';
  if (tryout_id) { filter += ` AND e.tryout_id = ?`; params.push(Number(tryout_id)); }
  if (season)    { filter += ` AND e.season = ?`;    params.push(season); }

  const rows = db.prepare(`
    SELECT p.id AS player_id, p.name AS player_name, p.position,
           AVG(e.serving)      AS serving,
           AVG(e.passing)      AS passing,
           AVG(e.setting)      AS setting,
           AVG(e.hitting)      AS hitting,
           AVG(e.blocking)     AS blocking,
           AVG(e.defense)      AS defense,
           AVG(e.athleticism)  AS athleticism,
           AVG(e.coachability) AS coachability,
           COUNT(e.id)         AS eval_count
    FROM player_evaluations e
    JOIN players p ON p.id = e.player_id
    WHERE 1=1 ${filter}
    GROUP BY e.player_id
    ORDER BY (COALESCE(AVG(e.serving),0)+COALESCE(AVG(e.passing),0)+COALESCE(AVG(e.setting),0)+COALESCE(AVG(e.hitting),0)+
              COALESCE(AVG(e.blocking),0)+COALESCE(AVG(e.defense),0)+COALESCE(AVG(e.athleticism),0)+COALESCE(AVG(e.coachability),0)) / 8 DESC
  `).all(...params);

  const summary = rows.map(r => {
    const scores = SKILL_FIELDS.map(f => r[f]).filter(v => v != null);
    const overall = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;
    return { ...r, overall };
  });

  res.json({ summary });
});

module.exports = router;
