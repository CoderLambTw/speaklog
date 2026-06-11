# ☁️ SpeakLog 雲端同步設定指南(Supabase + Google OAuth)

照著做一次(約 15 分鐘),之後所有裝置用 Google 帳號登入就能自動同步。

## 1. 建立 Supabase 專案

1. 到 [supabase.com](https://supabase.com) 用 GitHub 帳號登入 → **New project**
2. Region 選 **Southeast Asia (Singapore)**,資料庫密碼隨便設(用不到)
3. 等專案建好(約 1 分鐘)

## 2. 建表 + RLS(複製貼上即可)

Dashboard 左側 **SQL Editor** → **New query**,貼上執行:

```sql
-- 一人一列,整包 app state 存 JSONB
create table public.user_data (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security:每個人只能讀寫自己的資料
alter table public.user_data enable row level security;

create policy "read own data" on public.user_data
  for select using (auth.uid() = user_id);

create policy "insert own data" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "update own data" on public.user_data
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 3. 設定 Google OAuth

### 3a. Google Cloud Console

1. 到 [console.cloud.google.com](https://console.cloud.google.com) → 建立專案(名稱隨意,如 `speaklog`)
2. **APIs & Services → OAuth consent screen**:
   - User Type 選 **External** → 填 App 名稱與你的 email → 一路下一步
   - 在 **Test users** 加入你自己的 Gmail(或直接 **Publish app**)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type:**Web application**
   - **Authorized JavaScript origins**:
     - `https://coderlambtw.github.io`
     - `http://localhost:8000`(本機開發用,可選)
   - **Authorized redirect URIs**:
     - `https://<你的專案ref>.supabase.co/auth/v1/callback`
       (專案 ref 在 Supabase Dashboard 網址或 Settings → API 的 Project URL 裡)
4. 建立後複製 **Client ID** 和 **Client Secret**

### 3b. Supabase Dashboard

1. **Authentication → Providers → Google** → 開啟,貼上 Client ID / Client Secret → Save
2. **Authentication → URL Configuration**:
   - **Site URL**:`https://coderlambtw.github.io/speaklog/`
   - **Redirect URLs** 加入:
     - `https://coderlambtw.github.io/speaklog/`
     - `http://localhost:8000/`(本機開發用,可選)

## 4. 把金鑰填進程式

Dashboard **Settings → API** 複製兩個值,貼到 `js/sync.js` 最上面:

```js
const SUPABASE_URL = 'https://abcd1234.supabase.co';   // Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';             // anon public key
```

> anon key 是設計上公開的金鑰,寫在前端是安全的 — 資料存取由步驟 2 的 RLS 控管。

commit + push 後等 GitHub Pages 重新部署:

```bash
git add js/sync.js && git commit -m "Enable Supabase sync" && git push
```

## 5. 驗收

1. 開啟 https://coderlambtw.github.io/speaklog/ → 設定 → 「🔐 使用 Google 登入並同步」
2. 登入後顯示「已同步」+ email + 上次同步時間
3. 換另一台裝置登入同一個 Google 帳號 → 資料自動出現

## 運作方式

- **未登入**:跟原本完全一樣,純 localStorage
- **登入後**:每次變更 3.5 秒後自動上傳;開啟 App、回到前景、斷線重連時自動拉取
- **衝突處理**:Last-Write-Wins,以資料的 `meta.lastModified` 時間戳比較,新的覆蓋舊的
- **離線**:照常使用,回到線上自動同步
