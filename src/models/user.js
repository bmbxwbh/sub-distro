const { getDB } = require('./db');
const bcrypt = require('bcryptjs');

const UserModel = {
  findById(id) {
    return getDB().prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByUsername(username) {
    return getDB().prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  create({ username, password, email, role = 'user' }) {
    const hash = bcrypt.hashSync(password, 10);
    const result = getDB().prepare(
      'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)'
    ).run(username, hash, email, role);
    return result.lastInsertRowid;
  },

  update(id, fields) {
    const allowed = ['email', 'role', 'status'];
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
    getDB().prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
    return true;
  },

  delete(id) {
    getDB().prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  list({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const rows = getDB().prepare('SELECT id, username, email, role, status, created_at FROM users ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = getDB().prepare('SELECT COUNT(*) as count FROM users').get().count;
    return { rows, total, page, pages: Math.ceil(total / limit) };
  },

  verifyPassword(username, password) {
    const user = this.findByUsername(username);
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password)) return null;
    return user;
  }
};

module.exports = UserModel;
