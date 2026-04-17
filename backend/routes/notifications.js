const express = require('express');

const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { is_read, limit = 50, page = 1 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `SELECT * FROM notifications WHERE user_id = ?`;
  const params = [req.user.id];

  if (is_read != null) {
    sql += ` AND is_read = ?`;
    params.push(is_read === 'true' ? 1 : 0);
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM (${sql})`).get(...params).n;
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const notifications = db.prepare(sql).all(...params).map((notification) => ({
    ...notification,
    is_read: Boolean(notification.is_read),
  }));

  res.json({
    notifications,
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

router.patch('/:id/read', (req, res) => {
  const notificationId = Number(req.params.id);
  const notification = db.prepare(`
    SELECT *
    FROM notifications
    WHERE id = ? AND user_id = ?
  `).get(notificationId, req.user.id);

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE id = ?
  `).run(notificationId);

  res.json({ message: 'Notification marked as read' });
});

router.post('/read-all', (req, res) => {
  db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE user_id = ?
  `).run(req.user.id);

  res.json({ message: 'All notifications marked as read' });
});

module.exports = router;
