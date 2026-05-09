const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const UserModel = require('../models/user');
const PlanModel = require('../models/plan');
const SubModel = require('../models/subscription');
const XuiService = require('../services/xui');

router.use(requireAdmin);

// Dashboard
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

// Users management
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

// Plans management
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

// Subscriptions management
router.get('/subscriptions', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const data = SubModel.list({ page });
  res.render('admin/subscriptions', data);
});

// XUI config
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
