// node test/check.test.cjs  -- username generator rules + /api/check handler (Roblox is stubbed).
const assert = require('node:assert');
const {VALID_NAME, criteriaError, generate, nextBatch} = require('../usernamefinder/finder.js');
const handler = require('../api/check.js');

const base = {min: 5, max: 8, count: 10, letters: true, digits: true, underscore: true, style: 'random', prefix: '', contains: '', suffix: ''};

// Roblox rules
for (const ok of ['abc', 'a_b', 'Builder_man1', 'x'.repeat(20)]) assert.ok(VALID_NAME.test(ok), ok);
for (const bad of ['ab', 'x'.repeat(21), '_abc', 'abc_', 'a__b', 'a_b_c', 'ab-c', 'ab c']) assert.ok(!VALID_NAME.test(bad), bad);

// Generated names always obey the user's rules and Roblox's
const rules = [
  base,
  {...base, style: 'pronounceable'},
  {...base, prefix: 'Neo', suffix: 'X', min: 6, max: 10},
  {...base, contains: 'ro_', digits: false, min: 7, max: 7},
  {...base, letters: false, min: 3, max: 3, underscore: false},
];
for (const o of rules) {
  assert.strictEqual(criteriaError(o), '');
  for (let i = 0; i < 2000; i++) {
    const n = generate(o);
    if (!n) continue;
    assert.ok(VALID_NAME.test(n), n);
    assert.ok(n.length >= o.min && n.length <= o.max, `${n} length`);
    assert.ok(n.startsWith(o.prefix) && n.endsWith(o.suffix) && n.includes(o.contains), `${n} pattern`);
    if (!o.letters) assert.ok(/^\d+$/.test(n), `${n} digits only`);
    if (!o.digits) assert.ok(!/\d/.test(n.replace(o.prefix + o.contains + o.suffix, '')), `${n} no digits`);
  }
}

// Impossible rules are rejected up front
assert.match(criteriaError({...base, min: 9}), /Minimum/);
assert.match(criteriaError({...base, letters: false, digits: false}), /letters/);
assert.match(criteriaError({...base, prefix: 'a_', suffix: '_b'}), /one underscore/);
assert.match(criteriaError({...base, prefix: '_a'}), /start or end/);
assert.match(criteriaError({...base, prefix: 'abcdefghi'}), /longer than/);
assert.match(criteriaError({...base, contains: 'a-b'}), /only use/);

// A tiny search space runs dry instead of looping forever: 3 digits = 1000 names
const seen = new Set();
const digits3 = {...base, letters: false, underscore: false, min: 3, max: 3};
let total = 0;
for (let b; (b = nextBatch(digits3, seen, 25)).length;) total += b.length;
assert.strictEqual(total, 1000);

// API handler
function call(query) {
  return new Promise(resolve => {
    const res = {statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { resolve({status: this.statusCode, body: JSON.parse(body)}); }};
    handler({url: `/api/check?${query}`}, res);
  });
}
const json = (status, body) => ({status, ok: status < 300, json: async () => body});

(async () => {
  let validated = [];
  global.fetch = async url => {
    if (url.includes('usernames/users')) return json(200, {data: [{requestedUsername: 'builderman'}]});
    const name = new URL(url).searchParams.get('Username');
    validated.push(name);
    return json(200, name === 'badword1' ? {code: 2, message: 'Username not appropriate for Roblox'} : {code: 0, message: 'Username is valid'});
  };

  const r = await call('names=BuilderMan,freeone,badword1');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.results.map(x => x.status), ['taken', 'available', 'unavailable']);
  assert.deepStrictEqual(validated, ['freeone', 'badword1'], 'taken names skip the validator');

  assert.strictEqual((await call('names=')).status, 400);
  assert.strictEqual((await call('names=a_b_c')).status, 400);
  assert.strictEqual((await call(`names=${Array.from({length: 26}, (_, i) => 'name' + i).join(',')}`)).status, 400);

  global.fetch = async () => json(429, {});
  const limited = await call('names=freeone');
  assert.strictEqual(limited.status, 429);
  assert.ok(limited.body.retryAfter > 0);

  console.log('all checks passed');
})();
