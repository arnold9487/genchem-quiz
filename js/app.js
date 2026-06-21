/* =====================================================================
   普化期末考 練習題  —  純前端，無後端
   資料：根目錄各章 JSON；紀錄：localStorage + 匯出/匯入 JSON
   ===================================================================== */

/* ---------- 設定：要載入哪些章節（新增章節時改這裡就好）---------- */
const CHAPTER_FILES = [
  { file: "CH15.json", name: "Ch15 化學動力學" },
  { file: "CH18.json", name: "Ch18 元素週期性" },
  { file: "CH20.json", name: "Ch20 核化學" },
  { file: "CH21.json", name: "Ch21 有機化學" },
];

const OPTION_KEYS = ["a", "b", "c", "d", "e", "f"];
const STORAGE_KEY = "genchem_records_v1";

/* ---------- 全域狀態 ---------- */
const App = {
  chapters: [],          // [{file, name, questions:[...]}]
  allQuestions: [],      // 攤平後的所有題目（含 _id, _chapterFile）
  records: {},           // qid -> {attempts, correct, wrong, lastResult, lastSeen}
  quiz: null,            // 目前測驗的 state
};

/* ===================== 小工具 ===================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderMath(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }
}

/* 把純文字安全放進 HTML（KaTeX 之後才會掃描 $...$） */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ===================== 紀錄（localStorage）===================== */
function loadRecords() {
  try {
    App.records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    App.records = {};
  }
}
function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(App.records));
}
function recOf(qid) {
  const r = App.records[qid];
  return {
    attempts: r?.attempts || 0,
    correct: r?.correct || 0,
    wrong: r?.wrong || 0,
    due: r?.due || 0,           // 目前還要「答對幾次」才脫離錯題池（0 = 非錯題）
    lastResult: r?.lastResult ?? null,
    lastSeen: r?.lastSeen || 0,
  };
}

/* 依模式更新紀錄
   - exam：完整計分；答對 due-1、答錯 due+1
   - practice：只「清除」不「累積」；答對 due-1，答錯不動，且不計入 attempts/correct/wrong */
function applyResult(qid, isCorrect, mode) {
  const r = recOf(qid);
  if (mode === "exam") {
    r.attempts += 1;
    if (isCorrect) { r.correct += 1; r.due = Math.max(0, r.due - 1); }
    else { r.wrong += 1; r.due += 1; }
    r.lastResult = isCorrect ? "correct" : "wrong";
    r.lastSeen = Date.now();
  } else { // practice
    if (isCorrect) r.due = Math.max(0, r.due - 1);
    r.lastSeen = Date.now();
  }
  App.records[qid] = r;
}

/* ===================== 載入章節資料 ===================== */
async function loadChapters() {
  const results = await Promise.allSettled(
    CHAPTER_FILES.map(async (c) => {
      const res = await fetch(c.file, { cache: "no-store" });
      if (!res.ok) throw new Error(`${c.file}: HTTP ${res.status}`);
      const data = await res.json();
      return { ...c, questions: data };
    })
  );

  App.chapters = [];
  App.allQuestions = [];
  const failed = [];

  results.forEach((r, i) => {
    const cfg = CHAPTER_FILES[i];
    if (r.status === "fulfilled") {
      const ch = r.value;
      ch.questions.forEach((q) => {
        q._chapterFile = ch.file;
        q._chapterName = ch.name;
        q._id = `${ch.file}#${q["題號"]}`;
      });
      App.chapters.push(ch);
      App.allQuestions.push(...ch.questions);
    } else {
      failed.push(`${cfg.name}（${r.reason.message}）`);
    }
  });

  // 全域順序（章節順序 → 題號順序），供「依序出題」使用
  App.allQuestions.forEach((q, i) => { q._seq = i; });

  return failed;
}

/* ===================== 題目的可用選項 ===================== */
function optionsOf(q) {
  return OPTION_KEYS
    .filter((k) => (q[`選項${k}原文`] ?? "").toString().trim() !== "")
    .map((k) => ({
      key: k,
      text: q[`選項${k}原文`],
      zh: q[`選項${k}翻譯`],
      reason: q[`選項${k}理由`],
      img: q[`選項${k}圖片`],
    }));
}
function answerOf(q) {
  return (q["答案"] || "").toString().trim().toLowerCase();
}

/* ===================== 設定頁 ===================== */
function renderChapterList() {
  const box = $("#chapterList");
  if (!App.chapters.length) {
    box.innerHTML = `<p class="muted">沒有可用的章節資料。</p>`;
    return;
  }
  box.innerHTML = App.chapters
    .map(
      (ch) => `
      <label class="chapter-item">
        <input type="checkbox" class="chapter-cb" value="${esc(ch.file)}" checked>
        <span>${esc(ch.name)}</span>
        <span class="ch-count">${ch.questions.length} 題</span>
      </label>`
    )
    .join("") +
    `<div class="chapter-tools">
        <button id="selAll" class="ghost-btn">全選</button>
        <button id="selNone" class="ghost-btn">全不選</button>
     </div>`;

  $("#selAll").onclick = () => $$(".chapter-cb").forEach((c) => (c.checked = true));
  $("#selNone").onclick = () => $$(".chapter-cb").forEach((c) => (c.checked = false));
}

function selectedChapterFiles() {
  return $$(".chapter-cb:checked").map((c) => c.value);
}

function refreshRecordSummary() {
  const ids = Object.keys(App.records);
  const el = $("#recordSummary");
  if (!ids.length) {
    el.textContent = "尚無紀錄。";
    return;
  }
  let attempts = 0, correct = 0, due = 0;
  ids.forEach((id) => {
    const r = recOf(id);
    attempts += r.attempts; correct += r.correct;
    if (r.due > 0) due += 1;
  });
  el.innerHTML = `錯題池 <strong>${due}</strong> 題　·　已接觸 ${ids.length} 題　·　測驗作答 ${attempts} 次（對 ${correct}）`;
}

/* ===================== 出題 ===================== */
function buildQuiz() {
  const files = selectedChapterFiles();
  if (!files.length) {
    alert("請至少選擇一個章節。");
    return null;
  }
  const mode = $('input[name="mode"]:checked').value;
  const priority = $('input[name="priority"]:checked').value;
  const countMode = $('input[name="countMode"]:checked').value;

  let pool = App.allQuestions.filter((q) => files.includes(q._chapterFile));

  const rnd = () => Math.random();
  if (priority === "order") {
    // 依序：按章節順序 → 題號順序，不打散
    pool = pool.slice().sort((a, b) => a._seq - b._seq);
  } else {
    // 依優先順序排序（加入隨機因子打散同分），再取前 N
    const score = {
      random: () => rnd(),
      // 錯題池：due 越大越優先（負號讓它排前面），同分隨機
      wrong: (q) => { const r = recOf(q._id); return -r.due + rnd() * 0.5; },
      unseen: (q) => { const r = recOf(q._id); return r.attempts + rnd() * 0.5; },
      least: (q) => { const r = recOf(q._id); return r.attempts + rnd() * 0.5; },
    }[priority];
    pool = pool.slice().sort((a, b) => score(a) - score(b));
  }

  let n = pool.length;
  if (countMode === "custom") {
    const v = parseInt($("#customCount").value, 10);
    if (v > 0) n = Math.min(v, pool.length);
  }
  // 依序模式：取前 N 後維持順序；其他模式：作答順序再打散
  const sliced = pool.slice(0, n);
  const chosen = priority === "order" ? sliced : shuffle(sliced);

  return {
    mode,
    questions: chosen,
    current: 0,
    answers: {},        // qid -> 選的字母
    locked: {},         // qid -> 是否已鎖定（練習模式答完）
    finished: false,
  };
}

/* ===================== 作答頁渲染 ===================== */
function collapseRow(arrowId, bodyHtml, zhText) {
  // 通用「原文 + 可展開中文」的列
  const hasZh = (zhText ?? "").toString().trim() !== "";
  return `
    <div class="collap">
      ${hasZh ? `<span class="collap-arrow" data-arrow="${arrowId}"><span class="tri">▶</span></span>`
              : `<span class="collap-arrow" style="visibility:hidden"><span class="tri">▶</span></span>`}
      <div class="collap-body">
        ${bodyHtml}
        ${hasZh ? `<div class="collap-zh" data-zh="${arrowId}" hidden>${esc(zhText)}</div>` : ""}
      </div>
    </div>`;
}

function imagesHtml(field) {
  if (!field) return "";
  const list = Array.isArray(field) ? field : [field];
  return list.map((src) => `<img src="${esc(src)}" alt="題目圖片" loading="lazy">`).join("");
}

// 渲染數據表格（題目用），t = { head:[...], rows:[[...],...] }
function tableHtml(t) {
  if (!t || !Array.isArray(t.rows) || !t.rows.length) return "";
  const head = Array.isArray(t.head)
    ? `<thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`
    : "";
  const body = `<tbody>${t.rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<div class="q-table-wrap"><table class="q-table">${head}${body}</table></div>`;
}

function renderQuestion() {
  const qz = App.quiz;
  const q = qz.questions[qz.current];
  const qid = q._id;
  const opts = optionsOf(q);
  const ans = answerOf(q);
  const isPractice = qz.mode === "practice";
  const selected = qz.answers[qid];
  const locked = isPractice && qz.locked[qid];

  // 進度
  $("#progressFill").style.width = `${((qz.current + 1) / qz.questions.length) * 100}%`;
  $("#progressText").textContent = `${qz.current + 1} / ${qz.questions.length}`;

  const qImgs = imagesHtml(q["題目圖片"]);

  let html = `<div class="q-card">
    <div class="q-meta">${esc(q._chapterName)} · 第 ${esc(q["題號"])} 題 · ${esc(q["類型"] || "")}</div>
    ${collapseRow("q", `<div class="q-text">${esc(q["原題目"])}</div>`, q["中文題目(全翻)"])}
    ${tableHtml(q["表格"])}
    ${qImgs ? `<div class="q-images">${qImgs}</div>` : ""}
    <div class="options">`;

  opts.forEach((o) => {
    const aId = `opt-${o.key}`;
    let cls = "option";
    let mark = "";
    if (locked) {
      cls += " disabled";
      if (o.key === ans) cls += " correct";
      else if (o.key === selected) cls += " wrong";
      if (o.key === ans) mark = `<span class="opt-mark">✓</span>`;
      else if (o.key === selected) mark = `<span class="opt-mark">✗</span>`;
    } else if (o.key === selected) {
      cls += " selected";
    }

    const optBody = `
      <div class="opt-head">
        <span class="opt-letter">${o.key}</span>
        <div class="collap-body" style="flex:1">
          <span>${esc(o.text)}</span>
          ${o.zh && o.zh.trim() ? `<div class="collap-zh" data-zh="${aId}" hidden>${esc(o.zh)}</div>` : ""}
        </div>
        ${o.zh && o.zh.trim() ? `<span class="collap-arrow" data-arrow="${aId}"><span class="tri">▶</span></span>` : ""}
        ${mark}
      </div>
      ${o.img ? `<img class="opt-img" src="${esc(o.img)}" alt="選項${o.key}圖片" loading="lazy">` : ""}
      ${locked ? `<div class="opt-reason ${o.key === ans ? "correct" : (o.key === selected ? "wrong" : "")}">${esc(o.reason)}</div>` : ""}
    `;
    html += `<div class="${cls}" data-opt="${o.key}">${optBody}</div>`;
  });

  html += `</div>`; // .options

  // 練習模式答完 → 顯示歷史紀錄與錯題狀態
  if (locked) {
    const r = recOf(qid);
    let dueText;
    if (r.due > 0) dueText = `<span class="due">錯題池中：再答對 ${r.due} 次可脫離</span>`;
    else dueText = `<span class="cleared">不在錯題池</span>`;
    html += `<div class="q-stats">${dueText}　·　測驗紀錄：作答 ${r.attempts} 次 / 對 ${r.correct} / 錯 ${r.wrong}</div>`;
  }

  html += `</div>`; // .q-card
  $("#questionContainer").innerHTML = html;

  // 綁定：選項點選
  $$("#questionContainer .option").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".collap-arrow")) return; // 點箭頭不算作答
      onSelectOption(el.dataset.opt);
    });
  });

  // 綁定：展開/收合中文
  $$("#questionContainer .collap-arrow[data-arrow]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = el.dataset.arrow;
      const zh = $(`#questionContainer [data-zh="${id}"]`);
      if (!zh) return;
      const open = zh.hasAttribute("hidden");
      if (open) { zh.removeAttribute("hidden"); el.classList.add("open"); renderMath(zh); }
      else { zh.setAttribute("hidden", ""); el.classList.remove("open"); }
    });
  });

  updateNavButtons();
  renderMath($("#questionContainer"));
}

function onSelectOption(key) {
  const qz = App.quiz;
  const q = qz.questions[qz.current];
  const qid = q._id;

  if (qz.mode === "practice") {
    if (qz.locked[qid]) return;          // 已答過就鎖住
    qz.answers[qid] = key;
    qz.locked[qid] = true;
    applyResult(qid, key === answerOf(q), "practice"); // 練習：答對清除錯題，答錯不累積
    saveRecords();
    renderQuestion();                    // 重畫 → 顯示對錯 + 理由 + 紀錄
  } else {
    qz.answers[qid] = key;               // 測驗模式：只記錄，不回饋
    renderQuestion();
  }
}

function updateNavButtons() {
  const qz = App.quiz;
  const last = qz.current === qz.questions.length - 1;
  $("#prevBtn").disabled = qz.current === 0;
  if (qz.mode === "exam") {
    $("#nextBtn").hidden = last;
    $("#submitBtn").hidden = !last;
  } else {
    $("#nextBtn").hidden = false;
    $("#submitBtn").hidden = true;
    $("#nextBtn").textContent = last ? "看結果 →" : "下一題 →";
  }
}

function navPrev() {
  if (App.quiz.current > 0) { App.quiz.current--; renderQuestion(); }
}
function navNext() {
  const qz = App.quiz;
  if (qz.current < qz.questions.length - 1) { qz.current++; renderQuestion(); }
  else if (qz.mode === "practice") { finishQuiz(); }
}

/* ===================== 交卷 / 結果 ===================== */
function finishQuiz() {
  const qz = App.quiz;
  qz.finished = true;

  let correct = 0;
  const rows = qz.questions.map((q) => {
    const qid = q._id;
    const ans = answerOf(q);
    const sel = qz.answers[qid] || null;
    const ok = sel === ans;
    if (ok) correct++;

    // 測驗模式：計入紀錄（練習模式於作答當下已處理）
    if (qz.mode === "exam" && sel !== null) applyResult(qid, ok, "exam");

    return { q, ans, sel, ok };
  });

  if (qz.mode === "exam") { saveRecords(); refreshRecordSummary(); }

  renderResult(rows, correct);
  showView("result");
}

function renderResult(rows, correct) {
  const total = rows.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const pass = pct >= 60;

  $("#scoreBox").innerHTML = `
    <div class="score-big ${pass ? "pass" : "fail"}">${pct}%</div>
    <div class="score-sub">答對 ${correct} / ${total} 題　·　${App.quiz.mode === "exam" ? "已計入紀錄" : "練習模式（未計入紀錄）"}</div>`;

  $("#reviewList").innerHTML = rows.map((row, idx) => {
    const { q, ans, sel, ok } = row;
    const opts = optionsOf(q);
    const selText = sel ? `${sel.toUpperCase()}` : "未作答";
    const optReason = opts.map((o) => {
      let cls = "";
      if (o.key === ans) cls = "correct";
      else if (o.key === sel && !ok) cls = "wrong";
      const tag = o.key === ans ? " ✓正解" : (o.key === sel ? " ✗你選" : "");
      return `<div class="opt-reason ${cls}"><strong>${o.key.toUpperCase()}${tag}</strong>：${esc(o.text)}<br>${esc(o.reason)}</div>`;
    }).join("");

    return `
      <div class="review-item ${ok ? "r-correct" : "r-wrong"}">
        <div class="review-head">
          <span>${idx + 1}.</span>
          <span>${esc(q._chapterName)} · 第 ${esc(q["題號"])} 題</span>
          <span class="tag ${ok ? "ok" : "bad"}">${ok ? "答對" : "答錯"}</span>
          <span class="muted">你的答案：${selText} ／ 正解：${ans.toUpperCase()}</span>
        </div>
        <div class="q-text">${esc(q["原題目"])}</div>
        ${q["中文題目(全翻)"] ? `<div class="collap-zh">${esc(q["中文題目(全翻)"])}</div>` : ""}
        ${tableHtml(q["表格"])}
        ${imagesHtml(q["題目圖片"]) ? `<div class="q-images">${imagesHtml(q["題目圖片"])}</div>` : ""}
        <div style="margin-top:10px">${optReason}</div>
      </div>`;
  }).join("");

  renderMath($("#resultView"));
}

/* ===================== View 切換 ===================== */
function showView(name) {
  $("#setupView").hidden = name !== "setup";
  $("#quizView").hidden = name !== "quiz";
  $("#resultView").hidden = name !== "result";
  $("#homeBtn").hidden = name === "setup";
  window.scrollTo(0, 0);
}

/* ===================== 匯出 / 匯入 ===================== */
function exportRecords() {
  const blob = new Blob([JSON.stringify(App.records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `普化練習紀錄_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importRecords(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (typeof data !== "object" || Array.isArray(data)) throw new Error("格式不符");
      const count = Object.keys(data).length;
      if (!confirm(`檔案含 ${count} 題紀錄。匯入將「覆蓋」目前紀錄，確定？`)) return;
      App.records = data;
      saveRecords();
      refreshRecordSummary();
      alert("匯入完成。");
    } catch (e) {
      alert("匯入失敗：檔案格式錯誤。");
    }
  };
  reader.readAsText(file);
}

/* ===================== 深色模式 ===================== */
const THEME_KEY = "genchem_theme";

// 幾何太陽：中心圓 + 10 個三角形光芒
const SUN_SVG = (() => {
  let rays = "";
  for (let i = 0; i < 10; i++)
    rays += `<polygon points="12,1 10.7,5.2 13.3,5.2" transform="rotate(${i * 36} 12 12)"/>`;
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4.6"/>${rays}</svg>`;
})();
// 幾何月亮：彎月（兩段圓弧）
const MOON_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z"/></svg>`;

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = $("#themeBtn");
  if (btn) btn.innerHTML = theme === "dark" ? SUN_SVG : MOON_SVG;
}
function setupTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
  $("#themeBtn").onclick = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };
}

/* ===================== 週期表抽屜 ===================== */
function setupPeriodicTable() {
  const panel = $("#ptable");
  const toggle = () => {
    const open = panel.classList.toggle("open");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
  };
  $("#ptableTab").onclick = toggle;
  $("#ptableClose").onclick = () => {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  };
  // 按 Esc 關閉
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("open")) {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
    }
  });
}

/* ===================== 啟動 ===================== */
async function init() {
  setupTheme();
  setupPeriodicTable();
  loadRecords();
  refreshRecordSummary();

  // 設定頁事件
  $$('input[name="countMode"]').forEach((r) =>
    r.addEventListener("change", () => {
      $("#customCount").disabled = $('input[name="countMode"]:checked').value !== "custom";
    })
  );
  $("#startBtn").onclick = () => {
    const qz = buildQuiz();
    if (!qz) return;
    if (!qz.questions.length) { alert("選定範圍內沒有題目。"); return; }
    App.quiz = qz;
    qz.current = 0;
    renderQuestion();
    showView("quiz");
  };
  $("#prevBtn").onclick = navPrev;
  $("#nextBtn").onclick = navNext;
  $("#submitBtn").onclick = () => {
    const qz = App.quiz;
    const unanswered = qz.questions.filter((q) => !qz.answers[q._id]).length;
    if (unanswered > 0 && !confirm(`還有 ${unanswered} 題未作答，確定交卷？`)) return;
    finishQuiz();
  };
  $("#homeBtn").onclick = () => { if (confirm("離開目前作答並回到設定頁？")) showView("setup"); };
  $("#backHomeBtn").onclick = () => showView("setup");

  $("#exportBtn").onclick = exportRecords;
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importRecords(e.target.files[0]);
    e.target.value = "";
  });
  $("#clearBtn").onclick = () => {
    if (confirm("確定清除所有作答紀錄？此動作無法復原。")) {
      App.records = {};
      saveRecords();
      refreshRecordSummary();
    }
  };

  // 載入章節
  const failed = await loadChapters();
  renderChapterList();
  if (failed.length) {
    const note = document.createElement("p");
    note.className = "muted";
    note.style.color = "var(--bad)";
    note.textContent = `部分章節載入失敗：${failed.join("、")}`;
    $("#chapterList").appendChild(note);
  }
}

document.addEventListener("DOMContentLoaded", init);
