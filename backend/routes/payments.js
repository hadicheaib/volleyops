const express = require('express');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

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

function notifyUser(io, userId, title, body, relatedType, relatedId) {
  if (!io || !userId) return;
  db.prepare(`
    INSERT INTO notifications (user_id, type, title, body, related_type, related_id)
    VALUES (?, 'payment', ?, ?, ?, ?)
  `).run(userId, title, body, relatedType ?? null, relatedId ?? null);

  io.to(`user:${userId}`).emit('notification', {
    type: 'payment',
    title,
    body,
    relatedType,
    relatedId,
  });
}

function buildPaymentScope(user, params) {
  // Coaches, assistant coaches, and players all see only their own payments.
  // Only admins see all payments.
  if (user.role !== 'admin') {
    params.push(user.id);
    return ` AND p.user_id = ?`;
  }
  return '';
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

router.get('/plans', (req, res) => {
  const { active } = req.query;
  let sql = `SELECT * FROM payment_plans WHERE 1 = 1`;
  const params = [];

  if (active != null) {
    sql += ` AND is_active = ?`;
    params.push(active === 'true' ? 1 : 0);
  }

  sql += ` ORDER BY total_amount ASC, name ASC`;
  res.json({ plans: db.prepare(sql).all(...params) });
});

router.post('/plans', requireRole('admin'), [
  body('name').trim().notEmpty(),
  body('description').optional({ nullable: true }).trim(),
  body('total_amount').isFloat({ gt: 0 }),
  body('installment_count').optional().isInt({ min: 1, max: 24 }),
  body('interval_days').optional().isInt({ min: 1, max: 365 }),
  body('is_active').optional().isBoolean(),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const {
    name,
    description = null,
    total_amount,
    installment_count = 1,
    interval_days = 30,
    is_active = true,
  } = req.body;

  const result = db.prepare(`
    INSERT INTO payment_plans (name, description, total_amount, installment_count, interval_days, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, description, total_amount, installment_count, interval_days, is_active ? 1 : 0);

  res.status(201).json(db.prepare(`SELECT * FROM payment_plans WHERE id = ?`).get(result.lastInsertRowid));
});

router.post('/assign-plan', requireRole('admin'), [
  body('playerId').isInt({ min: 1 }),
  body('planId').isInt({ min: 1 }),
  body('firstDueDate').optional().isISO8601(),
  body('description').optional({ nullable: true }).trim(),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const { playerId, planId, firstDueDate, description = null } = req.body;
  const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(Number(playerId));
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const plan = db.prepare(`SELECT * FROM payment_plans WHERE id = ? AND is_active = 1`).get(Number(planId));
  if (!plan) return res.status(404).json({ error: 'Payment plan not found' });

  const baseDate = firstDueDate ? new Date(firstDueDate) : new Date();
  const installmentCount = Number(plan.installment_count);
  const rawInstallment = Number(plan.total_amount) / installmentCount;

  const createPlan = db.transaction(() => {
    const payments = [];
    let amountAllocated = 0;

    for (let installmentNumber = 1; installmentNumber <= installmentCount; installmentNumber += 1) {
      let amount = Number(rawInstallment.toFixed(2));
      if (installmentNumber === installmentCount) {
        amount = Number((Number(plan.total_amount) - amountAllocated).toFixed(2));
      }
      amountAllocated += amount;

      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + ((installmentNumber - 1) * Number(plan.interval_days)));

      const result = db.prepare(`
        INSERT INTO payments (
          player_id, plan_id, amount, description, due_date, status, installment_number
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        player.id,
        plan.id,
        amount,
        description || `${plan.name} installment ${installmentNumber}/${installmentCount}`,
        dueDate.toISOString(),
        installmentNumber,
      );

      payments.push(db.prepare(`SELECT * FROM payments WHERE id = ?`).get(result.lastInsertRowid));
    }

    return payments;
  });

  const payments = createPlan();
  notifyUser(
    req.app.get('io'),
    player.user_id,
    'Payment Plan Assigned',
    `${plan.name} has been assigned to your account.`,
    'player',
    player.id,
  );

  res.status(201).json({ player, plan, payments });
});

router.get('/', (req, res) => {
  const {
    status,
    player_id,
    team_id,
    overdue_only,
    page = 1,
    limit = 50,
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);
  let sql = `
    SELECT
      pay.*,
      p.name AS player_name,
      p.email AS player_email,
      p.user_id AS player_user_id,
      t.id AS team_id,
      t.name AS team_name,
      plan.name AS plan_name
    FROM payments pay
    JOIN players p ON p.id = pay.player_id
    LEFT JOIN team_players tp ON tp.player_id = p.id AND tp.is_active = 1
    LEFT JOIN teams t ON t.id = tp.team_id
    LEFT JOIN payment_plans plan ON plan.id = pay.plan_id
    WHERE 1 = 1
  `;
  const params = [];

  sql += buildPaymentScope(req.user, params);

  if (status) {
    sql += ` AND pay.status = ?`;
    params.push(status);
  }

  if (player_id) {
    sql += ` AND pay.player_id = ?`;
    params.push(Number(player_id));
  }

  if (team_id) {
    sql += ` AND t.id = ?`;
    params.push(Number(team_id));
  }

  if (overdue_only === 'true') {
    sql += ` AND (pay.status = 'overdue' OR (pay.status = 'pending' AND pay.due_date IS NOT NULL AND pay.due_date < datetime('now')))`;
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM (${sql})`).get(...params).n;
  sql += ` ORDER BY pay.due_date ASC, pay.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);

  const payments = db.prepare(sql).all(...params).map((payment) => ({
    ...payment,
    overdue:
      payment.status === 'overdue' ||
      (payment.status === 'pending' && payment.due_date && new Date(payment.due_date) < new Date()),
  }));

  res.json({
    payments,
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

router.get('/summary', (req, res) => {
  let sql = `
    SELECT pay.*
    FROM payments pay
    JOIN players p ON p.id = pay.player_id
    LEFT JOIN team_players tp ON tp.player_id = p.id AND tp.is_active = 1
    LEFT JOIN teams t ON t.id = tp.team_id
    WHERE 1 = 1
  `;
  const params = [];
  sql += buildPaymentScope(req.user, params);

  const payments = db.prepare(sql).all(...params);
  const summary = payments.reduce((acc, payment) => {
    acc.total_amount += Number(payment.amount || 0);
    if (payment.status === 'paid') acc.paid_amount += Number(payment.amount || 0);
    if (payment.status === 'pending') acc.pending_amount += Number(payment.amount || 0);
    if (payment.status === 'overdue') acc.overdue_amount += Number(payment.amount || 0);
    acc.status_counts[payment.status] = (acc.status_counts[payment.status] || 0) + 1;
    return acc;
  }, {
    total_amount: 0,
    paid_amount: 0,
    pending_amount: 0,
    overdue_amount: 0,
    status_counts: {},
  });

  summary.completion_rate = summary.total_amount
    ? Number(((summary.paid_amount / summary.total_amount) * 100).toFixed(1))
    : 0;

  res.json(summary);
});

router.patch('/:id/status', requireRole('admin'), [
  body('status').isIn(['pending', 'paid', 'overdue', 'cancelled']),
  body('paid_at').optional({ nullable: true }).isISO8601(),
], (req, res) => {
  if (validationErrors(req, res)) return;

  const paymentId = Number(req.params.id);
  const payment = db.prepare(`
    SELECT pay.*, p.user_id
    FROM payments pay
    JOIN players p ON p.id = pay.player_id
    WHERE pay.id = ?
  `).get(paymentId);

  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const paidAt = req.body.status === 'paid'
    ? (req.body.paid_at || new Date().toISOString())
    : null;

  db.prepare(`
    UPDATE payments
    SET status = ?, paid_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(req.body.status, paidAt, paymentId);

  if (payment.user_id) {
    const message = req.body.status === 'paid'
      ? `Your payment of $${payment.amount} has been marked as paid.`
      : `Your payment status is now "${req.body.status}".`;
    notifyUser(
      req.app.get('io'),
      payment.user_id,
      'Payment Status Updated',
      message,
      'payment',
      paymentId,
    );
  }

  res.json(db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId));
});

router.post('/:id/remind', requireRole('admin', 'coach'), async (req, res) => {
  const paymentId = Number(req.params.id);
  const payment = db.prepare(`
    SELECT
      pay.*,
      p.name AS player_name,
      p.email AS player_email,
      p.user_id AS player_user_id,
      t.id AS team_id,
      t.name AS team_name,
      t.coach_id
    FROM payments pay
    JOIN players p ON p.id = pay.player_id
    LEFT JOIN team_players tp ON tp.player_id = p.id AND tp.is_active = 1
    LEFT JOIN teams t ON t.id = tp.team_id
    WHERE pay.id = ?
  `).get(paymentId);

  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (req.user.role === 'coach' && payment.coach_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const title = 'Payment Reminder';
  const bodyText = `Reminder: ${payment.player_name} has an outstanding payment of $${payment.amount}${payment.due_date ? ` due ${new Date(payment.due_date).toLocaleDateString()}` : ''}.`;

  notifyUser(
    req.app.get('io'),
    payment.player_user_id,
    title,
    bodyText,
    'payment',
    paymentId,
  );

  let emailSent = false;
  const transporter = getTransporter();
  if (transporter && payment.player_email) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: payment.player_email,
        subject: `${title} - ${payment.team_name || 'VolleyOps'}`,
        text: bodyText,
        html: `<p>${bodyText}</p>`,
      });
      emailSent = true;
    } catch (error) {
      emailSent = false;
    }
  }

  res.json({
    message: 'Reminder sent',
    emailSent,
  });
});

module.exports = router;
