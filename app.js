/* ---------- bo dau thanh ---------- */
const MARKS = { "a": "àáảãạ", "ă": "ằắẳẵặ", "â": "ầấẩẫậ", "e": "èéẻẽẹ", "ê": "ềếểễệ",
                "i": "ìíỉĩị", "o": "òóỏõọ", "ô": "ồốổỗộ", "ơ": "ờớởỡợ",
                "u": "ùúủũụ", "ư": "ừứửữự", "y": "ỳýỷỹỵ" };
const UNMARK = {}, TONEIDX = {};
for (const b in MARKS) {
  // thu tu trong MARKS: huyen, sac, hoi, nga, nang  ->  ma thanh 1..5
  [...MARKS[b]].forEach((ch, i) => { UNMARK[ch] = b; TONEIDX[ch] = i + 1; });
}
function deTone(s) { return [...s].map(c => UNMARK[c] || c).join(""); }
function toneOf(s) { for (const c of s) if (TONEIDX[c]) return TONEIDX[c]; return 0; }
// 6 dang cua mot nguyen am theo thu tu trong sach: khong dau, sac, huyen, hoi, nga, nang
function toneForms(v) { const m = MARKS[v]; return [v, m[1], m[0], m[2], m[3], m[4]]; }

/* ---------- thu tu nhu trong sach ----------
   Bang trong sach: moi HANG la mot dau thanh, moi COT la mot am dau.
     hang: khong dau, sac, huyen, hoi, nga, nang
     cot : am dau theo thu tu tu dien, o trong (khong co am dau) dung dau
   Rieng muc 1 (nguyen am don) sach danh mot trang cho mot am dau,
   nen thu tu la theo trang (b, c, d, d, g, h, k, ...) roi moi den dau thanh. */
const TONE_ROWS = [0, 2, 1, 3, 4, 5];
const ONSET_COLS = ["", "b", "c", "ch", "d", "đ", "g", "gh", "gi", "h", "k", "kh", "l", "m",
                    "n", "ng", "ngh", "nh", "p", "ph", "qu", "r", "s", "t", "th", "tr", "v", "x"];
const ONSET_PAGES = ["b", "c", "d", "đ", "g", "h", "k", "l", "m", "n", "r", "s", "t", "v", "x",
                     "ch", "gi", "ng", "kh", "th", "tr", "nh", "ngh", "ph", "qu"];
const rankOf = arr => { const o = {}; arr.forEach((x, i) => o[x] = i); return o; };
const TONE_RANK = rankOf(TONE_ROWS), COL_RANK = rankOf(ONSET_COLS), PAGE_RANK = rankOf(ONSET_PAGES);

function bookOrder(items, byPage) {
  const key = byPage
    ? it => [PAGE_RANK[it.o] ?? 99, TONE_RANK[it.t]]
    : it => [TONE_RANK[it.t], COL_RANK[it.o] ?? 99];
  return items
    .map((it, i) => ({ it, k: key(it), i }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.i - b.i)
    .map(x => x.it);
}

/* ---------- dung du lieu tu RAW ---------- */
const DATA = { levels: {}, alpha1: RAW.a1.split(" "), alpha2: RAW.a2.split(" "),
               vowels: RAW.v.split(" "), onsetRead: RAW.or, toneRead: RAW.tr, toneName: RAW.tn };
RAW.g.forEach(([name, rimeList], gi) => {
  const rimes = rimeList.split(" ").map(r => {
    const items = RAW.r[r].split(" ").map(tok => {
      const w = tok.endsWith("*"), s = w ? tok.slice(0, -1) : tok;
      const base = deTone(s);
      return { s, o: base.slice(0, base.length - r.length), t: toneOf(s), w };
    });
    return { r, items: bookOrder(items, gi === 0) };
  });
  DATA.levels[String(gi + 1)] = { name, rimes };
});

const $ = (s, r) => (r || document).querySelector(s);
const stage = $("#stage"), ctl = $("#ctl"), ctl2 = $("#ctl2");
const state = {
  mode: "alpha",
  level: "1",
  rime: "*",       // "*" = tat ca van trong muc
  step: 0,
  item: null,      // {s, o, t, w, rime}
  alphaSet: "one", // one = chu don, duo = chu ghep
  order: { alpha: "seq", vowel: "seq", blend: "seq", read: "seq" },
  idx: { alpha: 0, vowel: 0, blend: 0, read: 0 },
  revealed: false,
  count: 0,
};

/* ---------- lay du lieu ---------- */
function rimesOfLevel(lv) { return DATA.levels[lv].rimes; }

function pool(wordsOnly) {
  const rs = rimesOfLevel(state.level);
  const picked = state.rime === "*" ? rs : rs.filter(r => r.r === state.rime);
  const out = [];
  for (const r of picked) for (const it of r.items) {
    if (wordsOnly && !it.w) continue;
    out.push({ ...it, rime: r.r });
  }
  return out;
}
// Ghep van can co am dau; Doc tron chi lay tieng co nghia.
function modePool() {
  const p = pool(state.mode === "read");
  return state.mode === "blend" ? p.filter(x => x.o !== "") : p;
}

function ord() { return state.order[state.mode]; }

function pickItem(delta) {
  const p = modePool();
  if (!p.length) { state.item = null; return; }
  if (ord() === "seq") {
    let i = state.idx[state.mode] + (delta || 0);
    i = ((i % p.length) + p.length) % p.length;
    state.idx[state.mode] = i;
    state.item = p[i];
  } else {
    let pick, guard = 0;
    do { pick = p[Math.random() * p.length | 0]; guard++; }
    while (state.item && p.length > 1 && pick.s === state.item.s && guard < 12);
    state.item = pick;
  }
  state.step = 0;
  state.revealed = false;
}
// doi che do ma van dung o tieng dang xem
function syncIdx() {
  const p = modePool();
  const i = state.item ? p.findIndex(x => x.s === state.item.s) : -1;
  state.idx[state.mode] = i < 0 ? 0 : i;
}

/* ---------- ve giao dien ---------- */
function ruled(inner) {
  return `<div class="ruled"><div class="mid"></div>${inner}</div>`;
}
function orderBtn() {
  return `<button class="small" id="ord">${ord() === "seq" ? "Thứ tự" : "Ngẫu nhiên"}</button>`;
}
function counter(i, total) { return `<div class="count">${i + 1}/${total}</div>`; }
function wire(id, fn) { const b = $("#" + id); if (b) b.onclick = fn; }

function render() {
  ctl.innerHTML = ""; ctl2.innerHTML = "";
  ({ alpha: drawAlpha, vowel: drawVowel, blend: drawBlend, read: drawRead })[state.mode]();
  wire("ord", () => {
    state.order[state.mode] = ord() === "seq" ? "rnd" : "seq";
    if (ord() === "seq" && (state.mode === "blend" || state.mode === "read")) syncIdx();
    render();
  });
}

function levelPicker(extra) {
  const opts = Object.keys(DATA.levels)
    .map(k => `<option value="${k}"${k === state.level ? " selected" : ""}>Mức ${k} — ${DATA.levels[k].name}</option>`).join("");
  const rs = rimesOfLevel(state.level);
  const ropts = [`<option value="*">Tất cả vần (${rs.length})</option>`]
    .concat(rs.map(r => `<option value="${r.r}"${r.r === state.rime ? " selected" : ""}>vần ${r.r}</option>`)).join("");
  ctl2.innerHTML =
    `<select id="lv" aria-label="Chọn mức">${opts}</select>` +
    `<select id="rm" aria-label="Chọn vần">${ropts}</select>` + (extra || "");
  $("#lv").onchange = e => { state.level = e.target.value; state.rime = "*"; restart(); };
  $("#rm").onchange = e => { state.rime = e.target.value; restart(); };
}
function restart() { state.idx[state.mode] = 0; state.item = null; render(); }

/* --- 1. Bang chu cai (trang 1) --- */
function alphaList() { return state.alphaSet === "one" ? DATA.alpha1 : DATA.alpha2; }

function drawAlpha() {
  const list = alphaList();
  if (state.idx.alpha >= list.length) state.idx.alpha = 0;
  const i = state.idx.alpha, ch = list[i], say = DATA.onsetRead[ch];
  stage.innerHTML = ruled(`<div class="glyph${ch.length > 1 ? " sm" : ""}"><span class="pair">${ch.toUpperCase()} ${ch}</span></div>`)
    + `<div class="cue">chữ ${ch}${say ? " — đọc " + say : ""}</div>`
    + `<div class="hint">Con cầm máy đi tìm chữ này trong nhà</div>`;
  const step = d => { state.idx.alpha = ((i + d) % list.length + list.length) % list.length; render(); };
  if (ord() === "seq") {
    ctl.innerHTML = `<button class="big" id="prev">Chữ trước</button>`
      + `<button class="big solid" id="next">Chữ sau</button>` + orderBtn() + counter(i, list.length);
    wire("prev", () => step(-1));
  } else {
    ctl.innerHTML = `<button class="big solid" id="next">Chữ khác</button>` + orderBtn() + counter(i, list.length);
  }
  wire("next", () => {
    if (ord() === "seq") step(1);
    else { state.idx.alpha = Math.random() * list.length | 0; render(); }
  });
  ctl2.innerHTML = `<div class="chips">`
    + `<button id="s1" aria-pressed="${state.alphaSet === "one"}">Chữ đơn</button>`
    + `<button id="s2" aria-pressed="${state.alphaSet === "duo"}">Chữ ghép</button>`
    + `</div>`;
  wire("s1", () => { state.alphaSet = "one"; state.idx.alpha = 0; render(); });
  wire("s2", () => { state.alphaSet = "duo"; state.idx.alpha = 0; render(); });
}

/* --- 2. Nguyen am va dau thanh (trang 3) --- */
function drawVowel() {
  const list = DATA.vowels, i = state.idx.vowel, v = list[i];
  const cells = toneForms(v).map((s, k) =>
    `<div class="cell"><b>${s}</b><span>${DATA.toneName[k]}</span></div>`).join("");
  stage.innerHTML =
    `<div class="cue" style="margin:0 0 3vmin">nguyên âm ${v} — 6 dấu thanh</div>`
    + `<div class="grid6">${cells}</div>`
    + `<div class="hint">Đọc lần lượt 6 ô. Rồi bố đọc một tiếng, con chỉ vào ô đúng.</div>`;
  const step = d => { state.idx.vowel = ((i + d) % list.length + list.length) % list.length; render(); };
  // nhan dai nen dung class "long" cho vua mot hang
  if (ord() === "seq") {
    ctl.innerHTML = `<button class="big long" id="prev">Nguyên âm trước</button>`
      + `<button class="big long solid" id="next">Nguyên âm sau</button>`
      + orderBtn() + counter(i, list.length);
    wire("prev", () => step(-1));
  } else {
    ctl.innerHTML = `<button class="big solid" id="next">Nguyên âm khác</button>`
      + orderBtn() + counter(i, list.length);
  }
  wire("next", () => {
    if (ord() === "seq") step(1);
    else { state.idx.vowel = Math.random() * list.length | 0; render(); }
  });
}

/* --- 3. Ghep van --- */
function drawBlend() {
  if (!state.item) pickItem(0);
  const it = state.item;
  if (!it) {
    stage.innerHTML = `<p class="cue">Vần này chưa có tiếng để ghép.<br>Chọn vần khác nhé.</p>`;
    ctl.innerHTML = orderBtn(); levelPicker(); return;
  }
  const seq = ord() === "seq", total = modePool().length;
  const base = deTone(it.s);
  // Van dong (ket thuc bang p, t, c, ch) khong the mang thanh ngang:
  // dat dau thanh ngay tren van, bo buoc trung gian khong dau.
  const closed = /(?:ch|[ptc])$/.test(it.rime);
  const shownRime = closed ? it.s.slice(it.o.length) : it.rime;
  const threeStep = it.t !== 0 && !closed;
  const last = threeStep ? 2 : 1;

  if (state.step === 0) {
    stage.innerHTML = ruled(
      `<div class="pieces"><div class="piece">${it.o}</div><div class="plus">+</div><div class="piece">${shownRime}</div></div>`
    ) + `<div class="cue">${DATA.onsetRead[it.o]} — ${shownRime}</div>`
      + `<div class="hint">Bố đọc mẫu một lần, rồi để con đọc lại</div>`;
  } else if (state.step === 1 && threeStep) {
    stage.innerHTML = ruled(`<div class="glyph">${base}</div>`)
      + `<div class="cue">${DATA.onsetRead[it.o]} — ${it.rime} — ${base}</div>`;
  } else {
    stage.innerHTML = ruled(`<div class="glyph">${it.s}</div>`)
      + `<div class="cue">${threeStep
          ? base + " — " + DATA.toneRead[it.t] + " — " + it.s
          : DATA.onsetRead[it.o] + " — " + shownRime + " — " + it.s}</div>`
      + (it.w ? "" : `<div class="hint">Tiếng luyện ghép — chưa cần hiểu nghĩa</div>`);
  }

  const lastStep = state.step >= last;
  ctl.innerHTML = (seq ? `<button class="small" id="prev">Trước</button>` : "")
    + `<button class="big solid" id="go">${lastStep ? (seq ? "Tiếng sau" : "Tiếng mới") : "Đọc tiếp"}</button>`
    + `<button class="small" id="again">Đọc lại</button>` + orderBtn()
    + (seq ? counter(state.idx.blend, total) : `<div class="count">Đã đọc ${state.count}</div>`);
  wire("go", () => {
    if (lastStep) { state.count++; pickItem(seq ? 1 : 0); } else { state.step++; }
    render();
  });
  wire("prev", () => { pickItem(-1); render(); });
  wire("again", () => { state.step = 0; render(); });
  levelPicker();
}

/* --- 4. Doc tron --- */
function drawRead() {
  if (!state.item) pickItem(0);
  const it = state.item;
  if (!it) {
    stage.innerHTML = `<p class="cue">Vần này chưa có tiếng có nghĩa.<br>Chọn vần khác nhé.</p>`;
    ctl.innerHTML = orderBtn(); levelPicker(); return;
  }
  const seq = ord() === "seq", total = modePool().length;
  stage.innerHTML = ruled(`<div class="glyph">${it.s}</div>`)
    + (state.revealed
        ? `<div class="cue">${it.o ? DATA.onsetRead[it.o] + " — " + it.rime + " — " : "vần " + it.rime + " — "}${deTone(it.s)}${it.t ? " — " + DATA.toneRead[it.t] + " — " + it.s : ""}</div>`
        : `<div class="hint">Con đọc — hoặc con ra đề cho bố đọc</div>`);
  ctl.innerHTML = (seq ? `<button class="small" id="prev">Trước</button>` : "")
    + `<button class="big solid" id="go">${seq ? "Tiếng sau" : "Tiếng mới"}</button>`
    + `<button class="small" id="rv">${state.revealed ? "Ẩn" : "Cách ghép"}</button>` + orderBtn()
    + (seq ? counter(state.idx.read, total) : `<div class="count">Đã đọc ${state.count}</div>`);
  wire("go", () => { state.count++; pickItem(seq ? 1 : 0); render(); });
  wire("prev", () => { pickItem(-1); render(); });
  wire("rv", () => { state.revealed = !state.revealed; render(); });
  levelPicker();
}

/* ---------- dieu khien chung ---------- */
for (const b of document.querySelectorAll("#tabs button[data-mode]")) {
  b.onclick = () => {
    for (const x of document.querySelectorAll("#tabs button[data-mode]")) x.setAttribute("aria-selected", "false");
    b.setAttribute("aria-selected", "true");
    state.mode = b.dataset.mode;
    state.item = null; state.revealed = false; state.step = 0;
    render();
  };
}
$("#hp").onclick = () => $("#help").classList.add("on");
$("#help .close").onclick = () => $("#help").classList.remove("on");
document.addEventListener("dblclick", e => e.preventDefault());

render();
