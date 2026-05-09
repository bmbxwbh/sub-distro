const { getDB } = require('../models/db');

const XuiService = {
  getConfig() {
    return getDB().prepare('SELECT * FROM xui_config WHERE id = 1').get();
  },

  saveConfig({ base_url, username, password }) {
    const existing = this.getConfig();
    if (existing) {
      getDB().prepare('UPDATE xui_config SET base_url = ?, username = ?, password = ? WHERE id = 1')
        .run(base_url, username, password);
    } else {
      getDB().prepare('INSERT INTO xui_config (id, base_url, username, password) VALUES (1, ?, ?, ?)')
        .run(base_url, username, password);
    }
  },

  async login() {
    const config = this.getConfig();
    if (!config) throw new Error('3x-ui not configured');

    const resp = await fetch(`${config.base_url}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `user=${encodeURIComponent(config.username)}&pass=${encodeURIComponent(config.password)}`,
      redirect: 'manual'
    });

    const cookies = resp.headers.getSetCookie?.() || [];
    const sessionCookie = cookies
      .map(c => c.split(';')[0])
      .join('; ');

    if (sessionCookie) {
      getDB().prepare('UPDATE xui_config SET session_cookie = ?, cookie_updated_at = CURRENT_TIMESTAMP WHERE id = 1')
        .run(sessionCookie);
    }

    return sessionCookie;
  },

  async getSessionCookie() {
    const config = this.getConfig();
    if (!config) throw new Error('3x-ui not configured');
    if (config.session_cookie) return config.session_cookie;
    return await this.login();
  },

  async apiRequest(method, path, body = null) {
    const config = this.getConfig();
    if (!config) throw new Error('3x-ui not configured');

    let cookie = await this.getSessionCookie();
    const opts = {
      method,
      headers: { Cookie: cookie }
    };

    if (body) {
      if (body instanceof URLSearchParams) {
        opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        opts.body = body.toString();
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }

    let resp = await fetch(`${config.base_url}${path}`, opts);

    // Re-login on 401/403
    if (resp.status === 401 || resp.status === 403) {
      cookie = await this.login();
      opts.headers.Cookie = cookie;
      resp = await fetch(`${config.base_url}${path}`, opts);
    }

    return resp.json();
  },

  async getInbounds() {
    return this.apiRequest('GET', '/panel/api/inbounds/list');
  },

  async getInbound(id) {
    return this.apiRequest('GET', `/panel/api/inbounds/get/${id}`);
  },

  async addClient(inboundId, client) {
    const settings = JSON.stringify({ clients: [client] });
    const params = new URLSearchParams();
    params.append('id', inboundId);
    params.append('settings', settings);
    return this.apiRequest('POST', '/panel/api/inbounds/addClient', params);
  },

  async updateClient(clientId, inboundId, client) {
    const settings = JSON.stringify({ clients: [client] });
    const params = new URLSearchParams();
    params.append('id', inboundId);
    params.append('settings', settings);
    return this.apiRequest('POST', `/panel/api/inbounds/updateClient/${clientId}`, params);
  },

  async deleteClient(inboundId, clientId) {
    return this.apiRequest('POST', `/panel/api/inbounds/${inboundId}/delClient/${clientId}`);
  },

  async getClientTraffics(email) {
    return this.apiRequest('GET', `/panel/api/inbounds/getClientTraffics/${email}`);
  },

  async resetClientTraffic(inboundId, email) {
    return this.apiRequest('POST', `/panel/api/inbounds/${inboundId}/resetClientTraffic/${email}`);
  },

  async getServerStatus() {
    return this.apiRequest('GET', '/panel/api/server/status');
  },

  async getConfigJson() {
    return this.apiRequest('GET', '/panel/api/server/getConfigJson');
  }
};

module.exports = XuiService;
