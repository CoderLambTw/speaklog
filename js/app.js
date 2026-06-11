/* ============================================================
   App — 路由、導覽列、Toast、Modal、主題
   ============================================================ */
const App = (() => {
  const ROUTES = [
    { path: 'dashboard', hash: '#/', icon: '🏠', label: '總覽', view: Views.dashboard, nav: true, bnav: true },
    { path: 'review', hash: '#/review', icon: '🃏', label: '複習', view: Views.review, nav: true, bnav: true, badge: true },
    { path: 'add', hash: '#/add', icon: '＋', label: '新增', view: Views.add, nav: true, bnav: 'add' },
    { path: 'vocab', hash: '#/vocab', icon: '📖', label: '單字庫', view: Views.vocab, nav: true, bnav: true },
    { path: 'grammar', hash: '#/grammar', icon: '🎯', label: '文法雷達', view: Views.grammar, nav: true },
    { path: 'pron', hash: '#/pron', icon: '🎙️', label: '發音練習', view: Views.pron, nav: true },
    { path: 'lessons', hash: '#/lessons', icon: '📚', label: '課程紀錄', view: Views.lessons, nav: true },
    { path: 'progress', hash: '#/progress', icon: '📈', label: '成長軌跡', view: Views.progress, nav: true },
    { path: 'settings', hash: '#/settings', icon: '⚙️', label: '設定', view: Views.settings, nav: true },
    { path: 'more', hash: '#/more', icon: '☰', label: '更多', view: Views.more, nav: false },
  ];

  const main = document.getElementById('main');
  let keyHandler = null;

  /* ---------- 鍵盤(複習頁用) ---------- */
  function bindKeys(fn) {
    unbindKeys();
    keyHandler = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      fn(e);
    };
    document.addEventListener('keydown', keyHandler);
  }
  function unbindKeys() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }

  /* ---------- 路由 ---------- */
  function parseHash() {
    const h = location.hash || '#/';
    const [pathPart, queryPart] = h.slice(2).split('?');
    const segs = pathPart.split('/').filter(Boolean);
    const query = {};
    if (queryPart) for (const kv of queryPart.split('&')) {
      const [k, v] = kv.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
    return { segs, query };
  }

  function route() {
    unbindKeys();
    speechSynthesis?.cancel?.();
    const { segs, query } = parseHash();
    const name = segs[0] || 'dashboard';

    if (name === 'lesson' && segs[1]) {
      Views.lessonDetail(main, segs[1]);
    } else {
      const r = ROUTES.find((x) => x.path === name) || ROUTES[0];
      r.view(main, segs[1], query);
    }
    renderNav();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function refresh() { route(); }

  /* ---------- 導覽列 ---------- */
  function renderNav() {
    const { segs } = parseHash();
    const active = segs[0] || 'dashboard';
    const dueCount = Store.dueCards().length;

    document.getElementById('sidebar').innerHTML = `
      <div class="brand"><div class="logo">🗣️</div><div>SpeakLog<small>口說成長引擎</small></div></div>
      ${ROUTES.filter((r) => r.nav).map((r) => `
        <a class="navlink${active === r.path || (active === 'lesson' && r.path === 'lessons') ? ' active' : ''}" href="${r.hash}">
          <span class="ico">${r.icon}</span>${r.label}
          ${r.badge && dueCount ? `<span class="nav-badge">${dueCount > 99 ? '99+' : dueCount}</span>` : ''}
        </a>`).join('')}
      <div class="sidebar-foot">${Sync.enabled() ? '☁️ 雲端同步已開啟' : Sync.configured() ? '資料目前只存在這台裝置<br>可到設定登入 Google 同步 ☁️' : '資料只存在這台裝置<br>記得定期匯出備份 💾'}</div>`;

    const moreActive = ['more', 'grammar', 'pron', 'lessons', 'lesson', 'progress', 'settings'].includes(active);
    const bnavRoutes = [
      ROUTES[0], ROUTES[1], ROUTES[2], ROUTES[3],
      { path: 'more', hash: '#/more', icon: '☰', label: '更多' },
    ];
    document.getElementById('bottomnav').innerHTML = `<div class="inner">
      ${bnavRoutes.map((r) => `
        <a class="bnav${r.bnav === 'add' ? ' bnav-add' : ''}${active === r.path || (r.path === 'more' && moreActive) ? ' active' : ''}" href="${r.hash}">
          <span class="ico">${r.icon}</span><span>${r.label}</span>
          ${r.badge && dueCount ? `<span class="nav-badge">${dueCount > 99 ? '99+' : dueCount}</span>` : ''}
        </a>`).join('')}
    </div>`;
  }

  function updateNavBadge() { renderNav(); }

  /* ---------- Toast ---------- */
  function toast(msg, opts = {}) {
    const rootEl = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast' + (opts.cls ? ' ' + opts.cls : '');
    el.innerHTML = msg;
    rootEl.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 350);
    }, opts.ms || 2800);
  }

  function achToast(a) {
    toast(`<span style="font-size:20px">${a.icon}</span> 成就解鎖:<b>${a.name}</b> +50 XP`, { cls: 'ach-toast', ms: 4200 });
  }

  /* ---------- Modal ---------- */
  function modal(html) {
    const rootEl = document.getElementById('modal-root');
    rootEl.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}
      <div class="btn-row mt" style="justify-content:flex-end"><button class="btn" id="modal-close">關閉</button></div>
    </div></div>`;
    const close = () => (rootEl.innerHTML = '');
    rootEl.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
    rootEl.querySelector('#modal-close').addEventListener('click', close);
  }

  function confirm(title, body, onOk) {
    const rootEl = document.getElementById('modal-root');
    rootEl.innerHTML = `<div class="modal-backdrop"><div class="modal">
      <h3>${title}</h3><p>${body}</p>
      <div class="btn-row mt" style="justify-content:flex-end">
        <button class="btn" id="c-no">取消</button>
        <button class="btn danger" id="c-yes">確定</button>
      </div></div></div>`;
    const close = () => (rootEl.innerHTML = '');
    rootEl.querySelector('#c-no').addEventListener('click', close);
    rootEl.querySelector('#c-yes').addEventListener('click', () => { close(); onOk(); });
    rootEl.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  }

  /* ---------- 主題 ---------- */
  function applyTheme() {
    document.documentElement.dataset.theme = Store.state.meta.theme || 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
      Store.state.meta.theme === 'light' ? '#f3f5fb' : '#0b1020');
  }

  /* ---------- 啟動 ---------- */
  function init() {
    applyTheme();
    if ('speechSynthesis' in window) speechSynthesis.getVoices(); // 預載語音清單
    window.addEventListener('hashchange', route);
    route();

    // 雲端同步:先顯示本機資料,背景初始化/拉取,有更新再重繪
    const onSync = (r) => {
      if (!r) return;
      if (r.status === 'pulled') { applyTheme(); refresh(); toast('☁️ 已同步雲端資料'); }
      else if (r.status === 'pushed') { refresh(); toast('☁️ 已上傳本機資料'); }
      else if (r.status === 'signedout') refresh();
      else if (r.status === 'error') toast('⚠️ 同步失敗:' + r.message + '(使用本機資料)', { ms: 4000 });
    };
    Sync.init(onSync).then(onSync).catch((e) => console.warn('[sync] init 失敗:', e.message));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Sync.flush();
      else Sync.maybePull().then((r) => {
        if (r && r.status === 'pulled') { applyTheme(); refresh(); toast('☁️ 已同步雲端資料'); }
      }).catch(() => {});
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { toast, achToast, modal, confirm, refresh, applyTheme, updateNavBadge, bindKeys };
})();
