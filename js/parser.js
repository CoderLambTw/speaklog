/* ============================================================
   Parser — 解析 Winning Plus 老師的課後筆記
   格式:
     老師名字
     [A.] CORRECTIONS:
     🛑 Vocabulary
     🟢 word – definition
     🛑 Grammar / Suggested Sentences;
     ❌ wrong sentence
     ✔️ correct sentence
     📣 Pronunciation
     📣 word — "phonetic guide"
     [B.] Feedback:
     ...
   解析採寬鬆策略:容忍 emoji 變體、不同的破折號、缺漏區塊。
   ============================================================ */
const Parser = (() => {
  const DASH_SPLIT = /\s+[–—-]+\s+|\s*[–—]\s*/; // en/em dash anywhere, hyphen needs spaces
  const VOCAB_MARK = /^[\s]*(?:🟢|🔵|🟡|•|\*|✅)\s*/;
  const WRONG_MARK = /^[\s]*(?:❌|✗|✘|🚫|×)\s*/;
  const RIGHT_MARK = /^[\s]*(?:✔️|✔|✓|✅|⭕)\s*/;
  const PRON_MARK = /^[\s]*(?:📣|🔊|🗣️|🔉)\s*/;

  function detectSection(line) {
    const s = line.toLowerCase();
    if (/vocabular|new words?\b/.test(s)) return 'vocab';
    if (/grammar|suggested sentence|sentence correction/.test(s)) return 'grammar';
    if (/pronunciation|pronounciation/.test(s)) return 'pron';
    if (/^\s*\[?\s*b\s*\.?\s*\]|feedback/.test(s)) return 'feedback';
    if (/^\s*\[?\s*a\s*\.?\s*\]|corrections?\s*:?\s*$/.test(s)) return 'corrections';
    return null;
  }

  function splitDef(raw) {
    // "word – definition"  |  "word - definition"  |  "word: definition"
    let m = raw.split(DASH_SPLIT);
    if (m.length >= 2) return [m[0].trim(), m.slice(1).join(' — ').trim()];
    m = raw.split(/\s*[:：]\s+/);
    if (m.length >= 2) return [m[0].trim(), m.slice(1).join(': ').trim()];
    return [raw.trim(), ''];
  }

  function cleanQuotes(s) {
    return s.replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '');
  }

  function parse(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const out = { teacher: '', vocab: [], grammar: [], pron: [], feedback: '', warnings: [] };
    let section = null;
    let started = false;          // 是否已遇到任何區塊標題
    let pendingWrong = null;
    const feedbackLines = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { if (section === 'feedback') feedbackLines.push(''); continue; }

      const sec = detectSection(line);
      // 區塊標題行(不含實際內容的行才算標題)
      const isHeader = sec && (
        sec === 'feedback' || sec === 'corrections' ||
        (sec === 'vocab' && !VOCAB_MARK.test(line)) ||
        (sec === 'grammar' && !WRONG_MARK.test(line) && !RIGHT_MARK.test(line)) ||
        (sec === 'pron' && /pronunciation|pronounciation/i.test(line))
      );
      if (isHeader) {
        if (sec !== 'corrections') section = sec;
        started = true;
        continue;
      }

      // 老師名字:第一個非空白、非標題的行
      if (!started && !out.teacher) {
        out.teacher = line.replace(/^teacher\s*[:：]?\s*/i, '').replace(/[:：]\s*$/, '').trim() || line;
        started = true; // 名字之後若直接出現項目也能處理
        continue;
      }

      if (section === 'feedback') { feedbackLines.push(rawLine.trimEnd()); continue; }

      if (WRONG_MARK.test(line)) {
        if (pendingWrong) out.warnings.push(`「${pendingWrong}」沒有對應的 ✔️ 修正句`);
        pendingWrong = line.replace(WRONG_MARK, '').trim();
        section = section || 'grammar';
        continue;
      }
      if (RIGHT_MARK.test(line)) {
        const correct = line.replace(RIGHT_MARK, '').trim();
        if (pendingWrong) {
          out.grammar.push({ wrong: pendingWrong, correct });
          pendingWrong = null;
        } else {
          out.grammar.push({ wrong: '', correct });
          out.warnings.push(`「${correct}」沒有對應的 ❌ 原句`);
        }
        continue;
      }
      if (PRON_MARK.test(line) && section === 'pron') {
        const body = line.replace(PRON_MARK, '').trim();
        const [word, guide] = splitDef(body);
        if (word) out.pron.push({ word: cleanQuotes(word), guide: cleanQuotes(guide) });
        continue;
      }
      if (VOCAB_MARK.test(line)) {
        const body = line.replace(VOCAB_MARK, '').trim();
        const [word, def] = splitDef(body);
        if (word) {
          out.vocab.push({ word: word.trim(), def: def.trim() });
          if (!def) out.warnings.push(`單字「${word}」缺少定義`);
        }
        section = section || 'vocab';
        continue;
      }

      // 無標記的行:依目前區塊歸類
      if (section === 'vocab') {
        const [word, def] = splitDef(line);
        if (def) out.vocab.push({ word, def });
      } else if (section === 'pron') {
        const [word, guide] = splitDef(line);
        if (word) out.pron.push({ word: cleanQuotes(word), guide: cleanQuotes(guide) });
      }
      // 其他散落行忽略
    }

    if (pendingWrong) out.warnings.push(`「${pendingWrong}」沒有對應的 ✔️ 修正句`);
    out.feedback = feedbackLines.join('\n').trim();

    if (!out.vocab.length && !out.grammar.length && !out.pron.length && !out.feedback) {
      out.warnings.push('沒有解析到任何內容 — 請確認貼上的是完整的老師筆記');
    }
    return out;
  }

  return { parse };
})();
if (typeof module !== 'undefined') module.exports = Parser;
