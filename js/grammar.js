/* ============================================================
   Grammar — 文法錯誤分類器 + 句子差異標示
   比對 ❌ 原句與 ✔️ 修正句,自動歸類錯誤模式,
   讓使用者看見自己「反覆犯的錯」。
   ============================================================ */
const Grammar = (() => {
  const ARTICLES = new Set(['a', 'an', 'the']);
  const PREPS = new Set(['in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
    'into', 'onto', 'over', 'under', 'between', 'during', 'after', 'before', 'since', 'until', 'through', 'against']);
  const PRONOUNS = new Set(['i', 'me', 'my', 'mine', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'hers',
    'it','its', 'we', 'us', 'our', 'they', 'them', 'their', 'theirs', 'myself', 'himself', 'herself', 'themselves']);
  const BE_HAVE_DO = new Set(['is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must']);
  const IRREGULAR = { go: 'went', come: 'came', eat: 'ate', take: 'took', get: 'got', make: 'made',
    see: 'saw', say: 'said', know: 'knew', think: 'thought', buy: 'bought', bring: 'brought',
    teach: 'taught', catch: 'caught', feel: 'felt', find: 'found', give: 'gave', tell: 'told',
    speak: 'spoke', write: 'wrote', read: 'read', meet: 'met', run: 'ran', drink: 'drank', swim: 'swam', begin: 'began' };
  const PAST_FORMS = new Set([...Object.values(IRREGULAR),
    'been', 'gone', 'done', 'seen', 'taken', 'given', 'written', 'spoken', 'known', 'eaten', 'become', 'begun']);

  const CATEGORIES = {
    tense:      { label: '動詞時態', icon: '⏰', tip: '說話前先想:這件事是「過去、現在、還是未來」?動詞要跟著時間走。' },
    agreement:  { label: '主詞動詞一致', icon: '🤝', tip: '第三人稱單數(he/she/it)動詞要加 s;複數主詞配複數動詞。' },
    article:    { label: '冠詞 a/an/the', icon: '🅰️', tip: '可數名詞單數前通常需要 a/an/the。特定的事物用 the。' },
    preposition:{ label: '介系詞', icon: '📍', tip: '介系詞多是搭配記憶:on Monday、in the morning、at night。' },
    plural:     { label: '單複數', icon: '🔢', tip: '可數名詞超過一個記得加 s/es;注意不可數名詞(information, advice)。' },
    pronoun:    { label: '代名詞', icon: '👤', tip: '注意主格/受格/所有格:I-me-my、they-them-their。' },
    wordchoice: { label: '用字選擇', icon: '💬', tip: '把正確的搭配詞(collocation)整句背起來,而不是只記單字。' },
    structure:  { label: '句構語序', icon: '🏗️', tip: '英文基本語序是「主詞 + 動詞 + 受詞」,修飾語位置和中文不同。' },
  };

  const tokenize = (s) => (s.toLowerCase().match(/[a-z']+/g) || []);
  const stem = (w) => w.replace(/'(s|re|ve|ll|d|m)$/, '');

  function isMorphVariant(a, b) {
    const [x, y] = [stem(a), stem(b)];
    if (x === y) return true;
    if (IRREGULAR[x] === y || IRREGULAR[y] === x) return true;
    const pairs = [[x, y], [y, x]];
    for (const [p, q] of pairs) {
      if (q === p + 's' || q === p + 'es' || q === p + 'ed' || q === p + 'd' || q === p + 'ing') return true;
      if (p.endsWith('y') && q === p.slice(0, -1) + 'ies') return true;
      if (p.endsWith('y') && q === p.slice(0, -1) + 'ied') return true;
      if (p.endsWith('e') && (q === p + 'd' || q === p.slice(0, -1) + 'ing')) return true;
      if (q.length === p.length + 3 && q.startsWith(p) && q.endsWith('ing')) return true; // run→running
      if (q.length === p.length + 2 && q.startsWith(p) && q.endsWith('ed')) return true;  // stop→stopped
    }
    return false;
  }

  /** 回傳分類 key 陣列(可能多個);空陣列代表無法判斷 → structure */
  function classify(wrong, correct) {
    if (!wrong || !correct) return ['wordchoice'];
    const w = tokenize(wrong), c = tokenize(correct);
    const wSet = new Set(w), cSet = new Set(c);
    const removed = w.filter((t) => !cSet.has(t));
    const added = c.filter((t) => !wSet.has(t));
    const cats = new Set();

    // 同字重排 → 語序
    if (!removed.length && !added.length && w.join(' ') !== c.join(' ')) return ['structure'];

    for (const t of added) {
      if (ARTICLES.has(t) && !removed.some((r) => ARTICLES.has(r))) cats.add('article');
    }
    for (const t of removed) {
      if (ARTICLES.has(t)) cats.add('article');
      if (PREPS.has(t)) cats.add('preposition');
      if (PRONOUNS.has(t)) cats.add('pronoun');
    }
    for (const t of added) {
      if (PREPS.has(t) && !cats.has('preposition')) cats.add('preposition');
      if (PRONOUNS.has(t) && removed.some((r) => PRONOUNS.has(r))) cats.add('pronoun');
    }

    // 配對被替換的詞,判斷形態變化
    const usedAdd = new Set();
    for (const r of removed) {
      if (ARTICLES.has(r) || PREPS.has(r) || PRONOUNS.has(r)) continue;
      let matched = false;
      for (const a of added) {
        if (usedAdd.has(a)) continue;
        if (BE_HAVE_DO.has(r) && BE_HAVE_DO.has(a)) {
          const pastPairs = new Set(['is>was', 'are>were', 'am>was', 'was>is', 'were>are',
            'has>had', 'have>had', 'do>did', 'does>did', 'will>would', 'can>could']);
          if (pastPairs.has(`${r}>${a}`) || pastPairs.has(`${a}>${r}`)) cats.add('tense');
          else cats.add('agreement');
          usedAdd.add(a); matched = true; break;
        }
        if (PAST_FORMS.has(r) && (PAST_FORMS.has(a) || BE_HAVE_DO.has(a))) {
          cats.add('tense');
          usedAdd.add(a); matched = true; break;
        }
        if (isMorphVariant(r, a)) {
          const [p, q] = [stem(r), stem(a)];
          if (q === p + 's' || q === p + 'es' || p === q + 's' || p === q + 'es' ||
              (p.endsWith('y') && q === p.slice(0, -1) + 'ies') || (q.endsWith('y') && p === q.slice(0, -1) + 'ies')) {
            // +s:動詞→一致,名詞→單複數(無 POS 資料,用前一個字猜:冠詞/形容詞後多為名詞)
            const idx = w.indexOf(r);
            const prev = idx > 0 ? w[idx - 1] : '';
            if (PRONOUNS.has(prev) || BE_HAVE_DO.has(prev)) cats.add('agreement');
            else if (ARTICLES.has(prev) || /(?:many|some|two|three|few|several|these|those)/.test(prev)) cats.add('plural');
            else cats.add('agreement');
          } else {
            cats.add('tense');
          }
          usedAdd.add(a); matched = true; break;
        }
      }
      if (!matched && BE_HAVE_DO.has(r)) cats.add('tense'); // 多餘/缺漏的助動詞,如 "I am agree"
      else if (!matched && r.length > 2) cats.add('wordchoice');
    }
    for (const a of added) {
      if (!usedAdd.has(a) && BE_HAVE_DO.has(a) && !cats.size) cats.add('tense');
    }

    if (!cats.size) {
      const changeRatio = (removed.length + added.length) / Math.max(w.length, c.length, 1);
      cats.add(changeRatio > 0.5 ? 'structure' : 'wordchoice');
    }
    return [...cats].slice(0, 3);
  }

  /* ---------- LCS 詞級 diff,輸出帶 <del>/<ins> 的 HTML ---------- */
  function lcsDiff(aTokens, bTokens) {
    const n = aTokens.length, m = bTokens.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = aTokens[i].toLowerCase() === bTokens[j].toLowerCase()
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const aFlags = new Array(n).fill(false), bFlags = new Array(m).fill(false);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (aTokens[i].toLowerCase() === bTokens[j].toLowerCase()) { aFlags[i] = bFlags[j] = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return { aFlags, bFlags };
  }

  const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** 回傳 { wrongHtml, correctHtml }:錯的字加 <del>,新的字加 <ins> */
  function diffHtml(wrong, correct) {
    const wT = (wrong || '').split(/\s+/).filter(Boolean);
    const cT = (correct || '').split(/\s+/).filter(Boolean);
    if (!wT.length || !cT.length) return { wrongHtml: escHtml(wrong), correctHtml: escHtml(correct) };
    const { aFlags, bFlags } = lcsDiff(wT, cT);
    const wrongHtml = wT.map((t, k) => (aFlags[k] ? escHtml(t) : `<del>${escHtml(t)}</del>`)).join(' ');
    const correctHtml = cT.map((t, k) => (bFlags[k] ? escHtml(t) : `<ins>${escHtml(t)}</ins>`)).join(' ');
    return { wrongHtml, correctHtml };
  }

  return { CATEGORIES, classify, diffHtml };
})();
if (typeof module !== 'undefined') module.exports = Grammar;
