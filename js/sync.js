/* ============================================================
   Sync — 跨裝置雲端同步(Supabase + Google OAuth)

   ⚠️ 部署者設定:照 SUPABASE_SETUP.md 建好專案後,
      把下面兩個常數換成你專案的值(Dashboard → Settings → API)。
      anon key 是公開金鑰,寫在前端是安全的(RLS 保護資料)。

   策略:Last-Write-Wins,以 meta.lastModified(毫秒)比較新舊。
   - 未登入:完全不動,維持原本的純 localStorage 行為
   - 登入後:開啟 App / 回到前景 / 重新上線 → 拉雲端,較新就套用
             本機任何變更 → 3.5 秒 debounce 後自動上傳
   ============================================================ */
const Sync = (() => {
  const SUPABASE_URL = 'https://lqpqwevpxedqizjfnhpg.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_r1pa4hKpnBXAf8hCgskb6A_BYJDNzgW'; // publishable key,公開安全

  let client = null;
  let user = null;
  let pushTimer = null;
  let syncing = false;
  let notify = null;   // App 註冊的回呼:同步/登入狀態變化時通知重繪

  const configured = () =>
    SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 40 && !!window.supabase;
  const enabled = () => !!(client && user);

  function touchLastSync() {
    Store.state.meta.sync.lastSync = Date.now();
    Store.persist();
  }

  /** 上傳內容不含裝置本地的同步狀態 */
  function payload() {
    const s = Store.state;
    return JSON.parse(JSON.stringify({ ...s, meta: { ...s.meta, sync: undefined } }));
  }

  async function init(cb) {
    notify = cb;
    if (!configured()) return;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce' },
    });
    const { data: { session } } = await client.auth.getSession();
    user = (session && session.user) || null;

    client.auth.onAuthStateChange((event, sess) => {
      const prevId = user && user.id;
      user = (sess && sess.user) || null;
      if (event === 'SIGNED_IN' && user && user.id !== prevId) {
        syncNow().then((r) => notify && notify(r)).catch((e) => notify && notify({ status: 'error', message: e.message }));
      } else if (event === 'SIGNED_OUT') {
        notify && notify({ status: 'signedout' });
      }
    });

    window.addEventListener('online', () => {
      syncNow().then((r) => notify && notify(r)).catch(() => {});
    });

    if (user) {
      try { return await syncNow(); }
      catch (e) { return { status: 'error', message: e.message }; }
    }
  }

  async function signIn() {
    if (!configured()) throw new Error('雲端同步尚未設定(見 SUPABASE_SETUP.md)');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    clearTimeout(pushTimer);
    pushTimer = null;
    if (client) await client.auth.signOut();
    user = null;
    Store.state.meta.sync.lastSync = null;
    Store.persist();
  }

  /** 雙向同步:比較時間戳,新的那邊贏 */
  async function syncNow() {
    if (!enabled() || syncing) return { status: 'skip' };
    syncing = true;
    try {
      const { data: row, error } = await client
        .from('user_data').select('data').eq('user_id', user.id).maybeSingle();
      if (error) throw new Error(error.message);
      const remote = (row && row.data) || null;
      const localTs = Store.state.meta.lastModified || 0;
      const remoteTs = (remote && remote.meta && remote.meta.lastModified) || 0;

      if (!remote || remoteTs < localTs) { await push(); return { status: 'pushed' }; }
      if (remoteTs > localTs) { applyRemote(remote); return { status: 'pulled' }; }
      touchLastSync();
      return { status: 'same' };
    } finally { syncing = false; }
  }

  async function push() {
    if (!enabled()) return;
    const { error } = await client.from('user_data').upsert(
      { user_id: user.id, data: payload(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) throw new Error(error.message);
    touchLastSync();
  }

  function applyRemote(remote) {
    remote.meta = { ...(remote.meta || {}), sync: { ...Store.state.meta.sync, lastSync: Date.now() } };
    Store.replace(remote);
  }

  /** Store.save() 每次變更後呼叫:debounce 自動上傳 */
  function schedulePush() {
    if (!enabled()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      push().catch((e) => console.warn('[sync] 自動上傳失敗:', e.message));
    }, 3500);
  }

  /** 切到背景前把待上傳的變更立刻送出 */
  function flush() {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    if (enabled()) push().catch((e) => console.warn('[sync] flush 失敗:', e.message));
  }

  /** 回到前景:距上次同步超過 1 分鐘就拉一次 */
  async function maybePull() {
    if (!enabled() || pushTimer) return { status: 'skip' };
    if (Date.now() - (Store.state.meta.sync.lastSync || 0) < 60000) return { status: 'skip' };
    return await syncNow();
  }

  return {
    init, signIn, signOut, syncNow, schedulePush, flush, maybePull,
    configured, enabled,
    getUser: () => user,
  };
})();
