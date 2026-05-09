const express = require('express');
const router = express.Router();
const UserModel = require('../models/user');

router.get('/login', (req, res) => {
  res.render('auth/login');
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = UserModel.verifyPassword(username, password);
  if (!user) {
    req.session.flash = { type: 'error', message: '用户名或密码错误' };
    return res.redirect('/auth/login');
  }
  if (user.status === 'banned') {
    req.session.flash = { type: 'error', message: '账号已被封禁' };
    return res.redirect('/auth/login');
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.redirect(user.role === 'admin' ? '/admin' : '/user');
});

router.get('/register', (req, res) => {
  res.render('auth/register');
});

router.post('/register', (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    req.session.flash = { type: 'error', message: '用户名和密码不能为空' };
    return res.redirect('/auth/register');
  }
  if (UserModel.findByUsername(username)) {
    req.session.flash = { type: 'error', message: '用户名已存在' };
    return res.redirect('/auth/register');
  }
  UserModel.create({ username, password, email });
  req.session.flash = { type: 'success', message: '注册成功，请登录' };
  res.redirect('/auth/login');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
