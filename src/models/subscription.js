const { getDB } = require('./db');
const { v4: uuidv4 } = require('uuid');

const SubModel = {
  findById(id) {
    return getDB().prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
  },

  findByToken(token) {
    return getDB().prepare('SELECT * FROM subscriptions WHERE token = ?').get(token);
  },

  findByUserId(userId) {
    return getDB().prepare(`
      SELECT s.*, p.name as plan_name
      FROM subscriptions s
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).all(userId);
  },

  create({ user_id, plan_id, email, uuid, data_limit, expires_at, inbound_id }) {
    const token = uuidv4().replace(/-/g, '');
    const result = getDB().prepare(
      'INSERT INTO subscriptions (user_id, plan_id, token, email, uuid, data_limit, expires_at, inbound_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(user_id, plan_id, token, email, uuid, data_limit, expires_at, inbound_id);
    return { id: result.lastInsertRowid, token };
  },

  update(id, fields) {
    const allowed = ['data_used', 'expires_at', 'enabled', 'inbound_id'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }
    if (updates.length === 0) return false;
    values.push(id);
    getDB().prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return true;
  },

  updateTraffic(id, upload, download) {
    getDB().prepare(
      'UPDATE subscriptions SET data_used = data_used + ? WHERE id = ?'
    ).run(upload + download, id);
  },

  delete(id) {
    getDB().prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
  },

  list({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const rows = getDB().prepare(`
      SELECT s.*, u.username, p.name as plan_name
      FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN plans p ON s.plan_id = p.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    const total = getDB().prepare('SELECT COUNT(*) as count FROM subscriptions').get().count;
    return { rows, total, page, pages: Math.ceil(total / limit) };
  },

  getExpired() {
    return getDB().prepare(
      "SELECT * FROM subscriptions WHERE enabled = 1 AND expires_at < datetime('now')"
    ).all();
  },

  disableExpired() {
    return getDB().prepare(
      "UPDATE subscriptions SET enabled = 0 WHERE enabled = 1 AND expires_at < datetime('now')"
    ).run();
  }
};

module.exports = SubModel;
