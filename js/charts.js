/* ============================================================
   Charts — 輕量 SVG 圖表(零依賴)
   ============================================================ */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  /** 折線圖(含漸層面積)。points: [{x:label, y:number}] */
  function line(points, { height = 180, color = '#6c7bff', color2 = '#2dd4bf', yFmt = (v) => v } = {}) {
    if (!points.length) return '<div class="faint" style="text-align:center;padding:30px 0">尚無資料</div>';
    const W = 600, H = height, padL = 38, padR = 14, padT = 14, padB = 26;
    const ys = points.map((p) => p.y);
    const maxY = Math.max(...ys, 1);
    const minY = 0;
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    const x = (i) => padL + (i / Math.max(points.length - 1, 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB);

    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    const area = `${path} L${x(points.length - 1).toFixed(1)},${H - padB} L${padL},${H - padB} Z`;

    // y 軸格線(4 條)
    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const v = minY + ((maxY - minY) * i) / 3;
      const yy = y(v).toFixed(1);
      grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="currentColor" stroke-opacity="0.08"/>
        <text x="${padL - 7}" y="${+yy + 4}" font-size="10" fill="currentColor" fill-opacity="0.45" text-anchor="end">${yFmt(Math.round(v))}</text>`;
    }
    // x 標籤(最多 6 個)
    const step = Math.max(1, Math.ceil(points.length / 6));
    let xlabels = '';
    points.forEach((p, i) => {
      if (i % step === 0 || i === points.length - 1) {
        xlabels += `<text x="${x(i).toFixed(1)}" y="${H - 8}" font-size="10" fill="currentColor" fill-opacity="0.45" text-anchor="middle">${p.x}</text>`;
      }
    });
    const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3" fill="${color2}"/>`).join('');

    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      ${dots}${xlabels}
    </svg>`;
  }

  /** 水平長條。items: [{label, value, color?, suffix?}] */
  function hbars(items, { max = null } = {}) {
    if (!items.length) return '<div class="faint" style="text-align:center;padding:20px 0">尚無資料</div>';
    const m = max || Math.max(...items.map((i) => i.value), 1);
    return items.map((it) => `
      <div class="hbar-row">
        <span class="lbl">${it.label}</span>
        <div class="hbar-track"><div class="hbar-fill" style="width:${Math.round((it.value / m) * 100)}%;background:${it.color || 'var(--accent)'}"></div></div>
        <span class="hbar-val">${it.value}${it.suffix || ''}</span>
      </div>`).join('');
  }

  /** GitHub 式活動熱力圖。activity: {'YYYY-MM-DD': {lesson,review,pron}} */
  function heatmap(activity, weeks = 18) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (weeks * 7 - 1) - ((today.getDay() + 6) % 7)); // 對齊週一
    let cols = '';
    const cursor = new Date(start);
    for (let w = 0; w < weeks + 1; w++) {
      let cells = '';
      for (let d = 0; d < 7; d++) {
        if (cursor > today) break;
        const key = cursor.toISOString().slice(0, 10);
        const a = activity[key];
        const score = a ? (a.lesson || 0) * 5 + (a.review || 0) * 0.4 + (a.pron || 0) : 0;
        const lvl = score === 0 ? 0 : score < 3 ? 1 : score < 6 ? 2 : score < 12 ? 3 : 4;
        const label = a ? `${key}:${a.lesson ? ` 上課×${a.lesson}` : ''}${a.review ? ` 複習×${a.review}` : ''}${a.pron ? ` 發音×${a.pron}` : ''}` : key;
        cells += `<div class="cell${lvl ? ' l' + lvl : ''}" title="${label}"></div>`;
        cursor.setDate(cursor.getDate() + 1);
      }
      cols += `<div class="col">${cells}</div>`;
    }
    return `<div class="heatmap">${cols}</div>
      <div class="heat-legend">少 <div class="cell" style="background:var(--heat-0)"></div><div class="cell l1"></div><div class="cell l2"></div><div class="cell l3"></div><div class="cell l4"></div> 多</div>`;
  }

  return { line, hbars, heatmap };
})();
