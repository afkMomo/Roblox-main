// GET /api/check?names=a,b,c
// -> { results: [{ name, status: "available" | "taken" | "unavailable", message }] }
//
// Browsers can't call Roblox directly (CORS), so this runs on Vercel.
// 1. One batch lookup removes names that belong to existing accounts (cheap, 1 request).
// 2. The rest go through Roblox's signup validator, which also catches filtered or reserved names.
const VALID_NAME = /^(?=.{3,20}$)[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?$/;
const MAX_NAMES = 25;
const CONCURRENCY = 5;

class RateLimited extends Error {}

async function roblox(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json' } });
  if (res.status === 429) throw new RateLimited();
  if (!res.ok) throw new Error(`Roblox responded ${res.status}`);
  return res.json();
}

async function existingAccounts(names) {
  const { data } = await roblox('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    body: JSON.stringify({ usernames: names, excludeBannedUsers: false }),
  });
  return new Set(data.map(u => u.requestedUsername.toLowerCase()));
}

async function validate(name) {
  const q = new URLSearchParams({ Username: name, Birthday: '2000-01-01T00:00:00.000Z' });
  const { code, message } = await roblox(`https://auth.roblox.com/v1/usernames/validate?${q}`);
  const status = code === 0 ? 'available' : code === 1 ? 'taken' : 'unavailable';
  return { name, status, message };
}

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
    const taken = await existingAccounts(names);
    const results = names.map(name =>
      taken.has(name.toLowerCase()) ? { name, status: 'taken', message: 'Username is already in use' } : null);
    const todo = names.filter((_, i) => !results[i]);
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
      for (const r of await Promise.all(todo.slice(i, i + CONCURRENCY).map(validate))) {
        results[names.indexOf(r.name)] = r;
      }
    }
    send(200, { results });
  } catch (e) {
    if (e instanceof RateLimited) return send(429, { error: 'Roblox is rate limiting requests', retryAfter: 15 });
    send(502, { error: e.message });
  }
};
