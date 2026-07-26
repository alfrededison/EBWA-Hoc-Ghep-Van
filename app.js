/* ---------- bo dau thanh ---------- */
const MARKS = { "a": "àáảãạ", "ă": "ằắẳẵặ", "â": "ầấẩẫậ", "e": "èéẻẽẹ", "ê": "ềếểễệ",
                "i": "ìíỉĩị", "o": "òóỏõọ", "ô": "ồốổỗộ", "ơ": "ờớởỡợ",
                "u": "ùúủũụ", "ư": "ừứửữự", "y": "ỳýỷỹỵ" };
const UNMARK = {}, TONEIDX = {};
for (const b in MARKS) {
  // thu tu trong MARKS: huyen, sac, hoi, nga, nang  ->  ma thanh 1..5
  const order = [1, 2, 3, 4, 5];
  [...MARKS[b]].forEach((ch, i) => { UNMARK[ch] = b; TONEIDX[ch] = order[i]; });
}
function deTone(s) { return [...s].map(c => UNMARK[c] || c).join(""); }
function toneOf(s) { for (const c of s) if (TONEIDX[c]) return TONEIDX[c]; return 0; }
// 6 dang cua mot nguyen am theo thu tu trong sach: khong dau, sac, huyen, hoi, nga, nang
function toneForms(v) { const m = MARKS[v]; return [v, m[1], m[0], m[2], m[3], m[4]]; }

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
    return { r, items };
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
  alphaIdx: 0,
  alphaOrder: "seq",
  vIdx: 0,
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

function nextItem(opt) {
  let p = pool(opt.word);
  if (opt.onset) p = p.filter(x => x.o !== "");
  if (!p.length) { state.item = null; return; }
  let pick, guard = 0;
  do { pick = p[Math.random() * p.length | 0]; guard++; }
  while (state.item && p.length > 1 && pick.s === state.item.s && guard < 12);
  state.item = pick;
  state.step = 0;
  state.revealed = false;
}

/* ---------- ve giao dien ---------- */
function ruled(inner) {
  return `<div class="ruled"><div class="mid"></div>${inner}</div>`;
}
function helpBtn() {
  return `<button class="small" id="hp" aria-label="Hướng dẫn">?</button>`;
}
function wireHelp() { const b = $("#hp"); if (b) b.onclick = () => $("#help").classList.add("on"); }

function render() {
  ctl.innerHTML = ""; ctl2.innerHTML = "";
  ({ alpha: drawAlpha, vowel: drawVowel, blend: drawBlend, read: drawRead })[state.mode]();
  wireHelp();
}

function levelPicker() {
  const opts = Object.keys(DATA.levels)
    .map(k => `<option value="${k}"${k === state.level ? " selected" : ""}>Mức ${k} — ${DATA.levels[k].name}</option>`).join("");
  const rs = rimesOfLevel(state.level);
  const ropts = [`<option value="*">Tất cả vần (${rs.length})</option>`]
    .concat(rs.map(r => `<option value="${r.r}"${r.r === state.rime ? " selected" : ""}>vần ${r.r}</option>`)).join("");
  ctl2.innerHTML =
    `<select id="lv" aria-label="Chọn mức">${opts}</select>` +
    `<select id="rm" aria-label="Chọn vần">${ropts}</select>` + helpBtn();
  $("#lv").onchange = e => { state.level = e.target.value; state.rime = "*"; step(true); };
  $("#rm").onchange = e => { state.rime = e.target.value; step(true); };
}

/* --- 1. Bang chu cai (trang 1) --- */
function alphaList() { return state.alphaSet === "one" ? DATA.alpha1 : DATA.alpha2; }

function drawAlpha() {
  const list = alphaList();
  if (state.alphaIdx >= list.length) state.alphaIdx = 0;
  const ch = list[state.alphaIdx];
  const say = DATA.onsetRead[ch];
  stage.innerHTML = ruled(`<div class="glyph${ch.length > 1 ? " sm" : ""}"><span class="pair">${ch.toUpperCase()} ${ch}</span></div>`)
    + `<div class="cue">chữ ${ch}${say ? " — đọc " + say : ""}</div>`
    + `<div class="hint">Con cầm máy đi tìm chữ này trong nhà</div>`;
  ctl.innerHTML = `<button class="big solid" id="go">Chữ khác</button>`
    + `<button class="small" id="ord">${state.alphaOrder === "seq" ? "Thứ tự" : "Ngẫu nhiên"}</button>`
    + `<div class="count">${state.alphaIdx + 1}/${list.length}</div>`;
  ctl2.innerHTML = `<div class="chips">`
    + `<button id="s1" aria-pressed="${state.alphaSet === "one"}">Chữ đơn</button>`
    + `<button id="s2" aria-pressed="${state.alphaSet === "duo"}">Chữ ghép</button>`
    + `</div>` + helpBtn();
  $("#go").onclick = () => {
    state.alphaIdx = state.alphaOrder === "seq"
      ? (state.alphaIdx + 1) % list.length
      : Math.random() * list.length | 0;
    render();
  };
  $("#ord").onclick = () => { state.alphaOrder = state.alphaOrder === "seq" ? "rnd" : "seq"; render(); };
  $("#s1").onclick = () => { state.alphaSet = "one"; state.alphaIdx = 0; render(); };
  $("#s2").onclick = () => { state.alphaSet = "duo"; state.alphaIdx = 0; render(); };
}

/* --- 2. Nguyen am va dau thanh (trang 3) --- */
function drawVowel() {
  const v = DATA.vowels[state.vIdx];
  const forms = toneForms(v);
  const cells = forms.map((s, i) =>
    `<div class="cell"><b>${s}</b><span>${DATA.toneName[i]}</span></div>`).join("");
  stage.innerHTML =
    `<div class="cue" style="margin:0 0 3vmin">nguyên âm ${v} — 6 dấu thanh</div>`
    + `<div class="grid6">${cells}</div>`
    + `<div class="hint">Đọc lần lượt 6 ô. Rồi bố đọc một tiếng, con chỉ vào ô đúng.</div>`;
  ctl.innerHTML = `<button class="big solid" id="go">Nguyên âm khác</button>`
    + `<div class="count">${state.vIdx + 1}/${DATA.vowels.length}</div>`;
  ctl2.innerHTML = helpBtn();
  $("#go").onclick = () => { state.vIdx = (state.vIdx + 1) % DATA.vowels.length; render(); };
}

/* --- 3. Ghep van --- */
function drawBlend() {
  if (!state.item) nextItem({ onset: true });
  const it = state.item;
  if (!it) {
    stage.innerHTML = `<p class="cue">Vần này chưa có tiếng để ghép.<br>Chọn vần khác nhé.</p>`;
    levelPicker(); return;
  }
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
  ctl.innerHTML =
    `<button class="big solid" id="go">${lastStep ? "Tiếng mới" : "Đọc tiếp"}</button>` +
    `<button class="small" id="again">Đọc lại</button>` +
    `<div class="count">Đã đọc ${state.count}</div>`;
  $("#go").onclick = () => {
    if (lastStep) { state.count++; nextItem({ onset: true }); } else { state.step++; }
    render();
  };
  $("#again").onclick = () => { state.step = 0; render(); };
  levelPicker();
}

/* --- 4. Doc tron --- */
function drawRead() {
  if (!state.item) nextItem({ word: true });
  const it = state.item;
  if (!it) {
    stage.innerHTML = `<p class="cue">Vần này chưa có tiếng có nghĩa.<br>Chọn vần khác nhé.</p>`;
    levelPicker(); return;
  }
  stage.innerHTML = ruled(`<div class="glyph">${it.s}</div>`)
    + (state.revealed
        ? `<div class="cue">${it.o ? DATA.onsetRead[it.o] + " — " + it.rime + " — " : "vần " + it.rime + " — "}${deTone(it.s)}${it.t ? " — " + DATA.toneRead[it.t] + " — " + it.s : ""}</div>`
        : `<div class="hint">Con đọc — hoặc con ra đề cho bố đọc</div>`);
  ctl.innerHTML = `<button class="big solid" id="go">Tiếng mới</button>`
    + `<button class="small" id="rv">${state.revealed ? "Ẩn" : "Cách ghép"}</button>`
    + `<div class="count">Đã đọc ${state.count}</div>`;
  $("#go").onclick = () => { state.count++; nextItem({ word: true }); render(); };
  $("#rv").onclick = () => { state.revealed = !state.revealed; render(); };
  levelPicker();
}

/* ---------- dieu khien chung ---------- */
function step(resetItem) { if (resetItem) { state.item = null; } render(); }

for (const b of document.querySelectorAll("#tabs button")) {
  b.onclick = () => {
    for (const x of document.querySelectorAll("#tabs button")) x.setAttribute("aria-selected", "false");
    b.setAttribute("aria-selected", "true");
    state.mode = b.dataset.mode;
    state.item = null; state.revealed = false;
    render();
  };
}
$("#help .close").onclick = () => $("#help").classList.remove("on");
document.addEventListener("dblclick", e => e.preventDefault());

render();
