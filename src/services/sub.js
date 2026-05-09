const XuiService = require('./xui');
const { getDB } = require('../models/db');
const SubModel = require('../models/subscription');
const { v4: uuidv4 } = require('uuid');

const SubService = {
  /**
   * Create a subscription: create client in 3x-ui + save to DB
   */
  async createSubscription({ userId, planId, email, expiresAt }) {
    const plan = getDB().prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) throw new Error('Plan not found');

    const clientUuid = uuidv4();
    const client = {
      id: clientUuid,
      email: email,
      flow: 'xtls-rprx-vision',
      enable: true,
      expiryTime: new Date(expiresAt).getTime(),
      tgId: '',
      subId: '',
      limitIp: plan.max_ips || 3,
      totalGB: (plan.data_limit || 0) * 1024 * 1024 * 1024,
      remark: email
    };

    // Add client to 3x-ui inbound
    if (plan.inbound_id) {
      try {
        await XuiService.addClient(plan.inbound_id, client);
      } catch (err) {
        console.error('Failed to add client to 3x-ui:', err.message);
      }
    }

    // Save to DB
    const sub = SubModel.create({
      user_id: userId,
      plan_id: planId,
      email,
      uuid: clientUuid,
      data_limit: plan.data_limit,
      expires_at: expiresAt,
      inbound_id: plan.inbound_id
    });

    return sub;
  },

  /**
   * Generate subscription content in various formats
   */
  async generateSubscription(token, format = 'auto') {
    const sub = SubModel.findByToken(token);
    if (!sub || !sub.enabled) return null;

    // Check expiry
    if (new Date(sub.expires_at) < new Date()) {
      return { expired: true };
    }

    // Get inbound config for node info
    let nodes = [];
    if (sub.inbound_id) {
      try {
        const resp = await XuiService.getInbound(sub.inbound_id);
        if (resp.success && resp.obj) {
          nodes = this._parseInboundToNodes(resp.obj, sub);
        }
      } catch (err) {
        console.error('Failed to get inbound:', err.message);
      }
    }

    // Sync traffic from 3x-ui
    try {
      const traffic = await XuiService.getClientTraffics(sub.email);
      if (traffic.success && traffic.obj) {
        const clientTraffic = Array.isArray(traffic.obj)
          ? traffic.obj.find(t => t.email === sub.email)
          : null;
        if (clientTraffic) {
          SubModel.update(sub.id, {
            data_used: Math.round((clientTraffic.up + clientTraffic.down) / (1024 * 1024))
          });
          sub.data_used = Math.round((clientTraffic.up + clientTraffic.down) / (1024 * 1024));
        }
      }
    } catch (err) {
      // Non-critical
    }

    return {
      sub,
      nodes,
      format
    };
  },

  /**
   * Parse 3x-ui inbound config into node connection strings
   */
  _parseInboundToNodes(inbound, sub) {
    const nodes = [];
    const settings = JSON.parse(inbound.settings || '{}');
    const streamSettings = JSON.parse(inbound.streamSettings || '{}');

    // Determine host (use panel domain or IP)
    const config = getDB().prepare('SELECT base_url FROM xui_config WHERE id = 1').get();
    const host = config ? new URL(config.base_url).hostname : '0.0.0.0';
    const port = inbound.port;

    const protocol = inbound.protocol;

    if (protocol === 'vless') {
      const tls = streamSettings.tlsSettings || streamSettings.realitySettings;
      const isReality = !!streamSettings.realitySettings;
      const network = streamSettings.network || 'tcp';

      let link = `vless://${sub.uuid}@${host}:${port}`;
      link += `?type=${network}`;

      if (isReality) {
        const rs = streamSettings.realitySettings;
        link += `&security=reality`;
        link += `&fp=${rs.settings?.fingerprint || 'chrome'}`;
        link += `&pbk=${rs.settings?.publicKey || ''}`;
        link += `&sid=${rs.settings?.shortId || ''}`;
        link += `&sni=${rs.serverNames?.[0] || host}`;
      } else if (streamSettings.security === 'tls') {
        link += `&security=tls`;
        link += `&sni=${streamSettings.tlsSettings?.serverName || host}`;
      }

      link += `#${encodeURIComponent(inbound.remark || `VLESS-${port}`)}`;
      nodes.push({ name: inbound.remark || `VLESS-${port}`, link, protocol: 'vless' });
    }

    if (protocol === 'vmess') {
      const vmessObj = {
        v: '2',
        ps: inbound.remark || `VMess-${port}`,
        add: host,
        port: port.toString(),
        id: sub.uuid,
        aid: '0',
        net: streamSettings.network || 'tcp',
        type: 'none',
        host: '',
        path: '',
        tls: streamSettings.security || 'none'
      };

      if (streamSettings.network === 'ws') {
        vmessObj.path = streamSettings.wsSettings?.path || '';
        vmessObj.host = streamSettings.wsSettings?.headers?.Host || '';
      }

      const link = 'vmess://' + Buffer.from(JSON.stringify(vmessObj)).toString('base64');
      nodes.push({ name: inbound.remark || `VMess-${port}`, link, protocol: 'vmess' });
    }

    if (protocol === 'trojan') {
      let link = `trojan://${sub.uuid}@${host}:${port}`;
      const sni = streamSettings.tlsSettings?.serverName || host;
      link += `?security=tls&sni=${sni}`;
      link += `#${encodeURIComponent(inbound.remark || `Trojan-${port}`)}`;
      nodes.push({ name: inbound.remark || `Trojan-${port}`, link, protocol: 'trojan' });
    }

    if (protocol === 'shadowsocks') {
      const method = inbound.settings?.method || settings.method || 'chacha20-ietf-poly1305';
      const password = sub.uuid;
      const ssLink = `${method}:${password}@${host}:${port}`;
      const encoded = Buffer.from(ssLink).toString('base64');
      nodes.push({
        name: inbound.remark || `SS-${port}`,
        link: `ss://${encoded}#${encodeURIComponent(inbound.remark || `SS-${port}`)}`,
        protocol: 'shadowsocks'
      });
    }

    return nodes;
  },

  /**
   * Export subscription in various formats
   */
  exportBase64(nodes) {
    return Buffer.from(nodes.map(n => n.link).join('\n')).toString('base64');
  },

  exportClash(nodes) {
    // Basic Clash YAML
    let yaml = 'proxies:\n';
    for (const node of nodes) {
      yaml += `  - name: ${node.name}\n`;
      yaml += `    type: ${node.protocol}\n`;
      yaml += `    server: placeholder\n`;
      yaml += `    port: 443\n`;
    }
    return yaml;
  },

  exportSingbox(nodes) {
    return JSON.stringify({
      outbounds: nodes.map(n => ({
        type: n.protocol,
        tag: n.name,
        server: 'placeholder',
        server_port: 443
      }))
    }, null, 2);
  }
};

module.exports = SubService;
