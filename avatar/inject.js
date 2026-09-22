/*
 * Roblox Avatar Rotator - Bookmarklet payload
 * Loaded via <script> injection from a bookmarklet while the user is on a
 * roblox.com page. Runs entirely in that page's own origin, so it rides on
 * the user's already-authenticated session cookies (sent automatically by
 * the browser) - no cookie is ever pasted, read, or sent to any other server.
 * Everything (selected outfits, interval) is kept in this browser's own
 * localStorage under roblox.com's origin. Stops the moment the tab closes.
 */
(function () {
  "use strict";

  if (!/(^|\.)roblox\.com$/.test(location.hostname)) {
    alert("Roblox Avatar Rotator only works on a roblox.com page. Open roblox.com first, then click the bookmarklet.");
    return;
  }

  if (document.getElementById("rar-panel")) {
    document.getElementById("rar-panel").scrollIntoView({ block: "center" });
    return;
  }

  const STORAGE_KEY = "rar_settings_v1";
  const AVATAR_TYPE_MAP = { R6: 1, R15: 3 };

  const state = {
    active: false,
    timer: null,
    csrfToken: null,
    userId: null,
    outfits: [], // fetched from Roblox
    outfitCache: {},
    selected: [], // [{id, name}]
    interval: 5,
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.selected = parsed.selected || [];
        state.interval = parsed.interval || 5;
      }
    } catch (e) {
      /* ignore corrupt storage */
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selected: state.selected, interval: state.interval })
      );
    } catch (e) {
      /* ignore */
    }
  }

  async function api(method, url, body) {
    const headers = { "Content-Type": "application/json" };
    if (state.csrfToken) headers["x-csrf-token"] = state.csrfToken;

    try {
      let res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 403 && res.headers.get("x-csrf-token")) {
        state.csrfToken = res.headers.get("x-csrf-token");
        headers["x-csrf-token"] = state.csrfToken;
        res = await fetch(url, {
          method,
          credentials: "include",
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      }
      return res;
    } catch (e) {
      return null;
    }
  }

  async function getAuthenticatedUser() {
    const res = await api("GET", "https://users.roblox.com/v1/users/authenticated");
    if (!res || !res.ok) return null;
    return res.json();
  }

  async function fetchOutfits() {
    if (!state.userId) return [];
    const url = `https://avatar.roblox.com/v2/avatar/users/${state.userId}/outfits?page=1&itemsPerPage=50&isEditable=true`;
    const res = await api("GET", url);
    if (!res || !res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .filter((o) => o.outfitType === "Avatar")
      .map((o) => ({ id: o.id, name: o.name }));
  }

  async function getOutfitDetails(outfitId) {
    const res = await api("GET", `https://avatar.roblox.com/v3/outfits/${outfitId}/details`);
    if (!res || !res.ok) return null;
    return res.json();
  }

  async function equipOutfit(details) {
    if (details.playerAvatarType) {
      const typeEnum = AVATAR_TYPE_MAP[details.playerAvatarType];
      if (typeEnum) {
        await api("POST", "https://avatar.roblox.com/v1/avatar/set-player-avatar-type", {
          playerAvatarType: typeEnum,
        });
      }
    }
    if (details.bodyColor3s) {
      await api("POST", "https://avatar.roblox.com/v2/avatar/set-body-colors", details.bodyColor3s);
    }
    if (details.assets) {
      const cleanAssets = details.assets.map((a) => {
        const clean = { id: a.id };
        if (a.meta) clean.meta = a.meta;
        return clean;
      });
      await api("POST", "https://avatar.roblox.com/v2/avatar/set-wearing-assets", { assets: cleanAssets });
    }
  }

  // ---- UI ----
  const panel = document.createElement("div");
  panel.id = "rar-panel";
  panel.innerHTML = `
    <style>
      #rar-panel { position: fixed; top: 16px; right: 16px; width: 300px; max-height: 80vh;
        overflow-y: auto; background: #121a2b; color: #edf6ff; border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,.4); z-index: 2147483647;
        font-family: Arial, Helvetica, sans-serif; font-size: 13px; border: 1px solid rgba(110,231,255,.25); }
      #rar-panel .rar-head { display:flex; align-items:center; justify-content:space-between;
        padding: 10px 12px; background: linear-gradient(45deg, #123244, #0b1020);
        border-bottom: 1px solid rgba(110,231,255,.2); border-radius: 12px 12px 0 0; }
      #rar-panel .rar-head b { font-size: 13px; color:#6ee7ff; }
      #rar-panel .rar-body { padding: 12px; display:flex; flex-direction:column; gap:8px; }
      #rar-panel button { background: rgba(110,231,255,.12); color:#edf6ff; border:none;
        border-radius:6px; padding:6px 10px; cursor:pointer; font-size:12px; }
      #rar-panel button:hover { background: rgba(110,231,255,.22); }
      #rar-panel button.rar-primary { background: #6ee7ff; color:#06222b; font-weight:700; }
      #rar-panel button.rar-danger { background:#e5484d; color:#fff; }
      #rar-panel button:disabled { opacity:.5; cursor:not-allowed; }
      #rar-panel .rar-row { display:flex; gap:6px; flex-wrap:wrap; }
      #rar-panel ul { list-style:none; margin:0; padding:0; max-height:160px; overflow-y:auto; }
      #rar-panel li label { display:flex; gap:6px; align-items:center; padding:4px 6px;
        background: rgba(255,255,255,.06); border-radius:4px; margin-bottom:4px; cursor:pointer; }
      #rar-panel input[type=number] { width: 60px; background:#0b1020; color:#edf6ff;
        border:1px solid rgba(110,231,255,.3); border-radius:4px; padding:4px; }
      #rar-panel .rar-status { font-size:11px; opacity:.85; min-height:14px; color:#a8b5c7; }
      #rar-panel .rar-close { cursor:pointer; opacity:.8; color:#a8b5c7; }
      #rar-dot { width:9px; height:9px; border-radius:50%; background:#e5484d; display:inline-block; margin-right:6px; }
      #rar-dot.active { background:#30d158; }
    </style>
    <div class="rar-head">
      <b><span id="rar-dot"></span>Avatar Rotator</b>
      <span class="rar-close" id="rar-close">&times;</span>
    </div>
    <div class="rar-body">
      <div id="rar-who" class="rar-status">Checking session...</div>
      <div class="rar-row">
        <button id="rar-fetch">Fetch My Outfits</button>
      </div>
      <ul id="rar-list"><li style="opacity:.6">Fetch outfits to see them here.</li></ul>
      <label style="display:flex; align-items:center; gap:6px;">
        Interval (s): <input type="number" id="rar-interval" min="1" max="300" value="5" />
      </label>
      <div class="rar-row">
        <button id="rar-start" class="rar-primary">Start</button>
        <button id="rar-stop" class="rar-danger" disabled>Stop</button>
      </div>
      <div id="rar-status" class="rar-status"></div>
    </div>
  `;
  document.body.appendChild(panel);

  const $ = (id) => document.getElementById(id);

  function setStatus(msg) {
    $("rar-status").textContent = msg;
  }

  function renderOutfits() {
    const list = $("rar-list");
    if (!state.outfits.length) {
      list.innerHTML = '<li style="opacity:.6">Fetch outfits to see them here.</li>';
      return;
    }
    const selectedIds = new Set(state.selected.map((o) => o.id));
    list.innerHTML = "";
    for (const o of state.outfits) {
      const li = document.createElement("li");
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = o.id;
      cb.checked = selectedIds.has(o.id);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(o.name));
      li.appendChild(label);
      list.appendChild(li);
    }
  }

  function collectSelected() {
    const checked = panel.querySelectorAll('#rar-list input[type="checkbox"]:checked');
    const ids = new Set(Array.from(checked).map((c) => Number(c.value)));
    return state.outfits.filter((o) => ids.has(o.id));
  }

  async function init() {
    loadSettings();
    $("rar-interval").value = state.interval;

    let user = null;
    try {
      user = await getAuthenticatedUser();
    } catch (e) {
      user = null;
    }

    if (!user) {
      $("rar-who").textContent = "Not logged in to Roblox on this tab.";
      $("rar-fetch").disabled = true;
      $("rar-start").disabled = true;
      return;
    }
    state.userId = user.id;
    $("rar-who").textContent = `Signed in as ${user.name}`;

    if (state.selected.length) {
      state.outfits = state.selected;
      renderOutfits();
    }
  }

  $("rar-fetch").addEventListener("click", async () => {
    setStatus("Fetching outfits...");
    const outfits = await fetchOutfits();
    if (!outfits.length) {
      setStatus("No outfits found.");
      return;
    }
    state.outfits = outfits;
    renderOutfits();
    setStatus(`Loaded ${outfits.length} outfits.`);
  });

  $("rar-start").addEventListener("click", async () => {
    const selected = collectSelected();
    if (!selected.length) {
      setStatus("Select at least one outfit first.");
      return;
    }
    state.selected = selected;
    state.interval = Math.max(1, Number($("rar-interval").value) || 5);
    saveSettings();

    state.active = true;
    $("rar-dot").classList.add("active");
    $("rar-start").disabled = true;
    $("rar-stop").disabled = false;
    setStatus("Rotation started.");

    let index = 0;
    const tick = async () => {
      if (!state.active) return;
      const outfit = state.selected[index % state.selected.length];
      try {
        let details = state.outfitCache[outfit.id];
        if (!details) {
          details = await getOutfitDetails(outfit.id);
          if (details) state.outfitCache[outfit.id] = details;
        }
        if (details) {
          setStatus(`Equipping: ${outfit.name}...`);
          await equipOutfit(details);
        } else {
          setStatus(`Skipping ${outfit.name} (couldn't fetch details).`);
        }
      } catch (e) {
        setStatus(`Error: ${e.message}`);
      }
      index++;
    };

    await tick();
    state.timer = setInterval(tick, state.interval * 1000);
  });

  $("rar-stop").addEventListener("click", () => {
    state.active = false;
    if (state.timer) clearInterval(state.timer);
    $("rar-dot").classList.remove("active");
    $("rar-start").disabled = false;
    $("rar-stop").disabled = true;
    setStatus("Rotation stopped.");
  });

  $("rar-close").addEventListener("click", () => {
    state.active = false;
    if (state.timer) clearInterval(state.timer);
    panel.remove();
  });

  init();
})();
