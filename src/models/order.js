const { getDB } = require('./db');

const OrderModel = {
  create({ order_no, user_id, plan_id, amount, discount, final_amount, coupon_code }) {
    getDB().prepare(
      'INSERT INTO orders (order_no, user_id, plan_id, amount, discount, final_amount, coupon_code) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(order_no, user_id, plan_id, amount, discount || 0, final_amount, coupon_code || null);
  },

  findByOrderNo(orderNo) {
    return getDB().prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  },

  markPaid(orderNo, tradeNo) {
    getDB().prepare(
      "UPDATE orders SET status='paid', trade_no=?, paid_at=CURRENT_TIMESTAMP WHERE order_no=? AND status='pending'"
    ).run(tradeNo, orderNo);
  },

  markFailed(orderNo) {
    getDB().prepare(
      "UPDATE orders SET status='failed' WHERE order_no=? AND status='pending'"
    ).run(orderNo);
  },

  findByUserId(userId) {
    return getDB().prepare(`
      SELECT o.*, p.name as plan_name
      FROM orders o
      LEFT JOIN plans p ON o.plan_id = p.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(userId);
  },

  list({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const rows = getDB().prepare(`
      SELECT o.*, u.username, p.name as plan_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN plans p ON o.plan_id = p.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    const total = getDB().prepare('SELECT COUNT(*) as count FROM orders').get().count;
    return { rows, total, page, pages: Math.ceil(total / limit) };
  }
};

module.exports = OrderModel;
