/**
 * slack-proxy.js — Tiny local proxy to forward messages to Slack API.
 * Needed because Slack's Web API does not support browser CORS requests.
 *
 * Usage: node slack-proxy.js
 * Listens on http://localhost:3002
 */

const https = require('https');
const http  = require('http');

const PORT = 3002;

http.createServer((req, res) => {
  // Allow requests from the browser (localhost)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST')    { res.writeHead(405); res.end(); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); }
    catch { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'invalid JSON' })); return; }

    const { token, channel, text } = parsed;
    if (!token || !channel || !text) {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: 'missing token, channel, or text' }));
      return;
    }

    const payload = JSON.stringify({ channel, text, mrkdwn: true });

    const options = {
      hostname: 'slack.com',
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const slackReq = https.request(options, slackRes => {
      let data = '';
      slackRes.on('data', chunk => data += chunk);
      slackRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });

    slackReq.on('error', err => {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: err.message }));
    });

    slackReq.write(payload);
    slackReq.end();
  });

}).listen(PORT, () => {
  console.log(`Slack proxy running → http://localhost:${PORT}`);
  console.log('Keep this terminal open while using NewsWatch.');
});
