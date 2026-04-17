const express = require('express');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
}

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function isConversationMember(conversationId, userId) {
  return Boolean(db.prepare(`
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = ? AND user_id = ?
  `).get(conversationId, userId));
}

function getConversationMembers(conversationId) {
  return db.prepare(`
    SELECT u.id, u.name, u.email
    FROM conversation_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.conversation_id = ?
    ORDER BY u.name ASC
  `).all(conversationId);
}

function notifyRecipients(io, recipientIds, title, body, relatedId) {
  for (const userId of recipientIds) {
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, body, related_type, related_id)
      VALUES (?, 'message', ?, ?, 'conversation', ?)
    `).run(userId, title, body, relatedId);

    io.to(`user:${userId}`).emit('notification', {
      type: 'message',
      title,
      body,
      relatedType: 'conversation',
      relatedId,
    });
  }
}

function canManageTeamConversation(user, team) {
  if (user.role === 'admin') return true;
  if (user.role === 'coach') return team.coach_id === user.id;
  if (user.role === 'assistant_coach') return team.assistant_coach_id === user.id;
  return false;
}

router.get('/conversations', (req, res) => {
  const conversations = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.type,
      c.team_id,
      c.created_at,
      COALESCE(
        c.name,
        t.name,
        CASE WHEN c.type = 'direct' THEN (
          SELECT u2.name
          FROM conversation_members cm2
          JOIN users u2 ON u2.id = cm2.user_id
          WHERE cm2.conversation_id = c.id AND cm2.user_id != ?
          LIMIT 1
        ) END
      ) AS display_name,
      (
        SELECT m.content
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message,
      (
        SELECT m.created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message_at,
      (
        SELECT COUNT(*)
        FROM messages m
        LEFT JOIN message_reads mr
          ON mr.message_id = m.id
         AND mr.user_id = ?
        WHERE m.conversation_id = c.id
          AND m.sender_id != ?
          AND mr.id IS NULL
      ) AS unread_count
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id
    LEFT JOIN teams t ON t.id = c.team_id
    WHERE cm.user_id = ?
    ORDER BY COALESCE(last_message_at, c.created_at) DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id);

  res.json({ conversations });
});

router.post('/conversations', [
  body('type').isIn(['direct', 'group', 'team', 'broadcast']),
  body('name').optional({ nullable: true }).trim(),
  body('teamId').optional({ nullable: true }).isInt({ min: 1 }),
  body('memberIds').optional().isArray(),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const { type, name = null, teamId = null } = req.body;
  let memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(Number) : [];

  if (type === 'broadcast' && !['admin', 'coach'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only admins and coaches can create broadcasts' });
  }

  if (type === 'team') {
    if (!teamId) return res.status(400).json({ error: 'teamId is required for team conversations' });
    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(Number(teamId));
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!canManageTeamConversation(req.user, team)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rosterUsers = db.prepare(`
      SELECT p.user_id
      FROM team_players tp
      JOIN players p ON p.id = tp.player_id
      WHERE tp.team_id = ? AND tp.is_active = 1 AND p.user_id IS NOT NULL
    `).all(Number(teamId)).map((row) => row.user_id);

    memberIds = [
      ...rosterUsers,
      team.coach_id,
      team.assistant_coach_id,
    ].filter(Boolean);
  }

  memberIds = [...new Set([req.user.id, ...memberIds])];
  if (memberIds.length < 2) {
    return res.status(400).json({ error: 'A conversation requires at least two members' });
  }

  const createConversation = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO conversations (name, type, team_id, created_by)
      VALUES (?, ?, ?, ?)
    `).run(name, type, teamId, req.user.id);

    const conversationId = result.lastInsertRowid;
    const insertMember = db.prepare(`
      INSERT INTO conversation_members (conversation_id, user_id)
      VALUES (?, ?)
    `);

    for (const memberId of memberIds) {
      insertMember.run(conversationId, memberId);
    }

    return conversationId;
  });

  const conversationId = createConversation();
  res.status(201).json({
    conversation: db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId),
    members: getConversationMembers(conversationId),
  });
});

router.get('/conversations/:id/messages', (req, res) => {
  const conversationId = Number(req.params.id);
  if (!isConversationMember(conversationId, req.user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const messages = db.prepare(`
    SELECT
      m.*,
      u.name AS sender_name,
      u.role AS sender_role
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(conversationId);

  res.json({
    conversation: db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId),
    members: getConversationMembers(conversationId),
    messages,
  });
});

router.post('/conversations/:id/messages', [
  body('content').trim().notEmpty(),
  body('attachment_name').optional({ nullable: true }).trim(),
  body('attachment_url').optional({ nullable: true }).trim(),
  body('is_announcement').optional().isBoolean(),
  body('send_email').optional().isBoolean(),
], async (req, res) => {
  if (validationErrors(req, res)) return;

  const conversationId = Number(req.params.id);
  if (!isConversationMember(conversationId, req.user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const {
    content,
    attachment_name = null,
    attachment_url = null,
    is_announcement = false,
    send_email = false,
  } = req.body;

  const result = db.prepare(`
    INSERT INTO messages (
      conversation_id, sender_id, content, attachment_name, attachment_url, is_announcement
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    conversationId,
    req.user.id,
    content,
    attachment_name,
    attachment_url,
    is_announcement ? 1 : 0,
  );

  const message = db.prepare(`
    SELECT m.*, u.name AS sender_name, u.role AS sender_role
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  db.prepare(`
    INSERT OR IGNORE INTO message_reads (message_id, user_id)
    VALUES (?, ?)
  `).run(message.id, req.user.id);

  const members = getConversationMembers(conversationId);
  const recipientIds = members
    .filter((member) => member.id !== req.user.id)
    .map((member) => member.id);

  const io = req.app.get('io');
  io.to(`conv:${conversationId}`).emit('message_created', message);
  notifyRecipients(
    io,
    recipientIds,
    `New message from ${req.user.name}`,
    content.slice(0, 140),
    conversationId,
  );

  let emailSent = false;
  if (send_email) {
    const transporter = getTransporter();
    const recipients = members
      .filter((member) => member.id !== req.user.id && member.email)
      .map((member) => member.email);

    if (transporter && recipients.length > 0) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.SMTP_USER,
          to: recipients.join(','),
          subject: `VolleyOps message from ${req.user.name}`,
          text: content,
          html: `<p>${content}</p>`,
        });
        emailSent = true;
      } catch (error) {
        emailSent = false;
      }
    }
  }

  res.status(201).json({ message, emailSent });
});

router.post('/conversations/:id/read', (req, res) => {
  const conversationId = Number(req.params.id);
  if (!isConversationMember(conversationId, req.user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare(`
    INSERT OR IGNORE INTO message_reads (message_id, user_id)
    SELECT m.id, ?
    FROM messages m
    WHERE m.conversation_id = ?
  `).run(req.user.id, conversationId);

  res.json({ message: 'Conversation marked as read' });
});

module.exports = router;
