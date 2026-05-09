const express = require('express');
const router = express.Router();
const SubService = require('../services/sub');
const SubModel = require('../models/subscription');
const QRCode = require('qrcode');

// Subscription endpoint - auto-detect format by User-Agent
router.get('/:token', async (req, res) => {
  const { token } = req.params;
  const ua = (req.headers['user-agent'] || '').toLowerCase();

  const result = await SubService.generateSubscription(token);
  if (!result) {
    return res.status(404).send('Subscription not found');
  }
  if (result.expired) {
    return res.status(403).send('Subscription expired');
  }

  const { sub, nodes } = result;
  if (!nodes || nodes.length === 0) {
    return res.status(200).send('No nodes available');
  }

  // Auto-detect format based on User-Agent
  const isClash = ua.includes('clash') || ua.includes('meta');
  const isSingbox = ua.includes('sing-box') || ua.includes('singbox');
  const isQuantumult = ua.includes('quantumult');
  const isSurge = ua.includes('surge');
  const isShadowrocket = ua.includes('shadowrocket');

  if (isClash) {
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clash.yaml"');
    return res.send(SubService.exportClash(nodes));
  }

  if (isSingbox) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(SubService.exportSingbox(nodes));
  }

  // Default: base64 (V2RayN, Shadowrocket, Quantumult X, etc.)
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(SubService.exportBase64(nodes));
});

// QR Code
router.get('/:token/qr', async (req, res) => {
  const { token } = req.params;
  const sub = SubModel.findByToken(token);
  if (!sub) return res.status(404).send('Not found');

  const baseUrl = process.env.SUB_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const subUrl = `${baseUrl}/sub/${token}`;

  try {
    const qr = await QRCode.toDataURL(subUrl, { width: 300, margin: 2 });
    res.send(`<img src="${qr}" alt="QR Code" />`);
  } catch (err) {
    res.status(500).send('Failed to generate QR');
  }
});

// Raw links (base64)
router.get('/:token/raw', async (req, res) => {
  const result = await SubService.generateSubscription(req.params.token);
  if (!result || result.expired || !result.nodes?.length) {
    return res.status(404).send('Not available');
  }
  res.setHeader('Content-Type', 'text/plain');
  res.send(SubService.exportBase64(result.nodes));
});

// Clash YAML
router.get('/:token/clash', async (req, res) => {
  const result = await SubService.generateSubscription(req.params.token);
  if (!result || result.expired || !result.nodes?.length) {
    return res.status(404).send('Not available');
  }
  res.setHeader('Content-Type', 'text/yaml');
  res.send(SubService.exportClash(result.nodes));
});

// Sing-box JSON
router.get('/:token/singbox', async (req, res) => {
  const result = await SubService.generateSubscription(req.params.token);
  if (!result || result.expired || !result.nodes?.length) {
    return res.status(404).send('Not available');
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(SubService.exportSingbox(result.nodes));
});

module.exports = router;
