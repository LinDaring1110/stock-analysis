/* =========================================================================
 * 股票利好分析 · 静态版（无后端、无动态刷新）
 *   - 双板块（上证主板 / 科创板）：渲染内嵌算法快照 window.SNAPSHOT
 *   - 市场指数：渲染静态快照 window.STATIC_INDICES
 *   - 小苏预测板块：渲染 window.PREDICTION（predict.py 基于 data/.py 算法生成）
 * 全部为静态展示，去除刷新按钮与实时拉取逻辑。
 * ========================================================================= */

const CONFIG = {
  boards: [
    { key: 'sh_main', name: '上证主板' },
    { key: 'star',    name: '科创板'   }
  ]
};

const $ = sel => document.querySelector(sel);

/* 双板块信号分级（沿用原版） */
function signalOf(total) {
  if (total >= 75) return { cls: 'sig-strong', text: '强烈利好' };
  if (total >= 60) return { cls: 'sig-bull',   text: '利好' };
  if (total >= 45) return { cls: 'sig-neutral',text: '中性偏多' };
  return { cls: 'sig-weak', text: '观望' };
}

/* 预测板块信号（使用预生成文字） */
function predictSignalClass(text) {
  if (text === '强烈利好') return 'sig-strong';
  if (text === '利好')     return 'sig-bull';
  if (text === '中性偏多') return 'sig-neutral';
  return 'sig-weak';
}

/* 指数 */
function renderIndices(indices) {
  const el = $('#indexGrid'); el.innerHTML = '';
  (indices || []).forEach(i => {
    const up = (i.changePct != null && i.changePct >= 0);
    el.innerHTML += `<div class="index-card">
      <div class="idx-name">${i.name}</div>
      <div class="idx-price ${up ? 'up' : 'down'}">${i.price != null ? i.price.toFixed(2) : '—'}</div>
      <div class="idx-chg ${up ? 'up' : 'down'}">${i.changePct != null ? (up ? '+' : '') + i.changePct.toFixed(2) + '%' : '—'}</div>
    </div>`;
  });
}

/* 双板块（沿用原版 stock-row 布局） */
function renderBoard(key, board) {
  const el = $('#table-' + key);
  $('#count-' + key).textContent = (board.items ? board.items.length : 0) + ' 只';
  el.innerHTML = '';
  (board.items || []).forEach(s => {
    const up = (s.changePct != null && s.changePct >= 0);
    const sig = signalOf(s.score.total);
    el.innerHTML += `<div class="stock-row">
      <div class="rank">${s.rank}</div>
      <div class="nm"><div class="name">${s.name}</div><div class="code">${s.code}</div></div>
      <div class="metrics">
        <div class="price ${up ? 'up' : 'down'}">${s.price != null ? s.price.toFixed(2) : '—'}</div>
        <div class="chg ${up ? 'up' : 'down'}">${s.changePct != null ? (up ? '+' : '') + s.changePct.toFixed(2) + '%' : '—'}</div>
        <div class="score-wrap">
          <div class="score-bar"><div class="score-fill" style="width:${Math.min(100, s.score.total)}%"></div></div>
          <span class="score-num">${s.score.total}</span>
        </div>
      </div>
      <span class="signal ${sig.cls}">${sig.text}</span>
    </div>`;
  });
}

/* 资讯（由板块快照数据派生） */
function deriveNews(boards) {
  const items = [];
  Object.values(boards || {}).forEach(b => {
    (b.items || []).slice(0, 6).forEach(s => {
      items.push({
        title: `${s.name}(${s.code}) 今日${s.changePct >= 0 ? '走强' : '走弱'}，涨跌幅 ${s.changePct >= 0 ? '+' : ''}${s.changePct}%`,
        time: '', codes: [s.code], category: b.name + '·异动', source: '算法快照衍生'
      });
    });
  });
  return items;
}
function renderNews(news) {
  const el = $('#newsList'); el.innerHTML = '';
  (news || []).forEach(n => {
    const codes = (n.codes || []).map(c => '〈' + c + '〉').join(' ');
    el.innerHTML += `<div class="news-item">
      <div class="news-meta">
        <span class="news-cat">${n.category || '资讯'}</span>
        <span>${n.time || '静态'}</span>
        <span>${n.source || ''}</span>
      </div>
      <div class="news-title">${n.title}</div>
      ${codes ? `<div class="news-codes">${codes}</div>` : ''}
    </div>`;
  });
}

function renderTimestamp(iso) {
  if (!iso) { $('#updatedAt').textContent = ''; return; }
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  const str = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  $('#updatedAt').textContent = '数据日期 ' + str;
}

function renderWarns(warns) {
  const el = $('#warnBanner');
  if (warns && warns.length) {
    el.textContent = '⚠ ' + warns.join('；');
    el.classList.remove('hidden');
  } else { el.classList.add('hidden'); }
}

/* 指标单元格着色：偏多=红(--up)，偏弱/风险=绿(--down)，中性=常规 */
function indClass(state) {
  if (!state) return '';
  if (/多头|红柱|金叉|强势|流入|上涨|合理/.test(state)) return 'pos';
  if (/弱势|死叉|流出|超买|回踩|风险|绿柱|空头/.test(state)) return 'neg';
  return 'neu';
}

/* 小苏预测板块 */
function renderPrediction(data) {
  const wrap = $('#predCards');
  if (!wrap || !data) return;
  const stocks = data.stocks || [];
  $('#count-predict').textContent = stocks.length + ' 只';
  wrap.innerHTML = '';
  stocks.forEach(s => {
    const up = (s.changePct != null && s.changePct >= 0);
    const sigCls = predictSignalClass(s.signal);
    const ind = s.ind || {};
    const cells = [
      ['MA排列',     ind.maArr || '—',                       ind.maArr],
      ['MA(5/10/20)', `${ind.ma5} / ${ind.ma10} / ${ind.ma20}`, ''],
      ['MACD',       `${ind.macd} · ${ind.macdState || ''}`,  ind.macdState],
      ['KDJ',        `K${ind.k} D${ind.d} J${ind.j}`,        ind.kdjState],
      ['RSI(24)',    `${ind.rsi24} · ${ind.rsiState || ''}`, ind.rsiState],
      ['BIAS(5)',    `${ind.bias5}% · ${ind.biasState || ''}`, ind.biasState],
      ['OBV',        ind.obvState || '—',                    ind.obvState],
      ['近期趋势',    ind.trendState || '—',                  ind.trendState],
    ];
    const indHtml = cells.map(c =>
      `<div class="ind-cell ${indClass(c[2])}"><div class="ind-k">${c[0]}</div><div class="ind-v">${c[1]}</div></div>`
    ).join('');
    wrap.innerHTML += `<div class="pred-card">
      <div class="pred-head">
        <div class="pred-id">
          <div class="pred-name">${s.name}</div>
          <div class="pred-code">${s.code}</div>
        </div>
        <div class="pred-price ${up ? 'up' : 'down'}">${s.price != null ? s.price.toFixed(2) : '—'}<span>${s.changePct != null ? (up ? '+' : '') + s.changePct.toFixed(2) + '%' : ''}</span></div>
        <div class="pred-score">
          <div class="ps-num">${s.score}</div>
          <div class="ps-label">利好评分</div>
        </div>
        <span class="signal ${sigCls}">${s.signal}</span>
      </div>
      <div class="pred-ind">${indHtml}</div>
      <div class="pred-concl">${s.conclusion}</div>
    </div>`;
  });
}

/* 启动（静态渲染） */
function init() {
  const snap = window.SNAPSHOT || {};
  const indices = (window.STATIC_INDICES && window.STATIC_INDICES.length)
    ? window.STATIC_INDICES : (snap.indices || []);

  renderIndices(indices);
  CONFIG.boards.forEach(b => {
    const board = (snap.boards && snap.boards[b.key]) || { items: [] };
    renderBoard(b.key, board);
  });
  renderNews(deriveNews(snap.boards));
  renderTimestamp(snap.updatedAt);
  renderWarns(snap.warns || []);
  $('#source').textContent = '双板块来源：' + (snap.source || '算法快照')
    + '；预测来源：' + ((window.PREDICTION && window.PREDICTION.source) || '');
  renderPrediction(window.PREDICTION);

  // 顶栏状态：静态算法快照
  const flag = $('#liveFlag');
  if (flag) { flag.textContent = '● 静态算法快照'; flag.className = 'snap'; }
}

init();
