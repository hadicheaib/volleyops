/**
 * VolleyOps — Seed Script
 * Run: node seed.js
 * Wipes existing data and inserts rich mock data.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('./db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) { return daysFromNow(-n); }

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Wipe ─────────────────────────────────────────────────────────────────────

console.log('🗑  Clearing existing data…');
db.exec(`
  DELETE FROM ai_suggestions;
  DELETE FROM message_reads;
  DELETE FROM messages;
  DELETE FROM conversation_members;
  DELETE FROM conversations;
  DELETE FROM notifications;
  DELETE FROM payments;
  DELETE FROM payment_plans;
  DELETE FROM team_players;
  DELETE FROM player_stats;
  DELETE FROM standings;
  DELETE FROM tactics_boards;
  DELETE FROM teams;
  DELETE FROM players;
  DELETE FROM refresh_tokens;
  DELETE FROM users;
`);

// ─── USERS ────────────────────────────────────────────────────────────────────

console.log('👤  Seeding users…');

const HASH = bcrypt.hashSync('Admin123!', 10);
const COACH_HASH = bcrypt.hashSync('Coach123!', 10);
const PLAYER_HASH = bcrypt.hashSync('Player123!', 10);

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, 1, ?, ?)
`);

const now = new Date().toISOString();

// Admin
const adminId = insertUser.run('Admin User', 'admin@volleyops.com', HASH, 'admin', now, now).lastInsertRowid;

// Coaches
const coach1Id = insertUser.run('Karim Mansour',    'karim.mansour@volleyops.com',  COACH_HASH, 'coach', now, now).lastInsertRowid;
const coach2Id = insertUser.run('Rania Khalil',     'rania.khalil@volleyops.com',   COACH_HASH, 'coach', now, now).lastInsertRowid;
const coach3Id = insertUser.run('Fadi Kallas',      'fadi.kallas@volleyops.com',    COACH_HASH, 'coach', now, now).lastInsertRowid;
const coach4Id = insertUser.run('Maya Harb',        'maya.harb@volleyops.com',      COACH_HASH, 'coach', now, now).lastInsertRowid;

// Assistant coaches
const asst1Id = insertUser.run('Omar Farhat',       'omar.farhat@volleyops.com',    COACH_HASH, 'assistant_coach', now, now).lastInsertRowid;
const asst2Id = insertUser.run('Lara Saad',         'lara.saad@volleyops.com',      COACH_HASH, 'assistant_coach', now, now).lastInsertRowid;
const asst3Id = insertUser.run('Nour Khoury',       'nour.khoury@volleyops.com',    COACH_HASH, 'assistant_coach', now, now).lastInsertRowid;

// Player-linked users (for messaging)
const uHadi   = insertUser.run('Hadi Cheaib',       'hadi.cheaib@volleyops.com',    PLAYER_HASH, 'player', now, now).lastInsertRowid;
const uAli    = insertUser.run('Ali Naji',          'ali.naji@volleyops.com',       PLAYER_HASH, 'player', now, now).lastInsertRowid;
const uHassan = insertUser.run('Hassan Fouani',     'hassan.fouani@volleyops.com',  PLAYER_HASH, 'player', now, now).lastInsertRowid;
const uMajd   = insertUser.run('Majd Ayash',        'majd.ayash@volleyops.com',     PLAYER_HASH, 'player', now, now).lastInsertRowid;
const uYoussef= insertUser.run('Youssef Khoury',    'youssef.khoury@volleyops.com', PLAYER_HASH, 'player', now, now).lastInsertRowid;
const uJad    = insertUser.run('Jad Rahme',         'jad.rahme@volleyops.com',      PLAYER_HASH, 'player', now, now).lastInsertRowid;
const uTarek  = insertUser.run('Tarek Bitar',       'tarek.bitar@volleyops.com',    PLAYER_HASH, 'player', now, now).lastInsertRowid;
const uRami   = insertUser.run('Rami Abboud',       'rami.abboud@volleyops.com',    PLAYER_HASH, 'player', now, now).lastInsertRowid;

console.log('  ✓ Users created');

// ─── TEAMS ────────────────────────────────────────────────────────────────────
// Teams created BEFORE players so players can reference team_id

console.log('🏆  Seeding teams…');

const insertTeam = db.prepare(`
  INSERT INTO teams (name, division, season, coach_id, assistant_coach_id,
                     is_finalized, roster_published, max_players, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const team1Id = insertTeam.run('Cedar Spikers',   'Division A', '2024-2025', coach1Id, asst1Id, 1, 1, 14, daysAgo(60), now).lastInsertRowid;
const team2Id = insertTeam.run('Beirut Blockers', 'Division A', '2024-2025', coach2Id, asst2Id, 1, 1, 14, daysAgo(55), now).lastInsertRowid;
const team3Id = insertTeam.run('Tripoli Thunder', 'Division B', '2024-2025', coach3Id, asst3Id, 1, 0, 14, daysAgo(50), now).lastInsertRowid;
const team4Id = insertTeam.run('South Stars',     'Division B', '2024-2025', coach4Id, null,    0, 0, 14, daysAgo(40), now).lastInsertRowid;

console.log('  ✓ Teams created');

// ─── PLAYERS ──────────────────────────────────────────────────────────────────

console.log('🏐  Seeding players…');

const insertPlayer = db.prepare(`
  INSERT INTO players (user_id, name, email, phone, date_of_birth, position, jersey_number,
                       team_id, registration_status, notes, season, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function addPlayer(userId, name, email, phone, dob, position, jersey, teamId, status, notes, season) {
  return insertPlayer.run(userId, name, email, phone, dob, position, jersey, teamId, status, notes, season,
    daysAgo(Math.floor(Math.random() * 30) + 5), now).lastInsertRowid;
}

// Cedar Spikers players — approved
const pHadi   = addPlayer(uHadi,    'Hadi Cheaib',     'hadi.cheaib@volleyops.com',    '+961 71 123 456', '2000-03-15', 'outside_hitter',       7,  team1Id, 'approved', 'Strong attacker, team captain material',          '2024-2025');
const pAli    = addPlayer(uAli,     'Ali Naji',        'ali.naji@volleyops.com',        '+961 70 234 567', '2001-07-22', 'setter',                1,  team1Id, 'approved', 'Excellent court vision and quick hands',           '2024-2025');
const pHassan = addPlayer(uHassan,  'Hassan Fouani',   'hassan.fouani@volleyops.com',   '+961 76 345 678', '1999-11-08', 'middle_blocker',        5,  team1Id, 'approved', 'Dominant blocker, needs work on serve-receive',   '2024-2025');
const pMajd   = addPlayer(uMajd,    'Majd Ayash',      'majd.ayash@volleyops.com',      '+961 79 456 789', '2002-01-30', 'libero',               10,  team1Id, 'approved', 'Best libero in the division, exceptional digs',   '2024-2025');
const pYoussef= addPlayer(uYoussef, 'Youssef Khoury',  'youssef.khoury@volleyops.com',  '+961 71 567 890', '2000-09-12', 'opposite',             14,  team1Id, 'approved', 'Powerful opposite, high vertical jump',           '2024-2025');
const pJad    = addPlayer(uJad,     'Jad Rahme',       'jad.rahme@volleyops.com',        '+961 70 678 901', '2001-05-19', 'outside_hitter',        3,  team1Id, 'approved', 'Consistent passer, clutch in tight moments',      '2024-2025');
const pTarek  = addPlayer(uTarek,   'Tarek Bitar',     'tarek.bitar@volleyops.com',      '+961 76 789 012', '1998-12-03', 'middle_blocker',        9,  team1Id, 'approved', 'Veteran presence, great leadership skills',       '2024-2025');
const pRami   = addPlayer(uRami,    'Rami Abboud',     'rami.abboud@volleyops.com',      '+961 78 890 123', '2003-04-25', 'defensive_specialist', 15,  team1Id, 'approved', 'Young talent, very aggressive on defense',        '2024-2025');

// Beirut Blockers players — approved
const pCharbel= addPlayer(null, 'Charbel Gemayel', 'charbel.gemayel@mail.com', '+961 71 111 222', '1999-06-14', 'setter',          2, team2Id, 'approved', 'Creative setter with consistent distribution',    '2024-2025');
const pKamal  = addPlayer(null, 'Kamal Assaad',    'kamal.assaad@mail.com',    '+961 70 222 333', '2000-08-27', 'outside_hitter',  6, team2Id, 'approved', 'Left-handed attacker, explosive approach',        '2024-2025');
const pElie   = addPlayer(null, 'Elie Haddad',     'elie.haddad@mail.com',     '+961 76 333 444', '2001-02-11', 'libero',         11, team2Id, 'approved', 'Aggressive receive, excellent reading of the game','2024-2025');
const pZiad   = addPlayer(null, 'Ziad Makhoul',    'ziad.makhoul@mail.com',    '+961 79 444 555', '2002-10-05', 'middle_blocker',  8, team2Id, 'approved', 'Physical specimen, still developing technique',   '2024-2025');
const pGeorge = addPlayer(null, 'George Nassar',   'george.nassar@mail.com',   '+961 71 555 666', '1997-07-18', 'opposite',       18, team2Id, 'approved', 'Club legend, 5th season with VolleyOps',          '2024-2025');
const pMarc   = addPlayer(null, 'Marc Semaan',     'marc.semaan@mail.com',     '+961 70 666 777', '2000-03-30', 'outside_hitter',  4, team2Id, 'approved', 'Great blocking fundamentals, solid all-rounder',  '2024-2025');

// Pending players — applied to Cedar Spikers
const pPending1 = addPlayer(null, 'Firas Hajj',     'firas.hajj@mail.com',     '+961 71 777 888', '2003-09-21', 'setter',         null, team1Id, 'pending',    null,                              '2024-2025');
const pPending2 = addPlayer(null, 'Nour Dabbagh',   'nour.dabbagh@mail.com',   '+961 70 888 999', '2004-01-15', 'outside_hitter', null, team1Id, 'pending',    null,                              '2024-2025');
const pPending3 = addPlayer(null, 'Samer Hobeiche', 'samer.hobeiche@mail.com', '+961 76 999 000', '2002-06-08', 'middle_blocker', null, team2Id, 'pending',    'Transferred from Beirut Titans',  '2024-2025');

// Waitlisted — applied to Beirut Blockers
const pWait1  = addPlayer(null, 'Bilal Khatib', 'bilal.khatib@mail.com', '+961 78 001 112', '2001-11-25', 'libero', null, team2Id, 'waitlisted', 'Strong applicant, waiting on capacity', '2024-2025');

// Rejected
addPlayer(null, 'Karl Sleiman', 'karl.sleiman@mail.com', '+961 71 112 223', '2005-03-17', 'outside_hitter', null, team1Id, 'rejected', 'Did not meet minimum age requirement', '2024-2025');

console.log('  ✓ Players created');

// ─── TEAM ROSTERS ─────────────────────────────────────────────────────────────

const insertTP = db.prepare(`INSERT OR IGNORE INTO team_players (team_id, player_id, is_active) VALUES (?, ?, 1)`);

// Cedar Spikers roster
[pHadi, pAli, pHassan, pMajd, pYoussef, pJad, pTarek, pRami].forEach(id => insertTP.run(team1Id, id));

// Beirut Blockers roster
[pCharbel, pKamal, pElie, pZiad, pGeorge, pMarc].forEach(id => insertTP.run(team2Id, id));

console.log('  ✓ Team rosters created');

// ─── STANDINGS ────────────────────────────────────────────────────────────────

console.log('📊  Seeding standings…');

const insertStanding = db.prepare(`
  INSERT INTO standings (team_id, season, played, wins, losses, sets_won, sets_lost, points, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Division A — 2024-2025
insertStanding.run(team1Id, '2024-2025', 18, 14, 4,  49, 22, 42, now); // Cedar Spikers  — 1st
insertStanding.run(team2Id, '2024-2025', 18, 11, 7,  39, 30, 33, now); // Beirut Blockers — 2nd

// Division B — 2024-2025
insertStanding.run(team3Id, '2024-2025', 16, 10, 6,  35, 26, 30, now); // Tripoli Thunder — 1st
insertStanding.run(team4Id, '2024-2025', 14,  6, 8,  25, 32, 18, now); // South Stars

// Previous season — 2023-2024
insertStanding.run(team1Id, '2023-2024', 20, 16, 4,  55, 20, 48, now);
insertStanding.run(team2Id, '2023-2024', 20, 12, 8,  44, 34, 36, now);
insertStanding.run(team3Id, '2023-2024', 18,  8, 10, 30, 38, 24, now);

console.log('  ✓ Standings created');

// ─── PAYMENT PLANS ────────────────────────────────────────────────────────────

console.log('💳  Seeding payment plans…');

const insertPlan = db.prepare(`
  INSERT INTO payment_plans (name, description, total_amount, installment_count, interval_days, is_active, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const planFullId    = insertPlan.run('Full Season Fee',        'Complete 2024-2025 season membership',            600,  1,  1, 1, daysAgo(70)).lastInsertRowid;
const planQuarterlyId = insertPlan.run('Quarterly Plan',       'Season fee split into 3 equal payments',          600,  3, 30, 1, daysAgo(70)).lastInsertRowid;
const planMonthlyId = insertPlan.run('Monthly Instalment',     '10-month payment plan – easiest on the wallet',  500, 10, 30, 1, daysAgo(70)).lastInsertRowid;
const planEquipId   = insertPlan.run('Equipment & Kit Fee',    'Jersey, shorts, kneepads, and club bag',          120,  2, 30, 1, daysAgo(65)).lastInsertRowid;
const planTournId   = insertPlan.run('Tournament Entry Fee',   'Covers 4 tournaments for the season',             200,  1,  1, 1, daysAgo(60)).lastInsertRowid;
const planJuniorId  = insertPlan.run('Junior Development Fee', 'U-21 discounted rate (3 instalments)',            360,  3, 30, 1, daysAgo(60)).lastInsertRowid;

console.log('  ✓ Payment plans created');

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

console.log('💰  Seeding payments…');

const insertPayment = db.prepare(`
  INSERT INTO payments (player_id, plan_id, amount, description, due_date, paid_at,
                        status, installment_number, notes, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function addPayment(playerId, planId, amount, description, dueDate, paidAt, status, installNum, notes) {
  return insertPayment.run(playerId, planId, amount, description, dueDate, paidAt,
    status, installNum, notes, daysAgo(60), now).lastInsertRowid;
}

// ── Hadi Cheaib — Quarterly Plan (2 paid, 1 upcoming)
addPayment(pHadi, planQuarterlyId, 200, 'Quarterly Plan – Instalment 1/3', daysAgo(60), daysAgo(58), 'paid',    1, null);
addPayment(pHadi, planQuarterlyId, 200, 'Quarterly Plan – Instalment 2/3', daysAgo(30), daysAgo(28), 'paid',    2, null);
addPayment(pHadi, planQuarterlyId, 200, 'Quarterly Plan – Instalment 3/3', daysFromNow(2), null,      'pending', 3, null);
addPayment(pHadi, planEquipId,     60,  'Equipment & Kit Fee – 1/2',        daysAgo(55), daysAgo(54), 'paid',    1, null);
addPayment(pHadi, planEquipId,     60,  'Equipment & Kit Fee – 2/2',        daysAgo(25), daysAgo(24), 'paid',    2, null);
addPayment(pHadi, planTournId,     200, 'Tournament Entry Fee',             daysAgo(45), daysAgo(44), 'paid',    1, null);

// ── Ali Naji — Monthly plan (6 paid, 4 remaining)
for (let i = 1; i <= 10; i++) {
  const dueOffset  = -60 + (i - 1) * 30;
  const dueDateStr = daysFromNow(dueOffset);
  if (i <= 6) {
    addPayment(pAli, planMonthlyId, 50, `Monthly Instalment ${i}/10`, dueDateStr, daysFromNow(dueOffset + 2), 'paid', i, null);
  } else if (i === 7) {
    addPayment(pAli, planMonthlyId, 50, `Monthly Instalment ${i}/10`, dueDateStr, null, 'overdue', i, 'Late — sent reminder 2026-04-01');
  } else {
    addPayment(pAli, planMonthlyId, 50, `Monthly Instalment ${i}/10`, daysFromNow(dueOffset), null, 'pending', i, null);
  }
}
addPayment(pAli, planEquipId, 60,  'Equipment & Kit Fee – 1/2', daysAgo(55), daysAgo(54), 'paid', 1, null);
addPayment(pAli, planEquipId, 60,  'Equipment & Kit Fee – 2/2', daysAgo(25), null,         'overdue', 2, 'Reminder sent');

// ── Hassan Fouani — Full season paid upfront
addPayment(pHassan, planFullId, 600, 'Full Season Fee', daysAgo(65), daysAgo(63), 'paid', 1, 'Paid in full — bank transfer');
addPayment(pHassan, planEquipId, 60, 'Equipment & Kit Fee – 1/2', daysAgo(55), daysAgo(50), 'paid', 1, null);
addPayment(pHassan, planEquipId, 60, 'Equipment & Kit Fee – 2/2', daysAgo(25), daysAgo(20), 'paid', 2, null);
addPayment(pHassan, planTournId, 200, 'Tournament Entry Fee', daysAgo(40), daysAgo(38), 'paid', 1, null);

// ── Majd Ayash — Junior plan (all paid)
for (let i = 1; i <= 3; i++) {
  const dueDateStr = daysFromNow(-60 + (i - 1) * 30);
  const paidDateStr = daysFromNow(-58 + (i - 1) * 30);
  addPayment(pMajd, planJuniorId, 120, `Junior Development Fee – ${i}/3`, dueDateStr, paidDateStr, 'paid', i, null);
}
addPayment(pMajd, planTournId, 200, 'Tournament Entry Fee', daysAgo(40), daysAgo(40), 'paid', 1, null);

// ── Youssef Khoury — Quarterly, 1 overdue
addPayment(pYoussef, planQuarterlyId, 200, 'Quarterly Plan – 1/3', daysAgo(60), daysAgo(58), 'paid',    1, null);
addPayment(pYoussef, planQuarterlyId, 200, 'Quarterly Plan – 2/3', daysAgo(10), null,         'overdue', 2, 'Overdue since ' + daysAgo(10));
addPayment(pYoussef, planQuarterlyId, 200, 'Quarterly Plan – 3/3', daysFromNow(20), null,     'pending', 3, null);

// ── Jad Rahme — Full season paid
addPayment(pJad, planFullId, 600, 'Full Season Fee', daysAgo(58), daysAgo(57), 'paid', 1, null);
addPayment(pJad, planEquipId, 60, 'Equipment & Kit Fee – 1/2', daysAgo(55), daysAgo(53), 'paid', 1, null);
addPayment(pJad, planEquipId, 60, 'Equipment & Kit Fee – 2/2', daysAgo(25), daysAgo(23), 'paid', 2, null);

// ── Tarek Bitar — Monthly plan (all paid — veteran)
for (let i = 1; i <= 10; i++) {
  const dueDateStr = daysFromNow(-90 + (i - 1) * 9);
  addPayment(pTarek, planMonthlyId, 50, `Monthly Instalment ${i}/10`, dueDateStr, dueDateStr, 'paid', i, null);
}
addPayment(pTarek, planTournId, 200, 'Tournament Entry Fee', daysAgo(50), daysAgo(49), 'paid', 1, null);

// ── Rami Abboud — Cancelled (withdrew from team midseason)
addPayment(pRami, planMonthlyId, 50, 'Monthly Instalment 1/10', daysAgo(60), daysAgo(59), 'paid',      1, null);
addPayment(pRami, planMonthlyId, 50, 'Monthly Instalment 2/10', daysAgo(30), daysAgo(29), 'paid',      2, null);
addPayment(pRami, planMonthlyId, 50, 'Monthly Instalment 3/10', daysFromNow(0), null,      'cancelled', 3, 'Player on medical leave — plan paused');
for (let i = 4; i <= 10; i++) {
  addPayment(pRami, planMonthlyId, 50, `Monthly Instalment ${i}/10`, daysFromNow((i - 3) * 30), null, 'cancelled', i, 'Medical leave');
}

// ── Charbel, Kamal, Elie, Ziad, George, Marc (Team 2)
addPayment(pCharbel, planQuarterlyId, 200, 'Quarterly Plan – 1/3', daysAgo(60), daysAgo(59), 'paid', 1, null);
addPayment(pCharbel, planQuarterlyId, 200, 'Quarterly Plan – 2/3', daysAgo(30), daysAgo(29), 'paid', 2, null);
addPayment(pCharbel, planQuarterlyId, 200, 'Quarterly Plan – 3/3', daysFromNow(0), null,      'pending', 3, null);

addPayment(pKamal, planFullId, 600, 'Full Season Fee', daysAgo(62), daysAgo(61), 'paid', 1, null);

addPayment(pElie, planMonthlyId, 50, 'Monthly Instalment 1/10', daysAgo(60), daysAgo(59), 'paid', 1, null);
addPayment(pElie, planMonthlyId, 50, 'Monthly Instalment 2/10', daysAgo(30), daysAgo(29), 'paid', 2, null);
addPayment(pElie, planMonthlyId, 50, 'Monthly Instalment 3/10', daysFromNow(0), null,      'overdue', 3, null);

addPayment(pZiad, planJuniorId, 120, 'Junior Dev – 1/3', daysAgo(60), daysAgo(58), 'paid', 1, null);
addPayment(pZiad, planJuniorId, 120, 'Junior Dev – 2/3', daysAgo(30), null,         'overdue', 2, 'Sent SMS reminder');
addPayment(pZiad, planJuniorId, 120, 'Junior Dev – 3/3', daysFromNow(0), null,      'pending', 3, null);

addPayment(pGeorge, planFullId, 600, 'Full Season Fee', daysAgo(65), daysAgo(64), 'paid', 1, null);
addPayment(pGeorge, planTournId, 200, 'Tournament Entry Fee', daysAgo(45), daysAgo(44), 'paid', 1, null);

addPayment(pMarc, planQuarterlyId, 200, 'Quarterly Plan – 1/3', daysAgo(60), daysAgo(59), 'paid', 1, null);
addPayment(pMarc, planQuarterlyId, 200, 'Quarterly Plan – 2/3', daysAgo(30), daysAgo(28), 'paid', 2, null);
addPayment(pMarc, planQuarterlyId, 200, 'Quarterly Plan – 3/3', daysFromNow(0), null,      'pending', 3, null);

console.log('  ✓ Payments created');

// ─── CONVERSATIONS & MESSAGES ────────────────────────────────────────────────

console.log('💬  Seeding conversations & messages…');

const insertConvo = db.prepare(`
  INSERT INTO conversations (name, type, team_id, created_by, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const insertMember = db.prepare(`
  INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, joined_at)
  VALUES (?, ?, ?)
`);

const insertMsg = db.prepare(`
  INSERT INTO messages (conversation_id, sender_id, content, is_announcement, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

function ts(minsAgo) {
  const d = new Date(Date.now() - minsAgo * 60 * 1000);
  return d.toISOString();
}

// Team channel — Cedar Spikers
const c1Id = insertConvo.run('Cedar Spikers', 'team', team1Id, coach1Id, ts(8640)).lastInsertRowid;
[coach1Id, asst1Id, uHadi, uAli, uHassan, uMajd, uYoussef, uJad, uTarek, uRami].forEach(uid =>
  insertMember.run(c1Id, uid, ts(8640))
);
insertMsg.run(c1Id, coach1Id, '📢 Welcome to the Cedar Spikers official channel! Keep all team communication here.', 1, ts(8630));
insertMsg.run(c1Id, coach1Id, 'Training schedule for this week: Mon & Wed 6pm, Fri 7pm at the Sports Complex. Do NOT be late.', 0, ts(7200));
insertMsg.run(c1Id, uHadi,   'Coach, can we push Friday session to 7:30? I have a conflict at 7.', 0, ts(7180));
insertMsg.run(c1Id, coach1Id, 'No changes this week Hadi. Be there at 7 or let me know by Thursday.', 0, ts(7160));
insertMsg.run(c1Id, uAli,    'I will be there on time. Also, are we reviewing the 6-2 rotation before the Beirut match?', 0, ts(7100));
insertMsg.run(c1Id, coach1Id, 'Yes Ali. We will run serve-receive drills for 45 minutes then review rotations. Come prepared.', 0, ts(7080));
insertMsg.run(c1Id, uHassan, 'What time is the match on Saturday?', 0, ts(5000));
insertMsg.run(c1Id, asst1Id, 'Match is at 3pm. Bus leaves from the club at 1:30. Bring your kit.', 0, ts(4990));
insertMsg.run(c1Id, uMajd,   'Ready! I have been working on those passing angles all week 💪', 0, ts(4000));
insertMsg.run(c1Id, uTarek,  'Let\'s go boys. We win this one and we go top of the table.', 0, ts(3800));
insertMsg.run(c1Id, uYoussef,'My spike percentage has been up this week, feeling good about Saturday.', 0, ts(3600));
insertMsg.run(c1Id, uJad,    'Everyone stay focused. We lost to them last year. Not this time.', 0, ts(2500));
insertMsg.run(c1Id, coach1Id,'🏆 MATCH RESULT: Cedar Spikers 3 – Beirut Blockers 1. Outstanding performance! Hadi MVP.', 1, ts(800));
insertMsg.run(c1Id, uHadi,   'LETS GOOO! What a match! Thank you coach for the trust 🙌', 0, ts(790));
insertMsg.run(c1Id, uAli,    'Amazing team effort. Hassan those blocks in set 3 were insane!', 0, ts(780));
insertMsg.run(c1Id, uHassan, 'Majd\'s defense kept us in that 4th set. Real MVP right there 😎', 0, ts(770));
insertMsg.run(c1Id, uMajd,   'You guys are too kind 😂 Next match let\'s go even harder', 0, ts(760));

// Team channel — Beirut Blockers
const c2Id = insertConvo.run('Beirut Blockers', 'team', team2Id, coach2Id, ts(8500)).lastInsertRowid;
[coach2Id, asst2Id, uYoussef, uJad, uTarek].forEach(uid => insertMember.run(c2Id, uid, ts(8500)));
insertMsg.run(c2Id, coach2Id, '📢 Beirut Blockers team channel. Season 2024-2025 starts now.', 1, ts(8490));
insertMsg.run(c2Id, coach2Id, 'We have a tough schedule this month. Full commitment required from everyone.', 0, ts(8400));
insertMsg.run(c2Id, asst2Id,  'Film review session Thursday 5pm. Attendance is mandatory.', 0, ts(6000));

// Direct message: Hadi ↔ Coach Karim
const dmHadiCoach = insertConvo.run(null, 'direct', null, coach1Id, ts(5500)).lastInsertRowid;
insertMember.run(dmHadiCoach, coach1Id, ts(5500));
insertMember.run(dmHadiCoach, uHadi,   ts(5500));
insertMsg.run(dmHadiCoach, coach1Id, 'Hadi, great work in training today. I want to discuss the captain role with you.', 0, ts(5490));
insertMsg.run(dmHadiCoach, uHadi,    'Thank you coach! I would be honoured. When can we meet?', 0, ts(5480));
insertMsg.run(dmHadiCoach, coach1Id, 'Come 30 mins early before Friday practice. We will talk then.', 0, ts(5470));
insertMsg.run(dmHadiCoach, uHadi,    'Perfect, I will be there. See you Friday coach 👍', 0, ts(5460));

// Direct message: Ali ↔ Hassan
const dmAliHassan = insertConvo.run(null, 'direct', null, uAli, ts(4400)).lastInsertRowid;
insertMember.run(dmAliHassan, uAli,    ts(4400));
insertMember.run(dmAliHassan, uHassan, ts(4400));
insertMsg.run(dmAliHassan, uAli,    'Bro can you stay after practice tomorrow? Want to work on our back-row attack timing', 0, ts(4390));
insertMsg.run(dmAliHassan, uHassan, 'For sure. Bring your A game though, I\'m going full speed 😤', 0, ts(4380));
insertMsg.run(dmAliHassan, uAli,    'Let\'s go! Also did coach give you feedback on your block form?', 0, ts(4370));
insertMsg.run(dmAliHassan, uHassan, 'Yeah he said my timing is off by like half a second. I need to read the setter better.', 0, ts(4360));
insertMsg.run(dmAliHassan, uAli,    'I can help with that — I\'ll set slower in warmup so you can build the timing first', 0, ts(4350));

// Direct: Majd ↔ Admin
const dmMajdAdmin = insertConvo.run(null, 'direct', null, adminId, ts(2000)).lastInsertRowid;
insertMember.run(dmMajdAdmin, adminId, ts(2000));
insertMember.run(dmMajdAdmin, uMajd,   ts(2000));
insertMsg.run(dmMajdAdmin, uMajd,   'Hi, I wanted to check on my payment plan. I have one instalment coming up soon.', 0, ts(1990));
insertMsg.run(dmMajdAdmin, adminId, 'Hi Majd! All your Junior Dev instalments are fully paid. You\'re all cleared 👍', 0, ts(1980));
insertMsg.run(dmMajdAdmin, uMajd,   'Oh great! I thought there was one more. Thank you!', 0, ts(1970));

console.log('  ✓ Conversations & messages created');

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

console.log('🔔  Seeding notifications…');

const insertNotif = db.prepare(`
  INSERT INTO notifications (user_id, type, title, body, is_read, related_type, related_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Hadi
insertNotif.run(uHadi, 'roster_published', '📢 Roster Published', 'Cedar Spikers roster has been officially published for 2024-2025.', 1, 'team', team1Id, ts(8000));
insertNotif.run(uHadi, 'payment_reminder', '💳 Payment Due Soon', 'Your Quarterly Plan instalment 3/3 ($200) is due in 2 days.', 0, 'payment', null, ts(60));
insertNotif.run(uHadi, 'message', '💬 New Message', 'Coach Karim sent you a direct message.', 1, 'conversation', dmHadiCoach, ts(5490));

// Ali
insertNotif.run(uAli, 'roster_published', '📢 Roster Published', 'Cedar Spikers roster has been officially published for 2024-2025.', 1, 'team', team1Id, ts(8000));
insertNotif.run(uAli, 'payment_reminder', '⚠️ Payment Overdue', 'Monthly Instalment 7/10 ($50) is overdue. Please pay as soon as possible.', 0, 'payment', null, ts(200));
insertNotif.run(uAli, 'payment_reminder', '⚠️ Equipment Fee Overdue', 'Equipment & Kit Fee instalment 2/2 ($60) is overdue.', 0, 'payment', null, ts(190));

// Hassan
insertNotif.run(uHassan, 'roster_published', '📢 Roster Published', 'Cedar Spikers roster has been officially published.', 1, 'team', team1Id, ts(8000));
insertNotif.run(uHassan, 'status_change', '✅ Registration Approved', 'Your registration has been approved. Welcome to VolleyOps!', 1, 'player', pHassan, ts(9000));

// Majd
insertNotif.run(uMajd, 'roster_published', '📢 Roster Published', 'Cedar Spikers roster has been officially published.', 1, 'team', team1Id, ts(8000));
insertNotif.run(uMajd, 'status_change', '✅ Registration Approved', 'Your registration has been approved. Welcome to VolleyOps!', 1, 'player', pMajd, ts(9000));

// Admin notifications
insertNotif.run(adminId, 'registration', '📝 New Registration', 'Firas Hajj submitted a registration request.', 0, 'player', pPending1, ts(500));
insertNotif.run(adminId, 'registration', '📝 New Registration', 'Nour Dabbagh submitted a registration request.', 0, 'player', pPending2, ts(400));
insertNotif.run(adminId, 'registration', '📝 New Registration', 'Samer Hobeiche submitted a registration request (transferred from Beirut Titans).', 0, 'player', pPending3, ts(300));
insertNotif.run(adminId, 'payment_overdue', '⚠️ Overdue Payments', '3 players have overdue payments this week. Review in Payments section.', 0, 'payment', null, ts(120));

console.log('  ✓ Notifications created');

// ─── TACTICS BOARDS ───────────────────────────────────────────────────────────

console.log('📋  Seeding tactics boards…');

const insertBoard = db.prepare(`
  INSERT INTO tactics_boards (name, team_id, created_by, markers, arrows, zones, formation, match_context, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Serve-receive formation (6-2)
const receiveMarkers = JSON.stringify([
  { id: 1, x: 0.5,  y: 0.85, type: 'player', label: 'S',  color: '#7c3aed', team: 'own', position: 'setter' },
  { id: 2, x: 0.2,  y: 0.70, type: 'player', label: 'LB', color: '#ec4899', team: 'own', position: 'outside_hitter' },
  { id: 3, x: 0.8,  y: 0.70, type: 'player', label: 'RB', color: '#ec4899', team: 'own', position: 'opposite' },
  { id: 4, x: 0.35, y: 0.85, type: 'player', label: 'LF', color: '#06b6d4', team: 'own', position: 'outside_hitter' },
  { id: 5, x: 0.65, y: 0.85, type: 'player', label: 'RF', color: '#06b6d4', team: 'own', position: 'middle_blocker' },
  { id: 6, x: 0.5,  y: 0.65, type: 'player', label: 'Li', color: '#f59e0b', team: 'own', position: 'libero' },
]);
const receiveArrows = JSON.stringify([
  { id: 1, x1: 0.2, y1: 0.70, x2: 0.5, y2: 0.60, color: '#10b981', style: 'solid' },
  { id: 2, x1: 0.5, y1: 0.65, x2: 0.5, y2: 0.58, color: '#10b981', style: 'dashed' },
]);
insertBoard.run(
  'Cedar Spikers – Serve Receive (6-2)', team1Id, coach1Id,
  receiveMarkers, receiveArrows, '[]', '6-2',
  JSON.stringify({ opponent: 'Beirut Blockers', score: '0-0', situation: 'serve_receive' }),
  daysAgo(5), daysAgo(5)
);

// Blocking scheme
const blockMarkers = JSON.stringify([
  { id: 1, x: 0.5,  y: 0.15, type: 'player', label: 'MB', color: '#7c3aed', team: 'own', position: 'middle_blocker' },
  { id: 2, x: 0.2,  y: 0.15, type: 'player', label: 'LB', color: '#ec4899', team: 'own', position: 'outside_hitter' },
  { id: 3, x: 0.8,  y: 0.15, type: 'player', label: 'RB', color: '#ec4899', team: 'own', position: 'opposite' },
  { id: 4, x: 0.3,  y: 0.35, type: 'player', label: 'Li', color: '#f59e0b', team: 'own', position: 'libero' },
  { id: 5, x: 0.5,  y: 0.85, type: 'player', label: 'S',  color: '#7c3aed', team: 'opp', position: 'setter' },
  { id: 6, x: 0.3,  y: 0.80, type: 'player', label: 'OH', color: '#ef4444', team: 'opp', position: 'outside_hitter' },
]);
insertBoard.run(
  'Counter-Block vs Left-Side Attack', team1Id, coach1Id,
  blockMarkers, '[]', '[]', '5-1',
  JSON.stringify({ situation: 'transition', score: '18-20', set: 3 }),
  daysAgo(10), daysAgo(10)
);

// Rotation drill
insertBoard.run(
  'Rotation 2 – Transition Pattern', team1Id, asst1Id,
  JSON.stringify([
    { id: 1, x: 0.5,  y: 0.75, type: 'player', label: 'Ali',    color: '#7c3aed', team: 'own' },
    { id: 2, x: 0.25, y: 0.65, type: 'player', label: 'Hadi',   color: '#ec4899', team: 'own' },
    { id: 3, x: 0.75, y: 0.65, type: 'player', label: 'Hassan', color: '#06b6d4', team: 'own' },
    { id: 4, x: 0.5,  y: 0.55, type: 'player', label: 'Majd',   color: '#f59e0b', team: 'own' },
    { id: 5, x: 0.3,  y: 0.8,  type: 'player', label: 'Jad',    color: '#10b981', team: 'own' },
    { id: 6, x: 0.7,  y: 0.8,  type: 'player', label: 'Tarek',  color: '#8b5cf6', team: 'own' },
  ]),
  JSON.stringify([
    { id: 1, x1: 0.25, y1: 0.65, x2: 0.5, y2: 0.55, color: '#10b981', style: 'solid' },
    { id: 2, x1: 0.5,  y1: 0.75, x2: 0.7, y2: 0.65, color: '#f59e0b', style: 'dashed' },
    { id: 3, x1: 0.75, y1: 0.65, x2: 0.5, y2: 0.72, color: '#ef4444', style: 'solid' },
  ]),
  '[]', '6-2',
  JSON.stringify({ situation: 'rotation_drill' }),
  daysAgo(3), daysAgo(3)
);

console.log('  ✓ Tactics boards created');

// ─── MATCHES & LINEUPS ────────────────────────────────────────────────────────

console.log('📅  Seeding matches & lineups…');

function dt(daysOffset, hour = 15, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

const insertMatch = db.prepare(`
  INSERT INTO matches (team_id, opponent, match_date, home_away, competition, location, status,
                       sets_us, sets_them, notes, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// ── Cedar Spikers matches ──
// Past matches
const m1 = insertMatch.run(team1Id, 'Beirut Blockers',   dt(-28, 15), 'away', 'Division A League', 'Beirut Sports Hall',   'completed', 3, 1, null, coach1Id, daysAgo(35), daysAgo(28)).lastInsertRowid;
const m2 = insertMatch.run(team1Id, 'Tripoli Thunder',   dt(-14, 16), 'home', 'Division A League', 'Cedar Arena',          'completed', 3, 0, 'Dominant performance', coach1Id, daysAgo(21), daysAgo(14)).lastInsertRowid;
const m3 = insertMatch.run(team1Id, 'South Stars',       dt(-7,  15), 'home', 'Division A League', 'Cedar Arena',          'completed', 2, 3, 'Tough loss — fatigue in set 5', coach1Id, daysAgo(14), daysAgo(7)).lastInsertRowid;

// Upcoming — NEXT MATCH (3 days away, lineup set for 4 players)
const m4 = insertMatch.run(team1Id, 'Beirut Blockers',   dt(3,  15,  30), 'home', 'Division A League', 'Cedar Arena',       'scheduled', null, null, 'Must win to go top', coach1Id, now, now).lastInsertRowid;

// Further upcoming
const m5 = insertMatch.run(team1Id, 'Coastal Crushers',  dt(10, 14,   0), 'away', 'Division A League', 'Coastal Sports Hub', 'scheduled', null, null, null, coach1Id, now, now).lastInsertRowid;
const m6 = insertMatch.run(team1Id, 'Mountain Spikes',   dt(17, 16,  30), 'home', 'Division A League', 'Cedar Arena',        'scheduled', null, null, null, coach1Id, now, now).lastInsertRowid;
const m7 = insertMatch.run(team1Id, 'Tripoli Thunder',   dt(24, 15,   0), 'away', 'Division A Cup',    'Tripoli Dome',       'scheduled', null, null, null, coach1Id, now, now).lastInsertRowid;

// ── Beirut Blockers matches ──
insertMatch.run(team2Id, 'Cedar Spikers',  dt(-28, 15), 'home', 'Division A League', 'Beirut Sports Hall',  'completed', 1, 3, null, coach2Id, daysAgo(35), daysAgo(28)).lastInsertRowid;
insertMatch.run(team2Id, 'South Stars',    dt(-10, 17), 'away', 'Division A League', 'South Arena',         'completed', 3, 2, null, coach2Id, daysAgo(17), daysAgo(10)).lastInsertRowid;
insertMatch.run(team2Id, 'Coastal Crushers', dt(5, 16), 'home', 'Division A League', 'Beirut Sports Hall',  'scheduled', null, null, null, coach2Id, now, now).lastInsertRowid;

// ── Tripoli Thunder matches ──
insertMatch.run(team3Id, 'Cedar Spikers',  dt(-14, 16), 'away', 'Division B League', 'Cedar Arena',         'completed', 0, 3, null, coach1Id, daysAgo(21), daysAgo(14)).lastInsertRowid;
insertMatch.run(team3Id, 'Tripoli Rivals', dt(6,  15), 'home', 'Division B League', 'Tripoli Dome',         'scheduled', null, null, null, coach1Id, now, now).lastInsertRowid;

console.log('  ✓ Matches created');

// ── Lineups ──
const insertLineup = db.prepare(`
  INSERT OR IGNORE INTO match_lineups (match_id, player_id, role, position, created_by)
  VALUES (?, ?, ?, ?, ?)
`);

// Past match m1 — Cedar vs Beirut (away win 3-1)
[pHadi, pAli, pHassan, pYoussef, pJad, pTarek].forEach(pid =>
  insertLineup.run(m1, pid, 'starter', null, coach1Id));
[pMajd, pRami].forEach(pid =>
  insertLineup.run(m1, pid, 'substitute', null, coach1Id));

// Past match m2 — Cedar vs Tripoli (home 3-0)
[pHadi, pAli, pHassan, pYoussef, pMajd, pTarek].forEach(pid =>
  insertLineup.run(m2, pid, 'starter', null, coach1Id));
[pJad, pRami].forEach(pid =>
  insertLineup.run(m2, pid, 'substitute', null, coach1Id));

// Past match m3 — Cedar vs South Stars (lost 2-3)
[pHadi, pAli, pHassan, pYoussef, pMajd, pJad].forEach(pid =>
  insertLineup.run(m3, pid, 'starter', null, coach1Id));
[pTarek, pRami].forEach(pid =>
  insertLineup.run(m3, pid, 'substitute', null, coach1Id));

// NEXT MATCH m4 — Cedar vs Beirut Blockers (lineup partially set)
// Hadi: starter, Ali: starter, Hassan: starter, Majd: substitute, Youssef: starter
// Jad: starter, Tarek: substitute — Rami: not yet assigned
insertLineup.run(m4, pHadi,    'starter',    'outside_hitter', coach1Id);
insertLineup.run(m4, pAli,     'starter',    'setter',         coach1Id);
insertLineup.run(m4, pHassan,  'starter',    'middle_blocker', coach1Id);
insertLineup.run(m4, pYoussef, 'starter',    'opposite',       coach1Id);
insertLineup.run(m4, pJad,     'starter',    'outside_hitter', coach1Id);
insertLineup.run(m4, pMajd,    'starter',    'libero',         coach1Id);
insertLineup.run(m4, pTarek,   'substitute', null,             coach1Id);
// pRami intentionally left out (not assigned yet)

// Match m5 (10 days away) — no lineup set yet

console.log('  ✓ Lineups created');

// Lineup notifications for upcoming match
[uHadi, uAli, uHassan, uMajd, uYoussef, uJad, uTarek].forEach(uid => {
  const isStarter = [uHadi, uAli, uHassan, uYoussef, uJad, uMajd].includes(uid);
  insertNotif.run(uid, 'lineup_set', '📋 Lineup Released',
    `You are ${isStarter ? '🟢 Starting' : '🔵 Substitute'} for the match vs Beirut Blockers on ${dt(3,15,30).split(' ')[0]}`,
    0, 'match', m4, ts(30));
});

// Match scheduled notification for all players
[uHadi, uAli, uHassan, uMajd, uYoussef, uJad, uTarek, uRami].forEach(uid => {
  insertNotif.run(uid, 'match_scheduled', '📅 New Match Scheduled',
    `Cedar Spikers vs Beirut Blockers on ${dt(3,15,30).split(' ')[0]} at Cedar Arena`,
    1, 'match', m4, ts(60));
});

console.log('  ✓ Match notifications created');

// ─── PLAYER STATS ─────────────────────────────────────────────────────────────

console.log('📊  Seeding player stats…');

const insertStats = db.prepare(`
  INSERT OR REPLACE INTO player_stats
    (player_id, season, matches_played, sets_played, points, kills, aces, blocks, digs, errors)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Cedar Spikers
insertStats.run(pHadi,    '2024-2025', 18, 62, 105, 85, 12,  8, 145, 24);
insertStats.run(pAli,     '2024-2025', 18, 62,  36, 12, 18,  6, 210, 15);
insertStats.run(pHassan,  '2024-2025', 17, 58, 115, 65,  8, 42,  45, 18);
insertStats.run(pMajd,    '2024-2025', 18, 62,   8,  0,  0,  0, 310,  8);
insertStats.run(pYoussef, '2024-2025', 17, 57, 117, 92, 10, 15,  52, 22);
insertStats.run(pJad,     '2024-2025', 16, 54,  88, 72,  9,  7, 130, 19);
insertStats.run(pTarek,   '2024-2025', 18, 60, 103, 58,  7, 38,  40, 14);
insertStats.run(pRami,    '2024-2025', 14, 42,  13,  5,  6,  2, 185, 12);

// Beirut Blockers
insertStats.run(pCharbel, '2024-2025', 18, 61,  37, 10, 22,  5, 195, 18);
insertStats.run(pKamal,   '2024-2025', 18, 61,  98, 78, 11,  9, 125, 20);
insertStats.run(pElie,    '2024-2025', 18, 61,  10,  0,  0,  0, 290, 10);
insertStats.run(pZiad,    '2024-2025', 17, 57,  91, 60,  6, 35,  42, 17);
insertStats.run(pGeorge,  '2024-2025', 18, 62, 115, 88,  9, 18,  48, 25);
insertStats.run(pMarc,    '2024-2025', 16, 54,  82, 68,  8,  6, 118, 21);

console.log('  ✓ Player stats created');

// ─── DONE ─────────────────────────────────────────────────────────────────────

console.log('\n✅  Seed complete!\n');
console.log('─────────────────────────────────────────────');
console.log('  Login credentials:');
console.log('  Admin:            admin@volleyops.com       / Admin123!');
console.log('  Coach (Karim):    karim.mansour@volleyops.com / Coach123!');
console.log('  Coach (Rania):    rania.khalil@volleyops.com  / Coach123!');
console.log('  Coach (Fadi):     fadi.kallas@volleyops.com   / Coach123!');
console.log('  Coach (Maya):     maya.harb@volleyops.com     / Coach123!');
console.log('  Asst Coach:       omar.farhat@volleyops.com   / Coach123!');
console.log('  Player (Hadi):    hadi.cheaib@volleyops.com   / Player123!');
console.log('  Player (Ali):     ali.naji@volleyops.com      / Player123!');
console.log('  Player (Hassan):  hassan.fouani@volleyops.com / Player123!');
console.log('  Player (Majd):    majd.ayash@volleyops.com    / Player123!');
console.log('─────────────────────────────────────────────\n');
