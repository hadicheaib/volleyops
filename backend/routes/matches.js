const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return true; }
  return false;
}

function pushNotification(io, userId, type, title, body_) {
  if (!io || !userId) return;
  try {
    db.prepare(`INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)`)
      .run(userId, type, title, body_);
    io.to(`user:${userId}`).emit('notification', { type, title, body: body_ });
  } catch {}
}

// Helper: get the player record for a user
function playerForUser(userId) {
  return db.prepare(`SELECT id FROM players WHERE user_id = ?`).get(userId);
}

// Helper: get team IDs a user is associated with (as coach or as player)
function teamIdsForUser(user) {
  if (user.role === 'admin') {
    return db.prepare(`SELECT id FROM teams`).all().map(r => r.id);
  }
  if (user.role === 'coach' || user.role === 'assistant_coach') {
    return db.prepare(
      `SELECT id FROM teams WHERE coach_id = ? OR assistant_coach_id = ?`
    ).all(user.id, user.id).map(r => r.id);
  }
  if (user.role === 'player') {
    const p = playerForUser(user.id);
    if (!p) return [];
    return db.prepare(
      `SELECT team_id FROM team_players WHERE player_id = ? AND is_active = 1`
    ).all(p.id).map(r => r.team_id);
  }
  return [];
}

// ─── GET /api/matches ─────────────────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const { team_id, status, upcoming } = req.query;
  const allowedTeams = teamIdsForUser(req.user);
  if (!allowedTeams.length) return res.json({ matches: [] });

  let sql = `
    SELECT m.*,
           t.name AS team_name,
           t.division,
           (SELECT COUNT(*) FROM match_lineups ml WHERE ml.match_id = m.id) AS lineup_count,
           (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id = m.team_id AND tp.is_active = 1) AS roster_size
    FROM matches m
    JOIN teams t ON t.id = m.team_id
    WHERE m.team_id IN (${allowedTeams.map(() => '?').join(',')})
  `;
  const params = [...allowedTeams];

  if (team_id) { sql += ` AND m.team_id = ?`; params.push(Number(team_id)); }
  if (status)  { sql += ` AND m.status = ?`;  params.push(status); }
  if (upcoming === 'true') {
    sql += ` AND m.status = 'scheduled' AND m.match_date >= datetime('now')`;
  }

  sql += ` ORDER BY m.match_date ASC`;
  const matches = db.prepare(sql).all(...params);
  res.json({ matches });
});

// ─── POST /api/matches ────────────────────────────────────────────────────────
router.post('/', authenticate, requireRole('admin', 'coach'), [
  body('team_id').isInt(),
  body('opponent').trim().notEmpty(),
  body('match_date').notEmpty(),
  body('home_away').optional().isIn(['home', 'away', 'neutral']),
  body('competition').optional().trim(),
  body('location').optional().trim(),
  body('notes').optional().trim(),
], (req, res) => {
  if (validationErrors(req, res)) return;
  const { team_id, opponent, match_date, home_away = 'home', competition, location, notes } = req.body;

  const allowed = teamIdsForUser(req.user);
  if (!allowed.includes(Number(team_id))) {
    return res.status(403).json({ error: 'Not authorised for this team' });
  }

  const result = db.prepare(`
    INSERT INTO matches (team_id, opponent, match_date, home_away, competition, location, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(team_id, opponent, match_date, home_away, competition ?? null, location ?? null, notes ?? null, req.user.id);

  const match = db.prepare(`
    SELECT m.*, t.name AS team_name FROM matches m JOIN teams t ON t.id = m.team_id WHERE m.id = ?
  `).get(result.lastInsertRowid);

  // Notify all players on the team's roster
  const roster = db.prepare(`
    SELECT p.user_id FROM team_players tp
    JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? AND tp.is_active = 1 AND p.user_id IS NOT NULL
  `).all(team_id);
  const io = req.app.get('io');
  roster.forEach(r => pushNotification(io, r.user_id, 'match_scheduled',
    '📅 New Match Scheduled',
    `${match.team_name} vs ${opponent} on ${new Date(match_date).toLocaleDateString()}`));

  res.status(201).json(match);
});

// ─── GET /api/matches/my ──────────────────────────────────────────────────────
// Player's next upcoming match + their lineup status
router.get('/my', authenticate, (req, res) => {
  const player = playerForUser(req.user.id);
  if (!player) return res.json({ match: null, role: null });

  const teamIds = teamIdsForUser(req.user);
  if (!teamIds.length) return res.json({ match: null, role: null });

  const match = db.prepare(`
    SELECT m.*, t.name AS team_name, t.division,
           (SELECT COUNT(*) FROM match_lineups ml WHERE ml.match_id = m.id AND ml.role = 'starter') AS starter_count,
           (SELECT COUNT(*) FROM match_lineups ml WHERE ml.match_id = m.id) AS lineup_count,
           (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id = m.team_id AND tp.is_active = 1) AS roster_size
    FROM matches m
    JOIN teams t ON t.id = m.team_id
    WHERE m.team_id IN (${teamIds.map(() => '?').join(',')})
      AND m.status = 'scheduled'
      AND m.match_date >= datetime('now')
    ORDER BY m.match_date ASC
    LIMIT 1
  `).get(...teamIds);

  if (!match) return res.json({ match: null, role: null });

  const lineup = db.prepare(
    `SELECT role, position, notes FROM match_lineups WHERE match_id = ? AND player_id = ?`
  ).get(match.id, player.id);

  res.json({ match, role: lineup?.role ?? null, position: lineup?.position ?? null });
});

// ─── GET /api/matches/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, (req, res) => {
  const match = db.prepare(`
    SELECT m.*, t.name AS team_name, t.division
    FROM matches m JOIN teams t ON t.id = m.team_id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!match) return res.status(404).json({ error: 'Match not found' });

  const allowed = teamIdsForUser(req.user);
  if (!allowed.includes(match.team_id)) return res.status(403).json({ error: 'Forbidden' });

  // Full lineup with player details
  const lineup = db.prepare(`
    SELECT ml.*, p.name AS player_name, p.position AS player_position, p.jersey_number
    FROM match_lineups ml
    JOIN players p ON p.id = ml.player_id
    WHERE ml.match_id = ?
    ORDER BY ml.role DESC, p.name ASC
  `).all(match.id);

  // Roster not yet in lineup
  const lineupPlayerIds = lineup.map(l => l.player_id);
  const rosterSql = `
    SELECT p.id, p.name, p.position, p.jersey_number
    FROM team_players tp
    JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? AND tp.is_active = 1
    ${lineupPlayerIds.length ? `AND p.id NOT IN (${lineupPlayerIds.map(() => '?').join(',')})` : ''}
    ORDER BY p.name ASC
  `;
  const unassigned = db.prepare(rosterSql).all(match.team_id, ...lineupPlayerIds);

  res.json({ ...match, lineup, unassigned });
});

// ─── PUT /api/matches/:id ─────────────────────────────────────────────────────
router.put('/:id', authenticate, requireRole('admin', 'coach'), [
  body('opponent').optional().trim().notEmpty(),
  body('match_date').optional().notEmpty(),
  body('home_away').optional().isIn(['home', 'away', 'neutral']),
  body('status').optional().isIn(['scheduled', 'completed', 'cancelled', 'postponed']),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const match = db.prepare(`SELECT * FROM matches WHERE id = ?`).get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const allowed = teamIdsForUser(req.user);
  if (!allowed.includes(match.team_id)) return res.status(403).json({ error: 'Forbidden' });

  const { opponent, match_date, home_away, competition, location, status, score_us, score_them, sets_us, sets_them, notes } = req.body;

  db.prepare(`
    UPDATE matches SET
      opponent    = COALESCE(?, opponent),
      match_date  = COALESCE(?, match_date),
      home_away   = COALESCE(?, home_away),
      competition = COALESCE(?, competition),
      location    = COALESCE(?, location),
      status      = COALESCE(?, status),
      score_us    = COALESCE(?, score_us),
      score_them  = COALESCE(?, score_them),
      sets_us     = COALESCE(?, sets_us),
      sets_them   = COALESCE(?, sets_them),
      notes       = COALESCE(?, notes),
      updated_at  = datetime('now')
    WHERE id = ?
  `).run(opponent ?? null, match_date ?? null, home_away ?? null, competition ?? null,
         location ?? null, status ?? null, score_us ?? null, score_them ?? null,
         sets_us ?? null, sets_them ?? null, notes ?? null, match.id);

  const updated = db.prepare(`
    SELECT m.*, t.name AS team_name FROM matches m JOIN teams t ON t.id = m.team_id WHERE m.id = ?
  `).get(match.id);
  res.json(updated);
});

// ─── DELETE /api/matches/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('admin', 'coach'), (req, res) => {
  const match = db.prepare(`SELECT * FROM matches WHERE id = ?`).get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const allowed = teamIdsForUser(req.user);
  if (!allowed.includes(match.team_id)) return res.status(403).json({ error: 'Forbidden' });

  db.prepare(`DELETE FROM matches WHERE id = ?`).run(match.id);
  res.json({ message: 'Deleted' });
});

// ─── POST /api/matches/:id/lineup ─────────────────────────────────────────────
// Bulk upsert: body = { lineup: [{ player_id, role, position, notes }, ...] }
router.post('/:id/lineup', authenticate, requireRole('admin', 'coach', 'assistant_coach'), (req, res) => {
  const match = db.prepare(`SELECT * FROM matches WHERE id = ?`).get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const allowed = teamIdsForUser(req.user);
  if (!allowed.includes(match.team_id)) return res.status(403).json({ error: 'Forbidden' });

  const { lineup } = req.body;
  if (!Array.isArray(lineup)) return res.status(422).json({ error: 'lineup must be an array' });

  const upsert = db.prepare(`
    INSERT INTO match_lineups (match_id, player_id, role, position, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(match_id, player_id) DO UPDATE SET
      role = excluded.role,
      position = excluded.position,
      notes = excluded.notes,
      created_by = excluded.created_by
  `);

  const remove = db.prepare(`DELETE FROM match_lineups WHERE match_id = ? AND player_id = ?`);

  db.transaction(() => {
    for (const entry of lineup) {
      if (entry.role === 'remove') {
        remove.run(match.id, entry.player_id);
      } else {
        upsert.run(match.id, entry.player_id, entry.role ?? 'substitute',
          entry.position ?? null, entry.notes ?? null, req.user.id);
      }
    }
  })();

  // Notify affected players
  const io = req.app.get('io');
  for (const entry of lineup) {
    if (entry.role === 'remove') continue;
    const player = db.prepare(`SELECT user_id, name FROM players WHERE id = ?`).get(entry.player_id);
    if (!player?.user_id) continue;
    const roleLabel = entry.role === 'starter' ? '🟢 Starting XI' : '🔵 Substitute';
    pushNotification(io, player.user_id, 'lineup_set',
      '📋 Lineup Updated',
      `You have been selected as ${roleLabel} for the match vs ${match.opponent}`);
  }

  // Return full updated lineup
  const updated = db.prepare(`
    SELECT ml.*, p.name AS player_name, p.position AS player_position, p.jersey_number
    FROM match_lineups ml
    JOIN players p ON p.id = ml.player_id
    WHERE ml.match_id = ?
    ORDER BY ml.role DESC, p.name ASC
  `).all(match.id);

  res.json({ lineup: updated });
});

module.exports = router;
