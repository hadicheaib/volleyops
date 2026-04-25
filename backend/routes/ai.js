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

function buildFallbackSuggestion({ prompt, formation, markers, matchContext }) {
  const lowerPrompt = (prompt || '').toLowerCase();
  const ourMarkers = (markers || []).filter((marker) => marker.team === 'our');
  const oppMarkers = (markers || []).filter((marker) => marker.team === 'opp');
  const contextBits = [];

  if (matchContext?.rotation) contextBits.push(`Current rotation: ${matchContext.rotation}`);
  if (matchContext?.score) contextBits.push(`Score context: ${matchContext.score}`);
  if (matchContext?.serveReceive) contextBits.push(`Serve receive focus: ${matchContext.serveReceive}`);

  const suggestions = [];

  if (lowerPrompt.includes('serve')) {
    suggestions.push('Target deep zone 1 with a fast float serve to force the opponent setter off the net.');
  }

  if (lowerPrompt.includes('receive') || lowerPrompt.includes('serve-receive')) {
    suggestions.push('Use a three-player receive lane and release the setter early to keep your side-out tempo stable.');
  }

  if (lowerPrompt.includes('rotation')) {
    suggestions.push(`In ${formation || 'the current'} formation, keep the setter one step inside so the second-ball path stays shorter and cleaner.`);
  }

  if (lowerPrompt.includes('block') || lowerPrompt.includes('counter')) {
    suggestions.push('Shift the middle blocker half a step toward zone 2 and pre-load the libero toward zone 6 for soft-block coverage.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Tighten your right-side defensive spacing and start the libero slightly deeper in zone 6 to improve dig coverage.');
    suggestions.push('If the opponent is in-system, commit the middle only on visible quick tempo and prioritize sealing cross-court first.');
  }

  return {
    source: 'fallback',
    summary: `Analyzed ${ourMarkers.length} of your players and ${oppMarkers.length} opponent markers on a ${formation || 'custom'} board.`,
    suggestions,
    context: contextBits,
  };
}

async function generateAnthropicSuggestion(payload) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stateSummary = JSON.stringify({
    formation: payload.formation,
    markers: payload.markers,
    arrows: payload.arrows,
    zones: payload.zones,
    matchContext: payload.matchContext,
  });

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
    max_tokens: 500,
    system: [
      'You are a volleyball tactics assistant for club coaches.',
      'Return concise tactical recommendations focused on rotations, serve-receive, blocking, and counter-tactics.',
      'Avoid generic motivational language. Be concrete and practical.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: `Coach prompt: ${payload.prompt}\n\nBoard state:\n${stateSummary}`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) return null;

  return {
    source: 'anthropic',
    summary: 'Generated with Anthropic based on the submitted board state.',
    suggestions: [text],
    context: [],
  };
}

router.post('/suggest', [
  body('prompt').trim().notEmpty(),
  body('boardId').optional({ nullable: true }).isInt({ min: 1 }),
  body('markers').optional().isArray(),
  body('arrows').optional().isArray(),
  body('zones').optional().isArray(),
  body('formation').optional().isString(),
  body('matchContext').optional().isObject(),
], async (req, res) => {
  if (validationErrors(req, res)) return;

  let boardId = req.body.boardId ? Number(req.body.boardId) : null;
  let boardState = {
    markers: req.body.markers || [],
    arrows: req.body.arrows || [],
    zones: req.body.zones || [],
    formation: req.body.formation || '6-2',
    matchContext: req.body.matchContext || {},
  };

  if (boardId) {
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
    const canAccess = req.user.role === 'admin'
      || board.created_by === req.user.id
      || board.coach_id === req.user.id
      || board.assistant_coach_id === req.user.id;

    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    boardState = {
      markers: JSON.parse(board.markers || '[]'),
      arrows: JSON.parse(board.arrows || '[]'),
      zones: JSON.parse(board.zones || '[]'),
      formation: board.formation,
      matchContext: JSON.parse(board.match_context || '{}'),
    };
  }

  let suggestion;
  try {
    suggestion = await generateAnthropicSuggestion({
      prompt: req.body.prompt,
      ...boardState,
    });
  } catch (error) {
    suggestion = null;
  }

  if (!suggestion) {
    suggestion = buildFallbackSuggestion({
      prompt: req.body.prompt,
      ...boardState,
    });
  }

  const responseText = [suggestion.summary, ...suggestion.suggestions].join('\n\n');
  const historyResult = db.prepare(`
    INSERT INTO ai_suggestions (board_id, user_id, prompt, response, board_state)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    boardId,
    req.user.id,
    req.body.prompt,
    responseText,
    JSON.stringify(boardState),
  );

  res.json({
    suggestionId: historyResult.lastInsertRowid,
    ...suggestion,
  });
});

// ─── POST /api/ai/team-placement ──────────────────────────────────────────────
// Given a list of evaluated players + available teams, suggest assignments.
// Body: { tryout_id?, player_ids?, team_ids? }
// Returns: { placements: [{ player_id, player_name, suggested_team_id, suggested_team_name, reasoning, confidence }], source }
router.post('/team-placement', authenticate, requireRole('admin', 'coach'), [
  body('tryout_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('player_ids').optional().isArray(),
  body('team_ids').optional().isArray(),
], async (req, res) => {
  if (validationErrors(req, res)) return;

  const { tryout_id, player_ids, team_ids } = req.body;

  // Load players with their evaluation averages
  let playerFilter = '';
  const pParams = [];
  if (tryout_id) {
    playerFilter = `AND e.tryout_id = ?`;
    pParams.push(Number(tryout_id));
  }
  if (player_ids && player_ids.length) {
    playerFilter += ` AND e.player_id IN (${player_ids.map(() => '?').join(',')})`;
    pParams.push(...player_ids.map(Number));
  }

  const players = db.prepare(`
    SELECT p.id, p.name, p.position,
           ROUND(AVG(e.serving),1)      AS serving,
           ROUND(AVG(e.passing),1)      AS passing,
           ROUND(AVG(e.setting),1)      AS setting,
           ROUND(AVG(e.hitting),1)      AS hitting,
           ROUND(AVG(e.blocking),1)     AS blocking,
           ROUND(AVG(e.defense),1)      AS defense,
           ROUND(AVG(e.athleticism),1)  AS athleticism,
           ROUND(AVG(e.coachability),1) AS coachability,
           ROUND(
             (COALESCE(AVG(e.serving),0)+COALESCE(AVG(e.passing),0)+COALESCE(AVG(e.setting),0)+
              COALESCE(AVG(e.hitting),0)+COALESCE(AVG(e.blocking),0)+COALESCE(AVG(e.defense),0)+
              COALESCE(AVG(e.athleticism),0)+COALESCE(AVG(e.coachability),0)) / 8.0, 1
           ) AS overall
    FROM player_evaluations e
    JOIN players p ON p.id = e.player_id
    WHERE 1=1 ${playerFilter}
    GROUP BY e.player_id
    ORDER BY overall DESC
  `).all(...pParams);

  if (!players.length) {
    return res.status(400).json({ error: 'No evaluated players found. Run evaluations first.' });
  }

  // Load available teams
  let teams;
  if (team_ids && team_ids.length) {
    const placeholders = team_ids.map(() => '?').join(',');
    teams = db.prepare(`SELECT id, name, division, max_players FROM teams WHERE id IN (${placeholders})`).all(...team_ids.map(Number));
  } else {
    teams = db.prepare(`SELECT id, name, division, max_players FROM teams`).all();
  }

  if (!teams.length) {
    return res.status(400).json({ error: 'No teams available for placement.' });
  }

  // Try AI placement
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const prompt = [
        `You are a volleyball team placement assistant. Based on the following player evaluations and available teams, suggest the best team placement for each player.`,
        ``,
        `Players (with skill scores 1-10, null means not evaluated):`,
        ...players.map(p =>
          `- ${p.name} (${p.position || 'unspecified'}, overall: ${p.overall}): ` +
          `serving=${p.serving}, passing=${p.passing}, setting=${p.setting}, hitting=${p.hitting}, ` +
          `blocking=${p.blocking}, defense=${p.defense}, athleticism=${p.athleticism}, coachability=${p.coachability}`
        ),
        ``,
        `Available teams:`,
        ...teams.map(t => `- Team ID ${t.id}: "${t.name}" (${t.division || 'no division'}, max ${t.max_players} players)`),
        ``,
        `Return a JSON array ONLY — no markdown, no prose — like:`,
        `[{"player_id":1,"suggested_team_id":2,"reasoning":"...","confidence":"high|medium|low"}]`,
        `Assign every player to exactly one team. Balance team sizes and skill levels where possible.`,
      ].join('\n');

      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      let parsed;
      try {
        // Strip any accidental markdown fences
        const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = null;
      }

      if (Array.isArray(parsed)) {
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));
        const placements = parsed.map(item => ({
          ...item,
          suggested_team_name: teamMap[item.suggested_team_id] || null,
          player_name: players.find(p => p.id === item.player_id)?.name || null,
        }));
        return res.json({ placements, source: 'anthropic' });
      }
    } catch (err) {
      console.error('AI team placement error:', err.message);
    }
  }

  // Fallback: round-robin by overall score descending
  const sorted = [...players].sort((a, b) => (b.overall || 0) - (a.overall || 0));
  const placements = sorted.map((p, i) => {
    const team = teams[i % teams.length];
    return {
      player_id: p.id,
      player_name: p.name,
      suggested_team_id: team.id,
      suggested_team_name: team.name,
      reasoning: `Assigned by skill score ranking (overall: ${p.overall ?? 'N/A'}).`,
      confidence: 'medium',
    };
  });

  res.json({ placements, source: 'fallback' });
});

module.exports = router;

