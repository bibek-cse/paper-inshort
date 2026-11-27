/*!
 * PaperInShot — https://bibek-cse.github.io/paper-inshort/
 * Copyright (c) 2026 Bibek (GitHub: bibek-cse). All rights reserved.
 * Unauthorised copying, modification, redistribution or re-hosting of this file,
 * via any medium, is prohibited without prior written permission. See LICENSE.
 */
/* PaperInShot UI — live, client-side, no build step, no inline scripts (CSP-safe). Data layer: api.js */
(() => {
'use strict';
const RR = window.RR, D = RR.DOMAINS, safe = RR.safeUrl;
const KIND = { paper: 'Paper', idea: 'Research idea', concept: 'Concept, made easy' };
const STOP = new Set('the and for with from that this into using based towards toward via over under are our their its than then them these those such can not but has have had was were been being what when where which while who will would could should may might also more most less very much many any each other some only same new novel approach method methods paper propose proposed show results model models data dataset learning deep neural network networks task tasks study analysis framework'.split(' '));
const PKEY = 'rr_profile_v1', CHUNK = 20;
const OWNER = { name: 'Bibek', gh: 'bibek-cse', home: 'https://bibek-cse.github.io/paper-inshort/', year: 2026 };
const COPY = `<p class="copyright">© ${OWNER.year} PaperInShot · created by <a href="https://github.com/${OWNER.gh}" target="_blank" rel="noopener noreferrer">${OWNER.name} (@${OWNER.gh})</a> · All rights reserved.</p>`;
const ALLOWED_HOSTS = ['bibek-cse.github.io', 'localhost', '127.0.0.1'];
const FEED_DOMAINS = ['deepfake', 'watermark', 'voice', 'forensics', 'face', 'signature', 'biometrics', 'document', 'architecture'];
const S = {
  tab: 'foryou', domain: null, byDomain: {}, interest: [], classics: [], seedIdeas: [], ideas: [], concepts: [], extras: [], sota: null, ddl: null,
  profile: load(PKEY, { terms: {}, liked: [], saved: {}, opened: [], searches: [] }), seen: new Set(load('rr_seen', [])), extra: {}, pendingNew: 0, deck: null, lastSync: null, view: [], shown: 0, installEvt: null, relPool: {}, pending: 0,
};
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
const saveProfile = () => { try { localStorage.setItem(PKEY, JSON.stringify(S.profile)); } catch (e) { RR.cache.prune(); } };

// ---------------------------------------------------------------- utils
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const href = u => esc(safe(u || '') || '#');
const A = (u, txt, cls = '') => safe(u || '') ? `<a class="${cls}" href="${href(u)}" target="_blank" rel="noopener noreferrer">${txt}</a>` : '';
/* Paper text → safe HTML: "[Pinto et al., 2024](url)" becomes a clean hyperlink, "work([…](…))" gets its space back,
   leftover markdown/LaTeX noise is removed, and truncation never cuts through a link. */
function rich(t, max = Infinity) {
  t = RR.smooth(RR.normLinks(t).replace(/(\w)\(\[/g, '$1 ([')).replace(/\\(textbf|textit|emph|mathrm|mathbf)\{([^}]*)\}/g, '$2');
  const re = /\[([^\]]{1,200})\]\((https?:[^)\s]+)\)/g, clean = x => RR.tex(x, true).replace(/\*\*|__|\$/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/\s{2,}/g, ' ');
  let out = '', vis = 0, last = 0, done = false, m;
  const bare = x => {   // leftover bare URLs, e.g. "(https://arxiv.org/html/…#bib.bib11)" → a short "[ref]" link instead of the raw address
    let h = '', i = 0; const R = /\(?\s*(https?:\/\/[^\s()<>]+[^\s()<>.,;:])\s*\)?/g; let m;
    while ((m = R.exec(x))) {
      const url = safe(m[1]); h += esc(x.slice(i, m.index)); i = R.lastIndex;
      let label = 'link'; try { const u = new URL(url); label = /#bib/.test(u.hash) ? 'ref' : u.hostname.replace(/^www\./, ''); } catch (e) {}
      h += url ? ` <a class="cite" href="${esc(url)}" target="_blank" rel="noopener noreferrer">[${esc(label)}]</a>` : esc(m[0]);
    }
    return h + esc(x.slice(i));
  };
  const text = x => { if (done) return; x = clean(x); if (vis + x.length > max) { x = x.slice(0, Math.max(0, max - vis)).replace(/\s+\S*$/, '') + '…'; done = true; } vis += x.length; out += bare(x); };
  while ((m = re.exec(t)) && !done) {
    text(t.slice(last, m.index)); last = re.lastIndex; if (done) break;
    const label = clean(m[1]), url = safe(m[2]);
    if (vis + label.length > max) { out += '…'; done = true; break; }
    vis += label.length; out += url ? `<a class="cite" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
  }
  if (!done) text(t.slice(last));
  return out;
}
const plain = t => RR.mdPlain(t);
const tokens = s => String(s || '').toLowerCase().match(/[a-z][a-z0-9\-]{2,}/g)?.filter(w => !STOP.has(w)) || [];
const fmtDate = d => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
function status(txt, state = 'ok') { $('#status').className = 'status ' + state; $('#statusText').textContent = txt; }
const cite = p => `${p.firstAuthor || (p.authors || '').split(',')[0]}${(p.nAuthors || 2) > 1 ? ' et al.' : ''}, ${p.venueShort || p.venue || 'preprint'} ${p.year || ''}`.trim();
const scholar = p => 'https://scholar.google.com/scholar?q=' + encodeURIComponent('"' + p.title + '"');
const tierBadge = p => {
  if (!p.tier) return '';
  const l = p.tier === 'Pre' ? 'Preprint' : ['IEEE', 'ACM', 'Q1', 'J', 'Soc'].includes(p.tier) ? p.venueShort : `${p.tier} · ${p.venueShort}`;
  return `<span class="tier t-${p.tier.replace('*', 's')}"${p.venueShort && p.tier !== 'Pre' ? ` data-venue="${esc(p.venueShort)}" role="button" title="About this venue"` : ''}>${esc(l)}</span>`;
};
const access = p => p.type !== 'paper' ? '' : (p.oa || p.arxiv) ? '<span class="acc oa">open</span>'
  : RR.campus.on ? '<span class="acc campus">🎓 campus access</span>' : '<span class="acc lock">🔒 subscription</span>';

function applyTheme() {
  const s = RR.settings, h = document.documentElement; h.dataset.theme = s.theme;
  if (s.accent) h.style.setProperty('--accent', s.accent); else h.style.removeProperty('--accent');
  $('meta[name=theme-color]').content = getComputedStyle(h).getPropertyValue('--bg').trim() || '#0d0f14';
}

// ---------------------------------------------------------------- personalisation
function bump(it, w) {
  const t = S.profile.terms;
  tokens(it.title).forEach(k => t[k] = (t[k] || 0) + w);
  if (it.domain) t['@' + it.domain] = (t['@' + it.domain] || 0) + w;
  saveProfile();
}
function score(it) {
  const t = S.profile.terms; let s = 0, best = null, bw = 0;
  new Set(tokens(it.title + ' ' + (it.abstract || it.inshort || '').slice(0, 400))).forEach(k => { const w = t[k] || 0; s += w; if (w > bw) { bw = w; best = k; } });
  s += (t['@' + it.domain] || 0) * 1.5 + (RR_TIER_RANK[it.tier] || 0) * 1.2 + Math.log10((it.cites || 0) + 1) * 2;
  if (it.date) s += Math.max(0, 12 - (Date.now() - new Date(it.date)) / 864e5 / 20);
  if (it.fresh) s += 2;
  if (it.isNew) s += 8;
  if (S.profile.opened.includes(it.id)) s -= 8;
  return { s, why: bw >= 3 ? best : null };
}
const topInterests = n => Object.entries(S.profile.terms).filter(([k]) => !k.startsWith('@') && k.length > 3).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

// ---------------------------------------------------------------- live data
async function loadDomain(d, force) { try { S.byDomain[d] = await RR.domainPapers(d, { force }); } catch (e) { S.byDomain[d] = S.byDomain[d] || []; throw e; } return S.byDomain[d]; }
async function sync(force = false, background = false) {
  if (!background) status('checking network…', 'busy');
  const before = RR.campus.on; await RR.detectCampus();
  if (RR.campus.on && !before) toast('🎓 Campus network detected — loading full IEEE/ACM feed');
  if (!background) status(RR.campus.on ? 'campus mode · fetching more papers…' : 'fetching live papers…', 'busy');
  const want = S.domain ? [S.domain] : FEED_DOMAINS;
  const res = []; for (let i = 0; i < want.length; i += 3) res.push(...await Promise.allSettled(want.slice(i, i + 3).map(d => loadDomain(d, force))));
  const ints = topInterests(2);
  if (ints.length) S.interest = (await Promise.allSettled(ints.map(q => RR.queryPapers(q)))).flatMap(r => r.status === 'fulfilled' ? r.value.slice(0, 12) : []);
  // LinkedIn-style freshness: anything not seen before is "new" and floats to the top
  const all = allPapers(), firstVisit = S.seen.size === 0; let fresh = 0;
  all.forEach(p => { if (!firstVisit && !S.seen.has(p.id)) { p.isNew = true; fresh++; } });
  S.lastSync = Date.now(); refreshStatus(res.some(r => r.status === 'fulfilled'));
  if (background) { if (fresh && !S.deck) { S.pendingNew = fresh; showNewPill(); } }
  else if (!S.deck) render();
  all.forEach(p => S.seen.add(p.id));
  try { localStorage.setItem('rr_seen', JSON.stringify([...S.seen].slice(-4000))); } catch (e) {}
}
function showNewPill() {
  let b = $('#newPill');
  if (!b) { b = document.createElement('button'); b.id = 'newPill'; b.className = 'newpill'; document.body.appendChild(b);
    b.addEventListener('click', () => { b.remove(); S.pendingNew = 0; if (S.tab !== 'foryou' && S.tab !== 'paper') setTab('foryou'); else render(); $('#feed').scrollTo({ top: 0, behavior: 'smooth' }); }); }
  b.textContent = `↑ ${S.pendingNew} new paper${S.pendingNew === 1 ? '' : 's'}`;
}
function refreshStatus(ok = true) {
  if (!ok) return status('offline · showing classics', 'off');
  status(`${RR.campus.on ? '🎓 campus · ' : ''}live · ${allPapers().length} papers · ${ago(S.lastSync)}`, RR.campus.on ? 'campus' : 'ok');
}
function allPapers() {
  const seen = new Set(), out = [];
  [...Object.values(S.byDomain).flat(), ...S.interest].forEach(p => { if (!seen.has(p.id)) { seen.add(p.id); out.push(p); } });
  return out;
}
const findItem = id => S.extra[id] || [...allPapers(), ...S.classics, ...S.ideas, ...S.seedIdeas, ...S.concepts, ...Object.values(S.profile.saved)].find(x => x.id === id);

// ---------------------------------------------------------------- feed
function list() {
  const inD = x => !S.domain || x.domain === S.domain;
  switch (S.tab) {
    case 'paper': { const ps = (S.domain ? S.byDomain[S.domain] || [] : allPapers()).filter(inD); return (ps.length ? ps : S.classics.filter(inD)).slice().sort((a, b) => (!!b.isNew - !!a.isNew) || (b.date || '').localeCompare(a.date || '')); }
    case 'idea': return [...S.ideas, ...S.seedIdeas].filter(inD);
    case 'concept': return S.concepts.filter(inD);
    case 'saved': return Object.values(S.profile.saved).filter(inD);
    default: {
      const sc = [...allPapers(), ...S.classics, ...S.ideas, ...S.seedIdeas, ...S.concepts].filter(inD).map(x => ({ x, ...score(x) })).sort((a, b) => b.s - a.s);
      const b = { paper: [], idea: [], concept: [] }; sc.forEach(o => (b[o.x.type] || b.paper).push(o));
      const order = ['paper', 'paper', 'paper', 'idea', 'paper', 'paper', 'concept'], out = [];
      for (let k = 0; out.length < sc.length && k < sc.length * 8; k++) { const q = b[order[k % order.length]]; if (q.length) out.push(q.shift()); }
      return out;
    }
  }
}
const venueYear = it => [it.venueShort || (it.venue || '').replace(/^\d{4}\s+/, '').slice(0, 48), it.year].filter(Boolean).join(' ');
const pubLine = it => it.upcoming ? 'To appear' : it.date ? 'Published ' + fmtDate(it.date) : '';
function heroHTML(it) {
  const d = D[it.domain] || D.cv;
  if (it.type === 'paper') {
    const insts = (it.insts || []).slice(0, 3);
    return `<div class="hero ph" style="--g1:${d.grad[0]};--g2:${d.grad[1]}">
      <div class="ph-top"><span class="ph-venue">${esc(venueYear(it) || 'Preprint')}</span>${it.tier && it.tier !== 'Pre' ? `<span class="ph-tier">${esc(RR_TIER_LABEL[it.tier] || it.tier)}</span>` : ''}</div>
      ${insts.length ? `<div class="ph-insts">${insts.map(i => `<span>🏛 ${esc(i)}</span>`).join('')}${(it.insts || []).length > 3 ? `<span>+${it.insts.length - 3} more</span>` : ''}</div>` : ''}
      <div class="ph-auth">${esc(it.authors || '')}</div>
      <div class="ph-foot"><span>${esc(pubLine(it))}</span><span class="ph-dom">${d.glyph} ${esc(d.label)}</span></div>
      ${RR.settings.hero === 'figure' ? '<div class="ph-fig">◌ fetching architecture figure…</div>' : ''}</div>`;
  }
  const steps = (it.slides || []).slice(0, 4).map(x => x.title).filter(Boolean);
  return `<div class="hero rm" style="--g1:${d.grad[0]};--g2:${d.grad[1]}">
    <span class="rm-kind">${esc(KIND[it.type] || it.type)} · ${esc(d.label)}</span>
    <ol>${steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>`;
}
function card(it, why) {
  const liked = S.profile.liked.includes(it.id), saved = !!S.profile.saved[it.id], src = it.type === 'paper' ? RR.sourceOf(it) : null;
  return `<section class="reel" data-id="${esc(it.id)}"><article class="card">
    ${heroHTML(it)}
    <div class="body" data-open>
      <div class="badges">${tierBadge(it)}${access(it)}${it.cites ? `<span class="cites">↗ ${it.cites} cites</span>` : ''}${it.isNew ? '<span class="isnew">NEW</span>' : it.fresh ? '<span class="cites">just published</span>' : ''}${it.classic ? '<span class="cites">classic</span>' : ''}</div>
      <h2>${esc(it.title)}</h2>
      <p class="inshort">${esc(it.inshort || RR.quickSummary(it).inshort)}</p>
      ${why ? `<div class="reasons">● because you follow “${esc(why)}”</div>` : ''}
      ${it.type !== 'paper' ? `<div class="meta">${esc(it.authors || '')}</div>` : ''}
    </div>
    <div class="actions">
      <button data-act="like" class="${liked ? 'on' : ''}" aria-label="Like">${liked ? '♥' : '♡'}</button>
      <button data-act="save" class="${saved ? 'on' : ''}" aria-label="Save">${saved ? '★' : '☆'}</button>
      <button data-act="share" aria-label="Share" title="Share">⤴</button>
      <button data-act="ask" class="askmini" aria-label="Ask AI">✦</button>
      ${src ? A(src.url, esc(({ 'ACM Digital Library': 'ACM DL', 'Publisher (DOI)': 'Publisher', 'NeurIPS Proceedings': 'NeurIPS', 'IET Digital Library': 'IET', 'AAAI Proceedings': 'AAAI', 'IJCAI Proceedings': 'IJCAI', 'CVF Open Access': 'CVF' })[src.label] || src.label) + ' ↗', 'srcbtn') : ''}
      <button data-act="open" class="open">Slides ▸</button>
    </div></article></section>`;
}
function render() {
  const feed = $('#feed'); feed.classList.toggle('nosnap', ['deadline', 'sota', 'venue'].includes(S.tab));
  if (S.tab === 'deadline') return renderDeadlines();
  if (S.tab === 'sota') return renderSota();
  if (S.tab === 'venue') return renderVenueTab();
  if (S.tab === 'idea') return renderIdeas();
  S.view = list(); S.shown = 0;
  if (!S.view.length) { feed.innerHTML = `<div class="empty">${S.tab === 'saved' ? 'Nothing saved yet — tap ☆ on any paper.' : 'Loading…'}</div>`; return; }
  feed.innerHTML = ''; feed.scrollTop = 0; more();
}
function more() {   // chunked rendering keeps the DOM small and scrolling smooth
  const feed = $('#feed'), next = S.view.slice(S.shown, S.shown + CHUNK); if (!next.length) return;
  feed.insertAdjacentHTML('beforeend', next.map(o => o.x ? card(o.x, o.why) : card(o)).join(''));
  S.shown += next.length; observe();
}

let io;
function observe() {
  io = io || new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    if (e.target.classList.contains('reel') && e.target === $('#feed').lastElementChild) more();
    if (RR.settings.hero !== 'figure') return;
    const it = findItem(e.target.dataset.id); if (!it || it.type !== 'paper') return;
    const mark = () => { const n = e.target.querySelector('.ph-fig'); if (n) n.textContent = 'no open figure · tap Slides for details'; };
    RR.figures(it).then(f => f?.arch ? setHeroFig(e.target, it, f) : mark()).catch(mark);
  }), { root: $('#feed'), rootMargin: '0px 0px 100% 0px' });
  document.querySelectorAll('.reel:not([data-o])').forEach(r => { r.dataset.o = 1; io.observe(r); });
}
async function setHeroFig(reel, it, f) {
  const h = reel.querySelector('.hero'); if (!h || h.classList.contains('fig')) return;
  const src = await RR.cropFigure(f.arch.src), img = new Image();
  img.alt = `Figure ${f.arch.n}`; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
  img.addEventListener('load', () => {
    h.className = 'hero fig'; h.replaceChildren(img);
    h.insertAdjacentHTML('beforeend', `<span class="figlabel">FIG. ${f.arch.n} · ARCHITECTURE</span><span class="figvenue">${esc(venueYear(it))}</span><span class="figcite">${esc(cite(it))}</span>`);
  });
  img.src = src;
}

// ---------------------------------------------------------------- ideas, SOTA, deadlines
function renderIdeas() {
  const feed = $('#feed');
  feed.innerHTML = (RR.hasLLM()
    ? `<div class="tabnote">💡 <b>${S.ideas.length ? 'Fresh ideas from today’s papers' : 'Generate fresh ideas'}</b> — built by your AI key from the newest top-venue papers. <button class="mini-btn" id="genIdeas">${S.ideas.length ? 'Regenerate' : 'Generate'}</button></div>`
    : `<div class="tabnote">💡 Add a free AI key in ⚙ to get new research ideas from today’s papers every day.</div>`) + list().map(x => card(x)).join('');
  feed.scrollTop = 0;
  const g = $('#genIdeas'); if (g) g.addEventListener('click', async () => {
    g.disabled = true; g.textContent = 'Thinking…';
    try { RR.cache.set('ideas:' + new Date().toISOString().slice(0, 10), null); S.ideas = await RR.aiIdeas(allPapers().filter(p => p.tier !== 'Pre')); renderIdeas(); }
    catch (e) { toast('AI request failed — check key/model'); g.disabled = false; g.textContent = 'Retry'; }
  });
}
async function renderSota() {
  const feed = $('#feed');
  if (!S.sota) { feed.innerHTML = '<div class="loader">Loading SOTA tables…</div>'; S.sota = await RR.json('data/sota.json').catch(() => ({ domains: [] })); if (S.tab !== 'sota') return; }
  const doms = S.sota.domains.filter(d => !S.domain || d.domain === S.domain);
  feed.innerHTML = `<div class="sota">${doms.map(d => {
    const dd = D[d.domain] || D.cv, rising = RR.rising(S.byDomain[d.domain] || []);
    return `<section class="sota-sec"><h3 style="--g1:${dd.grad[0]};--g2:${dd.grad[1]}"><span>${dd.glyph}</span>${esc(dd.label)}</h3>
      <p class="hint">Benchmarks: ${d.benchmarks.map(esc).join(' · ')}</p>
      <div class="tbl"><table><thead><tr><th>Model</th><th>Venue</th><th>Key idea</th><th>Links</th></tr></thead><tbody>
      ${d.models.slice().sort((a, b) => b.year - a.year).map(m => `<tr><td data-l="Model"><b>${esc(m.model)}</b></td><td data-l="Venue"><span class="tier t-${RR.tierOfShort(m.venue).replace('*', 's')}">${esc(m.venue)} ’${String(m.year).slice(2)}</span></td><td data-l="Idea">${esc(m.idea)}</td>
        <td class="links">${A(scholar({ title: m.model + ' ' + m.venue + ' ' + m.year }), 'Paper ↗')}${A(m.code, 'Code ⌥')}</td></tr>`).join('')}
      </tbody></table></div>
      ${rising.length ? `<h4>📈 Rising now (live · citations / month)</h4><div class="rising">${rising.map(({ p, v }) => `<div class="mini" data-id="${esc(p.id)}">${tierBadge(p)}<b>${esc(p.title)}</b><span>${esc(cite(p))} · ${v.toFixed(1)} cites/mo</span></div>`).join('')}</div>`
        : `<p class="hint small">Live “rising” list appears once this domain’s papers load${S.domain ? '' : ' (pick the domain chip)'}.</p>`}
    </section>`;
  }).join('')}<p class="hint small">${esc(S.sota.note || '')}</p>${COPY}</div>`;
  feed.scrollTop = 0;
}
async function renderDeadlines() {
  const feed = $('#feed');
  if (!S.ddl) { feed.innerHTML = '<div class="loader">Fetching live deadlines…</div>'; try { S.ddl = await RR.deadlines(); } catch (e) { S.ddl = []; } if (S.tab !== 'deadline') return; }
  const now = Date.now();
  const extra = S.extras.map(c => ({ name: c.name, what: c.what, t: c.deadline ? new Date(c.deadline) : null, place: c.location, url: safe(c.url), rank: { core: c.tier === 'Soc' ? 'Society' : 'Journal' } }));
  const rows = [...S.ddl, ...extra].sort((a, b) => (!a.t) - (!b.t) || (a.t < now) - (b.t < now) || (a.t < now ? b.t - a.t : a.t - b.t));
  feed.innerHTML = `<div class="dl-list"><p class="hint">Live from ${A('https://github.com/ccfddl/ccf-deadlines', 'ccf-deadlines')} (CORE ranks) + biometrics/forensics society venues · shown in your time zone.</p>` +
    rows.map((c, i) => {
      const days = c.t ? Math.ceil((c.t - now) / 864e5) : null, past = days !== null && days < 0, core = c.rank?.core && c.rank.core !== 'N' ? c.rank.core : '';
      return `<div class="dl ${past ? 'past' : days !== null && days <= 14 ? 'soon' : ''}">
        <h3>${esc(c.name)} ${core ? `<span class="tier t-${core.replace('*', 's')}">${esc(/^[AB]\*?$|^C$/.test(core) ? 'CORE ' + core : core)}</span>` : ''}</h3>
        <div class="count">${!c.t ? 'TBA' : past ? '✓' : days}<small>${!c.t ? '' : past ? 'closed' : days === 1 ? 'day left' : 'days left'}</small></div>
        <div class="what">${esc(c.what)}${c.t ? ' · <b>' + c.t.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</b>' : ''}${c.place ? ' · ' + esc(c.place) : ''}${c.date ? ' · ' + esc(c.date) : ''}</div>
        <div class="row">${A(c.url, 'Call for papers ↗')}${c.t && !past ? `<button data-ics="${i}">+ Calendar</button>` : ''}</div></div>`;
    }).join('') + COPY + '</div>';
  feed.scrollTop = 0;
  feed.querySelectorAll('[data-ics]').forEach(b => b.addEventListener('click', () => ics(rows[+b.dataset.ics])));
}
function ics(c) {
  const z = x => x.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z', clean = s => String(s).replace(/[\r\n,;]/g, ' ');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PaperInShot//EN', 'BEGIN:VEVENT', 'UID:' + clean(c.name + c.what).replace(/\W/g, '') + '@rr',
    'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(c.t), 'DTEND:' + z(new Date(+c.t + 36e5)), 'SUMMARY:' + clean(c.name + ' — ' + c.what), 'URL:' + (c.url || ''),
    'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:7 days to ' + clean(c.name), 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Tomorrow: ' + clean(c.name), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
  a.download = c.name.replace(/\W+/g, '_') + '.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function deadlineBanner() {
  try { S.ddl = S.ddl || await RR.deadlines(); } catch (e) { return; }
  const soon = S.ddl.filter(c => c.t && c.t > Date.now() && c.t - Date.now() < 14 * 864e5).sort((a, b) => a.t - b.t)[0];
  if (!soon || sessionStorage.getItem('rr_b') === soon.name) return;
  const d = Math.ceil((soon.t - Date.now()) / 864e5), b = $('#banner');
  b.innerHTML = `⏰ <b>${esc(soon.name)}</b> ${esc(soon.what.toLowerCase())} in ${d} day${d === 1 ? '' : 's'} — tap to see all`;
  b.classList.remove('hidden'); setTimeout(() => b.classList.add('hidden'), 8000);
  b.onclick = () => { b.classList.add('hidden'); sessionStorage.setItem('rr_b', soon.name); setTab('deadline'); };
}

// ---------------------------------------------------------------- deck
function openDeck(it, push = true) {
  const base = it.slides ? { inshort: it.inshort, slides: it.slides, by: it.classic ? 'hand-written' : '' } : RR.quickSummary(it);
  S.deck = { it, i: 0, sum: base, fig: undefined, figSel: null, explain: null, s2: null, crops: {} };
  if (!S.profile.opened.includes(it.id)) { S.profile.opened = [...S.profile.opened, it.id].slice(-500); bump(it, 1); }
  const d = D[it.domain] || D.cv;
  $('#deckDomain').textContent = `${KIND[it.type] || ''} · ${d.label}`;
  $('#deckDomain').style.background = `linear-gradient(90deg,${d.grad[0]},${d.grad[1]})`;
  $('#deck').classList.remove('hidden');
  if (push) history.pushState({}, '', '#/r/' + encodeURIComponent(it.id));
  build(); show(); if (it.type === 'paper') enrich(it);
}
async function enrich(it) {
  const dk = S.deck, refresh = () => { if (S.deck === dk) { build(); show(); } };
  const relP = RR.s2(it).catch(() => null).then(s2 => RR.related(it, s2?.s2id)).then(r => { if (S.deck !== dk) return; r.forEach(x => { S.extra[x.id] = x; }); dk.related = r; refresh(); }).catch(() => { dk.related = []; refresh(); });
  RR.s2(it).then(s => { if (S.deck !== dk || !s) return; dk.s2 = s; if (s.tldr && !RR.hasLLM() && !it.slides) dk.sum = { ...RR.quickSummary(it, s.tldr), tldr: s.tldr }; if (!it.pdf && s.pdf) it.pdf = s.pdf; refresh(); }).catch(() => {});
  const figP = RR.figures(it).then(async f => {
    if (S.deck !== dk) return f;
    if (f) await Promise.all(f.figs.flatMap(g => g.srcs || [g.src]).slice(0, 12).map(async u => { dk.crops[u] = await RR.cropFigure(u); }));
    dk.fig = f || null;
    if (!f) dk.text = await RR.paperText(it).catch(() => null); // no arXiv HTML → read the open PDF as text
    refresh(); return f;
  }).catch(() => { dk.fig = null; dk.text = null; refresh(); });
  if (RR.hasLLM() && !it.slides && it.abstract) {
    dk.aiLoading = true; refresh();
    try { const f = await figP; dk.sum = await RR.aiSummary(it, f?.method || ''); } catch (e) { toast('AI summary failed — showing quick summary'); }
    dk.aiLoading = false; refresh();
  }
}
function build() {
  const dk = S.deck, { it, sum } = dk, isPaper = it.type === 'paper';
  const cover = { cover: true, title: it.title, text: sum.inshort || it.inshort };
  let body;
  if (isPaper && !it.classic) {
    const key = (sum.by || '') + '|' + (dk.fig ? dk.fig.id : dk.fig === null ? 'none' : 'wait') + '|' + (dk.text ? 't' : dk.text === null ? 'x' : '');
    if (dk.storyKey !== key) { dk.story = RR.story(it, sum, dk.fig, allPapers(), dk.text || null); dk.storyKey = key; }
    body = dk.story.slides;
  } else {
    body = (sum.slides || []).map(s => s.arch || /^architecture/i.test(s.title) ? { ...s, arch: true } : /result/i.test(s.title) ? { ...s, results: true } : s);
    if (isPaper && !body.some(s => s.arch)) body.unshift({ arch: true, icon: '🏗️', title: 'Architecture', points: [] });
    if (isPaper) { const i = body.findIndex(s => s.arch); body.splice(0, 0, ...body.splice(i, 1)); }
  }
  const slides = [cover, ...body];
  if (isPaper && dk.fig && dk.fig.figs.length > 1 && !slides.some(s => s.gallery)) slides.push({ gallery: true });
  if (isPaper && !slides.some(s => s.type === 'related')) slides.push({ type: 'related', icon: '🔗', title: 'Related & SOTA papers' });
  if (isPaper || it.url) slides.push({ src: true });
  dk.slides = slides; if (dk.i >= slides.length) dk.i = slides.length - 1;
}
function closeDeck(pop = true) { $('#deck').classList.add('hidden'); $('#deckStage').replaceChildren(); S.deck = null; if (pop && location.hash.startsWith('#/r/')) history.back(); }
function step(d) { const n = S.deck.slides.length, j = S.deck.i + d; if (j < 0) return; if (j >= n) return closeDeck(); S.deck.i = j; show(); }
const ul = a => a?.length ? `<ul>${a.map(p => `<li>${rich(p)}</li>`).join('')}</ul>` : '';
const flow = a => a?.length ? `<div class="flow">${a.map((f, k) => (k ? '<div class="arrow">↓</div>' : '') + `<div>${rich(f)}</div>`).join('')}</div>` : '';

function figHTML(fig, label) {
  const dk = S.deck, it = dk.it, srcs = (fig.srcs || [fig.src]).map(u => dk.crops[u] || u);
  return `<figure class="figbox paper">
    <div class="figimgs n${Math.min(srcs.length, 4)}">${srcs.map(u => `<img src="${esc(u)}" alt="Figure ${fig.n}" referrerpolicy="no-referrer" decoding="async" data-zoom data-n="${fig.n}">`).join('')}</div>
    <figcaption><span class="fign">${esc(label || 'Figure')} ${fig.n}.</span> ${rich(fig.caption, 280)}
      <span class="srcline">Source: ${A(RR.sourceOf(it).url, esc(cite(it)), 'cite')}</span></figcaption></figure>`;
}
function readState(dk) {
  const f = dk.fig, t = dk.text, nT = f?.tables?.length || 0, nA = f?.algos?.length || 0;
  if (f === undefined || (f === null && t === undefined)) return `<p class="readst wait"><span class="spin">📖 Opening the full paper…</span> figures, tables & sections load into the slides</p>`;
  if (f) return `<p class="readst ok">📖 Read the full paper (${esc(f.via || 'arXiv')}) · ${f.figs.length} figure${f.figs.length === 1 ? '' : 's'}${nT ? ` · ${nT} table${nT === 1 ? '' : 's'}` : ''}${nA ? ` · ${nA} algorithm${nA === 1 ? '' : 's'}` : ''}${f.sec?.contrib?.length ? ' · contributions' : ''}${f.sec?.lit?.length ? ' · lit review' : ''}</p>`;
  if (t) return `<p class="readst mid">📄 Read the open PDF (text only — figure images need arXiv HTML)${t.contrib?.length ? ' · contributions' : ''}${t.lit?.length ? ' · lit review' : ''}</p>`;
  return `<p class="readst no">🔒 Full text isn’t openly readable — slides use abstract + metadata. Open the source on campus Wi-Fi for the PDF.</p>`;
}
const srcOfText = dk => dk.fig?.html || dk.text?.url || RR.sourceOf(dk.it).url;
function slideHTML(s, i, n) {
  const dk = S.deck, it = dk.it, num = `<div class="num">${i + 1} / ${n}${dk.aiLoading ? ' · <span class="spin">AI summarising…</span>' : ''}</div>`;
  if (s.cover) {
    const t = dk.fig?.teaser, insts = (it.insts || []).slice(0, 3);
    return `<div class="slide cover">${num}
      ${it.type === 'paper' ? `<div class="cover-venue"><b>${esc(venueYear(it) || 'Preprint')}</b>${it.tier && it.tier !== 'Pre' ? ` · ${esc(RR_TIER_LABEL[it.tier])}` : ''} ${access(it)}</div>` : ''}
      <h3>${esc(s.title)}</h3>
      ${it.type === 'paper' ? `<p class="cover-auth">${esc(it.authors || '')}</p>${insts.length ? `<p class="cover-inst">🏛 ${insts.map(esc).join(' · ')}</p>` : ''}<p class="hint">${esc(pubLine(it))}${it.cites ? ' · ' + it.cites + ' citations' : ''}</p>` : ''}
      ${t ? figHTML(t, 'Figure') : ''}
      <p>${esc(s.text)}</p>
      ${it.type === 'paper' ? readState(dk) : ''}
      ${dk.sum.by ? `<p class="hint small">Summary: ${esc(dk.sum.by)}</p>` : ''}</div>`;
  }
  const head = `${num}<h3><span class="ico">${esc(s.icon || '•')}</span>${esc(s.title)}</h3>`;
  if (s.type === 'related') {
    const r = dk.related;
    return `<div class="slide">${head}${r === undefined ? '<div class="shimmer"></div><p class="hint small">Finding similar papers live…</p>'
      : !r.length ? '<p class="hint">No related papers found right now.</p>'
      : `<div class="rels">${r.map(x => `<button class="rel" data-rel="${esc(x.id)}"><span class="rel-v">${esc(venueYear(x) || 'Paper')}</span><b>${esc(x.title)}</b><span class="rel-m">${esc(cite(x))}${x.cites ? ' · ' + x.cites + ' cites' : ''}${(x.date || '') > new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10) ? ' · <em>new</em>' : ''}</span></button>`).join('')}</div>
        <p class="hint small">Live from OpenAlex related works${dk.s2?.s2id ? ' + Semantic Scholar recommendations' : ''} · tap one to open its slides</p>`}</div>`;
  }
  if (s.type === 'figfull') {
    const g = s.fig, srcs = (g.srcs || [g.src]).map(u => dk.crops[u] || u), open = !!dk.capOpen;
    return `<div class="slide figfull">${num}<div class="ff-kicker">${esc(s.kicker)} <span>· Fig. ${g.n} of ${dk.fig.figs.length}</span></div>
      <div class="ffwrap n${Math.min(srcs.length, 4)}">${srcs.map(u => `<img src="${esc(u)}" alt="Figure ${g.n}" referrerpolicy="no-referrer" decoding="async" data-zoom="${g.n}">`).join('')}</div>
      <p class="ff-hint">⤢ tap to enlarge &amp; swipe all figures · ⟲ rotate phone for wide figures</p>
      <div class="ff-cap ${open ? 'open' : ''}" data-cap><b>Figure ${g.n}.</b> ${rich(g.caption)}${s.note ? `<span class="ff-note"><b>In the text:</b> ${rich(s.note)}</span>` : ''}</div>
      <p class="hint small">${open ? '' : 'Tap caption to expand · '}Source: ${A(RR.sourceOf(it).url, esc(cite(it)), 'cite')}</p></div>`;
  }
  if (s.type === 'abstract') return `<div class="slide">${head}<div class="legend"><span class="r-prob">problem</span><span class="r-idea">idea</span><span class="r-meth">method</span><span class="r-res">result</span></div>
    <p class="abs">${s.parts.map(x => `<span class="${x.r ? 'r-' + x.r : ''}">${esc(x.t)}</span>`).join(' ')}</p><p class="hint small">Full abstract of ${A(RR.sourceOf(dk.it).url, esc(cite(dk.it)), 'cite')}</p></div>`;
  if (s.type === 'figure') return `<div class="slide">${head}${figHTML(s.fig, 'Figure')}${s.note ? `<div class="explain"><h4>Where the paper uses it</h4><blockquote>${rich(s.note)}</blockquote></div>` : ''}</div>`;
  if (s.type === 'table') return `<div class="slide">${head}<p class="tcap"><b>Table ${s.table.n}.</b> ${rich(s.table.caption, 260)}</p>
    <div class="ptable"><table>${s.table.rows.map((r, k) => `<tr>${r.map(c => k ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>
    <p class="hint small">Reproduced from ${A(dk.fig.html, esc(cite(dk.it)), 'cite')} · swipe the table sideways</p></div>`;
  if (s.type === 'algo') return `<div class="slide">${head}<p class="tcap"><b>Algorithm ${s.algo.n}.</b> ${rich(s.algo.caption)}</p>
    <ol class="algo">${s.algo.lines.map(l => `<li>${esc(l.replace(/^\d+:\s*/, ''))}</li>`).join('')}</ol><p class="hint small">From ${A(dk.fig.html, esc(cite(dk.it)), 'cite')}</p></div>`;
  if (s.type === 'limits') return `<div class="slide">${head}${s.text ? `<div class="bubble warn">${rich(s.text)}</div><p class="hint small">${s.from === 'paper' ? 'From the paper’s own limitations / future-work text.' : 'AI-extracted from the abstract — check the paper.'}</p>`
    : `<p>The open text doesn’t state limitations explicitly. Good questions to ask while reading:</p><ul><li>Does it work on unseen generators / datasets?</li><li>Is it robust to compression, resizing and other real-world edits?</li><li>What does it cost (compute, data, labels)?</li></ul>`}</div>`;
  if (s.type === 'conclusion') return `<div class="slide">${head}<div class="explain"><blockquote>${rich(s.text)}</blockquote></div><p class="hint small">From the conclusion of ${A(srcOfText(dk), esc(cite(dk.it)), 'cite')}</p></div>`;
  if (s.type === 'hook') return `<div class="slide hook">${num}<div class="hook-ico">${esc(s.icon)}</div><div class="hook-k">${esc(s.title)}</div>
    <p class="hook-prob">${rich(s.problem)}</p><h3 class="hook-q">${esc(s.question)}</h3>${s.sub ? `<p class="hook-sub">${rich(s.sub)}</p>` : ''}<p class="hint small">Tap → to see how the paper answers it</p></div>`;
  if (s.type === 'versus') return `<div class="slide">${head}<div class="versus"><div class="vs-l"><b>${esc(s.left.h)}</b><p>${rich(s.left.t)}</p></div>
    <div class="vs-mid">→</div><div class="vs-r"><b>${esc(s.right.h)}</b><p>${rich(s.right.t)}</p></div></div></div>`;
  if (s.type === 'terms') return `<div class="slide">${head}<div class="terms">${s.terms.map(t => `<div class="term"><b>${esc(t.t)}</b><span>${rich(t.d)}</span></div>`).join('')}</div>
    <p class="hint small">Only terms this paper actually uses.</p></div>`;
  if (s.type === 'problem') return `<div class="slide">${head}${s.intro ? `<p class="hint">${rich(s.intro)}</p>` : ''}<div class="probs">${s.points.map(x => `<div class="prob">${rich(x)}</div>`).join('')}</div>
    <p class="hint small">From the introduction of ${A(srcOfText(dk), esc(cite(dk.it)), 'cite')}</p></div>`;
  if (s.type === 'litreview') return `<div class="slide">${head}<div class="lits">${s.cards.map(c => `<div class="lit">${c.theme ? `<b>${esc(c.theme)}</b>` : ''}<span>${rich(c.text)}</span>${c.refs ? `<em>${c.refs} cited work${c.refs === 1 ? '' : 's'}</em>` : ''}</div>`).join('')}</div>
    <p class="hint small">Condensed from the related-work section · citation links open the cited work</p></div>`;
  if (s.type === 'contrib') return `<div class="slide">${head}<ol class="contribs">${s.items.map(x => `<li>${rich(x)}</li>`).join('')}</ol>
    <p class="hint small">The authors’ own contribution list · ${A(srcOfText(dk), esc(cite(dk.it)), 'cite')}</p></div>`;
  if (s.type === 'findings') return `<div class="slide">${head}<div class="probs">${s.points.map(x => `<div class="prob res">${rich(x)}</div>`).join('')}</div>
    <p class="hint small">Sentences from the experiments section</p></div>`;
  if (s.type === 'stats') return `<div class="slide">${head}
    ${s.stats?.length ? `<div class="stats">${s.stats.map(x => `<div class="stat"><b>${esc(x.v)}</b><span>${esc(x.l)}</span></div>`).join('')}</div>` : ''}${ul(s.points)}</div>`;
  if (s.type === 'chips') return `<div class="slide">${head}<div class="dchips">${s.chips.map(c => `<span>${esc(c)}</span>`).join('')}</div><p class="hint">${esc(s.note || '')}</p></div>`;
  if (s.type === 'eli5') return `<div class="slide eli5">${head}<div class="bubble">${rich(s.text)}</div></div>`;
  if (s.type === 'quiz') { const pick = dk.quizPick;
    return `<div class="slide">${head}<p class="quiz-q">${esc(s.q)}</p><div class="quiz">${s.opts.map((o, k) => `<button data-opt="${k}" class="${pick == null ? '' : o.ok ? 'right' : pick === k ? 'wrong' : 'dim'}">${esc(o.t)}</button>`).join('')}</div>
    ${pick == null ? '<p class="hint small">Two of these come from other papers in your feed.</p>' : `<p class="quiz-res">${s.opts[pick].ok ? '🎉 Spot on — you’ve got the core idea.' : '🙂 Not quite — the highlighted one is this paper.'}</p>`}</div>`; }
  if (s.type === 'guide') return `<div class="slide">${head}<p class="readif">${rich(s.readIf)}</p><h4>Smart reading path · ${esc(s.time)}</h4>
    <ol class="path">${s.path.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${A(RR.sourceOf(dk.it).url, 'Open the paper ↗', 'mini-btn')}</div>`;
  if (s.gallery) return `<div class="slide">${num}<h3><span class="ico">🖼️</span>All figures</h3>
    <div class="gallery">${dk.fig.figs.map(g => `<figure><img src="${esc(dk.crops[g.src] || g.src)}" alt="Figure ${g.n}" referrerpolicy="no-referrer" loading="lazy" data-zoom data-n="${g.n}"><figcaption><b>Fig. ${g.n}</b> ${rich(g.caption, 110)}</figcaption></figure>`).join('')}</div>
    <p class="hint small">Tap any figure to view full screen and swipe through all of them. Source: ${A(RR.sourceOf(it).url, esc(cite(it)), 'cite')}</p></div>`;
  if (s.results && dk.fig?.results) return `<div class="slide">${num}<h3><span class="ico">${esc(s.icon || '📊')}</span>${esc(s.title)}</h3>${figHTML(dk.fig.results, 'Figure')}${s.text ? `<p>${rich(s.text)}</p>` : ''}${ul(s.points)}${flow(s.flow)}</div>`;
  if (s.arch) return archSlide(s, num);
  if (s.src) return srcSlide(num);
  return `<div class="slide">${num}<h3><span class="ico">${esc(s.icon || '•')}</span>${esc(s.title)}</h3>${s.text ? `<p>${rich(s.text)}</p>` : ''}${ul(s.points)}${flow(s.flow)}</div>`;
}
function archSlide(s, num) {
  const dk = S.deck, it = dk.it, f = dk.fig, fig = f && (dk.figSel || f.arch);
  let box = '';
  if (it.type === 'paper') {
    if (f === undefined) box = `<div class="figbox loading"><div class="shimmer"></div><p class="hint small">Finding and cropping the original architecture figure…</p></div>`;
    else if (!f) box = `<div class="figbox none"><p class="hint">No open full-text version found (arXiv / ar5iv), so the figure can't be shown here.</p>${A(it.pdf || RR.readUrl(it), it.pdf ? 'See the figure in the PDF ↗' : 'See it on ' + esc(RR.sourceOf(it).label) + ' ↗', 'mini-btn')}</div>`;
    else {
      box = `${figHTML(fig, 'Figure')}
        ${f.figs.length > 1 ? `<div class="thumbs">${f.figs.map(g => `<button data-fig="${g.n}" class="${g.n === fig.n ? 'on' : ''}">Fig ${g.n}</button>`).join('')}</div>` : ''}
        <button class="explain-btn" data-explain>${dk.explain ? 'Hide explanation' : '🔍 Explain this architecture'}</button>${dk.explain ? explainHTML(fig) : ''}`;
    }
  }
  return `<div class="slide arch">${num}<h3><span class="ico">${esc(s.icon || '🏗️')}</span>${esc(s.title)}</h3>${box}${s.text ? `<p>${rich(s.text)}</p>` : ''}${ul(s.points)}${flow(s.flow)}</div>`;
}
function explainHTML(fig) {
  const dk = S.deck, it = dk.it, e = dk.explain, f = dk.fig, ref = `<p class="hint small">Source: ${A(f.html, esc(cite(it)) + ' — full text')}</p>`;
  if (e === 'loading') return `<div class="explain"><p class="spin">Reading the method section…</p></div>`;
  if (e.ai) {
    const a = e.ai;
    return `<div class="explain"><p>${rich(a.overview)}</p>
      ${a.components?.length ? `<h4>Building blocks</h4><ul>${a.components.map(c => `<li><b>${rich(c.name)}</b> — ${rich(c.role)}</li>`).join('')}</ul>` : ''}
      ${a.dataflow?.length ? `<h4>Data flow</h4>${flow(a.dataflow)}` : ''}${a.training ? `<h4>Training</h4><p>${rich(a.training)}</p>` : ''}
      ${a.why_it_works ? `<h4>Why it works</h4><p>${rich(a.why_it_works)}</p>` : ''}<p class="hint small">AI explanation of Fig. ${fig.n} from the caption + method text.</p>${ref}</div>`;
  }
  return `<div class="explain"><h4>In the authors’ words</h4>${(e.ctx || []).map(c => `<blockquote>${rich(c)}</blockquote>`).join('') || '<p class="hint">No method text found near this figure.</p>'}
    <p class="hint small">Short excerpts where the paper describes this figure. Add an AI key in ⚙ for a plain-English walkthrough.</p>${ref}</div>`;
}
async function doExplain() {
  const dk = S.deck; if (dk.explain) { dk.explain = null; return show(); }
  dk.explain = 'loading'; show();
  const fig = dk.figSel || dk.fig.arch, ctxFig = { ...dk.fig, arch: fig };
  if (RR.hasLLM()) { try { dk.explain = { ai: await RR.aiArch(dk.it, ctxFig) }; } catch (e) { toast('AI failed — showing excerpts'); dk.explain = { ctx: dk.fig.context }; } }
  else dk.explain = { ctx: dk.fig.context };
  if (S.deck === dk) show();
}
function srcSlide(num) {
  const dk = S.deck, it = dk.it, ax = it.arxiv || dk.s2?.arxiv, src = it.type === 'paper' ? RR.sourceOf(it) : { label: 'Source', url: it.url };
  const bib = `${it.authors}. "${it.title}." ${it.venue || ''}${it.year ? ', ' + it.year : ''}.${it.doi ? ' doi:' + it.doi : ''}`;
  const prov = [['Paper record', it.src ? `${it.src} (${it.src === 'Crossref' ? 'api.crossref.org' : 'api.openalex.org'})` : it.classic ? 'hand-curated' : 'curated'],
    ['Published at', src.label], ['Summary', dk.sum.by || '—'], ['Figures', dk.fig ? (dk.fig.html.includes('ar5iv') ? 'ar5iv (arXiv full text)' : 'arXiv HTML full text') : 'not available openly'],
    ['TL;DR / arXiv link', dk.s2 ? 'Semantic Scholar' : '—']];
  return `<div class="slide">${num}<h3><span class="ico">📄</span>Original paper</h3>
    ${it.type === 'paper' ? `<div class="cite-box"><span>[1]</span> <span id="bib">${esc(bib)}</span> <button data-copy>Copy</button></div>` : ''}
    <div class="src-btns">
      ${A(RR.readUrl(it) || src.url, `${RR.campus.on && !it.oa ? '🎓 ' : ''}Read on ${esc(src.label)} ↗`, 'primary')}
      ${A(it.pdf, 'Open-access PDF ↓')}${ax ? A('https://arxiv.org/abs/' + ax, 'arXiv version ↗') : ''}${dk.fig ? A(dk.fig.html, 'Full text with figures ↗') : ''}
      ${A(it.code, 'Code ⌥')}
      <button class="ask-wide" data-ask>✦ Ask ChatGPT / Claude / Gemini about this paper</button>
    </div>
    ${it.type === 'paper' ? `<h4>Where this came from</h4><table class="prov">${prov.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <p class="hint small">Also: ${A(scholar(it), 'search Google Scholar')}${dk.s2?.s2id ? ' · ' + A('https://www.semanticscholar.org/paper/' + encodeURIComponent(dk.s2.s2id), 'Semantic Scholar page') : ''}</p>` : ''}
  </div>`;
}
function show() {
  const dk = S.deck; if (!dk) return;
  const { slides, i } = dk, st = $('#deckStage'), prev = st.querySelector('.slide')?.scrollTop || 0, same = st.dataset.i == i;
  st.innerHTML = slideHTML(slides[i], i, slides.length); st.dataset.i = i;
  const sl = st.querySelector('.slide'); if (same) sl.scrollTop = prev; else sl.classList.add('enter');
  st.querySelectorAll('img[data-zoom]').forEach(im => im.addEventListener('error', () => im.remove(), { once: true }));
  $('#deckProgress').innerHTML = slides.map((_, k) => `<i class="${k <= i ? 'done' : ''}"></i>`).join('');
  $('#deckCount').textContent = `${i + 1} / ${slides.length}`;
}
function onStageClick(e) {
  const dk = S.deck; if (!dk) return;
  const vb = e.target.closest('[data-venue]'); if (vb) return showVenue(vb.dataset.venue);
  const z = e.target.closest('[data-zoom]');
  if (z) return openLightbox(+(z.dataset.n || z.dataset.zoom) || 0, z.src);
  const f = e.target.closest('[data-fig]'); if (f) { dk.figSel = dk.fig.figs.find(g => g.n === +f.dataset.fig); dk.explain = null; return show(); }
  const rel = e.target.closest('[data-rel]'); if (rel) { const r = S.extra[rel.dataset.rel]; if (r) openDeck(r); return; }
  if (e.target.closest('[data-cap]')) { dk.capOpen = !dk.capOpen; return show(); }
  if (e.target.closest('[data-ask]')) return openAsk(dk.it);
  if (e.target.closest('[data-explain]')) return doExplain();
  const op = e.target.closest('[data-opt]'); if (op) { if (dk.quizPick == null) { dk.quizPick = +op.dataset.opt; show(); } return; }
  if (e.target.closest('[data-copy]')) { navigator.clipboard?.writeText($('#bib').textContent); return toast('Citation copied'); }
  if (e.target.closest('a,button,ul,ol,.flow,figure,.explain,.thumbs,.cite-box,.quiz,.terms,.versus,.ptable,.abs,.rels,.ffwrap,.ff-cap')) return;
  const r = e.currentTarget.getBoundingClientRect(); step(e.clientX - r.left < r.width * 0.3 ? -1 : 1);
}
/* Full-screen figure viewer: swipe / arrows between ALL figures of the paper, double-tap or +/- to zoom */
const LB = { list: [], i: 0, zoom: 1 };
function openLightbox(n, fallbackSrc) {
  const dk = S.deck, figs = dk?.fig?.figs || [];
  LB.list = figs.length ? figs.map(g => ({ src: dk.crops[g.src] || g.src, cap: `Figure ${g.n}. ${g.caption}`, n: g.n })) : [{ src: fallbackSrc, cap: '', n: 0 }];
  LB.i = Math.max(0, LB.list.findIndex(x => x.n === n)); LB.zoom = 1; drawLightbox(); $('#zoom').classList.remove('hidden');
}
function drawLightbox() {
  const z = $('#zoom'), it = S.deck?.it, cur = LB.list[LB.i];
  z.querySelector('img').src = cur.src; z.querySelector('img').style.width = (LB.zoom * 100) + '%';
  z.querySelector('.lb-cap').innerHTML = rich(cur.cap);
  z.querySelector('.lb-count').textContent = LB.list.length > 1 ? `${LB.i + 1} / ${LB.list.length}` : '';
  const src = it ? RR.sourceOf(it) : null, a = z.querySelector('.lb-src');
  if (src && safe(src.url)) { a.href = safe(src.url); a.textContent = cite(it); a.classList.remove('hidden'); } else a.classList.add('hidden');
  z.querySelector('.lb-dots').innerHTML = LB.list.length > 1 ? LB.list.map((_, k) => `<i class="${k === LB.i ? 'on' : ''}"></i>`).join('') : '';
}
function lbStep(d) { if (LB.list.length < 2) return; LB.i = (LB.i + d + LB.list.length) % LB.list.length; LB.zoom = 1; drawLightbox(); $('#zoom .lb-stage').scrollTo(0, 0); }
function lbZoom(f) { LB.zoom = Math.min(4, Math.max(1, f)); $('#zoom img').style.width = (LB.zoom * 100) + '%'; }

// ---------------------------------------------------------------- Venue explorer (CORE / CCF rank, deadlines, stats, links)
function venueHTML(v) {
  if (!v || !v.found) return `<div class="vcard"><p>No details found for “${esc(v?.query || '')}”. Try the short name (e.g. <b>ICPR</b>, <b>TIFS</b>) or the full name.</p>
    ${A('https://portal.core.edu.au/conf-ranks/?search=' + encodeURIComponent(v?.query || '') + '&by=all', 'Search the CORE portal ↗', 'mini-btn')}</div>`;
  const r = v.rank || {}, core = r.core && r.core !== 'N' ? r.core : '', ccf = r.ccf && r.ccf !== 'N' ? r.ccf : '', th = r.thcpl && r.thcpl !== 'N' ? r.thcpl : '';
  const dt = x => x ? new Date(x) : null, nx = v.next ? { ...v.next, deadline: dt(v.next.deadline), abstract: dt(v.next.abstract) } : null;
  const days = nx?.deadline ? Math.ceil((nx.deadline - Date.now()) / 864e5) : null, o = v.oa || {};
  const fmt = n => n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n * 100) / 100);
  const maxY = Math.max(1, ...(o.years || []).map(y => y.works_count || 0));
  return `<div class="vcard">
    <div class="v-head"><span class="v-kind">${v.kind === 'journal' ? '📘 Journal' : '🎤 Conference'}${v.area ? ' · ' + esc(v.area) : ''}</span>
      <h2>${esc(v.short)}</h2><p class="v-full">${esc(v.full || o.name || '')}</p>${o.publisher ? `<p class="hint">${esc(o.publisher)}${o.issn ? ' · ISSN ' + esc(o.issn) : ''}${o.oaJournal ? ' · open access' : ''}</p>` : ''}</div>
    ${v.kind === 'conference' ? `<div class="v-ranks">
      <div class="v-rank big t-${(core || 'none').replace('*', 's')}"><small>CORE</small><b>${esc(core || '—')}</b><span>${esc(RR.RANK_HELP.core[core] || 'Not ranked by CORE (or not listed).')}</span></div>
      <div class="v-rank"><small>CCF</small><b>${esc(ccf || '—')}</b><span>${esc(RR.RANK_HELP.ccf[ccf] || 'Not on the CCF list')}</span></div>
      <div class="v-rank"><small>THCPL</small><b>${esc(th || '—')}</b><span>Tsinghua list</span></div></div>`
    : `<div class="v-ranks"><div class="v-rank big"><small>Journal quality</small><b>${o.h != null ? 'h-index ' + o.h : 'See SJR'}</b><span>CORE no longer ranks journals — check the SCImago quartile (Q1–Q4) and impact via the links below.</span></div></div>`}
    ${v.kind === 'conference' ? `<div class="v-next">${nx ? `<div class="v-count"><b>${days}</b><small>days left</small></div><div><b>${esc(v.short)} ${nx.year}</b> paper deadline<br>${nx.deadline.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} <span class="hint">(your time)</span>
      ${nx.abstract && nx.abstract > Date.now() ? `<br><span class="hint">Abstract: ${nx.abstract.toLocaleDateString()}</span>` : ''}<br><span class="hint">${esc([nx.date, nx.place].filter(Boolean).join(' · '))}</span></div>`
      : `<div><b>Next deadline:</b> not announced yet${v.editions?.[0] ? ` · last edition ${v.editions[0].year}${v.editions[0].place ? ', ' + esc(v.editions[0].place) : ''}` : ''}</div>`}</div>` : ''}
    ${o.works == null ? '<p class="hint">Live publication stats unavailable right now — see the links below.</p>' : ''}<div class="stats v-stats${o.works == null ? ' hidden' : ''}">
      <div class="stat"><b>${fmt(o.h)}</b><span>h-index</span></div><div class="stat"><b>${fmt(o.i10)}</b><span>i10-index</span></div>
      <div class="stat"><b>${fmt(o.works)}</b><span>papers indexed</span></div><div class="stat"><b>${fmt(o.impact)}</b><span>2-yr mean citations ≈ impact</span></div></div>
    ${o.years?.length ? `<h4>Papers per year</h4><div class="v-bars">${o.years.map(y => `<div><i style="height:${Math.max(4, Math.round((y.works_count || 0) / maxY * 70))}px"></i><span>${y.year}</span><small>${fmt(y.works_count)}</small></div>`).join('')}</div>` : ''}
    ${v.editions?.length > 1 ? `<h4>Recent editions</h4><ul class="v-eds">${v.editions.map(e => `<li>${e.link ? A(e.link, esc(v.short + ' ' + e.year), 'cite') : esc(v.short + ' ' + e.year)} <span class="hint">${esc([e.date, e.place].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>` : ''}
    <h4>Learn more</h4><ul class="v-links">${v.links.map(l => `<li>${A(l.url, esc(l.label), 'cite')}${l.note ? ` <span class="hint">— ${esc(l.note)}</span>` : ''}</li>`).join('')}</ul>
    <p class="hint small">Ranks: ccf-deadlines (mirrors CORE, CCF, THCPL) — confirm on the CORE portal. Stats: OpenAlex (IEEE proceedings are sometimes split per year, so conference numbers can be partial).</p></div>`;
}
async function showVenue(q, target) {
  const box = target || $('#venueBody');
  if (!target) { $('#venueSheet').classList.remove('hidden'); }
  box.innerHTML = `${target ? '' : '<div class="sheet-head"><h3>About this venue</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>'}<div class="loader"><div class="shimmer"></div>Looking up ${esc(q)}…</div>`;
  let v = null; try { v = await RR.venueInfo(q); } catch (e) {}
  box.innerHTML = (target ? '' : '<div class="sheet-head"><h3>About this venue</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>') + venueHTML(v || { query: q });
}
function renderVenueTab() {
  const feed = $('#feed');
  feed.innerHTML = `<div class="vtab"><h3 class="v-title">🏛️ Conference & journal explorer</h3>
    <form id="venueForm"><input id="venueInput" maxlength="120" placeholder="Type a venue: ICPR, CVPR, TIFS, TBIOM…" autocomplete="off"><button>Check</button></form>
    <div class="chips wrap">${RR.VENUE_SUGGEST.map(x => `<button class="chip" data-vq="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div id="venueResult"><p class="hint">See the CORE / CCF ranking, the next deadline, h-index, papers per year and official links for any conference or journal. Tip: tap any venue badge (e.g. <b>A* · CVPR</b>) on a paper card.</p></div></div>`;
  feed.scrollTop = 0;
  $('#venueForm').addEventListener('submit', e => { e.preventDefault(); const q = $('#venueInput').value.trim(); if (q) showVenue(q, $('#venueResult')); });
  feed.querySelectorAll('[data-vq]').forEach(b => b.addEventListener('click', () => { $('#venueInput').value = b.dataset.vq; showVenue(b.dataset.vq, $('#venueResult')); }));
}

// ---------------------------------------------------------------- Ask AI (ChatGPT / Claude / Gemini / Perplexity) about the current paper
const AGENTS = {
  chatgpt:    { name: 'ChatGPT',    cls: 'ag-gpt', open: q => 'https://chatgpt.com/?q=' + encodeURIComponent(q), prefill: true },
  claude:     { name: 'Claude',     cls: 'ag-claude', open: q => 'https://claude.ai/new?q=' + encodeURIComponent(q), prefill: true },
  gemini:     { name: 'Gemini',     cls: 'ag-gem', open: () => 'https://gemini.google.com/app', prefill: false },
  perplexity: { name: 'Perplexity', cls: 'ag-ppx', open: q => 'https://www.perplexity.ai/search?q=' + encodeURIComponent(q), prefill: true },
};
const QUICK = ['Explain this paper simply, step by step', 'Explain the architecture figure in detail', 'What are the key contributions and novelty?',
  'What are the limitations and open problems?', 'How could I extend this for a new research paper?', 'Explain the math / loss functions'];
function askContext() {
  const dk = S.deck; if (!dk) return '';
  const s = dk.slides[dk.i] || {}, f = dk.fig;
  if (s.arch && f?.arch) return `Figure ${(dk.figSel || f.arch).n} (architecture): ${plain((dk.figSel || f.arch).caption)}`;
  if (s.type === 'figure' || s.type === 'figfull') return `Figure ${s.fig.n}: ${plain(s.fig.caption)}`;
  if (s.type === 'table') return `Table ${s.table.n}: ${plain(s.table.caption)}`;
  if (s.type === 'algo') return `Algorithm ${s.algo.n}: ${plain(s.algo.caption)}`;
  return '';
}
function buildPrompt(it, question, ctx) {
  const src = it.type === 'paper' ? RR.sourceOf(it) : { url: it.url };
  const links = [src.url && 'Paper: ' + src.url, it.arxiv && 'arXiv: https://arxiv.org/abs/' + it.arxiv, it.pdf && 'PDF: ' + it.pdf].filter(Boolean).join('\n');
  const head = `I'm reading this research paper. Please open/read it from the link${links.includes('\n') ? 's' : ''} below and answer my question.\n\n` +
    `Title: ${it.title}\n${it.authors ? 'Authors: ' + it.authors + '\n' : ''}${it.venue ? 'Venue: ' + it.venue + (it.year ? ' (' + it.year + ')' : '') + '\n' : ''}${links}\n`;
  const ctxLine = ctx ? `\nI'm currently looking at — ${ctx}\n` : '';
  const q = `\nMy question: ${question || 'Explain this paper simply, step by step.'}\nPlease answer for a PhD student, beginner-friendly, and cite sections/figures of the paper.`;
  const room = 1900 - head.length - ctxLine.length - q.length;     // keep the URL short enough for every agent
  const abs = it.abstract && room > 200 ? `\nAbstract: ${it.abstract.length > room ? it.abstract.slice(0, room - 1) + '…' : it.abstract}\n` : '';
  return head + abs + ctxLine + q;
}
function openAsk(it) {
  const pref = RR.settings.agent || 'chatgpt', ctx = askContext();
  $('#askBody').innerHTML = `<div class="sheet-head"><h3>✦ Ask AI about this paper</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <p class="hint">Opens a <b>new chat</b> in your own account with the paper's title, authors, links and abstract already filled in. Log in there if asked.</p>
    <div class="ask-paper"><b>${esc(it.title)}</b><span>${esc(it.type === 'paper' ? cite(it) : KIND[it.type] || '')}</span>${ctx ? `<span class="ask-ctx">+ ${esc(ctx.slice(0, 90))}${ctx.length > 90 ? '…' : ''}</span>` : ''}</div>
    <textarea id="askQ" rows="3" maxlength="500" placeholder="Type your question… (optional)"></textarea>
    <h4>Choose your AI</h4>
    <div class="agents">${Object.entries(AGENTS).map(([k, a]) => `<button class="agent ${a.cls} ${k === pref ? 'pref' : ''}" data-agent="${k}"><span class="ag-dot">${a.name[0]}</span><b>${a.name}</b><small>${a.prefill ? 'question pre-filled' : 'paste with one tap'}</small></button>`).join('')}</div>
    <h4>Quick questions</h4>
    <div class="chips wrap ask-quick">${QUICK.map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    ${it.pdf ? `<p class="hint small">Want the AI to read the full PDF? ${A(it.pdf, 'Download the PDF')} and attach it in the chat.</p>` : ''}
    <p class="hint small">Your question also gets copied to the clipboard as a backup. PaperInShot never sees your AI account.</p>`;
  $('#askSheet').classList.remove('hidden'); $('#askSheet').dataset.id = it.id; $('#askSheet').dataset.ctx = ctx;
}
function onAskClick(e) {
  const sh = $('#askSheet');
  if (e.target === sh || e.target.closest('[data-close]')) return sh.classList.add('hidden');
  const qb = e.target.closest('[data-q]'); if (qb) { $('#askQ').value = qb.dataset.q; return; }
  const ag = e.target.closest('[data-agent]'); if (!ag) return;
  const it = findItem(sh.dataset.id); if (!it) return;
  const a = AGENTS[ag.dataset.agent], prompt = buildPrompt(it, $('#askQ').value.trim(), sh.dataset.ctx);
  RR.settings.agent = ag.dataset.agent; RR.saveSettings();
  try { navigator.clipboard?.writeText(prompt); } catch (er) {}
  window.open(a.open(prompt), '_blank', 'noopener');
  toast(a.prefill ? `Opening ${a.name} — new chat with the paper` : `Opening ${a.name} — prompt copied, just paste (Ctrl/⌘+V)`);
  sh.classList.add('hidden');
}

// ---------------------------------------------------------------- actions & search
/* Share: a link that opens THIS paper's slides in PaperInShot, plus the original paper link */
const appLink = it => OWNER.home + '#/r/' + encodeURIComponent(it.id);
function shareText(it) { return `📄 ${it.title}${it.venueShort || it.venue ? ' (' + [it.venueShort || it.venue, it.year].filter(Boolean).join(' ') + ')' : ''}\nRead it in 60 seconds on PaperInShot π`; }
function share(it) {
  S.extra[it.id] = it;
  const link = appLink(it), txt = shareText(it), src = it.type === 'paper' ? RR.sourceOf(it) : null, enc = encodeURIComponent;
  const opt = (cls, label, href, icon) => `<a class="sh ${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><span>${icon}</span>${label}</a>`;
  $('#shareBody').innerHTML = `<div class="sheet-head"><h3>Share this paper</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="ask-paper"><b>${esc(it.title)}</b><span>${esc(it.type === 'paper' ? cite(it) : KIND[it.type] || '')}</span></div>
    ${navigator.share ? '<button class="install-btn" data-sh="native">↗ Share via…</button>' : ''}
    <div class="sharegrid">
      ${opt('wa', 'WhatsApp', 'https://wa.me/?text=' + enc(txt + '\n' + link), '💬')}
      ${opt('li', 'LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(link), 'in')}
      ${opt('x', 'X / Twitter', 'https://twitter.com/intent/tweet?text=' + enc(txt) + '&url=' + enc(link), '𝕏')}
      ${opt('tg', 'Telegram', 'https://t.me/share/url?url=' + enc(link) + '&text=' + enc(txt), '✈')}
      ${opt('em', 'Email', 'mailto:?subject=' + enc(it.title) + '&body=' + enc(txt + '\n\n' + link + (src ? '\n\nOriginal paper: ' + src.url : '')), '✉')}
      <button class="sh cp" data-sh="copy"><span>🔗</span>Copy link</button>
    </div>
    <div class="sharelinks">
      <p class="hint small">Opens this paper's slides in PaperInShot:</p><div class="linkbox"><code>${esc(link)}</code></div>
      ${src ? `<button class="ghost" data-sh="copysrc">Copy original paper link (${esc(src.label)})</button>` : ''}
      ${it.type === 'paper' ? '<button class="ghost" data-sh="cite">Copy citation</button>' : ''}
    </div>`;
  $('#shareSheet').dataset.id = it.id; $('#shareSheet').classList.remove('hidden');
}
async function onShareClick(e) {
  const sh = $('#shareSheet'); if (e.target === sh || e.target.closest('[data-close]')) return sh.classList.add('hidden');
  const b = e.target.closest('[data-sh]'); if (!b) { if (e.target.closest('a.sh')) setTimeout(() => sh.classList.add('hidden'), 300); return; }
  const it = findItem(sh.dataset.id); if (!it) return;
  const copy = async (t, msg) => { try { await navigator.clipboard.writeText(t); toast(msg); } catch (er) { prompt('Copy:', t); } };
  if (b.dataset.sh === 'native') { try { await navigator.share({ title: it.title, text: shareText(it), url: appLink(it) }); sh.classList.add('hidden'); } catch (er) {} }
  else if (b.dataset.sh === 'copy') copy(shareText(it) + '\n' + appLink(it), 'Link copied');
  else if (b.dataset.sh === 'copysrc') copy(RR.sourceOf(it).url, 'Paper link copied');
  else if (b.dataset.sh === 'cite') copy(`${it.authors}. "${it.title}." ${it.venue || ''}${it.year ? ', ' + it.year : ''}.${it.doi ? ' doi:' + it.doi : ''}`, 'Citation copied');
}
/* Open any paper by id — from memory, or rebuilt from the internet (shared links, search results) */
async function openById(id, push = false) {
  let it = findItem(id);
  if (!it) { toast('Opening paper…'); it = await RR.fetchById(id); if (it) S.extra[it.id] = it; }
  if (it) openDeck(it, push); else toast('Couldn’t load this paper — check your connection');
}
function onFeedClick(e) {
  const vb = e.target.closest('[data-venue]'); if (vb) { e.stopPropagation(); return showVenue(vb.dataset.venue); }
  const reel = e.target.closest('.reel'); if (!reel || e.target.closest('a')) return;
  const it = findItem(reel.dataset.id); if (!it) return;
  const b = e.target.closest('[data-act]');
  if (!b) { if (e.target.closest('[data-open],.hero')) openDeck(it); return; }
  const P = S.profile, a = b.dataset.act;
  if (a === 'open') openDeck(it);
  else if (a === 'like') { const on = !P.liked.includes(it.id); P.liked = on ? [...P.liked, it.id] : P.liked.filter(x => x !== it.id); if (on) { bump(it, 3); toast('Tuning For You…'); } saveProfile(); b.classList.toggle('on', on); b.textContent = on ? '♥' : '♡'; }
  else if (a === 'save') { const on = !P.saved[it.id]; if (on) { P.saved[it.id] = { ...it, abstract: (it.abstract || '').slice(0, 1500) }; bump(it, 2); } else delete P.saved[it.id]; saveProfile(); b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; toast(on ? 'Saved' : 'Removed'); }
  else if (a === 'share') share(it);
  else if (a === 'ask') openAsk(it);
}
/* Search: results appear while you type (debounced), tap one → its slides open straight away */
const SUGGEST = ['image generation', 'deepfake detection', 'image watermarking', 'voice anti-spoofing', 'forgery localization', 'face recognition', 'signature verification', 'vision-language model'];
let searchTimer = null, searchSeq = 0;
function resultRow(x) { S.extra[x.id] = x;
  return `<button class="mini res" data-id="${esc(x.id)}"><span class="res-top">${tierBadge(x)}${access(x)}${x.cites ? `<span class="cites">↗ ${x.cites}</span>` : ''}</span><b>${esc(x.title)}</b><span>${esc(cite(x))}</span><i class="res-go">Open slides ›</i></button>`; }
function searchHome() {
  const rec = S.profile.searches.slice(0, 6);
  $('#searchResults').innerHTML = `${rec.length ? `<h4>Recent</h4><div class="chips wrap">${rec.map(q => `<button class="chip" data-sq="${esc(q)}">↺ ${esc(q)}</button>`).join('')}</div>` : ''}
    <h4>Try</h4><div class="chips wrap">${SUGGEST.map(q => `<button class="chip" data-sq="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <p class="hint small">Results come live from OpenAlex as you type. Top venues (CORE A*/A/B, IEEE/ACM Transactions) are listed first.</p>`;
}
function openSearch(q = '') {
  $('#searchSheet').classList.remove('hidden'); const inp = $('#searchInput'); inp.value = q;
  if (q) liveSearch(q, true); else searchHome();
  setTimeout(() => inp.focus(), 60);
}
async function liveSearch(q, full = false) {
  q = q.trim().slice(0, 200); const box = $('#searchResults'), my = ++searchSeq;
  if (q.length < 2) return searchHome();
  const qt = tokens(q), need = qt.length <= 3 ? qt.length : Math.ceil(qt.length * 0.6);
  const local = qt.length ? [...allPapers(), ...S.classics].map(x => { const hay = (x.title + ' ' + (x.abstract || '')).toLowerCase(); return { x, s: qt.filter(t => new RegExp('\\b' + t.replace(/[-]/g, '\\-')).test(hay)).length }; })
    .filter(o => o.s >= need).sort((a, b) => b.s - a.s).slice(0, 5).map(o => o.x) : [];
  box.innerHTML = (local.length ? `<h4>In your feed</h4>${local.map(resultRow).join('')}` : '') + `<h4>From the internet</h4><div class="loader small"><div class="shimmer"></div>Searching “${esc(q)}”…</div>`;
  let net = [];
  try { net = full ? await RR.queryPapers(q) : await RR.quickSearch(q); } catch (e) { if (my === searchSeq) box.querySelector('.loader').outerHTML = '<p class="hint">Live search failed — are you online?</p>'; return; }
  if (my !== searchSeq) return;   // a newer query is on screen
  const seen = new Set(local.map(x => x.id)), rest = net.filter(x => !seen.has(x.id));
  box.innerHTML = (local.length ? `<h4>In your feed</h4>${local.map(resultRow).join('')}` : '') +
    `<h4>From the internet · ${rest.length} papers</h4>${rest.map(resultRow).join('') || '<p class="hint">No matches. Try other words or ⚙ → Venue quality: All.</p>'}` +
    (!full && rest.length ? `<button class="ghost wide" data-full="${esc(q)}">More results for “${esc(q)}” ›</button>` : '');
}
function rememberSearch(q) {
  q = q.trim().slice(0, 200); if (!q) return; const P = S.profile;
  P.searches = [q, ...P.searches.filter(x => x !== q)].slice(0, 30);
  tokens(q).forEach(k => P.terms[k] = (P.terms[k] || 0) + 2); P.terms[q.toLowerCase()] = (P.terms[q.toLowerCase()] || 0) + 4; saveProfile();
}
function onSearchClick(e) {
  const sh = $('#searchSheet');
  if (e.target === sh || e.target.closest('[data-close]')) return sh.classList.add('hidden');
  const sq = e.target.closest('[data-sq]'); if (sq) { $('#searchInput').value = sq.dataset.sq; rememberSearch(sq.dataset.sq); return liveSearch(sq.dataset.sq); }
  const more = e.target.closest('[data-full]'); if (more) return liveSearch(more.dataset.full, true);
  const r = e.target.closest('.res[data-id]'); if (!r) return;
  rememberSearch($('#searchInput').value);
  const it = S.extra[r.dataset.id] || findItem(r.dataset.id); if (!it) return;
  sh.classList.add('hidden'); openDeck(it);           // close the search first, then open the paper's slides
}

// ---------------------------------------------------------------- settings
function renderSettings() {
  const s = RR.settings, ints = Object.entries(S.profile.terms).filter(([k]) => !k.startsWith('@')).sort((a, b) => b[1] - a[1]).slice(0, 24);
  const opt = (k, v, l) => `<button class="seg ${s[k] == v ? 'on' : ''}" data-set="${k}" data-val="${v}">${l}</button>`;
  const fld = (k, ph, type = 'text') => `<input class="field" data-field="${k}" type="${type}" placeholder="${esc(ph)}" value="${esc(s[k])}" autocomplete="off" spellcheck="false">`;
  $('#settingsBody').innerHTML = `
    <div class="sheet-head"><h3>Customise</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>
    ${S.installEvt ? '<button class="install-btn" id="installBtn">⤓ Install PaperInShot on this device</button>' : `<p class="hint small">${/iphone|ipad/i.test(navigator.userAgent) ? 'To install: Safari → Share → “Add to Home Screen”.' : 'To install: browser menu → “Install app” / “Add to Home screen”.'}</p>`}
    <h4>Theme</h4><div class="segs">${opt('theme', 'midnight', '🌙 Midnight')}${opt('theme', 'paper', '📜 Paper')}${opt('theme', 'neon', '⚡ Neon')}${opt('theme', 'ocean', '🌊 Ocean')}</div>
    <h4>Accent</h4><div class="swatches">${['', '#ff5a5f', '#7c5cff', '#00c2a8', '#ff9f1c', '#3a86ff', '#e63946'].map(c => `<button data-accent="${c}" class="sw ${s.accent === c ? 'on' : ''}" data-c="${c}" aria-label="accent ${c || 'default'}"></button>`).join('')}</div>
    <h4>Card cover</h4><div class="segs">${opt('hero', 'figure', 'Architecture figure')}${opt('hero', 'gradient', 'Paper header only')}</div>
    <h4>Venue quality</h4><div class="segs">${opt('quality', 'astar', 'A* only')}${opt('quality', 'top', 'A*/A + Trans')}${opt('quality', 'topB', '+ B, society & journals')}${opt('quality', 'all', 'All')}</div>
    <h4>Preprints mixed in</h4><div class="segs">${opt('preprint', 0, '0%')}${opt('preprint', 10, '10%')}${opt('preprint', 25, '25%')}</div>
    <h4>🎓 Campus / institutional access</h4>
    <p class="hint">Network now: <b>${esc(RR.campus.on ? 'campus ✓' : 'regular')}</b>${RR.campus.org ? ' · ' + esc(RR.campus.org) : ''}. On campus Wi-Fi the feed fetches more pages, includes paywalled IEEE/ACM papers, and opens publisher full text.</p>
    <div class="segs">${opt('campus', 'auto', 'Auto-detect')}${opt('campus', 'on', 'Always on')}${opt('campus', 'off', 'Off (no IP lookup)')}</div>
    ${fld('campusMatch', 'Network names that count as campus (regex)')}${fld('ezproxy', 'Off-campus proxy prefix, e.g. https://…/login?url=')}
    <h4>My interests <span class="hint">(tap to remove)</span></h4>
    <div class="chips wrap">${ints.map(([k]) => `<button class="chip on" data-term="${esc(k)}">${esc(k)} ✕</button>`).join('') || '<span class="hint">Like, save or search to build this.</span>'}</div>
    <form id="interestForm"><input id="interestInput" maxlength="60" placeholder="Add topic, e.g. lip-sync deepfake"><button>Add</button></form>
    <details><summary><h4>🤖 Free AI summaries &amp; explanations (optional)</h4></summary>
      <p class="hint">Calls go straight from your browser to the provider. Free tiers: Google AI Studio (Gemini) or OpenRouter free models.</p>
      <div class="segs">${opt('llm', 'none', 'Off')}${opt('llm', 'gemini', 'Gemini')}${opt('llm', 'openai', 'OpenAI-compatible')}</div>
      ${fld('llmKey', 'API key', 'password')}${fld('llmModel', 'Model (blank = ' + (s.llm === 'gemini' ? 'gemini-2.5-flash' : 'openrouter/auto') + ')')}${s.llm === 'openai' ? fld('llmBase', 'https base URL') : ''}
      <label class="toggle"><input type="checkbox" id="remember" ${s.rememberKeys ? 'checked' : ''}> Remember keys on this device (otherwise cleared when the tab closes)</label>
    </details>
    <details><summary><h4>⚡ API limits (optional)</h4></summary>${fld('email', 'Email for OpenAlex/Crossref polite pool')}${fld('oaKey', 'OpenAlex API key', 'password')}${fld('jinaKey', 'Jina Reader key (more figure lookups)', 'password')}</details>
    <button class="install-btn" id="forceUpdate">⟳ Update app to the latest version</button>
    <div class="row2"><button class="ghost" id="clearCache">Clear cache</button><button class="ghost" id="resetProfile">Reset likes &amp; interests</button></div>
    <p class="hint small">Sources: OpenAlex · Crossref · Semantic Scholar · arXiv · ccf-deadlines. Tiers: CORE via ccf-deadlines.</p>
    <div class="about"><b>About</b><br>PaperInShot — design, code, icon and curated content © ${OWNER.year} ${OWNER.name} (@${OWNER.gh}). All rights reserved. Copying, re-hosting or redistributing this app or its code without written permission is not allowed. Paper metadata belongs to its publishers and authors.</div>${COPY}`;
  $('#settingsBody').querySelectorAll('.sw').forEach(b => { b.style.background = b.dataset.c || 'conic-gradient(#ff5a5f,#7c5cff,#00c2a8,#ff5a5f)'; });
}
function onSettingsClick(e) {
  const s = RR.settings, t = e.target;
  if (t.closest('[data-close]') || t === $('#settingsSheet')) return $('#settingsSheet').classList.add('hidden');
  if (t.id === 'installBtn') { S.installEvt.prompt(); S.installEvt.userChoice.finally(() => { S.installEvt = null; renderSettings(); }); return; }
  const set = t.closest('[data-set]');
  if (set) {
    const k = set.dataset.set, v = isNaN(set.dataset.val) ? set.dataset.val : +set.dataset.val; s[k] = v; RR.saveSettings();
    if (k === 'theme') applyTheme();
    if (['quality', 'preprint', 'campus'].includes(k)) { sessionStorage.removeItem('rr_net'); S.byDomain = {}; S.interest = []; sync(); }
    if (k === 'hero') render();
    return renderSettings();
  }
  const ac = t.closest('[data-accent]'); if (ac) { s.accent = ac.dataset.accent; RR.saveSettings(); applyTheme(); return renderSettings(); }
  const term = t.closest('[data-term]'); if (term) { delete S.profile.terms[term.dataset.term]; saveProfile(); return renderSettings(); }
  if (t.id === 'clearCache') { RR.cache.clear(); sessionStorage.removeItem('rr_net'); S.byDomain = {}; S.ddl = null; toast('Cache cleared'); sync(true); }
  if (t.id === 'forceUpdate') {   // get the newest app version: drop the offline copy + cached paper data, then reload
    toast('Updating to the latest version…'); RR.cache.clear();
    Promise.all([navigator.serviceWorker?.getRegistrations?.().then(rs => Promise.all(rs.map(r => r.unregister()))), window.caches?.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))])
      .catch(() => {}).finally(() => location.reload());
  }
  if (t.id === 'resetProfile' && confirm('Clear likes, saves and interests?')) { localStorage.removeItem(PKEY); S.profile = load(PKEY, { terms: {}, liked: [], saved: {}, opened: [], searches: [] }); renderSettings(); render(); }
}

// ---------------------------------------------------------------- wiring
function setTab(t) { S.tab = t; document.querySelectorAll('#tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === t); if (b.dataset.tab === t) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }); render(); }
function renderChips() {
  $('#domainChips').innerHTML = `<button class="chip ${!S.domain ? 'on' : ''}" data-dom="">All</button>` + Object.entries(D).map(([k, d]) => `<button class="chip ${S.domain === k ? 'on' : ''}" data-dom="${k}">${esc(d.label)}</button>`).join('');
}
function wire() {
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
  const tb = $('#tabs'), endCheck = () => tb.classList.toggle('end', tb.scrollLeft + tb.clientWidth >= tb.scrollWidth - 4);
  tb.addEventListener('scroll', endCheck, { passive: true }); endCheck();
  $('#domainChips').addEventListener('click', async e => {
    const b = e.target.closest('[data-dom]'); if (!b) return; S.domain = b.dataset.dom || null; renderChips(); render();
    if (S.domain && !S.byDomain[S.domain]) { status('fetching ' + D[S.domain].label + '…', 'busy'); try { await loadDomain(S.domain); refreshStatus(); } catch (er) { status('offline', 'off'); } if (!S.deck) render(); }
  });
  $('#feed').addEventListener('click', onFeedClick);
  $('#deckClose').addEventListener('click', () => closeDeck());
  $('#deckAsk').addEventListener('click', () => { if (S.deck) openAsk(S.deck.it); });
  $('#deckShare').addEventListener('click', () => { if (S.deck) share(S.deck.it); });
  $('#askSheet').addEventListener('click', onAskClick);
  $('#venueSheet').addEventListener('click', e => { if (e.target === e.currentTarget || e.target.closest('[data-close]')) e.currentTarget.classList.add('hidden'); }); $('#deckPrev').addEventListener('click', () => step(-1)); $('#deckNext').addEventListener('click', () => step(1));
  const st = $('#deckStage'); let x0 = null, y0 = null;
  st.addEventListener('click', onStageClick);
  st.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  st.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest('.thumbs,.tbl,.ptable,.algo')) step(dx < 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('keydown', e => {
    if (!$('#zoom').classList.contains('hidden')) { if (e.key === 'Escape') $('#zoom').classList.add('hidden'); else if (e.key === 'ArrowRight') lbStep(1); else if (e.key === 'ArrowLeft') lbStep(-1); else if (e.key === '+') lbZoom(LB.zoom + 1); else if (e.key === '-') lbZoom(LB.zoom - 1); return; }
    if (!S.deck) return; if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Escape') closeDeck();
  });
  const zb = $('#zoom'); let lx = null, ly = null, lastTap = 0, multi = false;
  zb.addEventListener('click', e => {
    const b = e.target.closest('[data-lb]'); if (!b) return;
    const a = b.dataset.lb; if (a === 'close') zb.classList.add('hidden'); else if (a === 'prev') lbStep(-1); else if (a === 'next') lbStep(1); else if (a === 'in') lbZoom(LB.zoom + 1); else if (a === 'out') lbZoom(LB.zoom - 1);
  });
  zb.querySelector('.lb-stage').addEventListener('click', () => { const t = Date.now(); if (t - lastTap < 300) { lbZoom(LB.zoom > 1 ? 1 : 2.5); lastTap = 0; } else lastTap = t; });
  zb.addEventListener('touchstart', e => { multi = e.touches.length > 1; lx = e.touches[0].clientX; ly = e.touches[0].clientY; }, { passive: true });
  zb.addEventListener('touchend', e => { if (lx == null || multi || LB.zoom > 1 || window.visualViewport?.scale > 1.05) { lx = null; return; }
    const dx = e.changedTouches[0].clientX - lx, dy = e.changedTouches[0].clientY - ly; lx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lbStep(dx < 0 ? 1 : -1); else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 2) zb.classList.add('hidden'); }, { passive: true });
  window.addEventListener('popstate', () => { const m = location.hash.match(/^#\/r\/(.+)/); if (m) { if (!S.deck || S.deck.it.id !== decodeURIComponent(m[1])) openById(decodeURIComponent(m[1])); } else if (S.deck) closeDeck(false); });
  $('#btnRefresh').addEventListener('click', () => { S.ddl = null; sessionStorage.removeItem('rr_net'); sync(true); });
  $('#btnSearch').addEventListener('click', () => openSearch());
  $('#btnSettings').addEventListener('click', () => { renderSettings(); $('#settingsSheet').classList.remove('hidden'); });
  $('#searchSheet').addEventListener('click', onSearchClick);
  $('#searchInput').addEventListener('input', e => { clearTimeout(searchTimer); const v = e.target.value; searchTimer = setTimeout(() => liveSearch(v), 450); });
  $('#shareSheet').addEventListener('click', onShareClick);
  $('#feed').addEventListener('click', e => { const m = e.target.closest('.sota .mini'); if (m) { const it = findItem(m.dataset.id); if (it) openDeck(it); } });
  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); clearTimeout(searchTimer); const v = $('#searchInput').value; rememberSearch(v); S.interest = []; liveSearch(v, true); $('#searchInput').blur(); });
  $('#settingsSheet').addEventListener('click', onSettingsClick);
  $('#settingsSheet').addEventListener('change', e => {
    if (e.target.id === 'remember') { RR.settings.rememberKeys = e.target.checked; RR.saveSettings(); return toast(e.target.checked ? 'Keys remembered on this device' : 'Keys kept for this session only'); }
    const f = e.target.closest('[data-field]'); if (f) { RR.settings[f.dataset.field] = f.value.trim(); RR.saveSettings(); toast('Saved'); }
  });
  $('#settingsSheet').addEventListener('submit', e => { e.preventDefault(); const v = $('#interestInput').value.trim().toLowerCase(); if (!v) return; S.profile.terms[v] = (S.profile.terms[v] || 0) + 8; tokens(v).forEach(k => S.profile.terms[k] = (S.profile.terms[k] || 0) + 3); saveProfile(); renderSettings(); S.interest = []; sync(); });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; $('#btnInstall').classList.remove('hidden'); });
  $('#btnInstall').addEventListener('click', () => { if (S.installEvt) { S.installEvt.prompt(); S.installEvt.userChoice.finally(() => { S.installEvt = null; $('#btnInstall').classList.add('hidden'); }); } });
  window.addEventListener('online', () => sync());
  const fit = () => document.documentElement.style.setProperty('--head-h', $('.top').offsetHeight + 'px');
  window.addEventListener('resize', fit); fit();
  setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) sync(true, true); }, 15 * 6e4);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.lastSync && Date.now() - S.lastSync > 10 * 6e4) sync(true, true); });
}

function guard() {
  console.info('%cPaperInShot © ' + OWNER.year + ' ' + OWNER.name + ' (@' + OWNER.gh + ') — all rights reserved. ' + OWNER.home, 'color:#ffcc66;font-weight:700');
  if (ALLOWED_HOSTS.includes(location.hostname)) return;
  const g = $('#copyGuard');
  g.innerHTML = `⚠️ This is an unauthorised copy of <b>PaperInShot</b> © ${OWNER.year} ${esc(OWNER.name)}. <a href="${OWNER.home}" rel="noopener">Open the original ↗</a>`;
  g.classList.remove('hidden');
}

async function init() {
  guard(); applyTheme(); renderChips(); wire();
  $('#feed').innerHTML = '<div class="loader"><div class="shimmer big"></div>Fetching today’s top-venue papers…</div>';
  const [seed, concepts, extras] = await Promise.all(['data/feed.json', 'data/concepts.json', 'data/conferences.json'].map(u => RR.json(u).catch(() => ({ items: [] }))));
  S.classics = seed.items.filter(x => x.type === 'paper'); S.seedIdeas = seed.items.filter(x => x.type === 'idea');
  S.concepts = concepts.items || []; S.extras = extras.items || [];
  if (RR.hasLLM()) S.ideas = RR.cache.get('ideas:' + new Date().toISOString().slice(0, 10), 24) || [];
  const m = location.hash.match(/^#\/r\/(.+)/);
  const tabHash = location.hash.match(/^#(deadline|sota|venue)$/); if (tabHash) setTab(tabHash[1]);
  await sync();
  if (m) openById(decodeURIComponent(m[1]));
  deadlineBanner();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => {});
    let reloaded = false;   // a new version took over → reload once so the new tabs/features appear immediately
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && navigator.serviceWorker.controller) { reloaded = true; location.reload(); } });
  }
}
init();
})();
