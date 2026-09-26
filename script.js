const tools = [
  {name: 'Username Finder', category: 'Utilities', icon: 'at', url: '/usernamefinder', description: 'Set a length, characters, and a pattern, then find Roblox usernames that are still free.'},
  {name: 'Avatar Rotator', category: 'Utilities', icon: 'arrows-clockwise', url: '/avatar', description: 'Rotate your Roblox avatar between saved outfits automatically, right from your browser.'},
  {name: 'Roblox Studio', category: 'Create', icon: 'hammer', url: 'https://create.roblox.com/', description: 'The official environment for building, scripting, and testing experiences.'},
  {name: 'Creator Dashboard', category: 'Create', icon: 'squares-four', url: 'https://create.roblox.com/dashboard/creations', description: 'Manage your experiences, assets, analytics, and monetization in one place.'},
  {name: 'Animation Editor', category: 'Create', icon: 'person-simple-run', url: 'https://create.roblox.com/docs/art/animation/editor', description: 'Create and edit custom animations directly inside Roblox Studio.'},
  {name: 'Luau Playground', category: 'Code', icon: 'terminal-window', url: 'https://luau.org/demo', description: 'Write and test Luau code in your browser with instant feedback.'},
  {name: 'Roblox API Reference', category: 'Code', icon: 'brackets-curly', url: 'https://create.roblox.com/docs/reference/engine', description: 'Search classes, properties, events, and services from the Roblox engine.'},
  {name: 'Asset Delivery API', category: 'Code', icon: 'cloud-arrow-down', url: 'https://create.roblox.com/docs/reference/cloud/assets', description: 'Explore asset metadata and delivery endpoints in the official docs.'},
  {name: 'Rojo', category: 'Code', icon: 'arrows-left-right', url: 'https://rojo.space/', description: 'Sync code from your own editor into Studio and keep your project in Git.'},
  {name: 'BloxMake Previewer', category: 'Assets', icon: 'cube', url: 'https://bloxmake.com/library/previewer', description: 'Preview Roblox assets and library items before using them in your project.'},
  {name: 'Creator Store', category: 'Assets', icon: 'storefront', url: 'https://create.roblox.com/marketplace', description: 'Find models, plugins, audio, fonts, and other assets for your experiences.'},
  {name: 'Creator Documentation', category: 'Learn', icon: 'book-open', url: 'https://create.roblox.com/docs', description: 'Official guides and tutorials for every part of Roblox development.'},
  {name: 'DevForum', category: 'Learn', icon: 'chats-circle', url: 'https://devforum.roblox.com/', description: 'Connect with other creators, get help, and follow platform updates.'},
  {name: 'Roblox Status', category: 'Utilities', icon: 'pulse', url: 'https://status.roblox.com/', description: 'Check whether Roblox services are up before you debug your own game.'},
];
const CATEGORIES = ['All', 'Create', 'Code', 'Assets', 'Learn', 'Utilities'];
const FAV_KEY = 'roblox-toolkit-favorites';

const $ = s => document.querySelector(s);
const grid = $('#tool-grid'), search = $('#search'), sort = $('#sort'), savedBtn = $('#saved-only');
let category = 'All', savedOnly = false;
let favorites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');

$('#filters').innerHTML = CATEGORIES.map(c => {
  const n = c === 'All' ? tools.length : tools.filter(t => t.category === c).length;
  return `<button type="button" data-cat="${c}" aria-pressed="${c === category}">${c} <span class="n">${n}</span></button>`;
}).join('');

const sorters = {
  featured: () => 0,
  az: (a, b) => a.name.localeCompare(b.name),
  za: (a, b) => b.name.localeCompare(a.name),
  category: (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name),
  saved: (a, b) => favorites.includes(b.name) - favorites.includes(a.name),
};

function card(t) {
  const local = t.url.startsWith('/');
  const saved = favorites.includes(t.name);
  const target = local ? '' : ' target="_blank" rel="noreferrer"';
  const host = local ? 'On this site' : `${new URL(t.url).hostname.replace(/^www\./, '')} <i class="ph ph-arrow-up-right"></i>`;
  return `<article class="tool${local ? ' is-local' : ''}">
    <div class="tool-top">
      <span class="tool-icon"><i class="ph ph-${t.icon}"></i></span>
      <button class="fav" type="button" data-fav="${t.name}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${t.name}"><i class="${saved ? 'ph-fill' : 'ph'} ph-heart"></i></button>
    </div>
    <h3><a href="${t.url}"${target}>${t.name}</a></h3>
    <p>${t.description}</p>
    <div class="tool-meta"><span class="tag${local ? ' tag-accent' : ''}">${t.category}</span><span class="host">${host}</span></div>
  </article>`;
}

function render() {
  const q = search.value.toLowerCase().trim();
  const shown = tools
    .filter(t => (category === 'All' || t.category === category)
      && (!savedOnly || favorites.includes(t.name))
      && `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q))
    .sort(sorters[sort.value]);
  grid.innerHTML = shown.map(card).join('');
  $('#empty').hidden = shown.length > 0;
  $('#tool-count').textContent = `${shown.length} of ${tools.length} tools`;
}

$('#filters').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  category = b.dataset.cat;
  document.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', x === b));
  render();
});
grid.addEventListener('click', e => {
  const b = e.target.closest('[data-fav]');
  if (!b) return;
  const n = b.dataset.fav;
  favorites = favorites.includes(n) ? favorites.filter(x => x !== n) : [...favorites, n];
  localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  render();
});
savedBtn.addEventListener('click', () => {
  savedOnly = !savedOnly;
  savedBtn.setAttribute('aria-pressed', savedOnly);
  render();
});
$('#reset').addEventListener('click', () => {
  search.value = '';
  savedOnly = false;
  savedBtn.setAttribute('aria-pressed', false);
  $('[data-cat="All"]').click();
});
search.addEventListener('input', render);
sort.addEventListener('change', render);
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault();
    search.focus();
  }
});
render();

// Quick username check. VALID_NAME and lookup() come from /usernamefinder/finder.js.
const quickStatus = $('#quick-status');
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
function setQuick(kind, icon, html) {
  quickStatus.className = `status ${kind}`;
  quickStatus.innerHTML = `<i class="ph ph-${icon}"></i><span>${html}</span>`;
}
$('#quick').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#quick-name').value.trim();
  if (!VALID_NAME.test(name)) {
    return setQuick('is-warn', 'warning', 'Use 3 to 20 letters or numbers, with at most one underscore in the middle.');
  }
  const safe = name; // VALID_NAME guarantees [A-Za-z0-9_] only, so this is safe to put in HTML.
  setQuick('', 'circle-notch', `Checking <b>${safe}</b>...`);
  try {
    const [r] = await lookup([name]);
    if (r.status === 'available') setQuick('is-ok', 'check-circle', `<b>${safe}</b> is available.`);
    else if (r.status === 'taken') setQuick('is-taken', 'x-circle', `<b>${safe}</b> is already taken.`);
    else setQuick('is-warn', 'warning', `Roblox won't allow <b>${safe}</b>. ${esc(r.message)}.`);
  } catch {
    setQuick('is-warn', 'warning', 'Could not reach Roblox right now. Try again in a moment.');
  }
});
