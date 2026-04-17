const express = require('express');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return true; }
  return false;
}

// GET /api/notes  — all notes for the current user
router.get('/', (req, res) => {
  const notes = db.prepare(
    `SELECT id, title, content, created_at, updated_at
     FROM user_notes WHERE user_id = ? ORDER BY updated_at DESC`
  ).all(req.user.id);
  res.json({ notes });
});

// POST /api/notes
router.post('/', [
  body('title').optional().trim(),
  body('content').optional().trim(),
], (req, res) => {
  if (validationErrors(req, res)) return;
  const { title = 'Untitled Note', content = '' } = req.body;
  const result = db.prepare(
    `INSERT INTO user_notes (user_id, title, content) VALUES (?, ?, ?)`
  ).run(req.user.id, title, content);
  const note = db.prepare(`SELECT * FROM user_notes WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(note);
});

// PUT /api/notes/:id
router.put('/:id', [
  body('title').optional().trim(),
  body('content').optional().trim(),
], (req, res) => {
  if (validationErrors(req, res)) return;
  const id = Number(req.params.id);
  const note = db.prepare(`SELECT * FROM user_notes WHERE id = ? AND user_id = ?`).get(id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const title   = req.body.title   !== undefined ? req.body.title   : note.title;
  const content = req.body.content !== undefined ? req.body.content : note.content;

  db.prepare(
    `UPDATE user_notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, content, id);
  res.json(db.prepare(`SELECT * FROM user_notes WHERE id = ?`).get(id));
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const note = db.prepare(`SELECT id FROM user_notes WHERE id = ? AND user_id = ?`).get(id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  db.prepare(`DELETE FROM user_notes WHERE id = ?`).run(id);
  res.json({ message: 'Note deleted' });
});

module.exports = router;
