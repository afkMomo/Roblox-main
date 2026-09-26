// Clothing previewer: classic 585x559 shirt/pants templates on a blocky R6 or R15 character.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 585, H = 559;
// Template regions [x, y, w, h] per box face, in BoxGeometry face order: +x, -x, +y, -y, +z, -z.
// The character faces +z, so its right side is -x. Per part the order is: left, right, up, down, front, back.
const TORSO = [[361, 74, 64, 128], [165, 74, 64, 128], [231, 8, 128, 64], [231, 204, 128, 64], [231, 74, 128, 128], [427, 74, 128, 128]];
const RIGHT_LIMB = [[19, 355, 64, 128], [151, 355, 64, 128], [217, 289, 64, 64], [217, 485, 64, 64], [217, 355, 64, 128], [85, 355, 64, 128]];
const LEFT_LIMB = [[374, 355, 64, 128], [506, 355, 64, 128], [308, 289, 64, 64], [308, 485, 64, 64], [308, 355, 64, 128], [440, 355, 64, 128]];
const RIGS = {R6: {torso: [1], limb: [1]}, R15: {torso: [.78, .22], limb: [.46, .4, .14]}};
const GAP = .045; // seam between R15 segments
const TARGET = new THREE.Vector3(0, 2.55, 0);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = s => document.querySelector(s);
const stage = $('#stage');
const state = {rig: 'R6', skin: '#a3a2a5', face: 'smile', layers: {shirt: null, pants: null, tshirt: null}};

// ---------- Renderer, camera, lights ----------
const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
camera.position.set(0, 3.6, 13);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET);
Object.assign(controls, {enableDamping: true, dampingFactor: .08, enablePan: false, minDistance: 6, maxDistance: 22, minPolarAngle: .35, maxPolarAngle: 1.75, autoRotateSpeed: 2.4});
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9aa6, 2.1));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(4, 8, 7);
const fill = new THREE.DirectionalLight(0xffffff, .5);
fill.position.set(-7, 3, 2);
const rim = new THREE.DirectionalLight(0xffffff, .6);
rim.position.set(0, 6, -8);
scene.add(key, fill, rim);

// Soft contact shadow under the feet.
const shadowCanvas = Object.assign(document.createElement('canvas'), {width: 128, height: 128});
const sctx = shadowCanvas.getContext('2d');
const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
grad.addColorStop(0, 'rgba(0,0,0,.38)');
grad.addColorStop(1, 'rgba(0,0,0,0)');
sctx.fillStyle = grad;
sctx.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false}));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = .01;
scene.add(shadow);

// ---------- Textures ----------
const canvases = {}, textures = {}, mats = {};
for (const k of ['torso', 'arms', 'legs']) {
  canvases[k] = Object.assign(document.createElement('canvas'), {width: W, height: H});
  textures[k] = new THREE.CanvasTexture(canvases[k]);
  textures[k].colorSpace = THREE.SRGBColorSpace;
  textures[k].anisotropy = renderer.capabilities.getMaxAnisotropy();
  mats[k] = new THREE.MeshStandardMaterial({map: textures[k], roughness: .95});
}
const skinMat = new THREE.MeshStandardMaterial({color: state.skin, roughness: .9});
const faceCanvas = Object.assign(document.createElement('canvas'), {width: 256, height: 256});
const faceTex = new THREE.CanvasTexture(faceCanvas);
faceTex.colorSpace = THREE.SRGBColorSpace;

// Transparent template pixels show the skin, like on Roblox. Shirts sit over pants on the torso.
function paint() {
  const {shirt, pants, tshirt} = state.layers;
  for (const [k, layers] of [['torso', [pants, shirt]], ['arms', [shirt]], ['legs', [pants]]]) {
    const ctx = canvases[k].getContext('2d');
    ctx.fillStyle = state.skin;
    ctx.fillRect(0, 0, W, H);
    for (const img of layers) if (img) ctx.drawImage(img, 0, 0, W, H);
    if (k === 'torso' && tshirt) ctx.drawImage(tshirt, 231, 74, 128, 128);
    textures[k].needsUpdate = true;
  }
  skinMat.color.set(state.skin);
}

function drawFace() {
  const c = faceCanvas.getContext('2d');
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = c.strokeStyle = '#1c1c21';
  c.lineCap = 'round';
  c.lineWidth = 10;
  const eye = (x, ry = 21) => { c.beginPath(); c.ellipse(x, 104, 12, ry, 0, 0, Math.PI * 2); c.fill(); };
  const smile = (open = false) => {
    c.beginPath();
    c.moveTo(84, 156);
    c.quadraticCurveTo(128, open ? 222 : 206, 172, 156);
    if (open) { c.closePath(); c.fill(); } else c.stroke();
  };
  if (state.face === 'smile') { eye(92); eye(164); smile(); }
  if (state.face === 'happy') {
    for (const x of [92, 164]) { c.beginPath(); c.arc(x, 116, 17, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    smile(true);
  }
  if (state.face === 'cool') {
    c.beginPath();
    c.roundRect(54, 84, 66, 40, 12);
    c.roundRect(136, 84, 66, 40, 12);
    c.fill();
    c.fillRect(116, 94, 24, 8);
    c.beginPath(); c.moveTo(98, 170); c.quadraticCurveTo(142, 186, 172, 154); c.stroke();
  }
  if (state.face === 'wink') {
    eye(92);
    c.beginPath(); c.moveTo(148, 108); c.quadraticCurveTo(164, 96, 180, 108); c.stroke();
    smile();
  }
  faceTex.needsUpdate = true;
}

// ---------- Character ----------
function setFaceUV(geo, face, [x, y, w, h]) {
  const uv = geo.attributes.uv, i = face * 4;
  const u0 = (x + .5) / W, u1 = (x + w - .5) / W, top = 1 - (y + .5) / H, bottom = 1 - (y + h - .5) / H;
  // BoxGeometry face corners: top-left, top-right, bottom-left, bottom-right (as seen from outside).
  uv.setXY(i, u0, top); uv.setXY(i + 1, u1, top); uv.setXY(i + 2, u0, bottom); uv.setXY(i + 3, u1, bottom);
}

// One body part, split into stacked segments for R15. Side faces get a slice of their region;
// only the outer ends get the Up/Down regions (inner caps sit in the seams).
function part(w, h, d, regions, material, splits) {
  const group = new THREE.Group();
  let from = 0, y = h / 2;
  splits.forEach((ratio, i) => {
    const last = i === splits.length - 1;
    const segH = h * ratio - (last ? 0 : GAP);
    const slice = ([x, ry, rw, rh]) => [x, ry + rh * from, rw, rh * ratio];
    const [fx, fy, fw, fh] = regions[4];
    const faces = [slice(regions[0]), slice(regions[1]),
      i === 0 ? regions[2] : [fx, fy + fh * from, fw, 1],
      last ? regions[3] : [fx, fy + fh * (from + ratio) - 1, fw, 1],
      slice(regions[4]), slice(regions[5])];
    const geo = new THREE.BoxGeometry(w, segH, d);
    faces.forEach((r, f) => setFaceUV(geo, f, r));
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = y - segH / 2;
    group.add(mesh);
    y -= h * ratio;
    from += ratio;
  });
  return group;
}

const character = new THREE.Group();
scene.add(character);
function build() {
  character.traverse(o => o.geometry && o.geometry.dispose());
  character.clear();
  const {torso, limb} = RIGS[state.rig];
  const add = (obj, x, y) => { obj.position.set(x, y, 0); character.add(obj); };
  add(part(2, 2, 1, TORSO, mats.torso, torso), 0, 3);
  add(part(1, 2, 1, RIGHT_LIMB, mats.arms, limb), -1.5, 3);
  add(part(1, 2, 1, LEFT_LIMB, mats.arms, limb), 1.5, 3);
  add(part(1, 2, 1, RIGHT_LIMB, mats.legs, limb), -.5, 1);
  add(part(1, 2, 1, LEFT_LIMB, mats.legs, limb), .5, 1);
  const head = new THREE.Group();
  head.add(new THREE.Mesh(new RoundedBoxGeometry(1.22, 1.22, 1.22, 4, .24), skinMat));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.02), new THREE.MeshStandardMaterial({map: faceTex, transparent: true, roughness: .9}));
  face.position.z = .612;
  head.add(face);
  add(head, 0, 4 + .61 + (state.rig === 'R15' ? .03 : 0));
}

// ---------- Camera ----------
let tween = null;
function orbitTo(theta, radius) {
  const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  const from = {theta: sph.theta, phi: sph.phi, radius: sph.radius};
  const to = {theta: from.theta + ((((theta - from.theta + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI), phi: 1.43, radius: radius ?? sph.radius};
  const start = performance.now(), dur = reduceMotion ? 1 : 600;
  tween = now => {
    const k = Math.min(1, (now - start) / dur), e = 1 - (1 - k) ** 3;
    for (const p of ['theta', 'phi', 'radius']) sph[p] = from[p] + (to[p] - from[p]) * e;
    camera.position.setFromSpherical(sph).add(controls.target);
    if (k === 1) tween = null;
  };
}
function zoom(factor) {
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
}
function setSpin(on) {
  controls.autoRotate = on;
  $('#spin').setAttribute('aria-pressed', on);
}

new ResizeObserver(([entry]) => {
  const {width, height} = entry.contentRect;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(stage);

renderer.setAnimationLoop(now => {
  if (tween) tween(now);
  controls.update();
  renderer.render(scene, camera);
});

// ---------- Reference templates ----------
function referenceTemplate(kind) {
  const c = Object.assign(document.createElement('canvas'), {width: W, height: H});
  const x = c.getContext('2d');
  const groups = kind === 'shirt'
    ? [['TORSO', TORSO, '#3a63f0'], ['R ARM', RIGHT_LIMB, '#e5484d'], ['L ARM', LEFT_LIMB, '#30a46c']]
    : [['TORSO', TORSO, '#8e4ec6'], ['R LEG', RIGHT_LIMB, '#e2711d'], ['L LEG', LEFT_LIMB, '#12a594']];
  const labels = ['L', 'R', 'UP', 'DOWN', 'FRONT', 'BACK'];
  const shade = [.72, .72, .55, .55, 1, .86];
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (const [name, regions, color] of groups) {
    regions.forEach(([rx, ry, rw, rh], f) => {
      x.globalAlpha = shade[f];
      x.fillStyle = color;
      x.fillRect(rx, ry, rw, rh);
      x.globalAlpha = 1;
      x.strokeStyle = 'rgba(255,255,255,.55)';
      x.strokeRect(rx + .5, ry + .5, rw - 1, rh - 1);
      x.fillStyle = '#fff';
      x.font = '600 12px "Geist Variable", system-ui, sans-serif';
      x.fillText(labels[f], rx + rw / 2, ry + rh / 2 - (f === 4 ? 9 : 0));
      if (f === 4) { x.font = '700 13px "Geist Variable", system-ui, sans-serif'; x.fillText(name, rx + rw / 2, ry + rh / 2 + 9); }
    });
  }
  return c;
}

// ---------- Slots ----------
let activeSlot = 'shirt';
const slotEl = slot => document.querySelector(`[data-slot="${slot}"]`);
function note(slot, text, kind = '') {
  const el = slotEl(slot).querySelector('.slot-note');
  el.textContent = text;
  el.className = `slot-note ${kind}`;
}

async function setSlot(slot, source, label) {
  let img;
  try {
    img = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source);
  } catch {
    return note(slot, 'That file is not an image this browser can read.', 'is-bad');
  }
  state.layers[slot] = img;
  const el = slotEl(slot);
  const thumb = el.querySelector('img');
  if (thumb.src.startsWith('blob:')) URL.revokeObjectURL(thumb.src);
  thumb.src = source instanceof HTMLCanvasElement ? source.toDataURL() : URL.createObjectURL(source);
  thumb.hidden = false;
  el.classList.add('is-filled');
  el.querySelector('.slot-remove').hidden = false;
  const wrongSize = slot !== 'tshirt' && (img.width !== W || img.height !== H);
  note(slot, wrongSize ? `${label}: ${img.width}x${img.height}, templates are 585x559 so it may look stretched` : label, wrongSize ? 'is-warn' : '');
  paint();
}

function clearSlot(slot) {
  state.layers[slot] = null;
  const el = slotEl(slot);
  el.querySelector('img').hidden = true;
  el.classList.remove('is-filled');
  el.querySelector('.slot-remove').hidden = true;
  note(slot, slot === 'tshirt' ? 'Any square image, shown on the chest' : 'Drop, paste, or click to upload');
  paint();
}

async function loadFromRoblox(slot, raw) {
  const id = (raw.match(/\d{3,}/) || [])[0];
  if (!id) return note(slot, 'Enter a Roblox item ID or catalog link.', 'is-warn');
  note(slot, 'Loading from Roblox...');
  const res = await fetch(`/api/clothing?id=${id}`).catch(() => null);
  const json = res && (res.headers.get('content-type') || '').includes('json');
  if (!res || (!res.ok && !json)) return note(slot, 'Loading by ID needs the Vercel version of this site.', 'is-bad');
  if (!res.ok) return note(slot, (await res.json()).error, 'is-bad');
  const name = decodeURIComponent(res.headers.get('x-asset-name') || `Item ${id}`);
  const type = res.headers.get('x-asset-type');
  if ((slot === 'shirt' && type === 'pants') || (slot === 'pants' && type === 'shirt')) {
    note(slot, `${name} is ${type === 'pants' ? 'pants' : 'a shirt'}, loaded anyway`, 'is-warn');
  }
  await setSlot(slot, await res.blob(), name);
}

document.querySelectorAll('.slot').forEach(el => {
  const slot = el.dataset.slot;
  const file = el.querySelector('input[type=file]');
  const activate = () => { activeSlot = slot; };
  el.addEventListener('pointerdown', activate);
  el.addEventListener('focusin', activate);
  file.addEventListener('change', () => { if (file.files[0]) setSlot(slot, file.files[0], file.files[0].name); file.value = ''; });
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('is-drag'); });
  el.addEventListener('dragleave', () => el.classList.remove('is-drag'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('is-drag');
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
    if (f) setSlot(slot, f, f.name);
  });
  el.querySelector('.slot-remove').addEventListener('click', e => { e.preventDefault(); clearSlot(slot); });
  el.querySelector('.slot-id').addEventListener('submit', e => {
    e.preventDefault();
    loadFromRoblox(slot, e.target.querySelector('input').value.trim());
  });
});

document.addEventListener('paste', e => {
  if (e.target.closest('input, textarea')) return;
  const f = [...e.clipboardData.files].find(x => x.type.startsWith('image/'));
  if (f) setSlot(activeSlot, f, 'Pasted image');
});

// ---------- Controls ----------
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b));
  setSpin(false);
  orbitTo(+b.dataset.view);
}));
$('#zoom-in').addEventListener('click', () => zoom(.85));
$('#zoom-out').addEventListener('click', () => zoom(1 / .85));
$('#spin').addEventListener('click', () => setSpin(!controls.autoRotate));
$('#reset').addEventListener('click', () => {
  setSpin(false);
  document.querySelectorAll('[data-view]').forEach((x, i) => x.setAttribute('aria-pressed', i === 0));
  orbitTo(0, 13);
});
$('#shot').addEventListener('click', () => {
  renderer.render(scene, camera);
  renderer.domElement.toBlob(blob => {
    const a = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: 'roblox-outfit.png'});
    a.click();
    URL.revokeObjectURL(a.href);
  });
});
$('#example').addEventListener('click', () => {
  setSlot('shirt', referenceTemplate('shirt'), 'Example shirt template');
  setSlot('pants', referenceTemplate('pants'), 'Example pants template');
});
document.querySelectorAll('[data-template]').forEach(b => b.addEventListener('click', () => {
  const a = Object.assign(document.createElement('a'), {href: referenceTemplate(b.dataset.template).toDataURL(), download: `roblox-${b.dataset.template}-template.png`});
  a.click();
}));
document.addEventListener('change', e => {
  const {name, value} = e.target;
  if (name === 'rig') { state.rig = value; build(); }
  if (name === 'face') { state.face = value; drawFace(); }
  if (name === 'skin') { state.skin = value; paint(); }
  if (e.target.id === 'skin-custom') {
    document.querySelectorAll('[name=skin]').forEach(r => { r.checked = false; });
    state.skin = value;
    paint();
  }
});
$('#skin-custom').addEventListener('input', e => { state.skin = e.target.value; paint(); });

build();
paint();
drawFace();
stage.classList.remove('is-loading');
$('#stage-msg').remove();
