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

module.exports = router;
