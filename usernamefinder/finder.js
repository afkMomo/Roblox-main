// Username finder: generate names from the user's rules, check them via /api/check,
// keep going until enough available names are found.
// The pure helpers at the top are also loaded by test/finder.test.cjs.

const VALID_NAME = /^(?=.{3,20}$)[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?$/;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz', DIGITS = '0123456789';
const CONSONANTS = 'bcdfghjklmnprstvwz', VOWELS = 'aeiou';
const pick = s => s[Math.floor(Math.random() * s.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function criteriaError(o) {
  const fixed = o.prefix + o.contains + o.suffix;
  if (!(o.min >= 3 && o.max <= 20)) return 'Length must be between 3 and 20.';
  if (o.min > o.max) return 'Minimum length is larger than the maximum.';
  if (!o.letters && !o.digits) return 'Pick letters, numbers, or both.';
  if (/[^A-Za-z0-9_]/.test(fixed)) return 'Starts with, Contains, and Ends with can only use letters, numbers, and underscores.';
  if ((fixed.match(/_/g) || []).length > 1) return 'Roblox allows only one underscore per name.';
  if (o.prefix.startsWith('_') || o.suffix.endsWith('_')) return 'Names cannot start or end with an underscore.';
  if (fixed.length > o.max) return `Your fixed text is ${fixed.length} characters, longer than the maximum length.`;
  if (!(o.count >= 1 && o.count <= 50)) return 'Find between 1 and 50 names.';
  return '';
}

// One candidate, or null when this roll broke a Roblox rule (caller just rolls again).
function generate(o) {
  const fixedLen = o.prefix.length + o.contains.length + o.suffix.length;
  const n = between(Math.max(o.min, fixedLen), o.max) - fixedLen;
  let fill = '';
  if (o.style === 'pronounceable' && o.letters) {
    let consonant = Math.random() < .6;
    for (let i = 0; i < n; i++, consonant = !consonant) fill += pick(consonant ? CONSONANTS : VOWELS);
    if (o.digits && n >= 4 && Math.random() < .4) {
      const d = between(1, 2);
      fill = fill.slice(0, n - d) + Array.from({length: d}, () => pick(DIGITS)).join('');
    }
  } else {
    const pool = (o.letters ? LETTERS : '') + (o.digits ? DIGITS : '');
    for (let i = 0; i < n; i++) fill += pick(pool);
  }
  if (o.underscore && n >= 3 && !(o.prefix + o.contains + o.suffix).includes('_') && Math.random() < .5) {
    const at = between(1, n - 2);
    fill = fill.slice(0, at) + '_' + fill.slice(at + 1);
  }
  const at = between(0, fill.length);
  const name = o.prefix + fill.slice(0, at) + o.contains + fill.slice(at) + o.suffix;
  return VALID_NAME.test(name) ? name : null;
}

// Up to `size` new names never tried before. Empty array = the rules are exhausted.
function nextBatch(o, seen, size) {
  const batch = [];
  for (let tries = 0; batch.length < size && tries < size * 50; tries++) {
    const name = generate(o);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      batch.push(name);
    }
  }
  return batch;
}

if (typeof module === 'object') module.exports = {VALID_NAME, criteriaError, generate, nextBatch};

if (typeof document === 'object') {
  const MAX_CHECKS = 2000; // ponytail: hard stop so impossible rules can't hammer Roblox forever
  const $ = s => document.querySelector(s);
  const form = $('#finder'), list = $('#results'), notice = $('#notice');
  const startBtn = $('#start'), stopBtn = $('#stop'), copyAll = $('#copy-all');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let runId = 0, found = [], checked = 0, taken = 0, target = 0;

  const readForm = () => {
    const f = new FormData(form);
    const text = k => String(f.get(k) || '').trim();
    return {
      min: +f.get('min'), max: +f.get('max'), count: +f.get('count'),
      letters: f.has('letters'), digits: f.has('digits'), underscore: f.has('underscore'),
      style: f.get('style'), prefix: text('prefix'), contains: text('contains'), suffix: text('suffix'),
    };
  };

  const setNotice = msg => { notice.hidden = !msg; $('#notice-text').textContent = msg; };

  function paint(running) {
    $('#stat-checked').textContent = checked.toLocaleString();
    $('#stat-taken').textContent = taken.toLocaleString();
    $('#stat-found').textContent = found.length;
    $('#bar').style.width = target ? `${(found.length / target) * 100}%` : '0';
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    copyAll.disabled = !found.length;
    $('#loading').hidden = !running;
    $('#empty').hidden = running || found.length > 0;
    $('#empty-title').textContent = checked ? 'No available names found' : 'Available names show up here';
    $('#empty-text').textContent = checked
      ? 'Try a longer length, more character types, or less fixed text.'
      : 'Set your rules on the left and press Find usernames.';
  }

  function addResult(name) {
    found.push(name);
    const li = document.createElement('li');
    li.className = 'result';
    li.innerHTML = '<i class="ph ph-check-circle"></i><span></span><button class="icon-btn" type="button" aria-label="Copy"><i class="ph ph-copy"></i></button>';
    li.querySelector('span').textContent = name;
    li.querySelector('button').setAttribute('aria-label', `Copy ${name}`);
    li.querySelector('button').dataset.copy = name;
    list.append(li);
  }

  async function copy(text, btn) {
    await navigator.clipboard.writeText(text);
    const icon = btn.querySelector('i'), was = icon.className;
    icon.className = 'ph ph-check';
    setTimeout(() => { icon.className = was; }, 1200);
  }

  async function run(o) {
    const id = ++runId;
    const live = () => id === runId;
    const seen = new Set();
    found = []; checked = 0; taken = 0; target = o.count;
    list.innerHTML = '';
    setNotice('');
    paint(true);

    while (live() && found.length < target) {
      if (checked >= MAX_CHECKS) { setNotice(`Stopped after checking ${MAX_CHECKS.toLocaleString()} names. Loosen your rules and try again.`); break; }
      const batch = nextBatch(o, seen, Math.min(20, Math.max(5, (target - found.length) * 2)));
      if (!batch.length) { setNotice('No new names left to try with these rules. Allow a longer length or fewer fixed characters.'); break; }

      let res;
      try {
        res = await fetch(`/api/check?names=${encodeURIComponent(batch.join(','))}`);
      } catch {
        res = null;
      }
      if (!live()) return;
      if (res && res.status === 429) {
        const {retryAfter = 15} = await res.json().catch(() => ({}));
        setNotice(`Roblox is rate limiting requests. Resuming in ${retryAfter} seconds.`);
        batch.forEach(n => seen.delete(n.toLowerCase()));
        await sleep(retryAfter * 1000);
        continue;
      }
      if (!res || !res.ok) { setNotice('Could not reach Roblox. Check your connection and try again.'); break; }

      setNotice('');
      for (const r of (await res.json()).results) {
        checked++;
        if (r.status === 'available' && found.length < target) addResult(r.name);
        else if (r.status === 'taken') taken++;
      }
      paint(true);
    }
    if (live()) paint(false);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const o = readForm();
    const err = criteriaError(o);
    $('#form-error').hidden = !err;
    $('#form-error-text').textContent = err;
    if (!err) run(o);
  });
  stopBtn.addEventListener('click', () => { runId++; paint(false); });
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]');
    if (b) copy(b.dataset.copy, b);
  });
  copyAll.addEventListener('click', () => copy(found.join('\n'), copyAll));
  paint(false);
}
