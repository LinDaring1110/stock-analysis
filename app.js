/* =========================================================================
 * 股票利好分析 · 静态版（无后端，但采用「存储即真相」架构）
 *
 * 数据流（用户期望的模式）：
 *   1) 启动时：先把【已存储的数据】渲染到界面（来自 localStorage，
 *      首次无缓存则用内嵌算法快照 snapshot.js 兜底）——界面永远不空白。
 *   2) 点击「刷新」：后台去拉取最新实时数据；在拉取过程中，界面继续
 *      显示【刷新前的旧数据】，不闪烁、不留白。
 *   3) 拉取成功且数据有效 → 用最新数据【覆盖存储】→ 界面渲染新数据。
 *   4) 拉取失败 / 超时 / 返回空 → 【保留旧存储】，界面继续显示旧数据，
 *      并提示「已继续显示上次数据」，绝不出现没有数据的情况。
 *
 * 数据：浏览器通过 JSONP 直接拉取东方财富（push2 / np-anotice）
 * 存储：localStorage（仅当拿到有效数据时才覆盖写入）
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

/* 带重试的 JSONP 调用：东方财富对连续请求会限流，失败时等 1.5s 再试一次 */
async function fetchRetry(fn, retries = 1, delay = 1500) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; if (i < retries) await new Promise(r => setTimeout(r, delay)); }
  }
  throw lastErr;
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
  try { shMain = await fetchRetry(() => fetchBoard('m:1+t:2')); } catch (e) { warns.push('上证主板行情获取失败（已重试）'); }
  try { star = await fetchRetry(() => fetchBoard('m:1+t:23')); } catch (e) { warns.push('科创板行情获取失败（已重试）'); }
  try { indices = await fetchRetry(() => fetchIndices()); } catch (e) { warns.push('指数快照获取失败（已重试）'); }
  try { news = await fetchRetry(() => fetchNews()); } catch (e) { warns.push('公告获取失败（已重试）'); }

  const boards = {
    sh_main: { key: 'sh_main', name: '上证主板', items: rankBoard(shMain) },
    star: { key: 'star', name: '科创板', items: rankBoard(star) }
  };

  // 板块级兜底：实时拉取为空时，优先回退到【本地活快照】（最近一次成功刷新写入的数据），
  // 没有本地快照时才用内嵌算法快照兜底，保证永不空白
  const cache = loadCache();
  const fb = (cache && cache.boards) ? cache : (window.SNAPSHOT || null);
  let usedFallback = false;
  if (fb && fb.boards) {
    if (boards.sh_main.items.length === 0 && fb.boards.sh_main) {
      boards.sh_main = fb.boards.sh_main;
      usedFallback = true;
      warns.push('上证主板实时获取失败，已显示已存储快照');
    }
    if (boards.star.items.length === 0 && fb.boards.star) {
      boards.star = fb.boards.star;
      usedFallback = true;
      warns.push('科创板实时获取失败，已显示已存储快照');
    }
  }

  if (!news || !news.length) news = deriveNews(boards);

  const usedSnap = boards.sh_main.items.length && boards.sh_main.items[0].source === 'algorithm';
  return {
    updatedAt: new Date().toISOString(),
    source: warns.length ? '东方财富实时（部分显示已存储数据）' : '东方财富（浏览器实时 JSONP 获取）',
    live: !usedSnap && !usedFallback,
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

/* ---------------------- 刷新（后台拉取 + 覆盖存储） ----------------------
 * 关键原则（用户要求）：
 *   - 刷新期间界面继续显示【刷新前的旧数据】，不空白；
 *   - 只有拿到「有效数据」（两个板块都有股票）才覆盖 localStorage；
 *   - 拉取失败 / 超时 / 返回空 → 保留旧存储，继续显示旧数据并提示；
 *   - 加冷却时间：频繁点击会触发东方财富限流，15 秒内只许刷新一次。
 * ------------------------------------------------------------------------- */
let lastRefreshAt = 0;
const COOLDOWN_MS = 15000;

async function refresh() {
  const now = Date.now();
  const remain = Math.ceil((COOLDOWN_MS - (now - lastRefreshAt)) / 1000);
  if (now - lastRefreshAt < COOLDOWN_MS) {
    renderWarns(['刷新太频繁，请 ' + remain + ' 秒后再试（避免触发数据源限流）']);
    return;   // 不动存储、不空白，界面保持当前数据
  }
  lastRefreshAt = now;

  const btn = $('#refreshBtn');
  btn.disabled = true; btn.textContent = '⟳ 拉取中…';
  renderLiveFlag('loading');   // 顶部显示「正在获取」，同时旧数据仍留在界面

  try {
    const data = await gather();
    const valid = data.boards.sh_main.items.length > 0 && data.boards.star.items.length > 0;

    if (valid) {
      // ✅ 拿到有效最新数据 → 更新本地快照（覆盖存储）→ 渲染新数据
      saveCache(data);
      renderAll(data);
      renderLiveFlag(data.live);   // data.live=true 表示本批数据全部来自实时拉取
    } else {
      // ⚠️ 实时未拿到有效数据 → 不动存储，继续显示已存的本地快照
      const store = loadCache() || window.SNAPSHOT;
      renderAll(store);
      renderWarns(['实时数据获取不完整，已继续显示已存储快照']);
      renderLiveFlag(false, store && store.updatedAt);
    }
  } catch (e) {
    // ❌ 整段实时拉取异常 → 保留旧存储，继续显示已存的本地快照，绝不空白
    const store = loadCache() || window.SNAPSHOT;
    renderAll(store);
    renderWarns(['实时数据获取失败（' + (e && e.message || '网络异常') + '），已继续显示已存储快照']);
    renderLiveFlag(false, store && store.updatedAt);
  } finally {
    btn.disabled = false; btn.textContent = '⟳ 刷新实时数据';
  }
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function renderLiveFlag(state, snapTs) {
  const el = $('#liveFlag');
  if (state === 'loading') {
    el.textContent = '⟳ 正在获取实时数据…（当前显示已存储快照）';
    el.classList.remove('live', 'snap'); el.classList.add('loading');
  } else if (state === true) {
    el.textContent = '● 浏览器实时 · 本地快照已更新'; el.classList.add('live'); el.classList.remove('snap', 'loading');
  } else {
    let txt = '● 显示已存储快照';
    if (snapTs) txt += '（更新于 ' + fmtTime(snapTs) + '）';
    txt += '（本次实时获取失败）';
    el.textContent = txt;
    el.classList.add('snap'); el.classList.remove('live', 'loading');
  }
}

/* ---------------------- 启动 ---------------------- */
async function init() {
  // 首屏优先显示【最近一次成功刷新的本地快照】（永不空白、秒开），
  // 本地无快照时才用内嵌算法快照兜底，再后台尝试实时刷新
  const cached = loadCache();
  if (cached) { renderAll(cached); renderLiveFlag(false, cached.updatedAt); }
  else if (window.SNAPSHOT) { renderAll(window.SNAPSHOT); renderLiveFlag(false, window.SNAPSHOT.updatedAt); }
  await refresh();
  $('#refreshBtn').addEventListener('click', refresh);
  // 页面打开时也记录一次时间，避免用户刚进页面就连点刷新
  lastRefreshAt = Date.now();
}

init();
