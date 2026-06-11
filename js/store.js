/* ============================================================
   Store — 資料層:localStorage 持久化、衍生索引、
   XP/等級/成就、活動紀錄與週連勝、學習洞察
   ============================================================ */
const Store = (() => {
  const KEY = 'speaklog.v1';

  /* ---------- 等級 ---------- */
  const LEVEL_TITLES = ['初登台', '暖身者', '開口者', '對話新手', '流暢學徒', '表達者',
    '溝通好手', '口說老練', '雄辯家', '雙語大師'];
  function levelInfo(xp) {
    // 每級所需 XP 遞增:level n 累計需 60*n*(n+1)/2
    let lv = 1;
    while (60 * (lv + 1) * lv / 2 <= xp) lv++;
    const floor = 60 * lv * (lv - 1) / 2;
    const ceil = 60 * (lv + 1) * lv / 2;
    return {
      level: lv,
      title: LEVEL_TITLES[Math.min(lv - 1, LEVEL_TITLES.length - 1)],
      progress: (xp - floor) / (ceil - floor),
      current: xp - floor,
      need: ceil - floor,
    };
  }

  /* ---------- 成就 ---------- */
  const ACHIEVEMENTS = [
    { id: 'first-lesson', icon: '🎬', name: '開課首航', desc: '記錄第 1 堂課', check: (s) => s.lessons.length >= 1 },
    { id: 'lessons-10', icon: '📚', name: '十堂里程', desc: '累積 10 堂課', check: (s) => s.lessons.length >= 10 },
    { id: 'lessons-30', icon: '🏛️', name: '三十而立', desc: '累積 30 堂課', check: (s) => s.lessons.length >= 30 },
    { id: 'words-30', icon: '🧠', name: '字彙起步', desc: '累積 30 個單字', check: (s) => vocabIndex(s).length >= 30 },
    { id: 'words-100', icon: '🚀', name: '百字俱樂部', desc: '累積 100 個單字', check: (s) => vocabIndex(s).length >= 100 },
    { id: 'mastered-20', icon: '💎', name: '深度記憶', desc: '20 個單字達到精熟', check: (s) => vocabIndex(s).filter((v) => SRS.isMastered(v.card)).length >= 20 },
    { id: 'streak-4', icon: '🔥', name: '月月不斷', desc: '週連勝達 4 週', check: (s) => weekStreak(s) >= 4 },
    { id: 'streak-12', icon: '⚡', name: '一季全勤', desc: '週連勝達 12 週', check: (s) => weekStreak(s) >= 12 },
    { id: 'first-review', icon: '🎯', name: '複習初體驗', desc: '完成第一次複習', check: (s) => totalReviews(s) >= 1 },
    { id: 'reviews-300', icon: '💯', name: '複習機器', desc: '累積 300 次複習', check: (s) => totalReviews(s) >= 300 },
    { id: 'inbox-zero', icon: '📭', name: '清空到期', desc: '把到期卡片全部清空', check: (s) => totalReviews(s) >= 10 && dueCards(s).length === 0 },
    { id: 'pron-20', icon: '🗣️', name: '金嗓練成', desc: '完成 20 次發音練習', check: (s) => Object.values(s.pron).reduce((a, p) => a + (p.count || 0), 0) >= 20 },
    { id: 'grammar-tamed', icon: '🪄', name: '馴服文法', desc: '同一錯誤類型連續 3 堂課沒再犯', check: (s) => tamedCategories(s).length > 0 },
    { id: 'night-owl', icon: '🌙', name: '夜貓學者', desc: '在晚上 11 點後複習', check: (s) => !!s.meta.nightOwl },
  ];

  /* ---------- 預設狀態 ---------- */
  function defaults() {
    return {
      lessons: [],        // [{id, date, teacher, vocab:[{word,def}], grammar:[{wrong,correct,cats}], pron:[{word,guide}], feedback}]
      srs: {},            // wordKey -> card
      gsrs: {},           // grammarId -> card(文法卡)
      pron: {},           // pronKey -> {count, last, best}
      meta: {
        xp: 0, ach: [], activity: {},   // 'YYYY-MM-DD' -> {lesson, review, pron}
        reviewLog: [],                   // [{date, total, correct}] 每日彙總
        theme: 'dark', newPerDay: 8, name: '', nightOwl: false, sampleLoaded: false,
      },
    };
  }

  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const s = JSON.parse(raw);
      const d = defaults();
      return { ...d, ...s, meta: { ...d.meta, ...(s.meta || {}) } };
    } catch (e) { console.warn('load failed', e); return defaults(); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  const wordKey = (w) => w.toLowerCase().replace(/[^a-z' -]/g, '').trim();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- 活動 / XP ---------- */
  function bump(type, n = 1) {
    const d = SRS.todayStr();
    const a = state.meta.activity[d] || { lesson: 0, review: 0, pron: 0 };
    a[type] = (a[type] || 0) + n;
    state.meta.activity[d] = a;
  }
  function addXp(n) { state.meta.xp += n; }

  /* ---------- 新增/刪除課程 ---------- */
  function addLesson(date, parsed) {
    const lesson = {
      id: uid(), date, teacher: parsed.teacher || '老師',
      vocab: parsed.vocab.map((v) => ({ word: v.word, def: v.def })),
      grammar: parsed.grammar.map((g) => ({ wrong: g.wrong, correct: g.correct, cats: Grammar.classify(g.wrong, g.correct) })),
      pron: parsed.pron.map((p) => ({ word: p.word, guide: p.guide })),
      feedback: parsed.feedback || '',
    };
    state.lessons.push(lesson);
    state.lessons.sort((a, b) => a.date.localeCompare(b.date));
    // 為新單字/文法建 SRS 卡
    for (const v of lesson.vocab) {
      const k = wordKey(v.word);
      if (k && !state.srs[k]) state.srs[k] = SRS.newCard();
    }
    lesson.grammar.forEach((g, i) => {
      const gid = `${lesson.id}:${i}`;
      if (g.wrong && g.correct) state.gsrs[gid] = SRS.newCard();
    });
    bump('lesson');
    addXp(30);
    const newAch = checkAchievements();
    save();
    return { lesson, newAch };
  }

  function deleteLesson(id) {
    const lesson = state.lessons.find((l) => l.id === id);
    if (!lesson) return;
    state.lessons = state.lessons.filter((l) => l.id !== id);
    Object.keys(state.gsrs).forEach((gid) => { if (gid.startsWith(id + ':')) delete state.gsrs[gid]; });
    // 移除不再被任何課程引用的單字卡
    const alive = new Set();
    state.lessons.forEach((l) => l.vocab.forEach((v) => alive.add(wordKey(v.word))));
    Object.keys(state.srs).forEach((k) => { if (!alive.has(k)) delete state.srs[k]; });
    save();
  }

  /* ---------- 衍生:單字索引 ---------- */
  /** [{key, word, def, defs[], lessons[{id,date}], card}] 依字母排序前的原始列表 */
  function vocabIndex(s = state) {
    const map = new Map();
    for (const l of s.lessons) {
      for (const v of l.vocab) {
        const k = wordKey(v.word);
        if (!k) continue;
        if (!map.has(k)) map.set(k, { key: k, word: v.word, defs: [], lessons: [] });
        const e = map.get(k);
        if (v.def && !e.defs.includes(v.def)) e.defs.push(v.def);
        e.lessons.push({ id: l.id, date: l.date });
      }
    }
    return [...map.values()].map((e) => ({ ...e, def: e.defs.join('; '), card: s.srs[e.key] || SRS.newCard() }));
  }

  /** 文法卡索引 [{gid, lesson, item, card}] */
  function grammarIndex(s = state) {
    const out = [];
    for (const l of s.lessons) {
      l.grammar.forEach((g, i) => {
        const gid = `${l.id}:${i}`;
        if (g.wrong && g.correct) out.push({ gid, lesson: l, item: g, card: s.gsrs[gid] || SRS.newCard() });
      });
    }
    return out;
  }

  function pronIndex(s = state) {
    const map = new Map();
    for (const l of s.lessons) {
      for (const p of l.pron) {
        const k = wordKey(p.word);
        if (!k) continue;
        if (!map.has(k)) map.set(k, { key: k, word: p.word, guide: p.guide, lessons: [] });
        map.get(k).lessons.push({ id: l.id, date: l.date });
      }
    }
    return [...map.values()].map((e) => ({ ...e, practice: s.pron[e.key] || { count: 0 } }));
  }

  /* ---------- 複習佇列 ---------- */
  function dueCards(s = state) {
    const today = SRS.todayStr();
    const vocab = vocabIndex(s).filter((v) => v.card.state !== 'new' && v.card.due <= today)
      .map((v) => ({ type: 'vocab', ...v }));
    const newOnes = vocabIndex(s).filter((v) => v.card.state === 'new')
      .slice(0, s.meta.newPerDay)
      .map((v) => ({ type: 'vocab', ...v }));
    const grammar = grammarIndex(s).filter((g) => g.card.due <= today)
      .map((g) => ({ type: 'grammar', ...g }));
    return [...vocab, ...newOnes, ...grammar];
  }

  function gradeVocab(key, g) {
    state.srs[key] = SRS.grade(state.srs[key] || SRS.newCard(), g);
    logReview(g !== 'again');
  }
  function gradeGrammar(gid, g) {
    state.gsrs[gid] = SRS.grade(state.gsrs[gid] || SRS.newCard(), g);
    logReview(g !== 'again');
  }
  function logReview(correct) {
    const d = SRS.todayStr();
    let entry = state.meta.reviewLog.find((r) => r.date === d);
    if (!entry) { entry = { date: d, total: 0, correct: 0 }; state.meta.reviewLog.push(entry); }
    entry.total += 1;
    if (correct) entry.correct += 1;
    bump('review');
    addXp(correct ? 2 : 1);
    if (new Date().getHours() >= 23) state.meta.nightOwl = true;
    save();
  }
  function totalReviews(s = state) { return s.meta.reviewLog.reduce((a, r) => a + r.total, 0); }

  function logPron(key, matched) {
    const p = state.pron[key] || { count: 0, last: null, best: false };
    p.count += 1;
    p.last = SRS.todayStr();
    if (matched) p.best = true;
    state.pron[key] = p;
    bump('pron');
    addXp(5);
    const newAch = checkAchievements();
    save();
    return newAch;
  }

  /* ---------- 週連勝 ---------- */
  function isoWeek(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = (d.getDay() + 6) % 7;            // Mon=0
    d.setDate(d.getDate() - day + 3);            // 該週四
    const firstThu = new Date(d.getFullYear(), 0, 4);
    const fday = (firstThu.getDay() + 6) % 7;
    firstThu.setDate(firstThu.getDate() - fday + 3);
    const week = 1 + Math.round((d - firstThu) / (7 * 864e5));
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  function weekStreak(s = state) {
    const weeks = new Set(Object.keys(s.meta.activity).map(isoWeek));
    if (!weeks.size) return 0;
    let streak = 0;
    const cursor = new Date();
    // 本週還沒活動不打斷連勝,從上週起算
    if (!weeks.has(isoWeek(cursor.toISOString().slice(0, 10)))) cursor.setDate(cursor.getDate() - 7);
    while (weeks.has(isoWeek(cursor.toISOString().slice(0, 10)))) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    }
    return streak;
  }

  /* ---------- 洞察 ---------- */
  function categoryStats(s = state) {
    const all = {};
    const recent = {};   // 最近 5 堂
    const lessons = s.lessons;
    const recentIds = new Set(lessons.slice(-5).map((l) => l.id));
    for (const l of lessons) {
      for (const g of l.grammar) {
        for (const c of g.cats || []) {
          all[c] = (all[c] || 0) + 1;
          if (recentIds.has(l.id)) recent[c] = (recent[c] || 0) + 1;
        }
      }
    }
    return { all, recent };
  }

  /** 曾經出現、但最近 3 堂課完全沒再犯的錯誤類型 */
  function tamedCategories(s = state) {
    if (s.lessons.length < 4) return [];
    const last3 = new Set(s.lessons.slice(-3).map((l) => l.id));
    const before = {}, recent = {};
    for (const l of s.lessons) {
      for (const g of l.grammar) for (const c of g.cats || []) {
        if (last3.has(l.id)) recent[c] = 1; else before[c] = (before[c] || 0) + 1;
      }
    }
    return Object.keys(before).filter((c) => before[c] >= 2 && !recent[c]);
  }

  function leeches(s = state) {
    return vocabIndex(s).filter((v) => SRS.isLeech(v.card));
  }

  function insights(s = state) {
    const out = [];
    const { all, recent } = categoryStats(s);
    const topRecent = Object.entries(recent).sort((a, b) => b[1] - a[1])[0];
    if (topRecent && topRecent[1] >= 2) {
      const cat = Grammar.CATEGORIES[topRecent[0]];
      out.push({ type: 'warn', icon: cat.icon, title: `最近常犯:${cat.label}`, body: `最近 5 堂課出現 ${topRecent[1]} 次。${cat.tip}`, link: '#/grammar' });
    }
    const tamed = tamedCategories(s);
    if (tamed.length) {
      const names = tamed.map((c) => Grammar.CATEGORIES[c].label).join('、');
      out.push({ type: 'good', icon: '🎉', title: `已馴服:${names}`, body: '這些錯誤最近 3 堂課都沒再出現,繼續保持!' });
    }
    const lc = leeches(s);
    if (lc.length) {
      out.push({ type: 'warn', icon: '🩹', title: `${lc.length} 個吃力單字`, body: `「${lc.slice(0, 3).map((v) => v.word).join('、')}」反覆忘記 — 試著造一個自己的句子,或在下堂課刻意用它。`, link: '#/vocab?f=leech' });
    }
    const overdue = vocabIndex(s).filter((v) => v.card.state !== 'new' && v.card.due < SRS.todayStr()).length;
    if (overdue >= 10) {
      out.push({ type: 'info', icon: '⏳', title: `${overdue} 張卡片已過期`, body: '累積太多會更難追,建議今天先清 15 張。', link: '#/review' });
    }
    // 字彙成長比較
    const thisMonth = SRS.todayStr().slice(0, 7);
    const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);
    const cntIn = (m) => s.lessons.filter((l) => l.date.startsWith(m)).reduce((a, l) => a + l.vocab.length, 0);
    const [tm, lm] = [cntIn(thisMonth), cntIn(lastMonth)];
    if (tm > lm && lm > 0) {
      out.push({ type: 'good', icon: '📈', title: '字彙吸收加速中', body: `這個月已學 ${tm} 個新單字,超越上個月的 ${lm} 個。` });
    }
    return out;
  }

  /* ---------- 成就檢查 ---------- */
  function checkAchievements() {
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (!state.meta.ach.includes(a.id) && a.check(state)) {
        state.meta.ach.push(a.id);
        addXp(50);
        newly.push(a);
      }
    }
    return newly;
  }

  /* ---------- 匯出 / 匯入 ---------- */
  function exportJson() { return JSON.stringify(state, null, 2); }
  function importJson(text) {
    const s = JSON.parse(text);
    if (!Array.isArray(s.lessons)) throw new Error('格式不正確:缺少 lessons');
    const d = defaults();
    state = { ...d, ...s, meta: { ...d.meta, ...(s.meta || {}) } };
    save();
  }
  function reset() { state = defaults(); save(); }

  /* ---------- 範例資料 ---------- */
  function loadSample() {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    const SAMPLE = [
      [49, 'Teacher Mae', [
        ['commute', 'to travel regularly between work and home'],
        ['hectic', 'very busy and full of activity'],
        ['wind down', 'to relax after a period of stress'],
      ], [
        ['I go to office by MRT everyday.', 'I go to the office by MRT every day.'],
        ['Yesterday I very tired.', 'Yesterday I was very tired.'],
      ], [['colleague', 'KOL-eeg'], ['comfortable', 'KUMF-tuh-bul']],
      'Great first impressions! You communicate your ideas clearly. Focus on using past tense consistently when telling stories about your day. Keep it up!'],
      [42, 'Teacher Mae', [
        ['deadline', 'the latest time by which something must be done'],
        ['negotiate', 'to discuss in order to reach an agreement'],
        ['workload', 'the amount of work a person has to do'],
        ['burnout', 'extreme tiredness from too much work'],
      ], [
        ['My boss give me too many works.', 'My boss gives me too much work.'],
        ['I am agree with your opinion.', 'I agree with your opinion.'],
      ], [['negotiate', 'nih-GOH-shee-ayt']],
      'You expressed your opinions about work-life balance very well today. Watch out for subject-verb agreement — remember "he/she gives", not "give". Your vocabulary is growing!'],
      [35, 'Teacher Joy', [
        ['itinerary', 'a planned route of a journey'],
        ['breathtaking', 'extremely beautiful or amazing'],
        ['off the beaten track', 'a place where few people go'],
      ], [
        ['I have went to Japan three times.', 'I have been to Japan three times.'],
        ['The view is very beautiful that I take many photos.', 'The view was so beautiful that I took many photos.'],
      ], [['itinerary', 'eye-TIN-er-air-ee']],
      'I enjoyed hearing about your travel experiences! Be careful with present perfect — "have been" for places you visited. Your storytelling is becoming more natural.'],
      [28, 'Teacher Mae', [
        ['nutritious', 'containing substances that help you stay healthy'],
        ['craving', 'a strong desire for a particular food'],
        ['portion', 'the amount of food served to one person'],
      ], [
        ['I eat less rices for my diet.', 'I eat less rice for my diet.'],
        ['She suggest me to exercise more.', 'She suggested that I exercise more.'],
      ], [['vegetable', 'VEJ-tuh-bul'], ['restaurant', 'RES-tuh-rahnt']],
      'Nice discussion about healthy eating habits! Remember that "rice" is uncountable. Also review how to use "suggest" — we say "suggest that someone do something".'],
      [14, 'Teacher Joy', [
        ['inevitable', 'certain to happen and impossible to avoid'],
        ['adapt', 'to change in order to suit a new situation'],
        ['remote work', 'working from home using the internet'],
      ], [
        ['AI will replace many job in the future.', 'AI will replace many jobs in the future.'],
        ['I am working in this company since 2018.', 'I have been working at this company since 2018.'],
      ], [['inevitable', 'in-EV-ih-tuh-bul']],
      'Excellent debate about technology today — you defended your points confidently! Watch plural nouns ("many jobs") and remember present perfect continuous for ongoing situations.'],
      [7, 'Teacher Mae', [
        ['milestone', 'an important event in the progress of something'],
        ['look back on', 'to think about something in the past'],
        ['proficiency', 'a high degree of skill in something'],
      ], [
        ['I am studying English since three months.', 'I have been studying English for three months.'],
        ['My pronunciation become more better.', 'My pronunciation has become much better.'],
      ], [['proficiency', 'pruh-FISH-en-see']],
      'Three months of classes — congratulations on this milestone! Your fluency has improved noticeably. Next, let\'s work on comparatives: "much better", never "more better". Proud of your progress!'],
    ];
    for (const [ago, teacher, vocab, grammar, pron, feedback] of SAMPLE) {
      addLesson(day(ago), {
        teacher,
        vocab: vocab.map(([word, def]) => ({ word, def })),
        grammar: grammar.map(([wrong, correct]) => ({ wrong, correct })),
        pron: pron.map(([word, guide]) => ({ word, guide })),
        feedback,
      });
    }
    // 模擬部分複習歷史,讓圖表有內容
    const words = Object.keys(state.srs);
    words.slice(0, 12).forEach((k, i) => {
      let c = state.srs[k];
      c = SRS.grade(c, 'good'); c = SRS.grade(c, i % 4 === 0 ? 'again' : 'good');
      if (i % 3 === 0) c = SRS.grade(c, 'good');
      state.srs[k] = c;
    });
    [40, 33, 26, 19, 12, 5, 2].forEach((ago, i) => {
      const d = day(ago);
      state.meta.reviewLog.push({ date: d, total: 10 + i * 2, correct: 7 + i * 2 });
      state.meta.activity[d] = { ...(state.meta.activity[d] || {}), review: 10 + i * 2 };
    });
    state.meta.sampleLoaded = true;
    checkAchievements();
    save();
  }

  return {
    get state() { return state; },
    save, wordKey, levelInfo, ACHIEVEMENTS,
    addLesson, deleteLesson,
    vocabIndex, grammarIndex, pronIndex,
    dueCards, gradeVocab, gradeGrammar, logPron, totalReviews,
    weekStreak, categoryStats, insights, leeches, checkAchievements,
    exportJson, importJson, reset, loadSample,
  };
})();
