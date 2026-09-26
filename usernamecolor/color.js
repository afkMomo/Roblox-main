// Username Color: show each name in its Roblox chat color (chatColor from roblox.js) and check availability.
const $ = s => document.querySelector(s);
const input = $('#names'), list = $('#list'), message = $('#message');
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = new Map(); // lowercased name -> lookup() result
let colorFilter = -1, runId = 0, names = [];

// Usernames (and their colors) ignore case, so "Momo" and "momo" count once.
const parse = () => [...new Map(input.value.split(/[\s,;]+/).filter(Boolean).map(n => [n.toLowerCase(), n])).values()].slice(0, 5000);

const BADGES = {
  available: ['is-ok', 'Available'],
  taken: ['is-muted', 'Taken'],
  unavailable: ['is-warn', 'Not allowed'],
  invalid: ['is-warn', 'Invalid name'],
};

function visible() {
  const onlyFree = $('#only-available').checked;
  let rows = names.map((name, i) => ({name, i, color: chatColorIndex(name), valid: VALID_NAME.test(name)}))
    .filter(r => (colorFilter < 0 || r.color === colorFilter)
      && (!onlyFree || (results.get(r.name.toLowerCase()) || {}).status === 'available'));
  const sort = $('#sort').value;
  if (sort === 'color') rows.sort((a, b) => a.color - b.color || a.i - b.i);
  if (sort === 'az') rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function render() {
  names = parse();
  const counts = CHAT_COLORS.map((_, c) => names.filter(n => chatColorIndex(n) === c).length);
  $('#filters').innerHTML = [`<button type="button" data-color="-1" aria-pressed="${colorFilter < 0}">All <span class="n">${names.length}</span></button>`]
    .concat(CHAT_COLORS.map((c, i) => `<button type="button" data-color="${i}" aria-pressed="${colorFilter === i}" ${counts[i] ? '' : 'disabled'}><span class="dot" style="background:${c.hex}"></span>${c.name} <span class="n">${counts[i]}</span></button>`))
    .join('');

  const invalid = names.filter(n => !VALID_NAME.test(n)).length;
  $('#count').textContent = names.length
    ? `${names.length} username${names.length === 1 ? '' : 's'}${invalid ? `, ${invalid} not valid on Roblox` : ''}`
    : 'Nothing yet';

  const msg = esc(message.value.trim() || 'Hello!');
  const rows = visible();
  list.innerHTML = rows.map(({name, color, valid}) => {
    const c = CHAT_COLORS[color];
    const r = valid ? results.get(name.toLowerCase()) : {status: 'invalid'};
    const [cls, label] = r ? BADGES[r.status] : ['', ''];
    return `<li class="color-row">
      <span class="swatch" style="--c:${c.hex}"></span>
      <div class="chat-line"><b style="color:${c.hex}">${esc(name)}</b>: ${msg}</div>
      <span class="color-meta">${c.name} <code>${c.hex.toUpperCase()}</code></span>
      <span class="badge ${cls}" ${r && r.message && r.status === 'unavailable' ? `title="${esc(r.message)}"` : ''}>${label}</span>
      <button class="icon-btn" type="button" data-copy="${esc(name)}" aria-label="Copy ${esc(name)}"><i class="ph ph-copy"></i></button>
    </li>`;
  }).join('');
  $('#empty').hidden = names.length > 0;
  $('#no-match').hidden = !names.length || rows.length > 0;
  $('#copy-visible').disabled = !rows.length;
  $('#only-available').disabled = ![...results.values()].some(r => r.status === 'available');
  localStorage.setItem('usernamecolor-names', input.value);
}

async function checkAll() {
  const id = ++runId;
  const live = () => id === runId;
  const todo = names.filter(n => VALID_NAME.test(n) && !results.has(n.toLowerCase()));
  const btn = $('#check');
  btn.innerHTML = '<i class="ph ph-stop"></i> Stop';
  let done = 0, rateLimits = 0;
  const progress = text => { $('#check-status').hidden = !text; $('#check-status').textContent = text; };
  while (live() && done < todo.length) {
    progress(`Checking ${Math.min(done + 100, todo.length)} of ${todo.length}...`);
    const batch = todo.slice(done, done + 100);
    try {
      for (const r of await lookup(batch)) results.set(r.name.toLowerCase(), r);
      done += batch.length;
      rateLimits = 0;
      render();
    } catch (e) {
      if (!(e instanceof RateLimited)) { progress('Could not reach Roblox right now. Try again in a moment.'); break; }
      const wait = Math.min(60, 5 * 2 ** rateLimits++);
      for (let t = wait; t > 0 && live(); t--) { progress(`Roblox is rate limiting. Resuming in ${t}s.`); await sleep(1000); }
    }
  }
  if (live()) {
    runId++;
    if (done >= todo.length) progress(todo.length ? `Checked ${todo.length} name${todo.length === 1 ? '' : 's'}.` : 'All names are already checked.');
  }
  btn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Check availability';
}

let typing = 0;
input.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(render, 120); });
message.addEventListener('input', render);
$('#sort').addEventListener('change', render);
$('#only-available').addEventListener('change', render);
$('#filters').addEventListener('click', e => {
  const b = e.target.closest('[data-color]');
  if (b) { colorFilter = +b.dataset.color; render(); }
});
$('#check').addEventListener('click', () => {
  if ($('#check').textContent.includes('Stop')) { runId++; $('#check').innerHTML = '<i class="ph ph-magnifying-glass"></i> Check availability'; $('#check-status').textContent = 'Stopped.'; }
  else checkAll();
});
$('#clear').addEventListener('click', () => { input.value = ''; results.clear(); colorFilter = -1; render(); input.focus(); });
$('#copy-visible').addEventListener('click', () => {
  const shown = visible().map(r => r.name);
  copyText(shown.join('\n'), `Copied ${shown.length} name${shown.length === 1 ? '' : 's'}`);
});
list.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]');
  if (b) copyText(b.dataset.copy, `Copied ${b.dataset.copy}`);
});

// Names sent over from the Username finder win over the last saved list.
const imported = sessionStorage.getItem('usernamecolor-import');
sessionStorage.removeItem('usernamecolor-import');
input.value = imported || localStorage.getItem('usernamecolor-names') || 'builderman\nMomo\nSilentFox\nneon_wolf';
render();
