// Username finder: generate names from the user's rules, check them against Roblox, and keep
// going until enough are found or the user presses Stop.
// Needs roblox.js and words.js loaded first (the test puts their exports on globalThis).

const LETTERS = 'abcdefghijklmnopqrstuvwxyz', DIGITS = '0123456789';
const CONSONANTS = 'bcdfghjklmnprstvwz', VOWELS = 'aeiou';
const WORD_STYLES = ['word', 'twowords', 'wordword'];
const FIRST_WORDS = ['adjectives', 'colors']; // read naturally as the first word of a pair
const pick = a => a[Math.floor(Math.random() * a.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
const underscores = s => (s.match(/_/g) || []).length;

function criteriaError(o) {
  const fixed = o.prefix + o.contains + o.suffix;
  if (/[^A-Za-z0-9_]/.test(fixed)) return 'Starts with, Contains, and Ends with can only use letters, numbers, and underscores.';
  if (underscores(fixed) > 1) return 'Roblox allows only one underscore per name.';
  if (o.style === 'wordword' && fixed.includes('_')) return 'word_word already uses the one underscore Roblox allows.';
  if (o.prefix.startsWith('_') || o.suffix.endsWith('_')) return 'Names cannot start or end with an underscore.';
  if ([...fixed.toLowerCase()].some(c => o.exclude.includes(c))) return 'Your fixed text uses a character you excluded.';
  if (o.style === 'pattern') {
    if (!/^[A-Za-z0-9_?*]+$/.test(o.pattern)) return 'Patterns can use C, V, L, D, ?, one underscore, and fixed letters or numbers.';
    const full = o.prefix + o.pattern + o.suffix;
    if (full.length < 3 || full.length > 20) return `This pattern makes ${full.length}-character names. Roblox allows 3 to 20.`;
    if (underscores(full) > 1) return 'Roblox allows only one underscore per name.';
  } else {
    if (!(o.min >= 3 && o.max <= 20)) return 'Length must be between 3 and 20.';
    if (o.min > o.max) return 'Minimum length is larger than the maximum.';
    if (fixed.length > o.max) return `Your fixed text is ${fixed.length} characters, longer than the maximum length.`;
  }
  if (o.style === 'random' && !o.letters && !o.digits) return 'Pick letters, numbers, or both.';
  if (WORD_STYLES.includes(o.style) && !o.categories.length && !o.customWords.length) return 'Pick at least one word type or add your own words.';
  if (o.numbers !== 'none' && !(o.numMin >= 1 && o.numMax <= 6 && o.numMin <= o.numMax)) return 'Digits must be 1 to 6, with the minimum no larger than the maximum.';
  if (!o.unlimited && !(o.count >= 1)) return 'Find at least 1 name, or turn on No limit.';
  return '';
}

// Returns a function that makes one candidate, or null when a roll breaks a rule (the caller rolls again).
function makeGenerator(o) {
  const ex = o.exclude;
  const keep = s => [...s].filter(c => !ex.includes(c)).join('');
  const letters = keep(LETTERS), digits = keep(DIGITS), consonants = keep(CONSONANTS), vowels = keep(VOWELS);
  const fits = w => w.length <= o.max && ![...w].some(c => ex.includes(c));
  const words = cats => [...new Set(cats.flatMap(c => WORDS[c]))].filter(fits);
  const all = [...new Set([...words(o.categories), ...o.customWords.filter(fits)])];
  const firsts = words(o.categories.filter(c => FIRST_WORDS.includes(c)));
  const seconds = [...new Set([...words(o.categories.filter(c => !FIRST_WORDS.includes(c))), ...o.customWords.filter(fits)])];
  const [first, second] = firsts.length && seconds.length ? [firsts, seconds] : [all, all];
  const inserts = o.style === 'random' || o.style === 'pronounceable'; // other styles treat Contains as a filter
  const withNumbers = !['random', 'pattern'].includes(o.style) && o.numbers !== 'none';

  const casing = parts => {
    switch (o.caseStyle) {
      case 'upper': return parts.map(p => p.toUpperCase());
      case 'capital': return parts.map((p, i) => (i ? p : cap(p)));
      case 'camel': return parts.map(cap);
      case 'mixed': return parts.map(p => [...p].map(c => (Math.random() < .5 ? c.toUpperCase() : c)).join(''));
      default: return parts;
    }
  };

  return () => {
    const numLen = withNumbers ? between(o.numMin, o.numMax) : 0;
    const fixedLen = o.prefix.length + (inserts ? o.contains.length : 0) + o.suffix.length + numLen;
    let parts, joiner = '';
    if (o.style === 'random' || o.style === 'pronounceable') {
      const n = between(Math.max(o.min, fixedLen), o.max) - fixedLen;
      if (n < 0) return null;
      let s = '';
      if (o.style === 'random') {
        const pool = (o.letters ? letters : '') + (o.digits ? digits : '');
        for (let i = 0; i < n; i++) s += pick(pool);
        if (o.underscore && n >= 3 && !underscores(o.prefix + o.contains + o.suffix) && Math.random() < .5) {
          const at = between(1, n - 2);
          s = s.slice(0, at) + '_' + s.slice(at + 1);
        }
      } else {
        for (let i = 0, c = Math.random() < .6; i < n; i++, c = !c) s += pick(c ? consonants : vowels);
      }
      parts = [s];
    } else if (o.style === 'pattern') {
      const sets = {C: consonants, V: vowels, L: letters, D: digits, '?': letters + digits, '*': letters + digits};
      parts = [[...o.pattern].map(ch => (sets[ch] ? pick(sets[ch]) : ch)).join('')];
    } else if (o.style === 'word') {
      parts = [pick(all)];
    } else {
      parts = [pick(first), pick(second)];
      if (parts[0] === parts[1]) return null;
      if (o.style === 'wordword') joiner = '_';
    }

    let core = casing(parts).join(joiner);
    if (inserts && o.contains) {
      const at = between(0, core.length);
      core = core.slice(0, at) + o.contains + core.slice(at);
    }
    if (withNumbers) {
      const num = Array.from({length: numLen}, () => pick(digits)).join('');
      core = o.numbers === 'start' ? num + core : core + num;
    }
    const name = o.prefix + core + o.suffix;

    if (!VALID_NAME.test(name)) return null;
    if (o.style !== 'pattern' && (name.length < o.min || name.length > o.max)) return null;
    if (o.contains && !name.toLowerCase().includes(o.contains.toLowerCase())) return null;
    if (ex && [...name.toLowerCase()].some(c => ex.includes(c))) return null;
    if (o.colors.length && !o.colors.includes(chatColorIndex(name))) return null;
    return name;
  };
}

// Up to `size` new names never tried before. Empty array = the rules are exhausted.
function nextBatch(gen, seen, size) {
  const batch = [];
  for (let tries = 0; batch.length < size && tries < Math.max(3000, size * 60); tries++) {
    const name = gen();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      batch.push(name);
    }
  }
  return batch;
}

if (typeof module === 'object') module.exports = {criteriaError, makeGenerator, nextBatch};

if (typeof document === 'object' && document.getElementById('finder')) {
  const $ = s => document.querySelector(s);
  const form = $('#finder'), foundEl = $('#found'), logEl = $('#log'), notice = $('#notice');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const MAX_LOG = 400;
  let runId = 0, clock = 0;
  let s = {found: [], checked: 0, taken: 0, filtered: 0, started: 0, target: 0};

  // Show only the options that apply to the chosen style.
  const syncStyle = () => {
    const style = new FormData(form).get('style');
    document.querySelectorAll('[data-show]').forEach(el => { el.hidden = !el.dataset.show.split(' ').includes(style); });
  };
  form.addEventListener('change', e => {
    if (e.target.name === 'style') syncStyle();
    if (e.target.name === 'unlimited') $('#count').disabled = e.target.checked;
  });
  syncStyle();

  const readForm = () => {
    const f = new FormData(form);
    const text = k => String(f.get(k) || '').trim();
    const style = f.get('style');
    return {
      style,
      min: style === 'pattern' ? 3 : +f.get('min'), max: style === 'pattern' ? 20 : +f.get('max'),
      letters: f.has('letters'), digits: f.has('digits'), underscore: f.has('underscore'),
      categories: f.getAll('category'),
      customWords: [...new Set(text('custom').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))],
      pattern: text('pattern'),
      caseStyle: f.get('case'),
      numbers: f.get('numbers'), numMin: +f.get('numMin'), numMax: +f.get('numMax'),
      prefix: text('prefix'), contains: text('contains'), suffix: text('suffix'),
      exclude: text('exclude').toLowerCase().replace(/[^a-z0-9_]/g, ''),
      colors: f.getAll('color').map(Number),
      unlimited: f.has('unlimited'), count: +f.get('count'),
      pace: +f.get('pace'),
    };
  };

  const setNotice = msg => { notice.hidden = !msg; $('#notice-text').textContent = msg; };
  const time = () => new Date().toLocaleTimeString([], {hour12: false});

  // Live log: newest at the bottom, sticks to the bottom unless you've scrolled up to read.
  function log(entries) {
    const stick = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 40;
    const frag = document.createDocumentFragment();
    const icons = {available: 'check-circle', taken: 'x', unavailable: 'prohibit', info: 'info', wait: 'hourglass-medium', error: 'warning'};
    for (const [kind, name, note = ''] of entries) {
      const li = document.createElement('li');
      li.className = `log-${kind}`;
      if (kind === 'available') { li.dataset.copy = name; li.title = 'Click to copy'; }
      li.innerHTML = `<span class="log-time">${time()}</span><i class="ph ph-${icons[kind]}"></i><span class="log-name">${esc(name)}</span><span class="log-note">${esc(note)}</span>`;
      frag.append(li);
    }
    logEl.append(frag);
    while (logEl.children.length > MAX_LOG) logEl.firstChild.remove();
    if (stick) logEl.scrollTop = logEl.scrollHeight;
  }

  function addFound(name) {
    s.found.push(name);
    const color = chatColor(name);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'name-chip';
    b.dataset.copy = name;
    b.title = `Copy ${name} (${color.name} in chat)`;
    b.innerHTML = `<span class="dot" style="background:${color.hex}"></span><span>${esc(name)}</span>`;
    foundEl.append(b);
  }

  function paint(running) {
    const secs = s.started ? (Date.now() - s.started) / 1000 : 0;
    $('#stat-found').textContent = s.found.length.toLocaleString();
    $('#stat-taken').textContent = s.taken.toLocaleString();
    $('#stat-filtered').textContent = s.filtered.toLocaleString();
    $('#stat-checked').textContent = s.checked.toLocaleString();
    $('#stat-speed').textContent = secs > 1 ? `${(s.checked / secs).toFixed(1)}/s` : '0/s';
    $('#stat-time').textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
    const bar = $('#bar');
    bar.classList.toggle('is-endless', running && !isFinite(s.target));
    bar.style.width = isFinite(s.target) && s.target ? `${Math.min(100, (s.found.length / s.target) * 100)}%` : '';
    $('#start').disabled = running;
    $('#stop').disabled = !running;
    document.querySelectorAll('[data-needs-results]').forEach(b => { b.disabled = !s.found.length; });
    $('#empty').hidden = s.found.length > 0;
    $('#empty-title').textContent = running ? 'Searching...' : s.checked ? 'No available names found' : 'Available names show up here';
    $('#empty-text').textContent = running ? 'Free names appear here the moment Roblox confirms them.'
      : s.checked ? 'Try a longer length, more word types, or fewer filters.' : 'Set your rules and press Find usernames.';
  }

  async function countdown(secs, live) {
    for (let t = secs; t > 0 && live(); t--) {
      setNotice(`Roblox is rate limiting requests. Resuming in ${t}s.`);
      await sleep(1000);
    }
    setNotice('');
  }

  async function run(o) {
    const id = ++runId;
    const live = () => id === runId;
    const gen = makeGenerator(o), seen = new Set();
    s = {found: [], checked: 0, taken: 0, filtered: 0, started: Date.now(), target: o.unlimited ? Infinity : o.count};
    foundEl.innerHTML = '';
    setNotice('');
    clearInterval(clock);
    clock = setInterval(() => paint(true), 1000);
    paint(true);
    log([['info', 'Search started', o.unlimited ? 'no limit, press Stop when you have enough' : `looking for ${o.count}`]]);

    let rateLimits = 0, failures = 0;
    while (live() && s.found.length < s.target) {
      // Size batches to how names are coming back: hard rules (mostly taken) get up to 100 names, which one
      // batch lookup clears; easy rules stay small so each request sends at most ~25 names to the validator.
      const hit = s.checked ? s.found.length / s.checked : .5;
      const open = s.checked ? (s.checked - s.taken) / s.checked : .5;
      const want = Math.min(25 / Math.max(open, .01), ((s.target - s.found.length) / Math.max(hit, .01)) * 1.2);
      const batch = nextBatch(gen, seen, Math.min(100, Math.max(5, Math.ceil(want))));
      if (!batch.length) {
        setNotice('No new names left to try with these rules. Loosen the length, word types, or filters.');
        log([['info', 'Out of new names', 'every combination these rules allow has been tried']]);
        break;
      }

      let results;
      try {
        results = await lookup(batch);
        rateLimits = 0;
        failures = 0;
      } catch (e) {
        if (!live()) return;
        batch.forEach(n => seen.delete(n.toLowerCase())); // try these again later
        if (e instanceof RateLimited) {
          const wait = Math.min(60, 5 * 2 ** rateLimits++); // 5s, 10s, 20s, 40s, 60s
          log([['wait', 'Rate limited', `pausing ${wait}s, then carrying on`]]);
          await countdown(wait, live);
          continue;
        }
        if (++failures <= 3) {
          log([['error', 'Could not reach Roblox', 'retrying in 3s']]);
          await sleep(3000);
          continue;
        }
        setNotice('Could not reach Roblox right now. Try again in a moment.');
        break;
      }
      if (!live()) return;

      const entries = [];
      for (const r of results) {
        s.checked++;
        if (r.status === 'available') { addFound(r.name); entries.push(['available', r.name, 'available']); }
        else if (r.status === 'taken') { s.taken++; entries.push(['taken', r.name, 'taken']); }
        else { s.filtered++; entries.push(['unavailable', r.name, r.message || 'not allowed']); }
      }
      log(entries);
      paint(true);
      if (o.pace && live() && s.found.length < s.target) await sleep(o.pace);
    }
    if (!live()) return;
    runId++;
    clearInterval(clock);
    paint(false);
    log([['info', 'Search finished', `${s.found.length} available out of ${s.checked} checked`]]);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const o = readForm();
    const err = criteriaError(o);
    $('#form-error').hidden = !err;
    $('#form-error-text').textContent = err;
    if (!err) run(o);
  });
  $('#stop').addEventListener('click', () => {
    runId++;
    clearInterval(clock);
    setNotice('');
    paint(false);
    log([['info', 'Stopped', `${s.found.length} available out of ${s.checked} checked`]]);
  });
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-copy]');
    if (el) copyText(el.dataset.copy, `Copied ${el.dataset.copy}`);
  });
  $('#copy-all').addEventListener('click', () => copyText(s.found.join('\n'), `Copied ${s.found.length} names`));
  $('#download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([s.found.join('\n') + '\n'], {type: 'text/plain'}));
    a.download = 'roblox-usernames.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#to-colors').addEventListener('click', () => {
    sessionStorage.setItem('usernamecolor-import', s.found.join('\n'));
    location.href = '/usernamecolor';
  });
  $('#show-taken').addEventListener('change', e => logEl.classList.toggle('hide-taken', !e.target.checked));
  $('#clear-log').addEventListener('click', () => { logEl.innerHTML = ''; });
  paint(false);
}
