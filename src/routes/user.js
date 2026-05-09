const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const SubModel = require('../models/subscription');
const PlanModel = require('../models/plan');
const OrderModel = require('../models/order');
const SubService = require('../services/sub');

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

// Subscribe to a plan — redirect to payment
router.post('/subscribe/:planId', (req, res) => {
  const plan = PlanModel.findById(req.params.planId);
  if (!plan || !plan.enabled) {
    req.session.flash = { type: 'error', message: '套餐不存在或已下架' };
    return res.redirect('/user/plans');
  }

  // 免费套餐直接创建
  if (!plan.price || plan.price <= 0) {
    const user = req.session.user;
    const email = `user${user.id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();
    SubService.createSubscription({ userId: user.id, planId: plan.id, email, expiresAt })
      .then(sub => {
        req.session.flash = { type: 'success', message: '订阅创建成功' };
        res.redirect(`/user/sub/${sub.token}`);
      })
      .catch(err => {
        req.session.flash = { type: 'error', message: '创建失败: ' + err.message };
        res.redirect('/user/plans');
      });
    return;
  }

  // 付费套餐 → 跳转支付下单（由 payment 路由处理）
  res.redirect(307, `/payment/create/${plan.id}`);
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

// Orders list
router.get('/orders', (req, res) => {
  const orders = OrderModel.findByUserId(req.session.user.id);
  res.render('user/orders', { orders });
});

module.exports = router;
