// GET /api/clothing?id=<shirt, pants, t-shirt, decal, or image asset id>
// -> the template image, with x-asset-name / x-asset-type headers.
//
// 1. Download the item. Clothing items are small model files that point at the template image.
// 2. Pull the image id out of it and download that image.
//
// Since April 2025 Roblox only serves most assets to authenticated callers. Set ROBLOX_API_KEY in Vercel
// (any user's Open Cloud key with the legacy-asset:manage permission) to load every public item.
// Without it, only the older items Roblox still serves anonymously will load.
const TYPES = {1: 'image', 2: 'tshirt', 11: 'shirt', 12: 'pants', 13: 'decal'};
const CLASSES = {Shirt: 'shirt', Pants: 'pants', ShirtGraphic: 'tshirt', Decal: 'decal'};
const UA = {'user-agent': 'Mozilla/5.0 (compatible; RobloxToolkit/1.0; +https://roblox-toolkit.vercel.app)'};
const isImage = b => (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8);

const httpError = (status, message) => Object.assign(new Error(message), {status});

// Where Roblox's CDN keeps this asset: Open Cloud first (if a key is set), then the legacy endpoint.
async function locate(id) {
  let authFailed = false;
  const tries = [
    process.env.ROBLOX_API_KEY && [`https://apis.roblox.com/asset-delivery-api/v1/assetId/${id}`, {...UA, 'x-api-key': process.env.ROBLOX_API_KEY}],
    [`https://assetdelivery.roblox.com/v1/assetId/${id}`, UA],
  ].filter(Boolean);
  for (const [url, headers] of tries) {
    const res = await fetch(url, {headers});
    if (res.status === 429) throw httpError(429, 'Roblox is rate limiting requests. Try again in a moment.');
    const body = await res.json().catch(() => ({}));
    if (body.location) return body.location;
    const message = (body.errors && body.errors[0] && body.errors[0].message) || '';
    if (res.status === 401 || res.status === 403 || /authenticat/i.test(message)) authFailed = true;
  }
  if (authFailed) {
    throw httpError(401, process.env.ROBLOX_API_KEY
      ? 'Roblox would not share this item. It may be private or off sale.'
      : 'Roblox only shares newer items with tools that have a Roblox API key. Download the template and drop it in instead.');
  }
  throw httpError(404, 'Could not find that item on Roblox.');
}

async function download(id) {
  const res = await fetch(await locate(id), {headers: UA});
  if (!res.ok) throw httpError(502, `Roblox's CDN responded ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = async (req, res) => {
  // The GitHub Pages copy of the site (custom domain) calls this cross-origin.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-expose-headers', 'x-asset-name, x-asset-type');
  const fail = (status, error) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({error}));
  };
  const id = new URL(req.url, 'http://localhost').searchParams.get('id') || '';
  if (!/^\d{1,20}$/.test(id)) return fail(400, 'Send a numeric Roblox asset id as ?id=');

  try {
    // Name and type are nice to have; the download below works without them.
    const details = await fetch(`https://economy.roblox.com/v2/assets/${id}/details`, {headers: UA}).then(r => r.json()).catch(() => ({}));
    if (details.AssetTypeId && !TYPES[details.AssetTypeId]) return fail(415, 'That item is not a shirt, pants, t-shirt, or image.');
    let type = TYPES[details.AssetTypeId];

    let file = await download(id);
    if (!isImage(file)) {
      const model = file.toString('latin1');
      const cls = model.match(/class="(Shirt|Pants|ShirtGraphic|Decal)"/);
      type = type || (cls && CLASSES[cls[1]]);
      const ref = model.match(/(?:asset\/?\?id=|rbxassetid:\/\/)(\d+)/i);
      if (!type || !ref) return fail(422, 'Could not find a clothing template inside this item.');
      file = await download(ref[1]);
      if (!isImage(file)) return fail(422, 'The template for this item is not an image.');
    }

    res.setHeader('content-type', file[0] === 0x89 ? 'image/png' : 'image/jpeg');
    res.setHeader('cache-control', 'public, max-age=86400, s-maxage=604800');
    res.setHeader('x-asset-name', encodeURIComponent(details.Name || `Item ${id}`));
    res.setHeader('x-asset-type', type || 'image');
    res.end(file);
  } catch (e) {
    fail(e.status || 502, e.message);
  }
};
