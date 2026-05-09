const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const OrderModel = require('../models/order');
const PlanModel = require('../models/plan');
const CouponModel = require('../models/coupon');
const SubService = require('../services/sub');
const PaymentService = require('../services/payment');

/**
 * 用户下单 → 跳转易支付收银台
 * POST /payment/create/:planId
 */
router.post('/create/:planId', requireAuth, async (req, res) => {
  const plan = PlanModel.findById(req.params.planId);
  if (!plan || !plan.enabled) {
    req.session.flash = { type: 'error', message: '套餐不存在或已下架' };
    return res.redirect('/user/plans');
  }

  const user = req.session.user;
  let amount = plan.price;
  let discount = 0;
  let couponCode = null;

  // 处理优惠码
  const code = (req.body.coupon_code || '').trim().toUpperCase();
  if (code) {
    const result = CouponModel.validate(code);
    if (!result.valid) {
      req.session.flash = { type: 'error', message: result.reason };
      return res.redirect('/user/plans');
    }
    const calc = CouponModel.calculate(amount, result.coupon);
    discount = calc.discount;
    amount = calc.final;
    couponCode = code;
  }

  // 免费（原价或折后为 0）直接创建订阅
  if (amount <= 0) {
    const email = `user${user.id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + plan.duration_days * 86400000).toISOString();
    try {
      if (couponCode) CouponModel.useOne(couponCode);
      const sub = await SubService.createSubscription({
        userId: user.id,
        planId: plan.id,
        email,
        expiresAt
      });
      req.session.flash = { type: 'success', message: '订阅创建成功' };
      return res.redirect(`/user/sub/${sub.token}`);
    } catch (err) {
      req.session.flash = { type: 'error', message: '创建失败: ' + err.message };
      return res.redirect('/user/plans');
    }
  }

  // 生成订单号
  const orderNo = `SD${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  // 写入订单表
  OrderModel.create({
    order_no: orderNo,
    user_id: user.id,
    plan_id: plan.id,
    amount: plan.price,
    discount,
    final_amount: amount,
    coupon_code: couponCode
  });

  // 扣减优惠码使用次数
  if (couponCode) CouponModel.useOne(couponCode);

  // 生成支付 URL 并跳转
  const payMethod = req.body.method || 'alipay';
  const payUrl = PaymentService.createPaymentUrl(
    orderNo,
    amount,
    `sub-distro - ${plan.name}${couponCode ? ` (优惠:${couponCode})` : ''}`,
    payMethod
  );

  res.redirect(payUrl);
});

/**
 * 易支付异步回调（POST，由易支付服务器调用）
 * POST /payment/notify
 */
router.post('/notify', express.urlencoded({ extended: false }), async (req, res) => {
  const params = req.body;

  // 验签
  if (!PaymentService.verifySign(params)) {
    console.warn('[payment] 签名验证失败:', params);
    return res.send('sign error');
  }

  // 校验 trade_status
  if (params.trade_status !== 'TRADE_SUCCESS') {
    return res.send('success');
  }

  const orderNo = params.out_trade_no;
  const tradeNo = params.trade_no;

  const order = OrderModel.findByOrderNo(orderNo);
  if (!order) {
    console.warn('[payment] 订单不存在:', orderNo);
    return res.send('order not found');
  }

  // 幂等
  if (order.status === 'paid') {
    return res.send('success');
  }

  // 标记已支付
  OrderModel.markPaid(orderNo, tradeNo);
  console.log(`[payment] 订单 ${orderNo} 支付成功，交易号: ${tradeNo}`);

  // 自动创建订阅
  const plan = PlanModel.findById(order.plan_id);
  if (plan) {
    const email = `user${order.user_id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + plan.duration_days * 86400000).toISOString();
    try {
      await SubService.createSubscription({
        userId: order.user_id,
        planId: plan.id,
        email,
        expiresAt
      });
      console.log(`[payment] 订单 ${orderNo} 订阅已创建`);
    } catch (err) {
      console.error(`[payment] 订单 ${orderNo} 订阅创建失败:`, err.message);
    }
  }

  res.send('success');
});

/**
 * 易支付同步回调
 * GET /payment/return
 */
router.get('/return', (req, res) => {
  req.session.flash = { type: 'success', message: '支付完成，请查看订阅列表' };
  res.redirect('/user/orders');
});

module.exports = router;
