const { getDB } = require('./db');

const PlanModel = {
  findById(id) {
    return getDB().prepare('SELECT * FROM plans WHERE id = ?').get(id);
  },

  list({ enabledOnly = false } = {}) {
    const sql = enabledOnly
      ? 'SELECT * FROM plans WHERE enabled = 1 ORDER BY price ASC'
      : 'SELECT * FROM plans ORDER BY id DESC';
    return getDB().prepare(sql).all();
  },

  create({ name, description, data_limit, duration_days, price, inbound_id, max_ips }) {
    const result = getDB().prepare(
      'INSERT INTO plans (name, description, data_limit, duration_days, price, inbound_id, max_ips) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name, description, data_limit, duration_days, price, inbound_id, max_ips);
    return result.lastInsertRowid;
  },

  update(id, fields) {
    const allowed = ['name', 'description', 'data_limit', 'duration_days', 'price', 'inbound_id', 'max_ips', 'enabled'];
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
    getDB().prepare(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return true;
  },

  delete(id) {
    getDB().prepare('DELETE FROM plans WHERE id = ?').run(id);
  }
};

module.exports = PlanModel;
