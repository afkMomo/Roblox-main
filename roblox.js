// Shared Roblox helpers: username rules, chat name colors, and availability lookups.
// Loaded as a plain <script> by the pages, and require()'d by api/check.js and the tests.

const VALID_NAME = /^(?=.{3,20}$)[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?$/;

// Default chat name colors, in the order Roblox's chat scripts list them.
const CHAT_COLORS = [
  {name: 'Red', hex: '#fd2943'},    // Color3.new(253/255, 41/255, 67/255)
  {name: 'Blue', hex: '#01a2ff'},   // Color3.new(1/255, 162/255, 255/255)
  {name: 'Green', hex: '#02b857'},  // Color3.new(2/255, 184/255, 87/255)
  {name: 'Violet', hex: '#6b327c'}, // BrickColor "Bright violet"
  {name: 'Orange', hex: '#da8541'}, // BrickColor "Bright orange"
  {name: 'Yellow', hex: '#f5cd30'}, // BrickColor "Bright yellow"
  {name: 'Pink', hex: '#e8bac8'},   // BrickColor "Light reddish violet"
  {name: 'Tan', hex: '#d7c59a'},    // BrickColor "Brick yellow"
];

// Port of GetNameValue + ComputeNameColor from Roblox's default chat (color_offset = 0).
// Capitalization never matters: upper and lower case differ by 32, a multiple of 8.
function chatColorIndex(name) {
  let value = 0;
  for (let i = 1; i <= name.length; i++) {
    let byte = name.charCodeAt(i - 1);
    let reverseIndex = name.length - i + 1;
    if (name.length % 2 === 1) reverseIndex--;
    if (reverseIndex % 4 >= 2) byte = -byte;
    value += byte;
  }
  return ((value % CHAT_COLORS.length) + CHAT_COLORS.length) % CHAT_COLORS.length; // Lua's % floors, JS's doesn't
}
const chatColor = name => CHAT_COLORS[chatColorIndex(name)];

class RateLimited extends Error {}

// -> [{name, status: "available" | "taken" | "unavailable", message}], same order as `names` (max 100).
// 1. One batch lookup removes names that belong to existing accounts.
// 2. The rest go through Roblox's signup validator, which also catches filtered or reserved names.
// host is "roblox.com" on the server, or "roproxy.com" (public Roblox mirror that allows CORS) in the browser.
async function checkNames(names, host) {
  const get = async (url, init) => {
    const res = await fetch(url, init);
    if (res.status === 429) throw new RateLimited();
    if (!res.ok) throw new Error(`Roblox responded ${res.status}`);
    return res.json();
  };
  // text/plain keeps this a "simple" request with no CORS preflight (RoProxy doesn't answer those).
  const {data} = await get(`https://users.${host}/v1/usernames/users`, {
    method: 'POST',
    headers: {'content-type': 'text/plain'},
    body: JSON.stringify({usernames: names, excludeBannedUsers: false}),
  });
  const taken = new Set(data.map(u => u.requestedUsername.toLowerCase()));
  const results = names.map(name =>
    taken.has(name.toLowerCase()) ? {name, status: 'taken', message: 'Username is already in use'} : null);

  const validate = async name => {
    const q = new URLSearchParams({Username: name, Birthday: '2000-01-01T00:00:00.000Z'});
    const {code, message} = await get(`https://auth.${host}/v1/usernames/validate?${q}`);
    results[names.indexOf(name)] = {name, status: code === 0 ? 'available' : code === 1 ? 'taken' : 'unavailable', message};
  };
  const todo = names.filter((_, i) => !results[i]);
  for (let i = 0; i < todo.length; i += 5) await Promise.all(todo.slice(i, i + 5).map(validate));
  return results;
}

// Browser entry point: our Vercel function when it's deployed, otherwise straight to RoProxy
// (static hosting has no /api).
let useApi = true;
async function lookup(names) {
  if (useApi) {
    const res = await fetch(`/api/check?names=${encodeURIComponent(names.join(','))}`).catch(() => null);
    if (res && res.status === 429) throw new RateLimited();
    if (res && res.ok) return (await res.json()).results;
    useApi = false;
  }
  return checkNames(names, 'roproxy.com');
}

// Copy text and confirm with a small toast (pages only).
async function copyText(text, label = 'Copied') {
  await navigator.clipboard.writeText(text);
  let t = document.querySelector('.toast');
  if (!t) {
    t = Object.assign(document.createElement('div'), {className: 'toast'});
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.textContent = label;
  t.classList.add('show');
  clearTimeout(copyText.timer);
  copyText.timer = setTimeout(() => t.classList.remove('show'), 1600);
}

if (typeof module === 'object') {
  module.exports = {VALID_NAME, CHAT_COLORS, chatColorIndex, chatColor, RateLimited, checkNames, lookup};
}
