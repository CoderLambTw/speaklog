/* ============================================================
   Views — 所有頁面的渲染與互動
   ============================================================ */
const Views = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const fmtDate = (d) => {
    const [y, m, day] = d.split('-');
    return `${y}/${m}/${day}`;
  };
  const dayDiff = (d) => Math.round((new Date(d) - new Date(SRS.todayStr())) / 864e5);
  const REDUCE_MOTION = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const I = (name, size, cls) => Icons.svg(name, size, cls);
  const hico = (name) => `<span class="h1-ico">${Icons.svg(name, 18)}</span>`;

  /* ---------- 動畫:數字滾動 ---------- */
  function countUp(root) {
    if (REDUCE_MOTION) return;
    $$('[data-count]', root).forEach((el) => {
      const target = +el.dataset.count;
      if (!Number.isFinite(target) || target <= 0) return;
      const dur = Math.min(900, 450 + target * 6);
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- 動畫:複習完成撒花 ---------- */
  function confetti() {
    if (REDUCE_MOTION) return;
    const colors = ['#7c8cff', '#2dd4bf', '#fbbf24', '#f87171', '#a78bfa', '#34d399'];
    const wrap = document.createElement('div');
    wrap.className = 'confetti';
    for (let i = 0; i < 36; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.width = 6 + Math.random() * 5 + 'px';
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
      p.style.animationDuration = (1.7 + Math.random() * 1.3).toFixed(2) + 's';
      p.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 4000);
  }

  /* ---------- 語音 ---------- */
  function speak(text, rate = 0.92) {
    if (!('speechSynthesis' in window)) return App.toast('此瀏覽器不支援語音播放');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    const pref = voices.find((v) => /samantha|google us|aria|jenny/i.test(v.name)) || voices[0];
    if (pref) u.voice = pref;
    speechSynthesis.speak(u);
  }

  function statusPill(card) {
    if (SRS.isLeech(card)) return '<span class="pill leech">吃力</span>';
    if (SRS.isMastered(card)) return '<span class="pill review">精熟</span>';
    if (card.state === 'new') return '<span class="pill new">新</span>';
    if (card.state === 'learning') return '<span class="pill learning">學習中</span>';
    return '<span class="pill review">複習中</span>';
  }

  function catPills(cats) {
    return (cats || []).map((c) => {
      const cat = Grammar.CATEGORIES[c];
      return cat ? `<span class="pill cat">${cat.icon} ${cat.label}</span>` : '';
    }).join('');
  }

  function grammarPairHtml(g, src = '') {
    const { wrongHtml, correctHtml } = Grammar.diffHtml(g.wrong, g.correct);
    return `<div class="gpair">
      ${g.wrong ? `<div class="gline wrong"><span class="mark no">${I('circle-x', 15)}</span><span>${wrongHtml}</span></div>` : ''}
      <div class="gline right"><span class="mark ok">${I('circle-check', 15)}</span><span>${correctHtml}</span></div>
      <div class="gmeta">${catPills(g.cats)}${src ? `<span class="src">${src}</span>` : ''}</div>
    </div>`;
  }

  /* ============================================================
     Dashboard
     ============================================================ */
  function dashboard(root) {
    const s = Store.state;
    if (!s.lessons.length) return emptyHome(root);

    const lv = Store.levelInfo(s.meta.xp);
    const streak = Store.weekStreak();
    const due = Store.dueCards();
    const vocab = Store.vocabIndex();
    const mastered = vocab.filter((v) => SRS.isMastered(v.card)).length;
    const ins = Store.insights();
    const last = s.lessons[s.lessons.length - 1];
    const pron = Store.pronIndex();
    const pronTodo = pron.filter((p) => !p.practice.count).length;
    const hour = new Date().getHours();
    const greet = hour < 5 ? '夜深了' : hour < 11 ? '早安' : hour < 18 ? '午安' : '晚安';
    const name = s.meta.name ? `,${esc(s.meta.name)}` : '';
    const dueVocab = due.filter((d) => d.type === 'vocab').length;
    const dueGrammar = due.filter((d) => d.type === 'grammar').length;

    root.innerHTML = `<div class="page">
      <div class="hero">
        <div>
          <h1>${greet}${name} 👋</h1>
          <div class="sub">已累積 ${s.lessons.length} 堂課 · ${vocab.length} 個單字 · 持續變強中</div>
        </div>
        <div class="hero-right">
          <div class="streak-pill"><span class="n">🔥</span> 週連勝 ${streak} 週</div>
          <div class="level-chip">
            <div class="top"><span>Lv.${lv.level} ${lv.title}</span><span class="xp">${lv.current}/${lv.need} XP</span></div>
            <div class="xpbar"><div style="width:${Math.round(lv.progress * 100)}%"></div></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>${I('clipboard-list', 16)} 今日任務</h3>
        <div class="task-row">
          <div class="ico">${I('layers', 19)}</div>
          <div class="tt"><b>複習到期卡片</b><small>${dueVocab} 個單字 + ${dueGrammar} 個文法句</small></div>
          ${due.length ? `<a class="btn primary sm" href="#/review">開始(${due.length})</a>` : '<span class="task-done">✓ 已清空</span>'}
        </div>
        <div class="task-row">
          <div class="ico">${I('mic', 19)}</div>
          <div class="tt"><b>發音練習</b><small>${pronTodo ? `${pronTodo} 個單字還沒練過` : '所有發音單字都練過了'}</small></div>
          ${pronTodo ? '<a class="btn sm" href="#/pron">去練習</a>' : '<span class="task-done">✓ 完成</span>'}
        </div>
        <div class="task-row">
          <div class="ico">${I('pencil', 18)}</div>
          <div class="tt"><b>記錄新課程</b><small>上完課就把老師筆記貼進來</small></div>
          <a class="btn sm" href="#/add">${I('plus', 14)} 新增</a>
        </div>
      </div>

      <div class="spacer"></div>
      <div class="grid cols-4">
        <div class="card stat"><span class="n" data-count="${s.lessons.length}">${s.lessons.length}</span><span class="lbl">課程數</span></div>
        <div class="card stat"><span class="n" data-count="${vocab.length}">${vocab.length}</span><span class="lbl">累積單字</span></div>
        <div class="card stat"><span class="n" data-count="${mastered}">${mastered}</span><span class="lbl">已精熟單字</span></div>
        <div class="card stat"><span class="n" data-count="${Store.totalReviews()}">${Store.totalReviews()}</span><span class="lbl">總複習次數</span></div>
      </div>

      ${ins.length ? `<div class="section-title"><h2>${I('lightbulb', 17)} 學習洞察</h2></div>
      <div class="grid">${ins.map((i) => `
        <div class="insight ${i.type}">
          <span class="ico">${i.icon}</span>
          <div class="tt"><b>${esc(i.title)}</b>${esc(i.body)}${i.link ? ` <a href="${i.link}">查看 →</a>` : ''}</div>
        </div>`).join('')}</div>` : ''}

      <div class="section-title"><h2>${I('calendar-days', 17)} 學習活動</h2></div>
      <div class="card">${Charts.heatmap(s.meta.activity)}</div>

      <div class="section-title"><h2>${I('message-circle', 17)} 最新一堂課</h2><a href="#/lessons">全部課程 →</a></div>
      <div class="card clickable" data-go="#/lesson/${last.id}">
        <div class="flex between wrap">
          <div><b>${fmtDate(last.date)} · ${esc(last.teacher)}</b>
          <div class="lesson-counts"><span>${I('book-open', 13, 'c-good')} ${last.vocab.length} 單字</span><span>${I('pencil', 13, 'c-warn')} ${last.grammar.length} 文法</span><span>${I('megaphone', 13, 'c-acc2')} ${last.pron.length} 發音</span></div></div>
        </div>
        ${last.feedback ? `<hr class="sep"><div class="fb-quote">${esc(last.feedback.length > 160 ? last.feedback.slice(0, 160) + '…' : last.feedback)}</div>` : ''}
      </div>
    </div>`;

    countUp(root);
    $$('[data-go]', root).forEach((el) => el.addEventListener('click', () => (location.hash = el.dataset.go)));
  }

  function emptyHome(root) {
    root.innerHTML = `<div class="page"><div class="empty">
      <div class="ico">🗣️</div>
      <h2>歡迎來到 SpeakLog</h2>
      <p>把每堂英文口說課的老師筆記貼進來,這裡會自動幫你整理單字、追蹤文法錯誤模式、排程間隔複習,讓你「看得見」自己的進步。</p>
      <div class="btn-row" style="justify-content:center">
        <a class="btn primary lg" href="#/add">${I('pencil', 16)} 貼上第一堂課筆記</a>
        <button class="btn lg" id="load-sample">${I('circle-play', 16)} 先看範例資料</button>
      </div>
    </div></div>`;
    $('#load-sample', root).addEventListener('click', () => {
      Store.loadSample();
      App.toast('已載入 6 堂範例課程,隨時可在設定中清除');
      App.refresh();
    });
  }

  /* ============================================================
     新增課程
     ============================================================ */
  const SAMPLE_NOTE = `Teacher Mae

[A.] CORRECTIONS:
🛑 Vocabulary
🟢 resilient – able to recover quickly from difficult situations
🟢 procrastinate – to delay doing something you should do

🛑 Grammar / Suggested Sentences;
❌ I am working here since five years.
✔️ I have been working here for five years.

📣 Pronunciation
📣 resilient — "rih-ZIL-yent"

[B.] Feedback:
You did a wonderful job expressing your opinions today!`;

  function add(root) {
    root.innerHTML = `<div class="page" style="max-width:760px">
      <div class="page-head"><div><h1>${hico('pencil')}新增課程筆記</h1><div class="sub">把老師課後給的筆記原封不動貼進來,系統會自動解析</div></div></div>
      <div class="card">
        <label class="field"><span>上課日期</span><input type="date" id="lesson-date" value="${SRS.todayStr()}"></label>
        <label class="field"><span>老師筆記 <a id="fill-sample" style="cursor:pointer;font-weight:500">(填入範例格式)</a></span>
          <textarea id="note-text" placeholder="${esc(SAMPLE_NOTE)}" spellcheck="false"></textarea>
        </label>
        <button class="btn primary block lg" id="parse-btn">${I('search', 16)} 解析筆記</button>
      </div>
      <div id="preview"></div>
    </div>`;

    $('#fill-sample', root).addEventListener('click', () => { $('#note-text', root).value = SAMPLE_NOTE; });
    $('#parse-btn', root).addEventListener('click', () => {
      const text = $('#note-text', root).value;
      if (!text.trim()) return App.toast('請先貼上筆記內容');
      const parsed = Parser.parse(text);
      renderPreview($('#preview', root), parsed, $('#lesson-date', root));
    });
  }

  function renderPreview(el, parsed, dateInput) {
    const total = parsed.vocab.length + parsed.grammar.length + parsed.pron.length;
    el.innerHTML = `<div class="spacer"></div><div class="card">
      <h3>解析結果預覽</h3>
      ${parsed.warnings.length ? `<div class="warn-box">⚠️ ${parsed.warnings.map(esc).join('<br>⚠️ ')}</div>` : ''}
      <div class="preview-sec"><div class="sec-title">${I('user', 14)} 老師</div><div class="pv-item"><b>${esc(parsed.teacher || '(未偵測到)')}</b></div></div>
      <div class="preview-sec"><div class="sec-title">${I('book-open', 14, 'c-good')} 單字 <span class="cnt">${parsed.vocab.length}</span></div>
        ${parsed.vocab.map((v) => `<div class="pv-item"><b>${esc(v.word)}</b> <span class="def">— ${esc(v.def || '(無定義)')}</span></div>`).join('') || '<div class="pv-item faint">無</div>'}</div>
      <div class="preview-sec"><div class="sec-title">${I('pencil', 14, 'c-warn')} 文法修正 <span class="cnt">${parsed.grammar.length}</span></div>
        ${parsed.grammar.map((g) => grammarPairHtml({ ...g, cats: Grammar.classify(g.wrong, g.correct) })).join('') || '<div class="pv-item faint">無</div>'}</div>
      <div class="preview-sec"><div class="sec-title">${I('megaphone', 14, 'c-acc2')} 發音 <span class="cnt">${parsed.pron.length}</span></div>
        ${parsed.pron.map((p) => `<div class="pv-item"><b>${esc(p.word)}</b> <span class="def">${esc(p.guide)}</span></div>`).join('') || '<div class="pv-item faint">無</div>'}</div>
      <div class="preview-sec"><div class="sec-title">${I('message-circle', 14)} 老師回饋</div><div class="pv-item" style="white-space:pre-wrap">${esc(parsed.feedback || '(無)')}</div></div>
      <button class="btn primary block lg" id="save-btn" ${total === 0 && !parsed.feedback ? 'disabled' : ''}>${I('save', 16)} 儲存這堂課(+30 XP)</button>
    </div>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#save-btn', el)?.addEventListener('click', () => {
      const date = dateInput.value || SRS.todayStr();
      const { lesson, newAch } = Store.addLesson(date, parsed);
      App.toast('✅ 已儲存!+30 XP');
      newAch.forEach((a) => App.achToast(a));
      location.hash = `#/lesson/${lesson.id}`;
    });
  }

  /* ============================================================
     課程列表 / 詳情
     ============================================================ */
  function lessons(root) {
    const s = Store.state;
    if (!s.lessons.length) return emptyRedirect(root, '還沒有任何課程', '記錄第一堂課,開始累積你的學習軌跡。');
    const sorted = [...s.lessons].sort((a, b) => b.date.localeCompare(a.date));
    const groups = {};
    for (const l of sorted) {
      const k = l.date.slice(0, 7);
      (groups[k] = groups[k] || []).push(l);
    }
    root.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${hico('library')}課程紀錄</h1><div class="sub">共 ${s.lessons.length} 堂課</div></div>
      <a class="btn primary" href="#/add">${I('plus', 15)} 新增課程</a></div>
      ${Object.entries(groups).map(([month, ls]) => `
        <div class="month-label">${month.replace('-', ' 年 ')} 月 · ${ls.length} 堂</div>
        <div class="grid">${ls.map((l) => `
          <div class="card clickable lesson-card" data-go="#/lesson/${l.id}">
            <div class="lesson-date"><div class="d">${+l.date.slice(8)}</div><div class="m">${MONTHS[+l.date.slice(5, 7) - 1]}</div></div>
            <div class="lesson-info">
              <div class="t">${esc(l.teacher)}</div>
              <div class="lesson-counts"><span>${I('book-open', 13, 'c-good')} ${l.vocab.length} 單字</span><span>${I('pencil', 13, 'c-warn')} ${l.grammar.length} 文法</span><span>${I('megaphone', 13, 'c-acc2')} ${l.pron.length} 發音</span>${l.feedback ? `<span>${I('message-circle', 13)} 回饋</span>` : ''}</div>
            </div>
          </div>`).join('')}</div>`).join('')}
    </div>`;
    $$('[data-go]', root).forEach((el) => el.addEventListener('click', () => (location.hash = el.dataset.go)));
  }

  function lessonDetail(root, id) {
    const l = Store.state.lessons.find((x) => x.id === id);
    if (!l) { location.hash = '#/lessons'; return; }
    root.innerHTML = `<div class="page" style="max-width:760px">
      <div class="page-head"><div>
        <h1>${fmtDate(l.date)}</h1>
        <div class="sub">${I('user', 13)} ${esc(l.teacher)}</div>
      </div><div class="btn-row">
        <a class="btn sm" href="#/lessons">← 返回</a>
        <button class="btn danger sm" id="del-lesson">${I('trash', 14)} 刪除</button>
      </div></div>

      ${l.feedback ? `<div class="card"><h3>${I('message-circle', 16)} 老師回饋</h3><div class="fb-quote">${esc(l.feedback)}</div></div><div class="spacer"></div>` : ''}

      ${l.vocab.length ? `<div class="card list-card"><div style="padding:16px 16px 6px"><h3>${I('book-open', 16, 'c-good')} 單字(${l.vocab.length})</h3></div>
        ${l.vocab.map((v) => {
          const card = Store.state.srs[Store.wordKey(v.word)] || SRS.newCard();
          return `<div class="vrow" data-speak="${esc(v.word)}">
            <div class="main"><div class="w">${esc(v.word)}</div><div class="d">${esc(v.def)}</div></div>
            ${statusPill(card)}<button class="iconbtn" title="播放發音">${I('volume-2', 16)}</button>
          </div>`;
        }).join('')}</div><div class="spacer"></div>` : ''}

      ${l.grammar.length ? `<div class="card list-card"><div style="padding:16px 16px 6px"><h3>${I('pencil', 15, 'c-warn')} 文法修正(${l.grammar.length})</h3></div>
        ${l.grammar.map((g) => grammarPairHtml(g)).join('')}</div><div class="spacer"></div>` : ''}

      ${l.pron.length ? `<div class="card list-card"><div style="padding:16px 16px 6px"><h3>${I('megaphone', 15, 'c-acc2')} 發音(${l.pron.length})</h3></div>
        ${l.pron.map((p) => `<div class="vrow" data-speak="${esc(p.word)}">
          <div class="main"><div class="w">${esc(p.word)}</div><div class="d pron-guide">${esc(p.guide)}</div></div>
          <button class="iconbtn" title="播放發音">${I('volume-2', 16)}</button>
        </div>`).join('')}</div>` : ''}
    </div>`;

    $$('[data-speak]', root).forEach((el) => el.addEventListener('click', () => speak(el.dataset.speak)));
    $('#del-lesson', root).addEventListener('click', () => {
      App.confirm('刪除這堂課?', '相關的單字與文法卡片也會一併移除(若未被其他課程引用)。', () => {
        Store.deleteLesson(id);
        App.toast('已刪除');
        location.hash = '#/lessons';
      });
    });
  }

  /* ============================================================
     單字庫
     ============================================================ */
  function vocab(root, _, query) {
    const all = Store.vocabIndex();
    if (!all.length) return emptyRedirect(root, '單字庫是空的', '新增課程筆記後,單字會自動收進來。');
    let filter = (query && query.f) || 'all';
    let q = '';
    let sort = 'recent';

    function renderList() {
      let list = all;
      if (q) list = list.filter((v) => v.word.toLowerCase().includes(q) || v.def.toLowerCase().includes(q));
      if (filter === 'new') list = list.filter((v) => v.card.state === 'new');
      else if (filter === 'learning') list = list.filter((v) => v.card.state === 'learning');
      else if (filter === 'mastered') list = list.filter((v) => SRS.isMastered(v.card));
      else if (filter === 'leech') list = list.filter((v) => SRS.isLeech(v.card));
      else if (filter === 'due') list = list.filter((v) => v.card.state !== 'new' && SRS.isDue(v.card));
      if (sort === 'alpha') list = [...list].sort((a, b) => a.word.localeCompare(b.word));
      else if (sort === 'due') list = [...list].sort((a, b) => a.card.due.localeCompare(b.card.due));
      else list = [...list].sort((a, b) => b.lessons[b.lessons.length - 1].date.localeCompare(a.lessons[a.lessons.length - 1].date));

      $('#vlist', root).innerHTML = list.length ? list.map((v) => `
        <div class="vrow" data-word="${esc(v.key)}">
          <div class="main">
            <div class="w">${esc(v.word)} ${v.lessons.length > 1 ? `<span class="pill">×${v.lessons.length} 次</span>` : ''}</div>
            <div class="d">${esc(v.def || '—')}</div>
          </div>
          ${statusPill(v.card)}
          <button class="iconbtn" data-speak="${esc(v.word)}" title="播放發音">${I('volume-2', 16)}</button>
        </div>`).join('') : '<div class="empty" style="padding:30px"><p>沒有符合的單字</p></div>';

      $$('#vlist [data-speak]', root).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); speak(el.dataset.speak); }));
      $$('#vlist .vrow', root).forEach((el) => el.addEventListener('click', () => {
        const v = all.find((x) => x.key === el.dataset.word);
        if (v) vocabModal(v);
      }));
    }

    const counts = {
      all: all.length,
      due: all.filter((v) => v.card.state !== 'new' && SRS.isDue(v.card)).length,
      new: all.filter((v) => v.card.state === 'new').length,
      learning: all.filter((v) => v.card.state === 'learning').length,
      mastered: all.filter((v) => SRS.isMastered(v.card)).length,
      leech: all.filter((v) => SRS.isLeech(v.card)).length,
    };
    const chipDefs = [['all', '全部'], ['due', '已到期'], ['new', '新'], ['learning', '學習中'], ['mastered', '精熟'], ['leech', '吃力']];

    root.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${hico('book-open')}單字庫</h1><div class="sub">${all.length} 個單字,${counts.mastered} 個已精熟</div></div></div>
      <div class="flex wrap mb">
        <input type="search" id="vq" placeholder="搜尋單字或定義…" style="flex:1;min-width:180px">
        <select id="vsort" style="width:auto">
          <option value="recent">最近學的</option>
          <option value="alpha">字母排序</option>
          <option value="due">到期日</option>
        </select>
      </div>
      <div class="chips mb" id="vchips">
        ${chipDefs.map(([k, label]) => `<button class="chip${filter === k ? ' active' : ''}" data-f="${k}">${label} ${counts[k]}</button>`).join('')}
      </div>
      <div class="card list-card" id="vlist"></div>
    </div>`;

    $('#vq', root).addEventListener('input', (e) => { q = e.target.value.toLowerCase().trim(); renderList(); });
    $('#vsort', root).addEventListener('change', (e) => { sort = e.target.value; renderList(); });
    $$('#vchips .chip', root).forEach((c) => c.addEventListener('click', () => {
      filter = c.dataset.f;
      $$('#vchips .chip', root).forEach((x) => x.classList.toggle('active', x === c));
      renderList();
    }));
    renderList();
  }

  function vocabModal(v) {
    const c = v.card;
    const dueTxt = c.state === 'new' ? '尚未開始複習' : c.due <= SRS.todayStr() ? '今天到期!' : `${dayDiff(c.due)} 天後到期`;
    App.modal(`
      <h3>${esc(v.word)} <button class="iconbtn" id="m-speak" title="播放發音">${I('volume-2', 16)}</button></h3>
      <p>${esc(v.def || '(無定義)')}</p>
      <div class="flex wrap" style="gap:7px">${statusPill(c)}
        <span class="pill">間隔 ${c.ivl} 天</span><span class="pill">複習 ${c.reps} 次</span>
        ${c.lapses ? `<span class="pill leech">忘記 ${c.lapses} 次</span>` : ''}<span class="pill">${dueTxt}</span></div>
      <hr class="sep">
      <div class="hint" style="font-size:13px">出現於:${v.lessons.map((l) => `<a href="#/lesson/${l.id}">${fmtDate(l.date)}</a>`).join('、')}</div>
    `);
    $('#m-speak')?.addEventListener('click', () => speak(v.word));
  }

  /* ============================================================
     複習(間隔複習核心)
     ============================================================ */
  function review(root) {
    const due = Store.dueCards();
    if (!due.length) {
      root.innerHTML = `<div class="page"><div class="empty">
        <div class="ico">🎉</div><h2>今天的複習都完成了!</h2>
        <p>所有卡片都按照間隔複習的排程安排好了,到期時會自動出現在這裡。</p>
        <div class="btn-row" style="justify-content:center">
          <a class="btn" href="#/vocab">${I('book-open', 15)} 逛逛單字庫</a><a class="btn" href="#/pron">${I('mic', 15)} 練練發音</a>
        </div></div></div>`;
      return;
    }
    // 排序:到期單字 → 文法 → 新字
    const queue = [
      ...due.filter((d) => d.type === 'vocab' && d.card.state !== 'new'),
      ...due.filter((d) => d.type === 'grammar'),
      ...due.filter((d) => d.type === 'vocab' && d.card.state === 'new'),
    ];
    const session = { queue, idx: 0, done: 0, correct: 0, revealed: false, xp: 0 };

    function current() { return session.queue[session.idx]; }

    function render() {
      const item = current();
      if (!item) return renderSummary();
      const total = session.queue.length;
      const front = item.type === 'vocab'
        ? `<div class="label">${item.card.state === 'new' ? '新單字' : '這個字是什麼意思?'}</div>
           <div class="big">${esc(item.word)}</div>
           <button class="iconbtn" data-speak="${esc(item.word)}" style="width:42px;height:42px" title="播放發音">${I('volume-2', 19)}</button>`
        : `<div class="label">怎麼說才對?在心裡修正這句話</div>
           <div class="sentence"><span class="mark no">${I('circle-x', 17)}</span> ${esc(item.item.wrong)}</div>`;
      const back = item.type === 'vocab'
        ? `<div class="divider"></div><div class="answer">${esc(item.def || '(無定義)')}</div>`
        : `<div class="divider"></div><div class="sentence answer" style="color:var(--text)"><span class="mark ok">${I('circle-check', 17)}</span> ${Grammar.diffHtml(item.item.wrong, item.item.correct).correctHtml}</div>
           <div class="gmeta" style="justify-content:center">${catPills(item.item.cats)}</div>`;

      root.innerHTML = `<div class="page review-wrap">
        <div class="review-top">
          <a class="iconbtn" href="#/" title="結束">${I('x', 16)}</a>
          <div class="progressbar"><div style="width:${Math.round((session.done / total) * 100)}%"></div></div>
          <span class="review-count">${session.done}/${total}</span>
        </div>
        <div class="fcard${session.revealed ? ' revealed' : ''}">${front}${session.revealed ? back : ''}</div>
        ${session.revealed ? gradeButtons(item) : `<button class="btn primary block lg mt" id="reveal">顯示答案</button>
        <div class="kbd-hint"><kbd>空白鍵</kbd> 顯示答案</div>`}
      </div>`;

      $$('[data-speak]', root).forEach((el) => el.addEventListener('click', () => speak(el.dataset.speak)));
      if (item.type === 'vocab' && !session.revealed && item.card.state !== 'new') speak(item.word);
      $('#reveal', root)?.addEventListener('click', reveal);
      $$('.gradebtn', root).forEach((b) => b.addEventListener('click', () => gradeCurrent(b.dataset.g)));
    }

    function gradeButtons(item) {
      if (item.type === 'grammar') {
        return `<div class="grade-row two">
          <button class="gradebtn again" data-g="again"><b>還會說錯</b><small>明天再練</small></button>
          <button class="gradebtn good" data-g="good"><b>說對了!</b><small>${SRS.previewIvl(item.card, 'good')}</small></button>
        </div><div class="kbd-hint"><kbd>1</kbd> 說錯 <kbd>3</kbd> 說對</div>`;
      }
      return `<div class="grade-row">
        <button class="gradebtn again" data-g="again"><b>忘記</b><small>${SRS.previewIvl(item.card, 'again')}</small></button>
        <button class="gradebtn hard" data-g="hard"><b>模糊</b><small>${SRS.previewIvl(item.card, 'hard')}</small></button>
        <button class="gradebtn good" data-g="good"><b>記得</b><small>${SRS.previewIvl(item.card, 'good')}</small></button>
        <button class="gradebtn easy" data-g="easy"><b>很熟</b><small>${SRS.previewIvl(item.card, 'easy')}</small></button>
      </div><div class="kbd-hint"><kbd>1</kbd>-<kbd>4</kbd> 評分</div>`;
    }

    function reveal() {
      if (session.lock) return;
      session.revealed = true;
      const item = current();
      if (item.type === 'vocab') speak(item.word);
      render();
    }

    function gradeCurrent(g) {
      if (session.lock) return;
      const item = current();
      const gained = g === 'again' ? 1 : 2;
      if (item.type === 'vocab') Store.gradeVocab(item.key, g);
      else Store.gradeGrammar(item.gid, g);
      session.done++;
      session.xp += gained;
      if (g !== 'again') session.correct++;
      else {
        // 答錯的卡片塞回佇列尾端,本次再出現一次
        session.queue.push({ ...item, card: item.type === 'vocab' ? Store.state.srs[item.key] : Store.state.gsrs[item.gid] });
      }
      session.idx++;
      session.revealed = false;
      App.updateNavBadge();

      // 動畫:卡片依評分方向滑出 + XP 浮字,結束後才換下一張
      const fc = $('.fcard', root);
      if (!fc || REDUCE_MOTION) return render();
      session.lock = true;
      fc.classList.remove('revealed');
      fc.classList.add(g === 'again' ? 'out-bad' : 'out-ok');
      const rect = fc.getBoundingClientRect();
      const float = document.createElement('div');
      float.className = 'xp-float' + (g === 'again' ? ' bad' : '');
      float.textContent = g === 'again' ? '再練一次' : `+${gained} XP`;
      float.style.left = rect.right - 86 + 'px';
      float.style.top = rect.top + 16 + 'px';
      document.body.appendChild(float);
      setTimeout(() => float.remove(), 950);
      setTimeout(() => { session.lock = false; render(); }, 250);
    }

    function renderSummary() {
      const acc = session.done ? Math.round((session.correct / session.done) * 100) : 0;
      const newAch = Store.checkAchievements();
      Store.save();
      root.innerHTML = `<div class="page review-wrap"><div class="card summary">
        <div class="emoji">${acc >= 80 ? '🏆' : acc >= 50 ? '💪' : '🌱'}</div>
        <h2>複習完成!</h2>
        <div class="xp-pop">+${session.xp} XP</div>
        <div class="nums">
          <div><div class="n"><span data-count="${session.done}">${session.done}</span></div><div class="l">張卡片</div></div>
          <div><div class="n"><span data-count="${acc}">${acc}</span>%</div><div class="l">記得率</div></div>
          <div><div class="n"><span data-count="${Store.weekStreak()}">${Store.weekStreak()}</span></div><div class="l">週連勝 🔥</div></div>
        </div>
        <div class="btn-row" style="justify-content:center">
          <a class="btn primary" href="#/">回到總覽</a>
          <a class="btn" href="#/progress">${I('trending-up', 15)} 看看成長</a>
        </div>
      </div></div>`;
      countUp(root);
      if (session.done && acc >= 50) confetti();
      newAch.forEach((a) => App.achToast(a));
      App.updateNavBadge();
    }

    App.bindKeys((e) => {
      if (e.key === ' ' && !session.revealed && current()) { e.preventDefault(); reveal(); }
      else if (session.revealed && current()) {
        const item = current();
        const map = item.type === 'grammar' ? { 1: 'again', 3: 'good' } : { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
        if (map[e.key]) gradeCurrent(map[e.key]);
      }
    });
    render();
  }

  /* ============================================================
     文法雷達
     ============================================================ */
  function grammar(root) {
    const idx = Store.grammarIndex();
    if (!idx.length) return emptyRedirect(root, '還沒有文法紀錄', '老師筆記裡的 ❌/✔️ 修正句會自動收集到這裡,並分析你的錯誤模式。');
    const { all, recent } = Store.categoryStats();
    const sorted = Object.entries(all).sort((a, b) => b[1] - a[1]);
    const colors = ['#f87171', '#fbbf24', '#6c7bff', '#2dd4bf', '#a78bfa', '#fb923c', '#34d399', '#94a3b8'];

    root.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${hico('target')}文法雷達</h1><div class="sub">看見自己反覆犯的錯,才能真正改掉它</div></div></div>
      <div class="card">
        <h3>錯誤模式分佈</h3>
        ${Charts.hbars(sorted.map(([k, v], i) => ({
          label: `${Grammar.CATEGORIES[k].icon} ${Grammar.CATEGORIES[k].label}`,
          value: v, color: colors[i % colors.length], suffix: ' 次',
        })))}
      </div>
      <div class="spacer"></div>
      ${sorted.length ? `<div class="grid">${sorted.slice(0, 3).map(([k]) => {
        const cat = Grammar.CATEGORIES[k];
        const isHot = (recent[k] || 0) >= 2;
        return `<div class="insight ${isHot ? 'warn' : 'info'}">
          <span class="ico">${cat.icon}</span>
          <div class="tt"><b>${cat.label}${isHot ? '(最近還在犯!)' : ''}</b>${cat.tip}</div>
        </div>`;
      }).join('')}</div>` : ''}

      <div class="section-title"><h2>${I('list', 17)} 所有修正紀錄(${idx.length})</h2></div>
      <div class="chips mb" id="gchips">
        <button class="chip active" data-c="all">全部</button>
        ${sorted.map(([k]) => `<button class="chip" data-c="${k}">${Grammar.CATEGORIES[k].icon} ${Grammar.CATEGORIES[k].label} ${all[k]}</button>`).join('')}
      </div>
      <div class="card list-card" id="glist"></div>
    </div>`;

    const listEl = $('#glist', root);
    function renderList(cat) {
      const items = [...idx].sort((a, b) => b.lesson.date.localeCompare(a.lesson.date))
        .filter((g) => cat === 'all' || (g.item.cats || []).includes(cat));
      listEl.innerHTML = items.map((g) => grammarPairHtml(g.item, fmtDate(g.lesson.date))).join('') ||
        '<div class="empty" style="padding:24px"><p>無紀錄</p></div>';
    }
    $$('#gchips .chip', root).forEach((c) => c.addEventListener('click', () => {
      $$('#gchips .chip', root).forEach((x) => x.classList.toggle('active', x === c));
      renderList(c.dataset.c);
    }));
    renderList('all');
  }

  /* ============================================================
     發音練習
     ============================================================ */
  function pron(root) {
    const list = Store.pronIndex();
    if (!list.length) return emptyRedirect(root, '還沒有發音紀錄', '老師筆記裡的 📣 發音提示會自動收集到這裡,可以聽標準發音、開麥克風練習。');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    root.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${hico('mic')}發音練習室</h1>
        <div class="sub">聽標準發音 · 慢速播放${SR ? ' · 錄音辨識挑戰' : ''}</div></div></div>
      ${!SR ? '<div class="warn-box">⚠️ 此瀏覽器不支援語音辨識(建議用 Chrome / Edge / Safari),仍可使用播放功能。</div>' : ''}
      <div class="grid cols-2">
        ${list.map((p) => `<div class="card pron-card" data-key="${esc(p.key)}">
          <div class="flex between">
            <div><div class="pron-word">${esc(p.word)}</div><div class="pron-guide">「${esc(p.guide || '—')}」</div></div>
            ${p.practice.best ? '<span class="pill review">✓ 達標</span>' : p.practice.count ? `<span class="pill learning">練習 ${p.practice.count} 次</span>` : '<span class="pill new">未練習</span>'}
          </div>
          <div class="pron-actions">
            <button class="btn sm" data-act="play">${I('volume-2', 14)} 播放</button>
            <button class="btn sm" data-act="slow">${I('timer', 14)} 慢速</button>
            ${SR ? `<button class="btn sm primary" data-act="mic">${I('mic', 14)} 換我說</button>` : ''}
          </div>
          <div class="mic-result" style="display:none"></div>
        </div>`).join('')}
      </div>
    </div>`;

    $$('.pron-card', root).forEach((cardEl) => {
      const key = cardEl.dataset.key;
      const p = list.find((x) => x.key === key);
      const resultEl = $('.mic-result', cardEl);
      cardEl.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        if (act === 'play') speak(p.word, 0.92);
        else if (act === 'slow') speak(p.word, 0.55);
        else if (act === 'mic') startMic();
      });

      function startMic() {
        const rec = new SR();
        rec.lang = 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        resultEl.style.display = 'block';
        resultEl.className = 'mic-result mic-live';
        resultEl.textContent = '🎤 請說:' + p.word;
        rec.onresult = (ev) => {
          const alts = [...ev.results[0]].map((r) => r.transcript.toLowerCase().trim());
          const target = p.word.toLowerCase();
          const hit = alts.some((t) => t.includes(target) || target.includes(t));
          const newAch = Store.logPron(key, hit);
          resultEl.className = 'mic-result ' + (hit ? 'ok' : 'no');
          resultEl.textContent = hit
            ? `✅ 太棒了!辨識到「${alts[0]}」 +5 XP`
            : `🔁 辨識到「${alts[0] || '(聽不清楚)'}」,再試一次!+5 XP`;
          newAch.forEach((a) => App.achToast(a));
        };
        rec.onerror = (ev) => {
          resultEl.className = 'mic-result no';
          resultEl.textContent = ev.error === 'not-allowed' ? '🚫 請允許麥克風權限' : '⚠️ 辨識失敗,再試一次';
        };
        rec.onend = () => resultEl.classList.remove('mic-live');
        try { rec.start(); } catch (e) { /* already running */ }
      }
    });
  }

  /* ============================================================
     成長軌跡
     ============================================================ */
  function progress(root) {
    const s = Store.state;
    if (!s.lessons.length) return emptyRedirect(root, '還沒有資料可以視覺化', '開始記錄課程,這裡會畫出你的成長曲線。');
    const vocab = Store.vocabIndex();
    const lv = Store.levelInfo(s.meta.xp);

    // 累積單字曲線(按課程日期)
    const byDate = {};
    for (const l of s.lessons) byDate[l.date] = (byDate[l.date] || 0) + l.vocab.length;
    let cum = 0;
    const cumPoints = Object.keys(byDate).sort().map((d) => { cum += byDate[d]; return { x: d.slice(5).replace('-', '/'), y: cum }; });

    // 複習正確率
    const accPoints = [...s.meta.reviewLog].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
      .map((r) => ({ x: r.date.slice(5).replace('-', '/'), y: Math.round((r.correct / Math.max(r.total, 1)) * 100) }));

    // 每月課程數
    const monthly = {};
    for (const l of s.lessons) monthly[l.date.slice(0, 7)] = (monthly[l.date.slice(0, 7)] || 0) + 1;
    const monthItems = Object.entries(monthly).sort().slice(-6).map(([m, v]) => ({ label: m.slice(2).replace('-', '/'), value: v, suffix: ' 堂', color: 'var(--accent-2)' }));

    const unlocked = new Set(s.meta.ach);

    root.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${hico('trending-up')}成長軌跡</h1><div class="sub">Lv.${lv.level} ${lv.title} · 總計 ${s.meta.xp} XP</div></div></div>
      <div class="grid cols-2">
        <div class="card"><h3>${I('book-open', 16)} 累積單字量</h3>${Charts.line(cumPoints)}</div>
        <div class="card"><h3>${I('target', 16)} 複習記得率(近 14 次)</h3>${accPoints.length >= 2 ? Charts.line(accPoints, { color: '#2dd4bf', color2: '#6c7bff', yFmt: (v) => v + '%' }) : '<div class="faint" style="text-align:center;padding:40px 0">完成幾次複習後,曲線就會出現</div>'}</div>
      </div>
      <div class="spacer"></div>
      <div class="grid cols-2">
        <div class="card"><h3>${I('calendar-days', 16)} 每月上課數</h3>${Charts.hbars(monthItems)}</div>
        <div class="card"><h3>${I('chart-column', 16)} 單字記憶分佈</h3>${Charts.hbars([
          { label: '🌑 新', value: vocab.filter((v) => v.card.state === 'new').length, color: '#94a3b8' },
          { label: '🌓 學習中', value: vocab.filter((v) => v.card.state === 'learning').length, color: '#fbbf24' },
          { label: '🌕 複習中', value: vocab.filter((v) => v.card.state === 'review' && !SRS.isMastered(v.card)).length, color: '#6c7bff' },
          { label: '💎 精熟', value: vocab.filter((v) => SRS.isMastered(v.card)).length, color: '#2dd4bf' },
        ])}</div>
      </div>

      <div class="section-title"><h2>${I('trophy', 17)} 成就(${unlocked.size}/${Store.ACHIEVEMENTS.length})</h2></div>
      <div class="ach-grid">
        ${Store.ACHIEVEMENTS.map((a) => `<div class="ach ${unlocked.has(a.id) ? 'unlocked' : 'locked'}">
          <div class="ico">${a.icon}</div><div class="nm">${a.name}</div><div class="ds">${a.desc}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  /* ============================================================
     設定
     ============================================================ */
  function settings(root) {
    const s = Store.state;
    root.innerHTML = `<div class="page" style="max-width:640px">
      <div class="page-head"><div><h1>${hico('sliders')}設定</h1></div></div>
      <div class="card">
        <label class="field"><span>你的名字(顯示在問候語)</span><input type="text" id="set-name" value="${esc(s.meta.name)}" placeholder="例如:Young"></label>
        <label class="field"><span>外觀主題</span><select id="set-theme">
          <option value="dark" ${s.meta.theme === 'dark' ? 'selected' : ''}>🌙 深色</option>
          <option value="light" ${s.meta.theme === 'light' ? 'selected' : ''}>☀️ 淺色</option>
        </select></label>
        <label class="field"><span>每天最多學幾個新單字(間隔複習)</span><input type="number" id="set-newperday" min="1" max="50" value="${s.meta.newPerDay}"></label>
        <button class="btn primary" id="set-save">儲存設定</button>
      </div>
      <div class="spacer"></div>
      <div class="card" id="sync-card">${syncCardHtml()}</div>
      <div class="spacer"></div>
      <div class="card">
        <h3>${I('save', 16)} 手動備份</h3>
        <p class="hint">${Sync.enabled() ? '已開啟雲端同步,匯出檔案可作為額外保險。' : '所有資料都存在這台裝置的瀏覽器(localStorage)。換裝置或清瀏覽器前,記得先匯出備份。'}</p>
        <div class="btn-row mt">
          <button class="btn" id="exp-btn">${I('download', 15)} 匯出 JSON</button>
          <button class="btn" id="imp-btn">${I('upload', 15)} 匯入 JSON</button>
          <input type="file" id="imp-file" accept=".json,application/json" hidden>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="card">
        <h3>${I('alert-triangle', 16, 'c-bad')} 危險區</h3>
        ${s.meta.sampleLoaded ? '<p class="hint">目前載有範例資料,正式開始使用前建議先清除。</p>' : ''}
        <button class="btn danger mt" id="reset-btn">清除所有資料</button>
      </div>
      <div class="spacer"></div>
      <p class="faint" style="font-size:12px;text-align:center">SpeakLog · 為 Winning Plus 一對一口說課設計的學習引擎<br>純前端 · 零追蹤 · 資料只屬於你</p>
    </div>`;

    bindSyncCard(root);
    $('#set-save', root).addEventListener('click', () => {
      s.meta.name = $('#set-name', root).value.trim();
      s.meta.theme = $('#set-theme', root).value;
      s.meta.newPerDay = Math.max(1, Math.min(50, +$('#set-newperday', root).value || 8));
      Store.save();
      App.applyTheme();
      App.toast('✅ 設定已儲存');
    });
    $('#exp-btn', root).addEventListener('click', () => {
      const blob = new Blob([Store.exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `speaklog-backup-${SRS.todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      App.toast('已下載備份檔');
    });
    $('#imp-btn', root).addEventListener('click', () => $('#imp-file', root).click());
    $('#imp-file', root).addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        App.confirm('匯入備份?', '目前的資料會被備份檔完全覆蓋。', () => {
          try {
            Store.importJson(reader.result);
            App.toast('✅ 匯入成功');
            App.applyTheme();
            App.refresh();
          } catch (err) { App.toast('❌ 匯入失敗:' + err.message); }
        });
      };
      reader.readAsText(f);
    });
    $('#reset-btn', root).addEventListener('click', () => {
      App.confirm('確定清除所有資料?', '所有課程、單字、複習進度將永久刪除。建議先匯出備份。', () => {
        Store.reset();
        App.toast('已清除所有資料');
        App.applyTheme();
        location.hash = '#/';
        App.refresh();
      });
    });
  }

  /* ---------- 雲端同步卡片(Supabase + Google 登入) ---------- */
  function syncCardHtml() {
    if (!Sync.configured()) {
      return `<h3>${I('cloud', 16)} 跨裝置同步</h3>
        <p class="hint">尚未啟用 — 部署者需建立 Supabase 專案並填入金鑰,
        詳見 repo 內的 <a href="https://github.com/CoderLambTw/speaklog/blob/main/SUPABASE_SETUP.md" target="_blank" rel="noopener">SUPABASE_SETUP.md</a>。
        在那之前,可用下方的手動備份在裝置間搬資料。</p>`;
    }
    if (!Sync.enabled()) {
      return `<h3>${I('cloud', 16)} 跨裝置同步</h3>
        <p class="hint">用 Google 帳號登入後,資料會自動同步到雲端:手機複習完,電腦打開就是最新進度。未登入也能照常使用,資料留在本機。</p>
        <button class="btn primary" id="sync-login">${I('log-in', 15)} 使用 Google 登入並同步</button>`;
    }
    const u = Sync.getUser();
    const last = Store.state.meta.sync.lastSync
      ? new Date(Store.state.meta.sync.lastSync).toLocaleString('zh-TW', { hour12: false }) : '—';
    return `<h3>${I('cloud', 16)} 跨裝置同步 <span class="pill review">已同步</span></h3>
      <p class="hint">${esc(u.email || u.id)} · 上次同步:${last}<br>
      變更後約 3 秒自動上傳;開啟 App、回到前景或重新上線時自動同步。其他裝置用同一個 Google 帳號登入即可。</p>
      <div class="btn-row">
        <button class="btn" id="sync-now">${I('refresh-cw', 15)} 立即同步</button>
        <button class="btn danger" id="sync-logout">${I('log-out', 15)} 登出</button>
      </div>`;
  }

  function bindSyncCard(root) {
    const card = $('#sync-card', root);
    if (!card) return;
    $('#sync-login', card)?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '前往 Google 登入…';
      try { await Sync.signIn(); }  // 成功會整頁導向 Google
      catch (err) {
        App.toast('❌ ' + err.message, { ms: 4500 });
        btn.disabled = false;
        btn.innerHTML = `${I('log-in', 15)} 使用 Google 登入並同步`;
      }
    });
    $('#sync-now', card)?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const r = await Sync.syncNow();
        App.toast(r.status === 'pulled' ? '☁️ 已下載雲端資料' : r.status === 'pushed' ? '☁️ 已上傳本機資料' : '✅ 已是最新狀態');
        App.refresh();
      } catch (err) { App.toast('❌ ' + err.message, { ms: 4000 }); btn.disabled = false; }
    });
    $('#sync-logout', card)?.addEventListener('click', () => {
      App.confirm('登出雲端同步?', '本機資料保留,雲端資料也不會刪除,重新登入即可繼續同步。', async () => {
        await Sync.signOut();
        App.toast('已登出');
        App.refresh();
      });
    });
  }

  /* ============================================================
     更多(手機版選單)
     ============================================================ */
  function more(root) {
    const items = [
      ['#/grammar', 'target', '文法雷達', '反覆犯錯模式分析'],
      ['#/pron', 'mic', '發音練習室', 'TTS 播放與錄音挑戰'],
      ['#/lessons', 'library', '課程紀錄', '每堂課詳情與老師回饋'],
      ['#/progress', 'trending-up', '成長軌跡', '圖表、成就、等級'],
      ['#/settings', 'sliders', '設定', '同步、備份、主題'],
    ];
    root.innerHTML = `<div class="page" style="max-width:560px">
      <div class="page-head"><div><h1>${hico('menu')}更多</h1></div></div>
      <div class="grid">${items.map(([href, ico, label, desc]) => `
        <a class="card clickable" href="${href}" style="text-decoration:none;color:inherit;display:flex;gap:14px;align-items:center">
          <div class="more-ico">${I(ico, 21)}</div>
          <div><b style="font-size:15.5px">${label}</b><div class="hint">${desc}</div></div>
        </a>`).join('')}</div>
    </div>`;
  }

  /* ---------- 通用空狀態 ---------- */
  function emptyRedirect(root, title, body) {
    root.innerHTML = `<div class="page"><div class="empty">
      <div class="ico">🌱</div><h2>${title}</h2><p>${body}</p>
      <a class="btn primary lg" href="#/add">${I('pencil', 16)} 新增課程筆記</a>
    </div></div>`;
  }

  return { dashboard, add, lessons, lessonDetail, vocab, review, grammar, pron, progress, settings, more };
})();
