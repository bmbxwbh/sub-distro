const crypto = require('crypto');

/**
 * 易支付 (EPay) 支付服务
 * 兼容主流易支付接口协议 v1.1
 */
const PaymentService = {
  get config() {
    return {
      apiUrl: process.env.EPAY_API_URL || 'https://pay.example.com',
      pid: process.env.EPAY_PID || '',
      key: process.env.EPAY_KEY || '',
      notifyUrl: `${process.env.SUB_BASE_URL || 'http://localhost:3000'}/payment/notify`,
      returnUrl: `${process.env.SUB_BASE_URL || 'http://localhost:3000'}/user/orders`,
    };
  },

  /**
   * 创建支付链接
   * @param {string} orderNo - 商户订单号
   * @param {number} amount - 金额（元）
   * @param {string} title - 商品名称
   * @param {string} method - 支付方式: alipay / qqpay / wxpay
   * @returns {string} 跳转 URL
   */
  createPaymentUrl(orderNo, amount, title, method = 'alipay') {
    const { apiUrl, pid, key, notifyUrl, returnUrl } = this.config;

    const params = {
      pid: pid,
      type: method,
      out_trade_no: orderNo,
      notify_url: notifyUrl,
      return_url: returnUrl,
      name: title,
      money: amount.toFixed(2),
    };

    // 生成签名
    params.sign = this._sign(params);
    params.sign_type = 'MD5';

    // 拼接跳转 URL
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    return `${apiUrl}/submit.php?${query}`;
  },

  /**
   * 验证回调签名
   * @param {object} params - 回调参数
   * @returns {boolean}
   */
  verifySign(params) {
    const { sign } = params;
    if (!sign) return false;

    const signParams = { ...params };
    delete signParams.sign;
    delete signParams.sign_type;

    return sign === this._sign(signParams);
  },

  /**
   * 查询订单状态
   * @param {string} orderNo - 商户订单号
   * @returns {object} 查询结果
   */
  async queryOrder(orderNo) {
    const { apiUrl, pid, key } = this.config;

    const params = {
      act: 'order',
      pid: pid,
      out_trade_no: orderNo,
    };

    params.sign = this._sign(params);
    params.sign_type = 'MD5';

    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    try {
      const resp = await fetch(`${apiUrl}/mapi.php?${query}`);
      return await resp.json();
    } catch (err) {
      return { code: -1, msg: err.message };
    }
  },

  /**
   * MD5 签名
   * 按参数名 ASCII 升序排列，key=value&拼接，末尾追加密钥
   */
  _sign(params) {
    const { key } = this.config;

    const sortedStr = Object.keys(params)
      .filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');

    return crypto.createHash('md5')
      .update(sortedStr + key)
      .digest('hex');
  }
};

module.exports = PaymentService;
