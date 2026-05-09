const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const SubModel = require('../models/subscription');
const PlanModel = require('../models/plan');
const SubService = require('../services/sub');
const { getDB } = require('../models/db');
const { v4: uuidv4 } = require('uuid');

router.use(requireAuth);

// User dashboard
router.get('/', (req, res) => {
  const subs = SubModel.findByUserId(req.session.user.id);
  res.render('user/dashboard', { subs });
});

// Browse plans
router.get('/plans', (req, res) => {
  const plans = PlanModel.list({ enabledOnly: true });
  res.render('user/plans', { plans });
});

// Subscribe to a plan
router.post('/subscribe/:planId', async (req, res) => {
  const plan = PlanModel.findById(req.params.planId);
  if (!plan || !plan.enabled) {
    req.session.flash = { type: 'error', message: '套餐不存在或已下架' };
    return res.redirect('/user/plans');
  }

  const user = req.session.user;
  const email = `user${user.id}_${Date.now()}`;
  const expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const sub = await SubService.createSubscription({
      userId: user.id,
      planId: plan.id,
      email,
      expiresAt
    });
    req.session.flash = { type: 'success', message: '订阅创建成功' };
    res.redirect(`/user/sub/${sub.token}`);
  } catch (err) {
    req.session.flash = { type: 'error', message: '创建失败: ' + err.message };
    res.redirect('/user/plans');
  }
});

// View subscription
router.get('/sub/:token', async (req, res) => {
  const sub = SubModel.findByToken(req.params.token);
  if (!sub || sub.user_id !== req.session.user.id) {
    return res.status(404).render('error', { message: '订阅不存在', code: 404 });
  }

  const baseUrl = process.env.SUB_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const subUrl = `${baseUrl}/sub/${sub.token}`;

  let result = null;
  try {
    result = await SubService.generateSubscription(sub.token);
  } catch (e) {}

  res.render('user/subscription', { sub, subUrl, result });
});

// Redeem code
router.get('/redeem', (req, res) => {
  res.render('user/redeem');
});

router.post('/redeem', async (req, res) => {
  const { code } = req.body;
  const db = getDB();
  const redeem = db.prepare('SELECT * FROM redeem_codes WHERE code = ? AND used_by IS NULL').get(code);

  if (!redeem) {
    req.session.flash = { type: 'error', message: '兑换码无效或已使用' };
    return res.redirect('/user/redeem');
  }

  const plan = PlanModel.findById(redeem.plan_id);
  if (!plan) {
    req.session.flash = { type: 'error', message: '关联套餐不存在' };
    return res.redirect('/user/redeem');
  }

  const user = req.session.user;
  const email = `user${user.id}_${Date.now()}`;
  const expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const sub = await SubService.createSubscription({
      userId: user.id,
      planId: plan.id,
      email,
      expiresAt
    });
    db.prepare('UPDATE redeem_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(user.id, redeem.id);
    req.session.flash = { type: 'success', message: '兑换成功' };
    res.redirect(`/user/sub/${sub.token}`);
  } catch (err) {
    req.session.flash = { type: 'error', message: '兑换失败: ' + err.message };
    res.redirect('/user/redeem');
  }
});

module.exports = router;
