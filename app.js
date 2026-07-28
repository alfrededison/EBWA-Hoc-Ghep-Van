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
// di vong trong danh sach: qua cuoi thi ve dau, lui truoc dau thi ra cuoi
const mod = (i, n) => ((i % n) + n) % n;
const randIdx = n => Math.random() * n | 0;
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
    const i = mod(state.idx[state.mode] + (delta || 0), p.length);
    state.idx[state.mode] = i;
    state.item = p[i];
  } else {
    let pick, guard = 0;
    do { pick = p[randIdx(p.length)]; guard++; }
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

/* ---------- cac manh giao dien ---------- */
const ruled = inner => `<div class="ruled"><div class="mid"></div>${inner}</div>`;
const glyph = (s, cls) => `<div class="glyph${cls ? " " + cls : ""}">${s}</div>`;
const cue = (t, cls) => `<div class="cue${cls ? " " + cls : ""}">${t}</div>`;
const hint = t => `<div class="hint">${t}</div>`;
const counter = (i, total) => `<div class="count">${i + 1}/${total}</div>`;
const orderBtn = () => `<button class="small" id="ord">${ord() === "seq" ? "Thứ tự" : "Ngẫu nhiên"}</button>`;
// hai nut bam dinh (Chu don / Chu ghep): [{id, label, on}]
const chipRow = cs => `<div class="chips">`
  + cs.map(c => `<button id="${c.id}" aria-pressed="${c.on}">${c.label}</button>`).join("") + `</div>`;
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

function levelPicker() {
  const opts = Object.keys(DATA.levels)
    .map(k => `<option value="${k}"${k === state.level ? " selected" : ""}>Mức ${k} — ${DATA.levels[k].name}</option>`).join("");
  const rs = rimesOfLevel(state.level);
  const ropts = [`<option value="*">Tất cả vần (${rs.length})</option>`]
    .concat(rs.map(r => `<option value="${r.r}"${r.r === state.rime ? " selected" : ""}>vần ${r.r}</option>`)).join("");
  ctl2.innerHTML =
    `<select id="lv" aria-label="Chọn mức">${opts}</select>` +
    `<select id="rm" aria-label="Chọn vần">${ropts}</select>`;
  $("#lv").onchange = e => { state.level = e.target.value; state.rime = "*"; restart(); };
  $("#rm").onchange = e => { state.rime = e.target.value; restart(); };
}
function restart() { state.idx[state.mode] = 0; state.item = null; render(); }

/* ---------- khung chung cho hai the "danh sach" (Chu cai, Nguyen am) ----------
   Mot danh sach phang, di lui/tien theo thu tu hoac nhay ngau nhien.
   labels: {prev, next, rnd}; wide: nhan dai thi thu nho cho vua mot hang. */
function drawList({ key, list, labels, wide, body }) {
  const n = list.length;
  if (state.idx[key] >= n) state.idx[key] = 0;
  const i = state.idx[key], seq = ord() === "seq";
  stage.innerHTML = body(list[i]);
  const cls = wide ? "big long" : "big";
  ctl.innerHTML = (seq
      ? `<button class="${cls}" id="prev">${labels.prev}</button>`
        + `<button class="${cls} solid" id="next">${labels.next}</button>`
      : `<button class="big solid" id="next">${labels.rnd}</button>`)
    + orderBtn() + counter(i, n);
  const go = j => { state.idx[key] = j; render(); };
  wire("prev", () => go(mod(i - 1, n)));
  wire("next", () => go(seq ? mod(i + 1, n) : randIdx(n)));
}

/* ---------- khung chung cho hai the "mot tieng" (Ghep van, Doc tron) ----------
   Lay mot tieng tu pool theo muc/van dang chon, kem nut lui/tien va mot nut rieng.
   derive: cac gia tri tinh tu tieng, dung chung cho body/goLabel/onGo.
   extra:  ham tra ve {id, label, fn} — goi sau pickItem de doc dung state. */
function drawItem({ key, empty, derive, body, goLabel, onGo, extra }) {
  if (!state.item) pickItem(0);
  const it = state.item;
  if (!it) {
    stage.innerHTML = cue(empty);
    ctl.innerHTML = orderBtn();
    levelPicker();
    return;
  }
  const seq = ord() === "seq", d = derive ? derive(it) : null, ex = extra();
  stage.innerHTML = body(it, d);
  ctl.innerHTML = (seq ? `<button class="small" id="prev">Trước</button>` : "")
    + `<button class="big solid" id="go">${goLabel(seq, d)}</button>`
    + `<button class="small" id="${ex.id}">${ex.label}</button>` + orderBtn()
    + (seq ? counter(state.idx[key], modePool().length) : `<div class="count">Đã đọc ${state.count}</div>`);
  wire("go", () => { onGo(seq, d); render(); });
  wire("prev", () => { pickItem(-1); render(); });
  wire(ex.id, () => { ex.fn(); render(); });
  levelPicker();
}

/* --- 1. Bang chu cai (trang 1) --- */
function alphaList() { return state.alphaSet === "one" ? DATA.alpha1 : DATA.alpha2; }

function drawAlpha() {
  drawList({
    key: "alpha",
    list: alphaList(),
    labels: { prev: "Chữ trước", next: "Chữ sau", rnd: "Chữ khác" },
    body: ch => {
      const say = DATA.onsetRead[ch];
      // chu ghep (2-3 ky tu) thi thu nho lai cho vua dong ke
      return ruled(glyph(`<span class="pair">${ch.toUpperCase()} ${ch}</span>`, ch.length > 1 ? "sm" : ""))
        + cue(`chữ ${ch}${say ? " — đọc " + say : ""}`)
        + hint("Con cầm máy đi tìm chữ này trong nhà");
    },
  });
  ctl2.innerHTML = chipRow([
    { id: "s1", label: "Chữ đơn", on: state.alphaSet === "one" },
    { id: "s2", label: "Chữ ghép", on: state.alphaSet === "duo" },
  ]);
  const setAlpha = v => { state.alphaSet = v; state.idx.alpha = 0; render(); };
  wire("s1", () => setAlpha("one"));
  wire("s2", () => setAlpha("duo"));
}

/* --- 2. Nguyen am va dau thanh (trang 3) --- */
function drawVowel() {
  drawList({
    key: "vowel",
    list: DATA.vowels,
    labels: { prev: "Nguyên âm trước", next: "Nguyên âm sau", rnd: "Nguyên âm khác" },
    wide: true,
    body: v => cue(`nguyên âm ${v} — 6 dấu thanh`, "top")
      + `<div class="grid6">` + toneForms(v).map((s, k) =>
          `<div class="cell"><b>${s}</b><span>${DATA.toneName[k]}</span></div>`).join("") + `</div>`
      + hint("Đọc lần lượt 6 ô. Rồi bố đọc một tiếng, con chỉ vào ô đúng."),
  });
}

/* --- 3. Ghep van --- */
function drawBlend() {
  drawItem({
    key: "blend",
    empty: "Vần này chưa có tiếng để ghép.<br>Chọn vần khác nhé.",
    // Van dong (ket thuc bang p, t, c, ch) khong the mang thanh ngang:
    // dat dau thanh ngay tren van, bo buoc trung gian khong dau.
    derive(it) {
      const closed = /(?:ch|[ptc])$/.test(it.rime);
      const three = it.t !== 0 && !closed;
      return { rime: closed ? it.s.slice(it.o.length) : it.rime, three, lastStep: state.step >= (three ? 2 : 1) };
    },
    body(it, d) {
      const say = DATA.onsetRead[it.o], base = deTone(it.s);
      if (state.step === 0)
        return ruled(`<div class="pieces"><div class="piece">${it.o}</div><div class="plus">+</div><div class="piece">${d.rime}</div></div>`)
          + cue(`${say} — ${d.rime}`)
          + hint("Bố đọc mẫu một lần, rồi để con đọc lại");
      if (state.step === 1 && d.three)
        return ruled(glyph(base)) + cue(`${say} — ${it.rime} — ${base}`);
      return ruled(glyph(it.s))
        + cue(d.three ? `${base} — ${DATA.toneRead[it.t]} — ${it.s}`
                      : `${say} — ${d.rime} — ${it.s}`)
        + (it.w ? "" : hint("Tiếng luyện ghép — chưa cần hiểu nghĩa"));
    },
    goLabel: (seq, d) => d.lastStep ? (seq ? "Tiếng sau" : "Tiếng mới") : "Đọc tiếp",
    onGo(seq, d) { if (d.lastStep) { state.count++; pickItem(seq ? 1 : 0); } else state.step++; },
    extra: () => ({ id: "again", label: "Đọc lại", fn: () => state.step = 0 }),
  });
}

/* --- 4. Doc tron --- */
function drawRead() {
  drawItem({
    key: "read",
    empty: "Vần này chưa có tiếng có nghĩa.<br>Chọn vần khác nhé.",
    body: it => ruled(glyph(it.s)) + (state.revealed
      ? cue((it.o ? `${DATA.onsetRead[it.o]} — ${it.rime} — ` : `vần ${it.rime} — `)
            + deTone(it.s) + (it.t ? ` — ${DATA.toneRead[it.t]} — ${it.s}` : ""))
      : hint("Con đọc — hoặc con ra đề cho bố đọc")),
    goLabel: seq => seq ? "Tiếng sau" : "Tiếng mới",
    onGo: seq => { state.count++; pickItem(seq ? 1 : 0); },
    extra: () => ({ id: "rv", label: state.revealed ? "Ẩn" : "Cách ghép",
                    fn: () => state.revealed = !state.revealed }),
  });
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
