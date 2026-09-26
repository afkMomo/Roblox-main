// GET /api/check?names=a,b,c
// -> { results: [{ name, status: "available" | "taken" | "unavailable", message }] }
// Browsers can't call roblox.com directly (CORS), so on Vercel the finder goes through here.
// The checking logic is shared with the browser fallback in usernamefinder/finder.js.
const {VALID_NAME, RateLimited, checkNames} = require('../usernamefinder/finder.js');

const MAX_NAMES = 25;

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  const send = (code, body) => { res.statusCode = code; res.end(JSON.stringify(body)); };

  const raw = new URL(req.url, 'http://localhost').searchParams.get('names') || '';
  const names = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))];
  if (!names.length || names.length > MAX_NAMES || !names.every(n => VALID_NAME.test(n))) {
    return send(400, { error: `Send 1 to ${MAX_NAMES} valid usernames as ?names=a,b,c` });
  }

  try {
    send(200, { results: await checkNames(names, 'roblox.com') });
  } catch (e) {
    if (e instanceof RateLimited) return send(429, { error: 'Roblox is rate limiting requests' });
    send(502, { error: e.message });
  }
};
