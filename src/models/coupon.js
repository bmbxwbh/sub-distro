const { getDB } = require('./db');

const CouponModel = {
  findById(id) {
    return getDB().prepare('SELECT * FROM coupon_codes WHERE id = ?').get(id);
  },

  findByCode(code) {
    return getDB().prepare('SELECT * FROM coupon_codes WHERE code = ? AND enabled = 1').get(code);
  },

  /**
   * 验证优惠码是否可用
   * @returns {{ valid: boolean, coupon?: object, reason?: string }}
   */
  validate(code) {
    const coupon = this.findByCode(code);
    if (!coupon) return { valid: false, reason: '优惠码不存在' };
    if (!coupon.enabled) return { valid: false, reason: '优惠码已禁用' };
    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
      return { valid: false, reason: '优惠码已达到使用上限' };
    }
    return { valid: true, coupon };
  },

  /**
   * 计算折扣后价格
   * @param {number} originalPrice 原价
   * @param {object} coupon 优惠码对象
   * @returns {{ discount: number, final: number }}
   */
  calculate(originalPrice, coupon) {
    let discount = 0;
    if (coupon.discount_type === 'percent') {
      discount = originalPrice * (coupon.discount_value / 100);
    } else {
      discount = coupon.discount_value;
    }
    // 折扣不能超过原价
    discount = Math.min(discount, originalPrice);
    discount = Math.round(discount * 100) / 100;
    const final = Math.max(0, Math.round((originalPrice - discount) * 100) / 100);
    return { discount, final };
  },

  /**
   * 标记使用一次
   */
  useOne(code) {
    getDB().prepare('UPDATE coupon_codes SET used_count = used_count + 1 WHERE code = ?').run(code);
  },

  list() {
    return getDB().prepare('SELECT * FROM coupon_codes ORDER BY created_at DESC').all();
  },

  create({ code, discount_type, discount_value, max_uses }) {
    getDB().prepare(
      'INSERT INTO coupon_codes (code, discount_type, discount_value, max_uses) VALUES (?, ?, ?, ?)'
    ).run(code, discount_type, discount_value, max_uses || 0);
  },

  toggleEnabled(id, enabled) {
    getDB().prepare('UPDATE coupon_codes SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  },

  delete(id) {
    getDB().prepare('DELETE FROM coupon_codes WHERE id = ?').run(id);
  }
};

module.exports = CouponModel;
