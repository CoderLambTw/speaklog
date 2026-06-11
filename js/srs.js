/* ============================================================
   SRS — 間隔複習引擎(SM-2 改良版)
   每張卡片: { ef, ivl, reps, due, lapses, state, last }
   state: 'new' → 'learning' → 'review'  (lapses>=4 視為 leech)
   ============================================================ */
const SRS = (() => {
  function todayStr(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function newCard() {
    return { ef: 2.5, ivl: 0, reps: 0, due: todayStr(), lapses: 0, state: 'new', last: null };
  }

  /** grade: 'again' | 'hard' | 'good' | 'easy' */
  function grade(card, g) {
    const c = { ...card };
    c.last = todayStr();
    if (g === 'again') {
      c.lapses += 1;
      c.reps = 0;
      c.ivl = 0;
      c.ef = Math.max(1.3, c.ef - 0.2);
      c.due = todayStr();          // 今天稍後再出現
      c.state = 'learning';
      return c;
    }
    if (g === 'hard') {
      c.ivl = c.reps === 0 ? 1 : Math.max(1, Math.round(c.ivl * 1.2));
      c.ef = Math.max(1.3, c.ef - 0.15);
    } else if (g === 'good') {
      if (c.reps === 0) c.ivl = 1;
      else if (c.reps === 1) c.ivl = 3;
      else c.ivl = Math.max(c.ivl + 1, Math.round(c.ivl * c.ef));
    } else { // easy
      c.ef = Math.min(3.0, c.ef + 0.15);
      c.ivl = c.reps === 0 ? 3 : Math.max(c.ivl + 2, Math.round(c.ivl * c.ef * 1.3));
    }
    c.ivl = Math.min(c.ivl, 365);
    c.reps += 1;
    c.due = todayStr(c.ivl);
    c.state = c.ivl >= 1 ? (c.reps >= 2 ? 'review' : 'learning') : 'learning';
    return c;
  }

  function isDue(card) { return card.due <= todayStr(); }
  function isLeech(card) { return card.lapses >= 4; }
  function isMastered(card) { return card.state === 'review' && card.ivl >= 21; }

  /** 預估下次間隔的人類可讀文字(顯示在按鈕上) */
  function previewIvl(card, g) {
    const c = grade(card, g);
    if (c.ivl === 0) return '<10 分';
    if (c.ivl === 1) return '1 天';
    if (c.ivl < 30) return `${c.ivl} 天`;
    return `${(c.ivl / 30).toFixed(1).replace(/\.0$/, '')} 個月`;
  }

  return { todayStr, newCard, grade, isDue, isLeech, isMastered, previewIvl };
})();
if (typeof module !== 'undefined') module.exports = SRS;
