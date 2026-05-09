function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'error', message: '请先登录' };
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: '无权访问', code: 403 });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
