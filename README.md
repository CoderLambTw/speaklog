# 🗣️ SpeakLog — 英文口說成長引擎

把每堂一對一英文口說課的老師筆記,變成你的**主動學習引擎**。

專為 [Winning Plus](https://www.winning-plus.com.tw/) 線上口說課的固定筆記格式設計:
貼上老師課後給的筆記,自動解析單字、文法修正、發音提示與回饋,
接著用科學化的方式幫你複習、追蹤、看見進步。

## ✨ 功能

| | |
|---|---|
| 📝 **一鍵匯入** | 貼上老師筆記 + 選日期,自動解析(容忍格式變化),儲存前可預覽 |
| 🃏 **間隔複習** | SM-2 演算法排程單字卡與「修正句」卡,4 段評分動態調整間隔 |
| 🎯 **文法雷達** | 自動把 ❌→✔️ 修正句分類成 8 種錯誤模式(時態、冠詞、介系詞⋯),用 diff 標示改了哪裡,讓你看見反覆犯的錯 |
| 📖 **單字庫** | 搜尋、狀態篩選(新/學習中/精熟/吃力)、出現次數、TTS 發音 |
| 🎙️ **發音練習室** | 標準/慢速 TTS 播放,麥克風語音辨識挑戰(Chrome/Edge/Safari) |
| 💡 **學習洞察** | 「最近常犯」「已馴服的錯誤」「吃力單字」等 pattern-level 建議 |
| 📈 **成長視覺化** | 累積單字曲線、記得率趨勢、GitHub 式活動熱力圖、記憶分佈 |
| 🔥 **遊戲化** | XP/等級、週連勝(貼合每週 1-2 堂課的節奏)、14 個成就 |
| ☁️ **跨裝置同步** | Google 登入後自動同步(Supabase),離線照常使用、上線自動補同步;未登入則維持純 localStorage |
| 🌙 **現代介面** | 深色/淺色主題、RWD 手機適配、鍵盤快捷鍵複習 |

## 🚀 使用

直接開啟 GitHub Pages 網址即可,無需安裝。第一次可點「先看範例資料」體驗完整功能。

本機開發:

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

純前端、零依賴、無建置步驟 — vanilla JS + hand-rolled SVG charts。

## 🔒 資料

預設所有資料只存在你裝置的 `localStorage`。兩種跨裝置方式:

1. **雲端同步(推薦)** — 照 [SUPABASE_SETUP.md](SUPABASE_SETUP.md) 設定一次後,
   在設定頁用 Google 登入,之後變更自動上傳、開啟自動下載(Last-Write-Wins 合併)。
2. **手動備份** — 設定 → 匯出 JSON,到新裝置匯入。

## 📋 支援的筆記格式

```
Teacher Mae

[A.] CORRECTIONS:
🛑 Vocabulary
🟢 resilient – able to recover quickly from difficult situations

🛑 Grammar / Suggested Sentences;
❌ I am working here since five years.
✔️ I have been working here for five years.

📣 Pronunciation
📣 resilient — "rih-ZIL-yent"

[B.] Feedback:
You did a wonderful job expressing your opinions today!
```

解析器採寬鬆策略:emoji 變體(✅/✓/✗)、不同破折號(– — -)、缺漏區塊都能處理。

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
