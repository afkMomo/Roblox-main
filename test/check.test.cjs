// node test/check.test.cjs  -- name rules, chat colors, the username generator, and both API handlers (Roblox is stubbed).
const assert = require('node:assert');
const roblox = require('../roblox.js');
const {WORDS} = require('../usernamefinder/words.js');
Object.assign(globalThis, roblox, {WORDS}); // finder.js expects these as page globals
const {criteriaError, makeGenerator, nextBatch} = require('../usernamefinder/finder.js');
const {VALID_NAME, CHAT_COLORS, chatColorIndex, lookup} = roblox;

// Roblox name rules
for (const ok of ['abc', 'a_b', 'Builder_man1', 'x'.repeat(20)]) assert.ok(VALID_NAME.test(ok), ok);
for (const bad of ['ab', 'x'.repeat(21), '_abc', 'abc_', 'a__b', 'a_b_c', 'ab-c', 'ab c']) assert.ok(!VALID_NAME.test(bad), bad);

// Chat color: worked by hand from Roblox's GetNameValue.
// "abc" (odd length): a -> reverse 3-1=2 -> negative; b -> 1 -> +; c -> 0 -> +.  -97 + 98 + 99 = 100, 100 % 8 = 4 (Orange)
assert.strictEqual(chatColorIndex('abc'), 4);
// "ab" (even): a -> reverse 2 -> negative, b -> 1 -> +.  -97 + 98 = 1 (Blue)
assert.strictEqual(chatColorIndex('ab'), 1);
// Negative totals wrap like Lua's floored %: "ba" -> -98 + 97 = -1 -> 7 (Tan)
assert.strictEqual(chatColorIndex('ba'), 7);
// Upper and lower case differ by 32, a multiple of 8, so capitalization never changes the color.
assert.strictEqual(chatColorIndex('MoMo_Builder'), chatColorIndex('momo_builder'));
assert.strictEqual(CHAT_COLORS.length, 8);

// Word lists are clean single tokens
for (const [cat, list] of Object.entries(WORDS)) {
  assert.ok(list.length >= 40, `${cat} has words`);
  for (const w of list) assert.match(w, /^[a-z]+$/, `${cat}: ${w}`);
}

// Generated names obey the user's rules and Roblox's, for every style
const base = {
  style: 'random', min: 5, max: 14, letters: true, digits: true, underscore: true, categories: ['adjectives', 'animals'],
  customWords: [], pattern: 'CVCVC', caseStyle: 'lower', numbers: 'none', numMin: 1, numMax: 3,
  prefix: '', contains: '', suffix: '', exclude: '', colors: [], unlimited: false, count: 10, pace: 0,
};
const rules = [
  base,
  {...base, style: 'pronounceable', numbers: 'end', min: 6, max: 9},
  {...base, style: 'word', caseStyle: 'capital', numbers: 'end', numMin: 2, numMax: 2},
  {...base, style: 'twowords', caseStyle: 'camel'},
  {...base, style: 'wordword', categories: ['colors', 'space'], min: 5, max: 20},
  {...base, style: 'pattern', pattern: 'neoCVD_D', min: 3, max: 20},
  {...base, style: 'twowords', customWords: ['momo', 'pixel'], categories: ['adjectives'], prefix: 'xX', suffix: 'Xx', min: 8, max: 20},
  {...base, style: 'random', contains: 'ro', exclude: 'aeiu', colors: [0, 5], digits: false, underscore: false},
  {...base, style: 'word', categories: ['food'], caseStyle: 'upper', numbers: 'start'},
];
for (const o of rules) {
  assert.strictEqual(criteriaError(o), '', `${o.style} rules are valid`);
  const gen = makeGenerator(o);
  let made = 0;
  for (let i = 0; i < 3000; i++) {
    const n = gen();
    if (!n) continue;
    made++;
    assert.ok(VALID_NAME.test(n), `${o.style}: ${n}`);
    if (o.style !== 'pattern') assert.ok(n.length >= o.min && n.length <= o.max, `${n} length`);
    assert.ok(n.startsWith(o.prefix) && n.endsWith(o.suffix), `${n} prefix/suffix`);
    assert.ok(n.toLowerCase().includes(o.contains), `${n} contains`);
    assert.ok(![...n.toLowerCase()].some(c => o.exclude.includes(c)), `${n} excluded chars`);
    if (o.colors.length) assert.ok(o.colors.includes(chatColorIndex(n)), `${n} color`);
    if (o.style === 'wordword') assert.match(n, /^[a-z]+_[a-z]+$/, n);
    if (o.style === 'twowords' && o.caseStyle === 'camel' && !o.prefix) assert.match(n, /^[A-Z][a-z]+[A-Z][a-z]+$/, n);
    if (o.style === 'pattern') assert.match(n, /^neo[bcdfghjklmnprstvwz][aeiou]\d_\d$/, n);
    if (o.style === 'word' && o.caseStyle === 'upper') assert.match(n, /^\d{1,3}[A-Z]+$/, n);
    if (o.numbers === 'end' && o.style === 'word') assert.match(n, /^[A-Z][a-z]+\d\d$/, n);
  }
  assert.ok(made > 50, `${o.style} makes names (${made})`);
}

// Impossible rules are rejected up front
assert.match(criteriaError({...base, min: 15}), /Minimum/);
assert.match(criteriaError({...base, letters: false, digits: false}), /letters/);
assert.match(criteriaError({...base, prefix: 'a_', suffix: '_b'}), /one underscore/);
assert.match(criteriaError({...base, style: 'wordword', prefix: 'a_'}), /already uses/);
assert.match(criteriaError({...base, prefix: '_a'}), /start or end/);
assert.match(criteriaError({...base, prefix: 'abcdefghijklmno'}), /longer than/);
assert.match(criteriaError({...base, style: 'pattern', pattern: 'CV'}), /3 to 20/);
assert.match(criteriaError({...base, style: 'pattern', pattern: 'CV-D'}), /Patterns can use/);
assert.match(criteriaError({...base, style: 'word', categories: []}), /word type/);
assert.match(criteriaError({...base, prefix: 'xa', exclude: 'a'}), /excluded/);
assert.strictEqual(criteriaError({...base, unlimited: true, count: 0}), '');

// A tiny search space runs dry instead of looping forever: 3 digits = 1000 names
const seen = new Set();
const gen3 = makeGenerator({...base, letters: false, underscore: false, min: 3, max: 3});
let total = 0;
for (let b; (b = nextBatch(gen3, seen, 100)).length;) total += b.length;
assert.strictEqual(total, 1000);

// API handlers
const json = (status, body) => ({status, ok: status < 300, json: async () => body, arrayBuffer: async () => body});
function call(handler, query) {
  return new Promise(resolve => {
    const res = {statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { resolve({status: this.statusCode, headers: this.headers, body}); }};
    handler({url: `/api/x?${query}`}, res);
  });
}

(async () => {
  const check = require('../api/check.js');
  const clothing = require('../api/clothing.js');
  let validated = [];
  const robloxStub = async (url, init) => {
    if (url.includes('usernames/users')) {
      assert.strictEqual(init.headers['content-type'], 'text/plain', 'no CORS preflight');
      return json(200, {data: [{requestedUsername: 'builderman'}]});
    }
    const name = new URL(url).searchParams.get('Username');
    validated.push(name);
    return json(200, name === 'badword1' ? {code: 2, message: 'Username not appropriate for Roblox'} : {code: 0, message: 'Username is valid'});
  };
  global.fetch = robloxStub;

  const r = await call(check, 'names=BuilderMan,freeone,badword1');
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(JSON.parse(r.body).results.map(x => x.status), ['taken', 'available', 'unavailable']);
  assert.deepStrictEqual(validated, ['freeone', 'badword1'], 'taken names skip the validator');
  assert.strictEqual((await call(check, 'names=')).status, 400);
  assert.strictEqual((await call(check, 'names=a_b_c')).status, 400);
  assert.strictEqual((await call(check, `names=${Array.from({length: 101}, (_, i) => 'name' + i).join(',')}`)).status, 400);

  global.fetch = async () => json(429, {});
  assert.strictEqual((await call(check, 'names=freeone')).status, 429);

  // Browser on static hosting: /api/check 404s, so lookup() goes to RoProxy directly.
  const hosts = [];
  global.fetch = async (url, init) => {
    if (url.startsWith('/api/')) return json(404, {});
    hosts.push(new URL(url).host);
    return robloxStub(url, init);
  };
  assert.deepStrictEqual((await lookup(['BuilderMan', 'freeone'])).map(x => x.status), ['taken', 'available']);
  assert.deepStrictEqual(hosts, ['users.roproxy.com', 'auth.roproxy.com']);

  // Clothing: shirt id -> model file -> template image id -> PNG bytes.
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  global.fetch = async url => {
    if (url.includes('/details')) return json(200, {Name: 'Cool Shirt', AssetTypeId: url.includes('/555/') ? 11 : 19});
    if (url.includes('assetId/555')) return json(200, {location: 'https://cdn/model'});
    if (url.includes('assetId/556')) return json(200, {location: 'https://cdn/png'});
    if (url === 'https://cdn/model') return json(200, Buffer.from('<Content name="ShirtTemplate"><url>http://www.roblox.com/asset/?id=556</url></Content>'));
    if (url === 'https://cdn/png') return json(200, png);
    throw new Error(`unexpected ${url}`);
  };
  const shirt = await call(clothing, 'id=555');
  assert.strictEqual(shirt.status, 200);
  assert.strictEqual(shirt.headers['content-type'], 'image/png');
  assert.strictEqual(shirt.headers['x-asset-type'], 'shirt');
  assert.strictEqual(decodeURIComponent(shirt.headers['x-asset-name']), 'Cool Shirt');
  assert.ok(png.equals(shirt.body));
  assert.strictEqual((await call(clothing, 'id=777')).status, 415, 'non-clothing asset types are refused');
  assert.strictEqual((await call(clothing, 'id=12ab')).status, 400);

  console.log('all checks passed');
})();
