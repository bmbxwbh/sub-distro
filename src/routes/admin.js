const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const UserModel = require('../models/user');
const PlanModel = require('../models/plan');
const SubModel = require('../models/subscription');
const OrderModel = require('../models/order');
const CouponModel = require('../models/coupon');
const SubService = require('../services/sub');
const XuiService = require('../services/xui');

router.use(requireAdmin);

// ─── Dashboard ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const users = UserModel.list({ limit: 1000 });
  const subs = SubModel.list({ limit: 1000 });
  const plans = PlanModel.list();
  let serverStatus = null;
  try {
    const resp = await XuiService.getServerStatus();
    if (resp.success) serverStatus = resp.obj;
  } catch (e) {}

  res.render('admin/dashboard', {
    stats: {
      totalUsers: users.total,
      totalSubs: subs.total,
      totalPlans: plans.length,
      serverStatus
    }
  });
});

// ─── Users Management ────────────────────────────────────────────
router.get('/users', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const data = UserModel.list({ page });
  res.render('admin/users', data);
});

router.post('/users/:id/delete', (req, res) => {
  UserModel.delete(req.params.id);
  req.session.flash = { type: 'success', message: '用户已删除' };
  res.redirect('/admin/users');
});

router.post('/users/:id/ban', (req, res) => {
  UserModel.update(req.params.id, { status: 'banned' });
  req.session.flash = { type: 'success', message: '用户已封禁' };
  res.redirect('/admin/users');
});

// ─── Plans Management ────────────────────────────────────────────
router.get('/plans', (req, res) => {
  const plans = PlanModel.list();
  res.render('admin/plans', { plans });
});

router.get('/plans/new', async (req, res) => {
  let inbounds = [];
  try {
    const resp = await XuiService.getInbounds();
    if (resp.success) inbounds = resp.obj || [];
  } catch (e) {}
  res.render('admin/plan_form', { plan: null, inbounds });
});

router.post('/plans/new', (req, res) => {
  const { name, description, data_limit, duration_days, price, inbound_id, max_ips } = req.body;
  PlanModel.create({
    name,
    description,
    data_limit: parseInt(data_limit) || 0,
    duration_days: parseInt(duration_days) || 30,
    price: parseFloat(price) || 0,
    inbound_id: inbound_id ? parseInt(inbound_id) : null,
    max_ips: parseInt(max_ips) || 3
  });
  req.session.flash = { type: 'success', message: '套餐已创建' };
  res.redirect('/admin/plans');
});

router.get('/plans/:id/edit', async (req, res) => {
  const plan = PlanModel.findById(req.params.id);
  let inbounds = [];
  try {
    const resp = await XuiService.getInbounds();
    if (resp.success) inbounds = resp.obj || [];
  } catch (e) {}
  res.render('admin/plan_form', { plan, inbounds });
});

router.post('/plans/:id/edit', (req, res) => {
  const { name, description, data_limit, duration_days, price, inbound_id, max_ips, enabled } = req.body;
  PlanModel.update(req.params.id, {
    name,
    description,
    data_limit: parseInt(data_limit) || 0,
    duration_days: parseInt(duration_days) || 30,
    price: parseFloat(price) || 0,
    inbound_id: inbound_id ? parseInt(inbound_id) : null,
    max_ips: parseInt(max_ips) || 3,
    enabled: enabled === 'on' ? 1 : 0
  });
  req.session.flash = { type: 'success', message: '套餐已更新' };
  res.redirect('/admin/plans');
});

router.post('/plans/:id/delete', (req, res) => {
  PlanModel.delete(req.params.id);
  req.session.flash = { type: 'success', message: '套餐已删除' };
  res.redirect('/admin/plans');
});

// ─── Subscriptions Management ────────────────────────────────────
router.get('/subscriptions', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const data = SubModel.list({ page });
  res.render('admin/subscriptions', data);
});

// ─── Admin: Create Subscription for User (代开订阅) ─────────────
router.get('/subscriptions/create', (req, res) => {
  const users = UserModel.list({ limit: 1000 }).rows;
  const plans = PlanModel.list();
  res.render('admin/create_sub', { users, plans });
});

router.post('/subscriptions/create', async (req, res) => {
  const { user_id, plan_id, duration_days, data_limit } = req.body;
  const userId = parseInt(user_id);
  const planId = parseInt(plan_id);

  if (!userId || !planId) {
    req.session.flash = { type: 'error', message: '请选择用户和套餐' };
    return res.redirect('/admin/subscriptions/create');
  }

  const user = UserModel.findById(userId);
  if (!user) {
    req.session.flash = { type: 'error', message: '用户不存在' };
    return res.redirect('/admin/subscriptions/create');
  }

  const plan = PlanModel.findById(planId);
  if (!plan) {
    req.session.flash = { type: 'error', message: '套餐不存在' };
    return res.redirect('/admin/subscriptions/create');
  }

  const days = parseInt(duration_days) || plan.duration_days;
  const limit = parseInt(data_limit) !== undefined ? parseInt(data_limit) : plan.data_limit;
  const email = `user${userId}_admin_${Date.now()}`;
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  try {
    const sub = await SubService.createSubscription({
      userId,
      planId,
      email,
      expiresAt
    });
    // 如果管理员指定了自定义流量，覆盖套餐默认值
    if (limit !== plan.data_limit) {
      SubModel.update(sub.id, { data_limit: limit });
    }
    req.session.flash = { type: 'success', message: `已为 ${user.username} 代开订阅，到期: ${new Date(expiresAt).toLocaleDateString('zh-CN')}` };
    res.redirect('/admin/subscriptions');
  } catch (err) {
    req.session.flash = { type: 'error', message: '代开失败: ' + err.message };
    res.redirect('/admin/subscriptions/create');
  }
});

// ─── Orders Management ───────────────────────────────────────────
router.get('/orders', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const data = OrderModel.list({ page });
  res.render('admin/orders', data);
});

// ─── Coupons Management ──────────────────────────────────────────
router.get('/coupons', (req, res) => {
  const coupons = CouponModel.list();
  res.render('admin/coupons', { coupons });
});

router.post('/coupons/create', (req, res) => {
  let { code, discount_type, discount_value, max_uses } = req.body;
  code = (code || '').trim().toUpperCase();
  if (!code) {
    req.session.flash = { type: 'error', message: '优惠码不能为空' };
    return res.redirect('/admin/coupons');
  }
  discount_value = parseFloat(discount_value);
  if (!discount_value || discount_value <= 0) {
    req.session.flash = { type: 'error', message: '折扣值必须大于 0' };
    return res.redirect('/admin/coupons');
  }
  if (discount_type === 'percent' && discount_value > 100) {
    req.session.flash = { type: 'error', message: '百分比折扣不能超过 100' };
    return res.redirect('/admin/coupons');
  }
  try {
    CouponModel.create({
      code,
      discount_type,
      discount_value,
      max_uses: parseInt(max_uses) || 0
    });
    req.session.flash = { type: 'success', message: `优惠码 ${code} 已创建` };
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      req.session.flash = { type: 'error', message: '优惠码已存在' };
    } else {
      req.session.flash = { type: 'error', message: err.message };
    }
  }
  res.redirect('/admin/coupons');
});

// Bulk coupon generation
router.post('/coupons/bulk', (req, res) => {
  let { prefix, count, discount_type, discount_value, max_uses } = req.body;
  count = Math.min(parseInt(count) || 10, 200); // max 200
  discount_value = parseFloat(discount_value);
  if (!discount_value || discount_value <= 0) {
    req.session.flash = { type: 'error', message: '折扣值必须大于 0' };
    return res.redirect('/admin/coupons');
  }
  if (discount_type === 'percent' && discount_value > 100) {
    req.session.flash = { type: 'error', message: '百分比折扣不能超过 100' };
    return res.redirect('/admin/coupons');
  }

  prefix = (prefix || '').trim().toUpperCase() || 'CODE';
  max_uses = parseInt(max_uses) || 0;
  const created = [];
  const errors = [];

  for (let i = 0; i < count; i++) {
    // Generate unique code: PREFIX + 6 random chars
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const code = `${prefix}${suffix}`;
    try {
      CouponModel.create({ code, discount_type, discount_value, max_uses });
      created.push(code);
    } catch (err) {
      errors.push(code);
    }
  }

  req.session.flash = {
    type: 'success',
    message: `批量生成完成：成功 ${created.length} 个${errors.length ? `，失败 ${errors.length} 个` : ''}`
  };
  res.redirect('/admin/coupons');
});

router.post('/coupons/:id/toggle', (req, res) => {
  const coupon = CouponModel.findById(req.params.id);
  if (coupon) {
    CouponModel.toggleEnabled(coupon.id, !coupon.enabled);
    req.session.flash = { type: 'success', message: coupon.enabled ? '已禁用' : '已启用' };
  }
  res.redirect('/admin/coupons');
});

router.post('/coupons/:id/delete', (req, res) => {
  CouponModel.delete(req.params.id);
  req.session.flash = { type: 'success', message: '优惠码已删除' };
  res.redirect('/admin/coupons');
});

// ─── Node Monitoring (节点监控) ──────────────────────────────────
router.get('/nodes', async (req, res) => {
  let inbounds = [];
  let serverStatus = null;
  let error = null;

  try {
    const resp = await XuiService.getInbounds();
    if (resp.success) {
      inbounds = resp.obj || [];
    } else {
      error = '获取 Inbound 列表失败';
    }
  } catch (err) {
    error = '无法连接 3x-ui 面板: ' + err.message;
  }

  try {
    const resp = await XuiService.getServerStatus();
    if (resp.success) serverStatus = resp.obj;
  } catch (e) {}

  // Helper for formatting bytes
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  };

  res.render('admin/nodes', { inbounds, serverStatus, error, formatBytes });
});

router.get('/nodes/refresh', (req, res) => {
  res.redirect('/admin/nodes');
});

// ─── XUI Config ──────────────────────────────────────────────────
router.get('/xui', (req, res) => {
  const config = XuiService.getConfig();
  res.render('admin/xui', { config });
});

router.post('/xui', (req, res) => {
  const { base_url, username, password } = req.body;
  XuiService.saveConfig({ base_url, username, password });
  req.session.flash = { type: 'success', message: '3x-ui 配置已保存' };
  res.redirect('/admin/xui');
});

router.post('/xui/test', async (req, res) => {
  try {
    const resp = await XuiService.getInbounds();
    res.json({ success: resp.success, message: resp.success ? '连接成功' : '请求失败' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
