/* =========================================================================
 * 股票利好分析 · 静态版（无后端）
 * 数据：浏览器通过 JSONP 直接拉取东方财富（push2 / np-anotice）
 * 存储：localStorage（刷新时整体覆盖）
 * 部署：推到 GitHub 后开启 Pages 即可公网访问
 * ========================================================================= */

const CONFIG = {
  BOARD_SIZE: 20,
  STORAGE_KEY: 'stock_analysis_cache_v1',
  boards: [
    { key: 'sh_main', name: '上证主板', fs: 'm:1+t:2' },
    { key: 'star',    name: '科创板',   fs: 'm:1+t:23' }
  ],
  indices: [
    { name: '上证指数', secid: '1.000001' },
    { name: '沪深300',  secid: '1.000300' },
    { name: '深证成指', secid: '0.399001' },
    { name: '创业板指', secid: '0.399006' },
    { name: '科创50',   secid: '1.000688' }
  ]
};

const EM_FIELDS = 'f12,f14,f2,f3,f62,f184,f9,f20,f23';

/* ---------------------- 工具 ---------------------- */
const $ = sel => document.querySelector(sel);
const num = v => { if (v == null) return null; const n = parseFloat(v); return isNaN(n) ? null : n; };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mapRange = (x, a, b, c, d) => c + (clamp(x, a, b) - a) * (d - c) / (b - a);

/* JSONP：从浏览器直接请求东方财富（HTTPS，避免 GitHub Pages 混合内容拦截） */
function jsonp(url, timeout = 9000) {
  return new Promise((resolve, reject) => {
    const name = 'jp_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    const script = document.createElement('script');
    let done = false;
    const cleanup = () => { delete window[name]; if (script.parentNode) script.parentNode.removeChild(script); };
    window[name] = data => { if (done) return; done = true; cleanup(); resolve(data); };
    script.onerror = () => { if (done) return; done = true; cleanup(); reject(new Error('JSONP 请求失败')); };
    const sep = url.includes('?') ? '&' : '?';
    script.src = url + sep + 'cb=' + name + '&_=' + Date.now();
    document.body.appendChild(script);
    setTimeout(() => { if (!done) { done = true; cleanup(); reject(new Error('JSONP 超时')); } }, timeout);
  });
}

/* ---------------------- 数据拉取 ---------------------- */
async function fetchBoard(fsCode) {
  const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=2000&po=1&np=1&fltt=2&invt=2&fid=f3'
    + '&fs=' + encodeURIComponent(fsCode) + '&fields=' + EM_FIELDS;
  const j = await jsonp(url);
  const diff = (j.data && j.data.diff) || [];
  return diff.map(d => ({
    code: d.f12, name: d.f14,
    price: num(d.f2), changePct: num(d.f3),
    mainNetIn: num(d.f62), turnover: num(d.f184),
    pe: num(d.f9), mktCap: num(d.f20)
  }));
}

async function fetchIndices() {
  const ids = CONFIG.indices.map(i => i.secid).join(',');
  const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f14,f2,f3,f124&secids='
    + encodeURIComponent(ids);
  const j = await jsonp(url);
  const diff = (j.data && j.data.diff) || [];
  return diff.map(d => ({ code: d.f12, name: d.f14, price: num(d.f2), changePct: num(d.f3) }));
}

async function fetchNews() {
  const url = 'https://np-anotice-stock.eastmoney.com/api/security/announcement/getAnnouncementList'
    + '?page_size=40&client_source=web&stock_list=&notice_type=';
  try {
    const j = await jsonp(url);
    const list = (j.data && j.data.list) || [];
    if (!list.length) return null;
    return list.map(n => ({
      title: n.title,
      time: n.ei_time ? String(n.ei_time) : (n.time ? String(n.time) : ''),
      codes: (n.codes || []).map(c => c.split(',')[0]).filter(Boolean),
      category: n.columns || n.notice_type_name || '公告',
      source: '东方财富公告'
    }));
  } catch (e) { return null; }
}

/* ---------------------- 评分（与后端一致） ---------------------- */
function scoreStock(s) {
  const hasMain = (s.mainNetIn != null && s.mktCap);
  let momentumW, mainW, turnW, peW;
  if (hasMain) { momentumW = 42; mainW = 30; turnW = 16; peW = 12; }
  else { momentumW = 58; mainW = 0; turnW = 24; peW = 18; }

  const momentum = mapRange(s.changePct, -3, 9, 0, momentumW);
  let main = 0;
  if (hasMain) {
    const ratio = s.mainNetIn / s.mktCap * 100;
    main = mapRange(ratio, -0.5, 1.5, 0, mainW);
  }
  let turn = 0;
  if (s.turnover != null) {
    if (s.turnover >= 1.5 && s.turnover <= 8) turn = (peW === 12 ? 16 : 24);
    else if (s.turnover > 0.5) turn = (peW === 12 ? 16 : 24) * 0.6;
  }
  let pe = 0;
  if (s.pe != null && s.pe > 0) {
    if (s.pe >= 10 && s.pe <= 60) pe = (peW === 12 ? 12 : 18);
    else if (s.pe <= 120) pe = (peW === 12 ? 12 : 18) * 0.55;
  }
  const score = Math.round(momentum + main + turn + pe);
  return { momentum: +momentum.toFixed(1), main: +main.toFixed(1), turnover: +turn.toFixed(1), pe: +pe.toFixed(1), total: score };
}

function rankBoard(items) {
  return items
    .filter(s => s.price != null && s.changePct != null)
    .map(s => ({ ...s, score: scoreStock(s) }))
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, CONFIG.BOARD_SIZE)
    .map((s, i) => ({ rank: i + 1, ...s }));
}

function deriveNews(boards) {
  const items = [];
  Object.values(boards).forEach(b => {
    b.items.slice(0, 6).forEach(s => {
      items.push({
        title: `${s.name}(${s.code}) 今日${s.changePct >= 0 ? '走强' : '走弱'}，涨跌幅 ${s.changePct >= 0 ? '+' : ''}${s.changePct}%`,
        time: '', codes: [s.code], category: b.name + '·异动', source: '实时行情衍生'
      });
    });
  });
  return items;
}

function signalOf(total) {
  if (total >= 75) return { cls: 'sig-strong', text: '强烈利好' };
  if (total >= 60) return { cls: 'sig-bull',   text: '利好' };
  if (total >= 45) return { cls: 'sig-neutral',text: '中性偏多' };
  return { cls: 'sig-weak', text: '观望' };
}

/* ---------------------- 汇总 ---------------------- */
async function gather() {
  const warns = [];
  let shMain = [], star = [], indices = [], news = null;
  try { shMain = await fetchBoard('m:1+t:2'); } catch (e) { warns.push('上证主板行情获取失败'); }
  try { star = await fetchBoard('m:1+t:23'); } catch (e) { warns.push('科创板行情获取失败'); }
  try { indices = await fetchIndices(); } catch (e) { warns.push('指数快照获取失败'); }
  try { news = await fetchNews(); } catch (e) { warns.push('公告获取失败'); }

  const boards = {
    sh_main: { key: 'sh_main', name: '上证主板', items: rankBoard(shMain) },
    star: { key: 'star', name: '科创板', items: rankBoard(star) }
  };
  if (!news || !news.length) news = deriveNews(boards);

  return {
    updatedAt: new Date().toISOString(),
    source: '东方财富（浏览器实时 JSONP 获取）',
    live: true,
    warns, indices, boards, news
  };
}

/* ---------------------- 本地存储（刷新覆盖） ---------------------- */
function loadCache() {
  try { return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)); } catch (e) { return null; }
}
function saveCache(data) {
  try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

/* ---------------------- 渲染 ---------------------- */
function renderIndices(indices) {
  const el = $('#indexGrid');
  el.innerHTML = '';
  indices.forEach(i => {
    const up = (i.changePct != null && i.changePct >= 0);
    el.innerHTML += `<div class="index-card">
      <div class="idx-name">${i.name}</div>
      <div class="idx-price ${up ? 'up' : 'down'}">${i.price != null ? i.price.toFixed(2) : '—'}</div>
      <div class="idx-chg ${up ? 'up' : 'down'}">${i.changePct != null ? (up ? '+' : '') + i.changePct.toFixed(2) + '%' : '—'}</div>
    </div>`;
  });
}

function renderBoard(key, board) {
  const el = $('#table-' + key);
  $('#count-' + key).textContent = board.items.length + ' 只';
  el.innerHTML = '';
  board.items.forEach(s => {
    const up = (s.changePct != null && s.changePct >= 0);
    const sig = signalOf(s.score.total);
    el.innerHTML += `<div class="stock-row">
      <div class="rank">${s.rank}</div>
      <div><div class="name">${s.name}</div><div class="code">${s.code}</div></div>
      <div class="price ${up ? 'up' : 'down'}">${s.price != null ? s.price.toFixed(2) : '—'}</div>
      <div class="chg ${up ? 'up' : 'down'}">${s.changePct != null ? (up ? '+' : '') + s.changePct.toFixed(2) + '%' : '—'}</div>
      <div class="score-wrap">
        <div class="score-bar"><div class="score-fill" style="width:${Math.min(100, s.score.total)}%"></div></div>
        <span class="score-num">${s.score.total}</span>
        <span class="signal ${sig.cls}">${sig.text}</span>
      </div>
    </div>`;
  });
}

function renderNews(news) {
  const el = $('#newsList');
  el.innerHTML = '';
  news.forEach(n => {
    const codes = (n.codes || []).map(c => '〈' + c + '〉').join(' ');
    el.innerHTML += `<div class="news-item">
      <div class="news-meta">
        <span class="news-cat">${n.category || '资讯'}</span>
        <span>${n.time || '实时'}</span>
        <span>${n.source || ''}</span>
      </div>
      <div class="news-title">${n.title}</div>
      ${codes ? `<div class="news-codes">${codes}</div>` : ''}
    </div>`;
  });
}

function renderTimestamp(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  const str = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $('#updatedAt').textContent = '更新于 ' + str;
}

function renderWarns(warns) {
  const el = $('#warnBanner');
  if (warns && warns.length) {
    el.textContent = '⚠ ' + warns.join('；');
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function renderAll(data) {
  renderIndices(data.indices);
  renderBoard('sh_main', data.boards.sh_main);
  renderBoard('star', data.boards.star);
  renderNews(data.news);
  renderTimestamp(data.updatedAt);
  renderWarns(data.warns);
  $('#source').textContent = '数据来源：' + (data.source || '—');
}

/* ---------------------- 刷新（重新拉取 + 覆盖） ---------------------- */
async function refresh() {
  const btn = $('#refreshBtn');
  btn.disabled = true; btn.textContent = '⟳ 拉取中…';
  try {
    const data = await gather();
    saveCache(data);          // 覆盖本地存储
    renderAll(data);
  } catch (e) {
    alert('实时数据拉取失败：' + e.message + '\n请检查网络或东方财富接口可达性。');
  } finally {
    btn.disabled = false; btn.textContent = '⟳ 刷新实时数据';
  }
}

/* ---------------------- 启动 ---------------------- */
async function init() {
  // 先展示本地缓存（若有），再后台刷新到最新
  const cached = loadCache();
  if (cached) renderAll(cached);
  await refresh();
  $('#refreshBtn').addEventListener('click', refresh);
}

init();
