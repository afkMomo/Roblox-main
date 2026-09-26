// GET /api/clothing?id=<shirt, pants, t-shirt, decal, or image asset id>
// -> the template image, with x-asset-name / x-asset-type headers.
// Roblox's CDN doesn't allow browser requests (no CORS), so the clothing previewer loads items through here.
const TYPES = {1: 'image', 2: 'tshirt', 11: 'shirt', 12: 'pants', 13: 'decal'};

async function download(id) {
  const res = await fetch(`https://assetdelivery.roblox.com/v1/assetId/${id}`);
  const body = await res.json().catch(() => ({}));
  if (!body.location) throw Object.assign(new Error(body.errors?.[0]?.message || 'Asset not found'), {status: res.status === 429 ? 429 : 404});
  return Buffer.from(await (await fetch(body.location)).arrayBuffer());
}

module.exports = async (req, res) => {
  const fail = (status, error) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({error}));
  };
  const id = new URL(req.url, 'http://localhost').searchParams.get('id') || '';
  if (!/^\d{1,20}$/.test(id)) return fail(400, 'Send a numeric Roblox asset id as ?id=');

  try {
    const details = await (await fetch(`https://economy.roblox.com/v2/assets/${id}/details`)).json().catch(() => ({}));
    const type = TYPES[details.AssetTypeId];
    if (!type) return fail(415, details.AssetTypeId ? 'That item is not a shirt, pants, t-shirt, or image.' : 'Could not find that item on Roblox.');

    let file = await download(id);
    if (type !== 'image') {
      // Clothing items are small model files that point at the actual template image.
      const ref = file.toString('latin1').match(/(?:asset\/?\?id=|rbxassetid:\/\/)(\d+)/i);
      if (!ref) return fail(422, 'Could not find the template inside this item.');
      file = await download(ref[1]);
    }
    const isPng = file[0] === 0x89 && file[1] === 0x50, isJpeg = file[0] === 0xff && file[1] === 0xd8;
    if (!isPng && !isJpeg) return fail(422, 'The template for this item is not an image.');

    res.setHeader('content-type', isPng ? 'image/png' : 'image/jpeg');
    res.setHeader('cache-control', 'public, max-age=86400');
    res.setHeader('x-asset-name', encodeURIComponent(details.Name || `Item ${id}`));
    res.setHeader('x-asset-type', type);
    res.end(file);
  } catch (e) {
    fail(e.status === 429 ? 429 : e.status === 404 ? 404 : 502, e.status === 429 ? 'Roblox is rate limiting requests. Try again in a moment.' : e.message);
  }
};
