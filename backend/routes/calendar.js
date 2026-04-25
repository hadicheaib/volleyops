const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Helper: get/create calendar token for a user ────────────────────────────
function getOrCreateToken(userId) {
  let row = db.prepare(`SELECT token FROM calendar_tokens WHERE user_id = ?`).get(userId);
  if (!row) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(`INSERT INTO calendar_tokens (user_id, token) VALUES (?, ?)`).run(userId, token);
    row = { token };
  }
  return row.token;
}

// ─── Helper: get team IDs for a user ─────────────────────────────────────────
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
    const p = db.prepare(`SELECT id FROM players WHERE user_id = ?`).get(user.id);
    if (!p) return [];
    return db.prepare(
      `SELECT team_id FROM team_players WHERE player_id = ? AND is_active = 1`
    ).all(p.id).map(r => r.team_id);
  }
  return [];
}

// ─── Format date for iCal: 20250308T100000Z ──────────────────────────────────
function toICalDate(iso, durationHours = 2) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (date) =>
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  const start = fmt(d);
  const end = fmt(new Date(d.getTime() + durationHours * 3600000));
  return { start, end };
}

// ─── Escape iCal text ────────────────────────────────────────────────────────
function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// ─── Build iCal content ───────────────────────────────────────────────────────
function buildICal(userId) {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
  if (!user) return null;

  const teamIds = teamIdsForUser(user);
  if (!teamIds.length) {
    return buildICalString(user.name, []);
  }

  const ph = teamIds.map(() => '?').join(',');

  // Matches
  const matches = db.prepare(`
    SELECT m.id, m.opponent, m.match_date, m.location, m.home_away, m.competition,
           t.name AS team_name
    FROM matches m
    JOIN teams t ON t.id = m.team_id
    WHERE m.team_id IN (${ph}) AND m.status IN ('scheduled','completed')
    ORDER BY m.match_date ASC
  `).all(...teamIds);

  // Training sessions
  const sessions = db.prepare(`
    SELECT ts.id, ts.date, ts.title, ts.type, ts.notes, t.name AS team_name
    FROM training_sessions ts
    JOIN teams t ON t.id = ts.team_id
    WHERE ts.team_id IN (${ph})
    ORDER BY ts.date ASC
  `).all(...teamIds);

  const events = [];

  for (const m of matches) {
    const { start, end } = toICalDate(m.match_date, 2);
    const summary = `${esc(m.team_name)} vs ${esc(m.opponent)}`;
    const desc = [
      m.competition ? `Competition: ${m.competition}` : '',
      m.home_away   ? `Type: ${m.home_away}` : '',
      m.location    ? `Location: ${m.location}` : '',
    ].filter(Boolean).join('\\n');
    events.push({
      uid: `match-${m.id}@volleyops`,
      start, end,
      summary,
      description: desc,
      location: m.location || '',
    });
  }

  for (const s of sessions) {
    const { start, end } = toICalDate(s.date, 1.5);
    const summary = s.title
      ? `[${s.type}] ${esc(s.title)} – ${esc(s.team_name)}`
      : `[${s.type}] ${esc(s.team_name)}`;
    events.push({
      uid: `session-${s.id}@volleyops`,
      start, end,
      summary,
      description: s.notes ? esc(s.notes) : '',
      location: '',
    });
  }

  return buildICalString(user.name, events);
}

function buildICalString(calName, events) {
  const now = toICalDate(new Date().toISOString(), 0).start;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VolleyOps//VolleyOps Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:VolleyOps – ${esc(calName)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const ev of events) {
    lines.push(...[
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${ev.start}`,
      `DTEND:${ev.end}`,
      `SUMMARY:${ev.summary}`,
      ev.description ? `DESCRIPTION:${ev.description}` : null,
      ev.location    ? `LOCATION:${esc(ev.location)}`   : null,
      'END:VEVENT',
    ].filter(Boolean));
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ─── GET /api/calendar/token ──────────────────────────────────────────────────
// Returns the user's calendar subscription token (creates one if absent)
router.get('/token', authenticate, (req, res) => {
  const token = getOrCreateToken(req.user.id);
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const feedUrl = `${protocol}://${host}/api/calendar/feed/${token}`;
  const webcalUrl = feedUrl.replace(/^https?/, 'webcal');
  res.json({ token, feed_url: feedUrl, webcal_url: webcalUrl });
});

// ─── GET /api/calendar/feed/:token ───────────────────────────────────────────
// Public: returns iCal file for the user associated with the token
router.get('/feed/:token', (req, res) => {
  const { token } = req.params;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).send('Invalid token');
  }
  const row = db.prepare(`SELECT user_id FROM calendar_tokens WHERE token = ?`).get(token);
  if (!row) return res.status(404).send('Not found');

  const ical = buildICal(row.user_id);
  if (!ical) return res.status(404).send('User not found');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="volleyops.ics"');
  res.send(ical);
});

module.exports = router;
