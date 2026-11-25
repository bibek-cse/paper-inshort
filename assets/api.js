/*!
 * ResearchReels — https://bibek-cse.github.io/research-reels/
 * Copyright (c) 2026 Bibek (GitHub: bibek-cse). All rights reserved.
 * Unauthorised copying, modification, redistribution or re-hosting of this file,
 * via any medium, is prohibited without prior written permission. See LICENSE.
 */
/* ResearchReels data layer. Everything is fetched live from free, CORS-enabled APIs — no server, no keys required:
   OpenAlex + Crossref (papers & venues) · Semantic Scholar (TL;DR, arXiv ids) · arXiv HTML via r.jina.ai (figures, text)
   · ccfddl/ccf-deadlines (deadlines + CORE ranks) · ipwho.is (optional campus-network detection).                      */
(() => {
'use strict';
const RR = window.RR = {};

// ------------------------------------------------------------------ settings (keys only persist if you opt in)
const SKEY = 'rr_settings_v3', SECRET = ['llmKey', 'oaKey', 'jinaKey'];
RR.defaults = {
  theme: 'midnight', accent: '', hero: 'figure', quality: 'topB', preprint: 10,
  campus: 'auto', campusMatch: 'IIT Patna|Indian Institute of Technology|National Knowledge Network|NKN|ERNET', ezproxy: '',
  llm: 'none', llmKey: '', llmModel: '', llmBase: 'https://openrouter.ai/api/v1', rememberKeys: false,
  oaKey: '', email: '', jinaKey: '',
};
const readJSON = (store, k) => { try { return JSON.parse(store.getItem(k)) || {}; } catch (e) { return {}; } };
RR.settings = Object.assign({}, RR.defaults, readJSON(localStorage, SKEY), readJSON(sessionStorage, SKEY));
RR.saveSettings = () => {
  const s = RR.settings, pub = { ...s }, sec = {};
  SECRET.forEach(k => { sec[k] = s[k]; if (!s.rememberKeys) delete pub[k]; });
  try { localStorage.setItem(SKEY, JSON.stringify(pub)); sessionStorage.setItem(SKEY, JSON.stringify(sec)); } catch (e) {}
};

// ------------------------------------------------------------------ LaTeX → readable text
/* Papers' titles, abstracts and captions often contain LaTeX ("1.76\times", "$\alpha=0.5$", "x^{2}", "\mathcal{L}_{cls}").
   This turns it into plain Unicode a non-LaTeX reader can follow: 1.76×, α = 0.5, x², ℒ_cls. */
const TEX_SYM = { times: '×', cdot: '·', pm: '±', mp: '∓', div: '÷', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', sim: '~', simeq: '≃', equiv: '≡',
  propto: '∝', infty: '∞', rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔', leftrightarrow: '↔', uparrow: '↑', downarrow: '↓', mapsto: '↦',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', forall: '∀', exists: '∃', partial: '∂', nabla: '∇', sum: 'Σ', prod: 'Π', int: '∫',
  ldots: '…', cdots: '⋯', dots: '…', circ: '∘', oplus: '⊕', otimes: '⊗', star: '⋆', ast: '∗', prime: '′', degree: '°', checkmark: '✓', dagger: '†', ddagger: '‡',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
  nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', ell: 'ℓ', hbar: 'ℏ',
  log: 'log', exp: 'exp', max: 'max', min: 'min', arg: 'arg', sin: 'sin', cos: 'cos', tanh: 'tanh', lim: 'lim', det: 'det', Pr: 'Pr', mathrm: '', '%': '%' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', T: 'ᵀ', '*': '*', '′': '′' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', p: 'ₚ', s: 'ₛ', t: 'ₜ', i: 'ᵢ', j: 'ⱼ', r: 'ᵣ', u: 'ᵤ', v: 'ᵥ' };
const SCRIPT = { L: 'ℒ', D: '𝒟', N: '𝒩', R: 'ℛ', F: 'ℱ', X: '𝒳', Y: '𝒴', Z: '𝒵', M: 'ℳ', G: '𝒢', H: 'ℋ', E: 'ℰ', B: 'ℬ', C: '𝒞', I: 'ℐ', O: '𝒪', P: '𝒫', S: '𝒮', T: '𝒯', U: '𝒰', W: '𝒲', A: '𝒜', K: '𝒦', Q: '𝒬', V: '𝒱' };
const BB = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', E: '𝔼', P: 'ℙ', I: '𝕀' };
const mapAll = (t, m) => [...t].every(c => m[c]) ? [...t].map(c => m[c]).join('') : null;
RR.tex = (str, keepEdges) => {
  let t = String(str || ''); if (!/[\\$^_{}~]/.test(t)) return t;
  const keep = []; t = t.replace(/\]\(https?:[^)\s]+\)|https?:\/\/[^\s)\]]+/g, m => { keep.push(m); return '\u0002' + (keep.length - 1) + '\u0002'; });   // never touch URLs
  for (let k = 0; k < 3; k++) t = t
    .replace(/\\(?:text|textrm|textnormal|mathrm|operatorname|textbf|textit|emph|mathbf|boldsymbol|bm|textsc|texttt|mathit|mathsf|underline|hat|bar|tilde|widehat|widetilde|overline|vec|dot)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\mathcal\s*\{([A-Z])\}/g, (_, c) => SCRIPT[c] || c).replace(/\\mathbb\s*\{([A-Z])\}/g, (_, c) => BB[c] || c)
    .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => (a.length > 2 ? '(' + a + ')' : a) + '/' + (b.length > 2 ? '(' + b + ')' : b))
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, a) => '√' + (a.length > 1 ? '(' + a + ')' : a));
  t = t.replace(/\\(?:cite[pt]?|citep|citet|ref|eqref|label|footnote|url)\s*\{[^{}]*\}/g, '').replace(/\\(left|right|big|Big|bigg|Bigg)(?![A-Za-z])\s*/g, '').replace(/\\([{}%&#_$])/g, '$1').replace(/\\[,;:!]|\\ /g, ' ').replace(/\\quad|\\qquad/g, '  ')
    .replace(/\\([A-Za-z]+)(?![A-Za-z])/g, (m, n) => n in TEX_SYM ? TEX_SYM[n] + (/^[a-z]{2,}$/.test(TEX_SYM[n]) ? ' ' : '') : '')
    .replace(/(?<![A-Za-z][A-Za-z])\^\{([^{}]{1,12})\}|(?<![A-Za-z][A-Za-z])\^([A-Za-z0-9+\-*′])/g, (m, a, b) => { const v = a ?? b; return (v.length <= 3 && mapAll(v, SUP)) || (v.length === 1 ? '^' + v : '^(' + v + ')'); })
    .replace(/(?<![A-Za-z][A-Za-z])_\{([^{}]{1,16})\}|(?<![A-Za-z0-9][A-Za-z0-9])_([A-Za-z0-9])(?![A-Za-z0-9])/g, (m, a, b) => { const v = a ?? b; return (v.length <= 3 && mapAll(v, SUB)) || '_' + v; })
    .replace(/\$\$?/g, '').replace(/[{}]/g, '').replace(/([.A-Za-z])~(?=[\dA-Z])/g, '$1 ').replace(/ {2,}/g, ' ')
    .replace(/\s*([ΣΠ∫])\s*/g, ' $1').replace(/([^\d\s])×\s*/g, '$1 × ').replace(/(\d)\s*×/g, '$1×').replace(/\s+([,.;:%])/g, '$1');
  t = t.replace(/\u0002(\d+)\u0002/g, (_, i) => keep[+i]);
  return keepEdges ? t : t.trim();
};

/* Fix glued text from PDFs/HTML so it reads naturally:
   "work(Pinto et al., 2024)" → "work (Pinto et al., 2024)", "inputs.Left:" → "inputs. Left:", "(Li, 2023)shows" → "(Li, 2023) shows".
   URLs and markdown links are never touched. */
RR.smooth = str => {
  let t = String(str || ''); if (!t) return t;
  const keep = []; t = t.replace(/\[[^\]]{1,200}\]\(https?:[^)\s]+\)|https?:\/\/[^\s)\]]+/g, m => { keep.push(m); return '\u0004' + (keep.length - 1) + '\u0004'; });
  t = t.replace(/([A-Za-z])\((?=\u0004|[A-Z][A-Za-z'’\-]+(?:\s+et al\.?|,|\s+and\s|\s*&)[^()]{0,80}\d{4}[a-z]?[);])/g, '$1 (')     // space before citation brackets
       .replace(/(\d{4}[a-z]?\)|\u0004\d+\u0004\))(?=[A-Za-z])/g, '$1 ')                                                        // space after "(…, 2024)"
       .replace(/([a-z%\)\]’”])([.!?;:])(?=[A-Z][a-z])/g, '$1$2 ')                                                              // "inputs.Left" → "inputs. Left"
       .replace(/([a-z])(?=\((?:a|b|c|d|i|ii|iii)\)\s)/g, '$1 ')                                                                 // "shown(a) " → "shown (a) "
       .replace(/ {2,}/g, ' ');
  return t.replace(/\u0004(\d+)\u0004/g, (_, i) => keep[+i]);
};

// ------------------------------------------------------------------ safe helpers
RR.safeUrl = u => { if (!u || typeof u !== 'string') return ''; try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } };

// ------------------------------------------------------------------ cache (localStorage, TTL, LRU-ish prune)
const CP = 'rrc:';
RR.cache = {
  get(k, maxAgeH = 6) {
    try { const o = JSON.parse(localStorage.getItem(CP + k)); if (o && Date.now() - o.t < maxAgeH * 36e5) return o.v; } catch (e) {}
    return undefined;
  },
  set(k, v) {
    const s = JSON.stringify({ t: Date.now(), v });
    for (let i = 0; i < 3; i++) { try { localStorage.setItem(CP + k, s); return; } catch (e) { RR.cache.prune(); } }
  },
  prune() {
    const ks = Object.keys(localStorage).filter(k => k.startsWith(CP))
      .map(k => { try { return [k, JSON.parse(localStorage.getItem(k)).t]; } catch (e) { return [k, 0]; } }).sort((a, b) => a[1] - b[1]);
    ks.slice(0, Math.ceil(ks.length / 3) + 1).forEach(([k]) => localStorage.removeItem(k));
  },
  clear() { Object.keys(localStorage).filter(k => k.startsWith(CP)).forEach(k => localStorage.removeItem(k)); },
};

// ------------------------------------------------------------------ fetch with timeout + in-flight de-duplication
const inflight = new Map();
async function fetchT(url, opts = {}, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { ...opts, signal: c.signal, credentials: 'omit', referrerPolicy: 'no-referrer' }); if (!r.ok) throw new Error(r.status + ' ' + url); return r; }
  finally { clearTimeout(t); }
}
function once(key, fn) { if (inflight.has(key)) return inflight.get(key); const p = fn().finally(() => inflight.delete(key)); inflight.set(key, p); return p; }
RR.json = (u, o = {}, ms) => o.method ? fetchT(u, o, ms).then(r => r.json()) : once('j' + u, () => fetchT(u, o, ms).then(r => r.json()));
RR.text = (u, o = {}, ms) => once('t' + u, () => fetchT(u, o, ms).then(r => r.text()));

// ------------------------------------------------------------------ venue classification
RR.classifyVenue = (name = '') => {
  for (const v of window.RR_VENUES) {
    if (v.re.test(name) && !(v.not && v.not.test(name))) {
      let short = v.short;
      if (v.tier === 'IEEE' || v.short === 'ACM Trans') { const m = window.RR_TRANS_SHORT.find(([re]) => re.test(name)); if (m) short = m[1]; }
      return { tier: v.tier, short };
    }
  }
  return { tier: null, short: '' };
};
RR.tierOfShort = name => {   // for curated tables that use short names (CVPR, TIFS, ...)
  const v = window.RR_VENUES.find(v => v.short.toLowerCase() === String(name).toLowerCase());
  if (v) return v.tier;
  if (/^(T[A-Z]{2,5}|IEEE )/.test(name) || window.RR_TRANS_SHORT.some(([, s]) => s === name)) return 'IEEE';
  return /^(IJCV|Pattern Recognition|TMLR)$/i.test(name) ? 'Q1' : /arxiv/i.test(name) ? 'Pre' : 'B';
};
RR.allowedTiers = () => ({
  astar: ['A*'], top: ['A*', 'A', 'IEEE', 'ACM', 'Q1'],
  topB: ['A*', 'A', 'IEEE', 'ACM', 'Q1', 'B', 'Soc', 'J'], all: null,
}[RR.settings.quality]);

// ------------------------------------------------------------------ domains
RR.DOMAINS = {
  deepfake:     { label: 'Deepfake',        glyph: '🎭', grad: ['#ff5a5f', '#6a1b9a'], q: 'deepfake OR "face forgery" OR "face manipulation detection" OR "AI-generated image detection" OR "synthetic image detection"', kw: /deepfake|face forgery|face swap|face manipulation|ai-generated|synthetic image|generated image|forgery detection/i },
  face:         { label: 'Face',            glyph: '◉',  grad: ['#ff9966', '#c2185b'], q: '"face recognition" OR "face anti-spoofing" OR "face verification" OR "face presentation attack"', kw: /face (recognition|verification|anti-spoofing|presentation)|facial recognition/i },
  voice:        { label: 'Voice / Audio',   glyph: '〰', grad: ['#00b4db', '#0b3d91'], q: '"speech deepfake" OR "audio deepfake" OR "voice cloning" OR "speaker verification" OR "spoofing countermeasure"', kw: /speech deepfake|audio deepfake|voice (cloning|conversion|spoof)|speaker verification|anti-spoofing|spoof(ing)? (detection|countermeasure)|synthetic speech/i },
  signature:    { label: 'Signature',       glyph: '✍',  grad: ['#f7971e', '#8e4a00'], q: '"signature verification" OR "handwritten signature" OR "signature forgery" OR "writer identification"', kw: /signature (verification|forgery)|handwritten signature|writer (identification|verification)/i },
  watermark:    { label: 'Watermarking',    glyph: '◈',  grad: ['#43cea2', '#185a9d'], q: 'watermarking OR "image watermark" OR "audio watermark" OR steganography OR "content provenance"', kw: /watermark|steganograph|provenance|data hiding/i },
  forensics:    { label: 'Forensics',       glyph: '⌕',  grad: ['#8e2de2', '#2b1055'], q: '"image forensics" OR "forgery localization" OR "manipulation detection" OR "tampering localization" OR "copy-move"', kw: /forensic|forgery locali|tamper|manipulation (detection|locali)|copy-move|splicing/i },
  biometrics:   { label: 'Biometric Sec',   glyph: '⬡',  grad: ['#e53935', '#3b0a0a'], q: '"presentation attack detection" OR "biometric template protection" OR "morphing attack" OR "biometric security" OR "iris recognition" OR "fingerprint"', kw: /biometric|presentation attack|morphing attack|iris|fingerprint|palmprint|gait recognition/i },
  document:     { label: 'Document / ICDAR', glyph: '▤', grad: ['#b06ab3', '#4568dc'], q: '"document image" OR "tampered text" OR "document forgery" OR "handwriting recognition" OR "scene text"', kw: /document (image|forgery|analysis|understanding)|tampered text|handwrit|scene text|\bocr\b/i },
  architecture: { label: 'DL Architecture', glyph: '⧉',  grad: ['#11998e', '#1b3a2f'], q: '"vision transformer" OR mamba OR "state space model" OR "diffusion transformer" OR "mixture of experts"', kw: /transformer|mamba|state space|mixture of experts|backbone|foundation model/i },
  cv:           { label: 'Computer Vision', glyph: '◎',  grad: ['#5b86e5', '#1a1f4f'], q: '"vision-language model" OR "object detection" OR "semantic segmentation" OR "foundation model"', kw: /vision-language|object detection|segmentation|visual|image/i },
};
RR.guessDomain = t => {
  for (const [k, d] of Object.entries(RR.DOMAINS)) if (k !== 'cv' && d.kw.test(t || '')) return k;
  return 'cv';
};

// ------------------------------------------------------------------ campus / institutional network
// Uses ipwho.is once per session to read your network's organisation name. Turn off in ⚙ (campus: off/on).
RR.campus = { on: false, org: '' };
RR.detectCampus = async () => {
  const s = RR.settings;
  if (s.campus === 'on') return (RR.campus = { on: true, org: 'manual' });
  if (s.campus === 'off') return (RR.campus = { on: false, org: '' });
  const c = sessionStorage.getItem('rr_net');
  if (c) { try { return (RR.campus = JSON.parse(c)); } catch (e) {} }
  try {
    const j = await RR.json('https://ipwho.is/?fields=success,connection', {}, 6000);
    const org = [j.connection?.org, j.connection?.isp].filter(Boolean).join(' · ');
    const re = new RegExp(s.campusMatch || RR.defaults.campusMatch, 'i');
    RR.campus = { on: re.test(org), org };
  } catch (e) { RR.campus = { on: false, org: '' }; }
  sessionStorage.setItem('rr_net', JSON.stringify(RR.campus));
  return RR.campus;
};
RR.readUrl = p => {   // best "read full text" link for the current network
  const base = RR.safeUrl(p.doi ? 'https://doi.org/' + p.doi : p.url);
  if (!base) return '';
  if (!RR.campus.on && RR.settings.ezproxy && !p.oa) return RR.safeUrl(RR.settings.ezproxy + encodeURIComponent(base)) || base;
  return base;
};

// ------------------------------------------------------------------ OpenAlex
const OA = 'https://api.openalex.org';
function oaParams(extra) {
  const p = new URLSearchParams(extra);
  if (RR.settings.oaKey) p.set('api_key', RR.settings.oaKey);
  if (RR.settings.email) p.set('mailto', RR.settings.email);
  return p.toString();
}
function rebuildAbstract(inv) {
  if (!inv) return ''; const a = [];
  for (const [w, ps] of Object.entries(inv)) ps.forEach(p => { a[p] = w; });
  return a.join(' ').replace(/\s+/g, ' ').trim();
}
const ARX = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i;
function arxivFrom(w) {
  for (const l of [w.primary_location, ...(w.locations || []), w.best_oa_location].filter(Boolean)) {
    const m = (l.landing_page_url || l.pdf_url || '').match(ARX); if (m) return m[1];
  }
  const d = (w.doi || '').match(/10\.48550\/arxiv\.(\d{4}\.\d{4,5})/i); return d ? d[1] : '';
}
const titleKey = t => (t || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]/g, '').slice(0, 70);
RR.normalizeWork = (w, domain) => {
  let venue = w.primary_location?.source?.display_name || '', cls = RR.classifyVenue(venue);
  if (!cls.tier || cls.tier === 'Pre') {
    for (const l of w.locations || []) {
      const c = RR.classifyVenue(l.source?.display_name || '');
      if (c.tier && c.tier !== 'Pre') { cls = c; venue = l.source.display_name; break; }
    }
  }
  const auth = (w.authorships || []).map(a => a.author?.display_name).filter(Boolean);
  const abstract = RR.smooth(RR.tex(rebuildAbstract(w.abstract_inverted_index))), title = RR.tex((w.display_name || '').replace(/<[^>]+>/g, ''));
  const insts = [...new Set((w.authorships || []).flatMap(a => (a.institutions || []).map(i => i.display_name)).filter(Boolean))];
  return {
    id: 'oa:' + w.id.split('/').pop(), type: 'paper', src: 'OpenAlex',
    domain: domain || RR.guessDomain(title + ' ' + abstract), title, abstract,
    date: w.publication_date, year: (w.publication_date || '').slice(0, 4),
    authors: auth.slice(0, 4).join(', ') + (auth.length > 4 ? ' et al.' : ''), firstAuthor: (auth[0] || '').split(' ').pop(), nAuthors: auth.length, insts,
    venue, tier: cls.tier, venueShort: cls.short, cites: w.cited_by_count || 0,
    doi: (w.doi || '').replace('https://doi.org/', ''), url: w.doi || w.primary_location?.landing_page_url || w.id,
    pdf: w.best_oa_location?.pdf_url || '', oa: !!w.open_access?.is_oa, arxiv: arxivFrom(w), related: (w.related_works || []).slice(0, 15).map(x => x.split('/').pop()),
  };
};
const TODAY = () => new Date().toISOString().slice(0, 10);
RR.fixDate = p => { if (p.date && p.date > TODAY()) { p.upcoming = true; p.date = ''; } return p; };   // proceedings dated in the future → "to appear"
/* Where the paper actually lives (instead of a generic Scholar link) */
RR.sourceOf = p => {
  const doi = (p.doi || '').toLowerCase(), u = (p.url || '').toLowerCase();
  const D = [[/^10\.1109\//, 'IEEE Xplore'], [/^10\.1145\//, 'ACM Digital Library'], [/^10\.1007\//, 'Springer'], [/^10\.1016\//, 'ScienceDirect'],
    [/^10\.48550\//, 'arXiv'], [/^10\.21437\//, 'ISCA Archive'], [/^10\.1609\//, 'AAAI Proceedings'], [/^10\.24963\//, 'IJCAI Proceedings'], [/^10\.18653\//, 'ACL Anthology'],
    [/^10\.3390\//, 'MDPI'], [/^10\.1049\//, 'IET Digital Library'], [/^10\.52202\//, 'NeurIPS Proceedings']];
  for (const [re, label] of D) if (re.test(doi)) return { label, url: 'https://doi.org/' + p.doi };
  if (/thecvf\.com/.test(u)) return { label: 'CVF Open Access', url: p.url };
  if (/openreview\.net/.test(u)) return { label: 'OpenReview', url: p.url };
  if (/proceedings\.mlr\.press/.test(u)) return { label: 'PMLR', url: p.url };
  if (/neurips\.cc|nips\.cc/.test(u)) return { label: 'NeurIPS Proceedings', url: p.url };
  if (p.doi) return { label: 'Publisher (DOI)', url: 'https://doi.org/' + p.doi };
  if (p.arxiv) return { label: 'arXiv', url: 'https://arxiv.org/abs/' + p.arxiv };
  try { return { label: new URL(p.url).hostname.replace(/^www\./, ''), url: p.url }; } catch (e) { return { label: 'Source', url: p.url }; }
};
RR.searchWorks = async ({ query, months = 24, page = 1, perPage = 100, sort = 'publication_date:desc' }) => {
  const from = new Date(Date.now() - months * 30.4 * 864e5).toISOString().slice(0, 10);
  const j = await RR.json(`${OA}/works?${oaParams({
    search: query, filter: `has_abstract:true,from_publication_date:${from}`, sort, 'per-page': perPage, page,
    select: 'id,doi,display_name,publication_date,authorships,abstract_inverted_index,primary_location,locations,best_oa_location,cited_by_count,open_access,related_works',
  })}`);
  return j.results || [];
};

// ------------------------------------------------------------------ Crossref (newest IEEE / ACM publications, incl. Early Access)
const XR_MEMBERS = { ieee: 263, acm: 320 };
const stripTags = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/^\s*(abstract)\s*/i, '').trim();
RR.crossref = async (query, domain, { months = 8, rows = 80 } = {}) => {
  const from = new Date(Date.now() - months * 30.4 * 864e5).toISOString().slice(0, 10);
  const p = new URLSearchParams({
    'query.bibliographic': query.replace(/"|\bOR\b/g, ' ').replace(/\s+/g, ' '), rows, sort: 'relevance',
    filter: `member:${XR_MEMBERS.ieee},member:${XR_MEMBERS.acm},from-pub-date:${from},type:journal-article,type:proceedings-article`,
    select: 'DOI,title,author,container-title,published,abstract,is-referenced-by-count,URL,link',
  });
  if (RR.settings.email) p.set('mailto', RR.settings.email);
  const j = await RR.json('https://api.crossref.org/works?' + p);
  const kw = RR.DOMAINS[domain]?.kw;
  return (j.message?.items || []).map(it => {
    const title = RR.tex(stripTags((it.title || [])[0])), abstract = RR.smooth(RR.tex(stripTags(it.abstract)));
    const venue = (it['container-title'] || [])[0] || '', cls = RR.classifyVenue(venue);
    const dp = it.published?.['date-parts']?.[0] || [];
    const auth = (it.author || []).map(a => [a.given, a.family].filter(Boolean).join(' '));
    const insts = [...new Set((it.author || []).flatMap(a => (a.affiliation || []).map(f => f.name)).filter(Boolean))];
    return {
      id: 'doi:' + it.DOI, type: 'paper', src: 'Crossref', domain: domain || RR.guessDomain(title + ' ' + abstract),
      title, abstract, date: dp.length ? `${dp[0]}-${String(dp[1] || 1).padStart(2, '0')}-${String(dp[2] || 1).padStart(2, '0')}` : '', year: String(dp[0] || ''),
      authors: auth.slice(0, 4).join(', ') + (auth.length > 4 ? ' et al.' : ''), firstAuthor: (it.author?.[0]?.family || ''), nAuthors: auth.length, insts,
      venue, tier: cls.tier, venueShort: cls.short, cites: it['is-referenced-by-count'] || 0,
      doi: it.DOI, url: 'https://doi.org/' + it.DOI, pdf: '', oa: false, arxiv: '', fresh: true,
    };
  }).filter(x => x.title && (!kw || kw.test(x.title + ' ' + x.abstract)));
};

/* Collect papers for one query: OpenAlex (+ Crossref IEEE/ACM). On a campus network, more pages and paywalled
   papers without abstracts are included, because you can open them directly. */
async function collect(q, domain, months = 24) {
  const allowed = RR.allowedTiers(), campus = RR.campus.on, seen = new Set(), top = [], pre = [];
  const add = p => {
    RR.fixDate(p);
    const k = titleKey(p.title); if (!p.title || seen.has(k)) return; seen.add(k);
    if (!p.abstract && !campus) return;
    if (p.tier === 'Pre') pre.push(p);
    else if (!allowed || allowed.includes(p.tier)) top.push(p);
  };
  const xr = RR.crossref(q, domain, { rows: campus ? 120 : 60 }).catch(() => []);
  const maxPages = campus ? 5 : 3;
  for (let page = 1; page <= maxPages; page++) {
    let raw = [];
    try { raw = await RR.searchWorks({ query: q, months, page }); } catch (e) { if (page === 1) throw e; break; }
    raw.forEach(w => add(RR.fixDate(RR.normalizeWork(w, domain))));
    if (top.length >= (campus ? 60 : 28) || raw.length < 100) break;
  }
  (await xr).forEach(add);
  if (top.length < 10) {   // thin recent window → add the most-cited top-venue papers
    try { (await RR.searchWorks({ query: q, months: 60, sort: 'cited_by_count:desc' })).forEach(w => { const p = RR.normalizeWork(w, domain); if (p.tier !== 'Pre') add(p); }); } catch (e) {}
  }
  top.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return RR.mixPreprints(top, pre);
}
RR.mixPreprints = (top, pre) => {
  const share = RR.settings.preprint / 100;
  if (!share || !pre.length) return top;
  const every = Math.max(1, Math.round((1 - share) / share)), out = []; let j = 0;
  top.forEach((p, i) => { out.push(p); if ((i + 1) % every === 0 && j < pre.length) out.push(pre[j++]); });
  if (!top.length) out.push(...pre.slice(0, 5));
  return out;
};
const ck = k => `t3:${k}:${RR.settings.quality}:${RR.settings.preprint}:${RR.campus.on ? 'c' : 'o'}`;
RR.domainPapers = async (domain, { force = false } = {}) => {
  const key = ck('dom:' + domain);
  if (!force) { const c = RR.cache.get(key, 1); if (c) return c; }
  const out = await collect(RR.DOMAINS[domain]?.q || domain, domain); RR.cache.set(key, out); return out;
};
RR.queryPapers = async query => {
  const key = ck('q:' + query.toLowerCase()); const c = RR.cache.get(key, 6); if (c) return c;
  const out = await collect(query, null, 36); RR.cache.set(key, out); return out;
};

// ------------------------------------------------------------------ related / similar papers (live)
const SEL = 'id,doi,display_name,publication_date,authorships,abstract_inverted_index,primary_location,locations,best_oa_location,cited_by_count,open_access,related_works';
RR.related = async (p, s2id) => {
  const key = 'rel:' + p.id; const c = RR.cache.get(key, 24); if (c) return c;
  let works = [];
  // 1) OpenAlex "related works" of this paper
  if (p.related?.length) {
    try { works = (await RR.json(`${OA}/works?${oaParams({ filter: 'openalex:' + p.related.join('|'), 'per-page': 25, select: SEL })}`)).results || []; }
    catch (e) { const r = await Promise.allSettled(p.related.slice(0, 6).map(id => RR.json(`${OA}/works/${id}?${oaParams({ select: SEL })}`))); works = r.filter(x => x.status === 'fulfilled').map(x => x.value); }
  }
  let out = works.map(w => RR.fixDate(RR.normalizeWork(w)));
  // 2) Semantic Scholar recommendations (works for Crossref-only papers too)
  if (out.length < 4 && s2id) {
    try {
      const j = await RR.json(`https://api.semanticscholar.org/recommendations/v1/papers/forpaper/${encodeURIComponent(s2id)}?limit=10&fields=title,year,venue,externalIds,abstract,publicationDate,authors,citationCount,url`, {}, 15000);
      out = out.concat((j.recommendedPapers || []).map(r => {
        const cls = RR.classifyVenue(r.venue || ''), au = (r.authors || []).map(a => a.name);
        return RR.fixDate({ id: 's2:' + r.paperId, type: 'paper', src: 'Semantic Scholar', title: RR.tex(r.title), abstract: RR.tex(r.abstract || ''), date: r.publicationDate || '', year: String(r.year || ''),
          authors: au.slice(0, 4).join(', ') + (au.length > 4 ? ' et al.' : ''), firstAuthor: (au[0] || '').split(' ').pop(), nAuthors: au.length,
          venue: r.venue || '', tier: cls.tier, venueShort: cls.short, cites: r.citationCount || 0, doi: r.externalIds?.DOI || '', arxiv: r.externalIds?.ArXiv || '',
          url: r.externalIds?.DOI ? 'https://doi.org/' + r.externalIds.DOI : r.url, pdf: '', oa: false, domain: RR.guessDomain(r.title + ' ' + (r.abstract || '')) });
      }));
    } catch (e) {}
  }
  // 3) Fallback: OpenAlex search with the title's key words
  if (out.length < 4) {
    const q = p.title.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 7).join(' ');
    try { out = out.concat((await RR.searchWorks({ query: q, months: 48, sort: 'relevance_score:desc', perPage: 15 })).map(w => RR.fixDate(RR.normalizeWork(w)))); } catch (e) {}
  }
  const seen = new Set([titleKey(p.title)]);
  out = out.filter(x => { const k = titleKey(x.title); if (!x.title || seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (RR_TIER_RANK[b.tier] || 0) - (RR_TIER_RANK[a.tier] || 0) || (b.date || b.year || '').localeCompare(a.date || a.year || '')).slice(0, 8);
  RR.cache.set(key, out); return out;
};

// ------------------------------------------------------------------ Semantic Scholar (TL;DR + arXiv id)
RR.s2 = async p => {
  const key = 's2:' + p.id; const c = RR.cache.get(key, 24 * 14); if (c !== undefined) return c;
  const f = 'fields=externalIds,tldr,openAccessPdf', S2 = 'https://api.semanticscholar.org/graph/v1/paper/';
  let r = null;
  try {
    if (p.arxiv) r = await RR.json(`${S2}ARXIV:${p.arxiv}?${f}`, {}, 12000);
    else if (p.doi) r = await RR.json(`${S2}DOI:${encodeURIComponent(p.doi)}?${f}`, {}, 12000);
  } catch (e) {}
  if (!r) { try { r = (await RR.json(`${S2}search/match?query=${encodeURIComponent(p.title)}&${f}`, {}, 12000)).data?.[0] || null; } catch (e) {} }
  const out = r ? { tldr: RR.tex(r.tldr?.text || ''), arxiv: r.externalIds?.ArXiv || '', pdf: RR.safeUrl(r.openAccessPdf?.url || ''), s2id: r.paperId || '' } : null;
  RR.cache.set(key, out); return out;
};
RR.ensureArxiv = async p => { if (p.arxiv) return p.arxiv; const s = await RR.s2(p); if (s?.arxiv) p.arxiv = s.arxiv; return p.arxiv; };

// ------------------------------------------------------------------ arXiv HTML → figures (with sub-figures) + method text
let qChain = Promise.resolve();
const queued = fn => (qChain = qChain.then(fn, fn).then(v => new Promise(r => setTimeout(() => r(v), 1500))));
const ARCH_RE = /(overview|overall|architecture|framework|pipeline|proposed|our method|our approach|network|model structure|workflow|illustration of)/i;
function pickArch(figs) {
  if (!figs.length) return null;
  return figs.map((f, i) => ({ f, s: (ARCH_RE.test(f.caption) ? 10 : 0) + (/proposed|our /i.test(f.caption) ? 4 : 0) - i * 0.5 })).sort((a, b) => b.s - a.s)[0].f;
}
function contextFor(text, n) {
  const paras = text.split(/\n{2,}/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 120 && !/^!\[|^(figure|fig\.)\s*\d/i.test(s));
  const ref = new RegExp(`(Fig(ure|\\.)?\\s*~?${n})(?!\\d)`, 'i');
  let hits = paras.filter(p => ref.test(p)).slice(0, 3);
  if (hits.length < 2) {
    const i = paras.findIndex(p => /^(#+\s*)?\d*\.?\s*(method|methodology|proposed|approach|framework|our method)/i.test(p));
    if (i >= 0) hits = hits.concat(paras.slice(i, i + 2));
  }
  return [...new Set(hits)].slice(0, 3).map(p => RR.mdCut(p.replace(/^#+\s*/, ''), 520));
}
// Markdown from r.jina.ai: images are absolute; sub-figure images precede one "Figure N:" caption.
function parseMarkdown(md) {
  const toks = []; let m;
  const img = /!\[[^\]]*\]\((https?:\/\/(?:arxiv\.org\/html|ar5iv\.labs\.arxiv\.org\/html)\/[^)\s]+\.(?:png|jpe?g|gif|svg|webp))\)/gi;
  const cap = /(?:^|\n)\s*(?:\*\*)?(?:Figure|Fig\.)\s*(\d+)\s*[:.|](?:\*\*)?\s*([^\n]{10,700})/gi;
  while ((m = img.exec(md))) toks.push({ i: m.index, img: m[1] });
  while ((m = cap.exec(md))) toks.push({ i: m.index, n: +m[1], cap: m[2] });
  toks.sort((a, b) => a.i - b.i);
  const figs = []; let pend = [];
  for (const t of toks) {
    if (t.img) { pend.push(t.img); continue; }
    if (pend.length && !figs.some(f => f.n === t.n)) figs.push({ n: t.n, src: pend[0], srcs: pend.slice(0, 6), caption: t.cap.replace(/\*+/g, '').trim() });
    pend = [];
  }
  return figs;
}
function mdText(el, base) {   // element text with its links preserved as [text](absolute-url)
  const c = el.cloneNode(true);
  c.querySelectorAll('a[href]').forEach(a => { let u = ''; try { u = new URL(a.getAttribute('href'), base).href; } catch (e) {} const tx = a.textContent.replace(/\s+/g, ' ').trim();
    a.replaceWith(c.ownerDocument.createTextNode(u && tx && /^https?:/.test(u) ? `[${tx}](${u})` : tx)); });
  c.querySelectorAll('math').forEach(m => m.replaceWith(c.ownerDocument.createTextNode(m.getAttribute('alttext') || m.textContent)));
  return c.textContent.replace(/\s+/g, ' ').trim();
}
function parseHTML(html, id) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ver = (html.match(new RegExp(id.replace('.', '\\.') + '(v\\d+)')) || [])[1] || '';
  const base = `https://arxiv.org/html/${id}${ver}/`, figs = [];
  doc.querySelectorAll('figure.ltx_figure').forEach(fg => {
    if (fg.parentElement?.closest('figure.ltx_figure')) return;
    const imgs = [...fg.querySelectorAll('img')].map(i => RR.safeUrl(new URL(i.getAttribute('src') || '', base).href)).filter(Boolean);
    const cap = fg.querySelector(':scope > figcaption') || fg.querySelector('figcaption');
    if (!imgs.length || !cap) return;
    const t = mdText(cap, base), n = +(t.match(/(?:Figure|Fig\.)\s*(\d+)/i) || [])[1];
    if (!n || figs.some(f => f.n === n)) return;
    figs.push({ n, src: imgs[0], srcs: imgs.slice(0, 6), caption: t.replace(/^(Figure|Fig\.)\s*\d+\s*[:.]?\s*/i, '') });
  });
  const text = [...doc.querySelectorAll('.ltx_para, h2, h3')].map(e => (e.tagName[0] === 'H' ? '# ' + e.textContent : mdText(e, base))).join('\n\n');
  return { figs, text };
}
// ---- tables, algorithms, conclusion, limitations from the full text
const cellClean = c => RR.tex(c.replace(/\*\*|__/g, '')).replace(/\s+/g, ' ').trim().slice(0, 42);
function parseTablesMd(md) {
  const tabs = [], capRe = /(?:^|\n)\s*(?:\*\*)?Table\s*(\d+)\s*[:.|](?:\*\*)?\s*([^\n]{5,400})/gi; let m;
  while ((m = capRe.exec(md)) && tabs.length < 8) {
    const n = +m[1]; if (tabs.some(t => t.n === n)) continue;
    const win = md.slice(Math.max(0, m.index - 2500), m.index + 3000), after = md.slice(m.index, m.index + 3000);
    const block = (after.match(/\n(\|[^\n]+\|\n){2,}/) || win.match(/\n(\|[^\n]+\|\n){2,}/) || [])[0];
    if (!block) continue;
    const rows = block.trim().split('\n').filter(r => !/^\|\s*:?-{2,}/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|').map(cellClean))
      .filter(r => r.some(Boolean)).slice(0, 12).map(r => r.slice(0, 8));
    if (rows.length >= 2) tabs.push({ n, caption: m[2].replace(/\*+/g, '').trim(), rows });
  }
  return tabs;
}
function parseAlgosMd(md) {
  const out = [], re = /(?:^|\n)\s*(?:\*\*)?Algorithm\s*(\d+)\s*(?:\*\*)?\s*[:.]?\s*([^\n]{3,160})\n([\s\S]{20,2200}?)(?=\n\s*\n\s*\n|\n#|\n\s*(?:\*\*)?(?:Figure|Table|Algorithm)\s*\d)/gi; let m;
  while ((m = re.exec(md)) && out.length < 4) {
    if (out.some(a => a.n === +m[1])) continue;
    const lines = m[3].split('\n').map(l => l.replace(/\*\*|\$|\\[a-z]+\{?|\}/g, '').replace(/\s+/g, ' ').trim()).filter(l => l.length > 1).slice(0, 16);
    if (lines.length >= 2) out.push({ n: +m[1], caption: m[2].replace(/\*+/g, '').trim(), lines });
  }
  return out;
}
function section(md, re) {
  const m = md.match(new RegExp('#+\\s*\\d*\\.?\\s*(' + re + ')[^\\n]*\\n([\\s\\S]{80,2500}?)(?=\\n#|$)', 'i'));
  return m ? m[2].replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim() : '';
}
function extras(text, html) {
  let tables = [], algos = [];
  if (html) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    doc.querySelectorAll('figure.ltx_table').forEach(fg => {
      const cap = fg.querySelector('figcaption')?.textContent.replace(/\s+/g, ' ').trim() || '', n = +(cap.match(/Table\s*(\d+)/i) || [])[1], tb = fg.querySelector('table');
      if (!n || !tb || tables.length >= 8) return;
      const rows = [...tb.querySelectorAll('tr')].slice(0, 12).map(tr => [...tr.children].slice(0, 8).map(td => cellClean(td.textContent)));
      if (rows.length >= 2) tables.push({ n, caption: cap.replace(/^Table\s*\d+\s*[:.]?\s*/i, ''), rows });
    });
    doc.querySelectorAll('figure.ltx_float_algorithm').forEach(fg => {
      const cap = fg.querySelector('figcaption')?.textContent.replace(/\s+/g, ' ').trim() || '', n = +(cap.match(/Algorithm\s*(\d+)/i) || [])[1];
      const lines = [...fg.querySelectorAll('.ltx_listingline')].map(l => l.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 16);
      if (n && lines.length >= 2 && algos.length < 4) algos.push({ n, caption: cap.replace(/^Algorithm\s*\d+\s*/i, ''), lines });
    });
    text = [...doc.querySelectorAll('.ltx_para, h2, h3')].map(e => (e.tagName[0] === 'H' ? '# ' : '') + e.textContent).join('\n\n');
  } else { tables = parseTablesMd(text); algos = parseAlgosMd(text); }
  const conclusion = section(text, 'Conclusions?|Concluding Remarks|Discussion and Conclusions?|Summary and Conclusions?');
  let limitations = section(text, 'Limitations?|Limitations and Future Work|Broader Impact and Limitations');
  if (!limitations) { const P = protect(text.replace(/\s+/g, ' ')); limitations = P.back((P.s.match(/[^.]*\b(limitation|fails? to|future work|does not (handle|generalize)|struggles? with)\b[^.]*\./gi) || []).slice(0, 3).join(' ')); }
  const trim = (s, n) => RR.mdCut(s, n);
  return { tables, algos, conclusion: trim(conclusion, 700), limitations: trim(limitations, 600) };
}
/* Markdown links like "[Pinto et al., 2024](https://arxiv.org/html/…#bib.bib11)" are kept (the UI turns them into
   hyperlinks), so every cut / sentence split must never break inside one. */
const MDLINK = /\[[^\]]{1,200}\]\(https?:[^)\s]+\)/g;
RR.mdCut = (s, n) => {
  s = String(s || ''); if (s.length <= n) return s;
  let cut = n; for (const m of s.matchAll(MDLINK)) { if (m.index < cut && m.index + m[0].length > cut) { cut = m.index + m[0].length; break; } }
  return s.slice(0, cut).replace(/\s+\S*$/, '') + '…';
};
const protect = s => { const keep = []; return { s: s.replace(MDLINK, m => { keep.push(m); return '\u0001' + (keep.length - 1) + '\u0001'; }), back: t => t.replace(/\u0001(\d+)\u0001/g, (_, i) => keep[+i]) }; };
RR.mdPlain = s => RR.smooth(String(s || '')).replace(/(\w)\(\[/g, '$1 ([').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*|__|\$/g, '');
const RES_RE = /(result|qualitative|visuali[sz]ation|comparison with|compared with|performance|ablation|heat ?map|localization result|detection result|examples of|samples)/i;
RR.figures = async p => {
  const id = await RR.ensureArxiv(p).catch(() => ''); if (!id) return null;
  const key = 'fig7:' + id; const c = RR.cache.get(key, 24 * 14); if (c !== undefined) return c;
  const h = RR.settings.jinaKey ? { headers: { Authorization: 'Bearer ' + RR.settings.jinaKey } } : {};
  // 1) arXiv native HTML (2024+)  2) ar5iv (older arXiv papers)  3) proxy fallback for either
  const tries = [
    () => queued(() => RR.text('https://r.jina.ai/https://arxiv.org/html/' + id, h, 30000)).then(t => ({ figs: parseMarkdown(t), text: t, html: 'https://arxiv.org/html/' + id })),
    () => queued(() => RR.text('https://r.jina.ai/https://ar5iv.labs.arxiv.org/html/' + id, h, 30000)).then(t => ({ figs: parseMarkdown(t), text: t, html: 'https://ar5iv.labs.arxiv.org/html/' + id })),
    () => queued(() => RR.text('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://arxiv.org/html/' + id), {}, 30000)).then(t => ({ ...parseHTML(t, id), raw: t, isHtml: true, html: 'https://arxiv.org/html/' + id })),
  ];
  let got = null;
  for (const t of tries) { try { const r = await t(); if (r.figs.length) { got = r; break; } } catch (e) {} }
  if (!got) { RR.cache.set(key, null); return null; }
  got.figs.forEach(f => { f.caption = RR.smooth(RR.tex(f.caption)); }); got.text = RR.smooth(RR.tex(got.text));
  const figs = got.figs.slice(0, 12), arch = pickArch(figs);
  const results = figs.find(f => f !== arch && RES_RE.test(f.caption)) || null;
  const teaser = figs.find(f => f.n === 1 && f !== arch) || null;
  const ex = extras(got.isHtml ? got.raw : got.text, got.isHtml);
  const paras = got.text.split(/\n{2,}/).map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x.length > 80 && !/^!\[|^\W*(figure|fig\.|table)\s*\d/i.test(x));
  const ctxOf = {}; figs.forEach(f => { const re = new RegExp(`(Fig(ure|\\.)?\\s*~?${f.n})(?!\\d)`, 'i'); const h = paras.find(x => re.test(x)); if (h) { const P = protect(h), sn = P.s.match(/[^.]*\bFig(?:ure|\.)?\s*~?\d[^.]*\./i); ctxOf[f.n] = RR.mdCut(P.back((sn ? sn[0] : P.s).trim()), 360); } });
  const out = { id, html: got.html, figs, arch, results, teaser, ctxOf, ...ex, context: contextFor(got.text, arch.n),
    method: (got.text.match(/#+\s*\d*\.?\s*(?:Method|Methodology|Proposed[^\n]*|Approach)[^\n]*\n([\s\S]{200,3500})/i)?.[1] || '').replace(/\s+/g, ' ').slice(0, 3500) };
  RR.cache.set(key, out); return out;
};

/* Professional crop: trims white margins of a figure on a canvas (only possible when the image host allows CORS).
   Returns an object URL, or the original URL if cropping isn't possible. */
const cropCache = new Map();
RR.cropFigure = src => {
  if (cropCache.has(src)) return cropCache.get(src);
  const p = (async () => {
    try {
      const blob = await fetchT(src, { mode: 'cors' }, 15000).then(r => r.blob());
      const bmp = await createImageBitmap(blob);
      const W = bmp.width, H = bmp.height; if (W * H > 16e6) return src;
      const cv = new OffscreenCanvas(W, H), cx = cv.getContext('2d', { willReadFrequently: true });
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); cx.drawImage(bmp, 0, 0);
      const d = cx.getImageData(0, 0, W, H).data, ink = (x, y) => { const i = (y * W + x) * 4; return d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240; };
      let t = 0, b = H - 1, l = 0, r = W - 1;
      const rowInk = y => { for (let x = 0; x < W; x += 2) if (ink(x, y)) return true; return false; };
      const colInk = x => { for (let y = t; y <= b; y += 2) if (ink(x, y)) return true; return false; };
      while (t < b && !rowInk(t)) t++; while (b > t && !rowInk(b)) b--; while (l < r && !colInk(l)) l++; while (r > l && !colInk(r)) r--;
      const pad = Math.round(Math.min(W, H) * 0.02), x0 = Math.max(0, l - pad), y0 = Math.max(0, t - pad), w = Math.min(W, r + pad) - x0, h = Math.min(H, b + pad) - y0;
      if (w < 40 || h < 40 || (w > W * 0.97 && h > H * 0.97)) return src;
      const out = new OffscreenCanvas(w, h); out.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, w, h);
      return URL.createObjectURL(await out.convertToBlob({ type: 'image/png' }));
    } catch (e) { return src; }
  })();
  cropCache.set(src, p); return p;
};

// ------------------------------------------------------------------ quick summary (no AI)
const CUES = {
  why: /\b(however|challeng|limitation|limited|existing|remain|lack|suffer|vulnerab|threat|problem|difficult|fail|struggl|concern|risk|increasingly)/i,
  nov: /\b(we propose|we introduce|we present|we develop|this paper|in this work|novel|first)\b/i,
  arch: /\b(network|module|encoder|decoder|transformer|branch|backbone|attention|architecture|pipeline|layer|block|fusion|diffusion|loss|stage|graph)\b/i,
  res: /(outperform|achiev|state-of-the-art|\bsota\b|%|improv|experiment|accuracy|\bauc\b|\beer\b|benchmark|demonstrat|surpass)/i,
};
/* split on sentence ends only (keeps decimals like 1.76×, "et al.", "e.g." intact) */
const sents = t => String(t || '').replace(/\b(et al|e\.g|i\.e|vs|Fig|Eq|Sec|Tab|resp)\.\s/g, '$1\u0003 ').split(/(?<=[.!?])\s+(?=[A-Z0-9(\["“])/).map(s => s.replace(/\u0003/g, '.').trim()).filter(s => s.length > 25);
RR.quickSummary = (p, tldr) => {
  if (!p.abstract) return { inshort: tldr || `Just published in ${p.venue || 'a top venue'}. The abstract isn't indexed yet — open it on the publisher site${RR.campus.on ? ' (your campus network has access)' : ''}.`,
    slides: [{ arch: true, icon: '🏗️', title: 'Architecture', points: [] }], by: tldr ? 'Semantic Scholar TL;DR' : 'metadata only' };
  const ss = sents(p.abstract), pick = (re, n) => ss.filter(s => re.test(s)).slice(0, n);
  const why = pick(CUES.why, 2), nov = pick(CUES.nov, 2), arch = pick(CUES.arch, 3), res = pick(CUES.res, 3);
  const slides = [];
  if (why.length) slides.push({ icon: '❓', title: 'Why do we need this?', text: why.join(' ') });
  slides.push({ icon: '🔑', title: 'Key points', points: ss.slice(0, 4) });
  if (nov.length) slides.push({ icon: '✨', title: "What's new", text: nov.join(' ') });
  slides.push({ arch: true, icon: '🏗️', title: 'Architecture', points: arch });
  if (res.length) slides.push({ icon: '📊', title: 'Main results', points: res });
  return { inshort: tldr || [nov[0] || ss[0], res[0]].filter(Boolean).join(' ').split(' ').slice(0, 65).join(' '), slides, by: tldr ? 'Semantic Scholar TL;DR + abstract' : 'abstract (rule-based)' };
};

// ------------------------------------------------------------------ optional LLM (your own free key; called directly from your browser)
RR.hasLLM = () => RR.settings.llm !== 'none' && !!RR.settings.llmKey;
RR.llm = async (system, user) => {
  const s = RR.settings; let txt = '';
  if (s.llm === 'gemini') {
    const j = await RR.json(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.llmModel || 'gemini-2.5-flash')}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.llmKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } }),
    }, 60000);
    txt = j.candidates?.[0]?.content?.parts?.map(x => x.text).join('') || '';
  } else {
    const base = RR.safeUrl(s.llmBase); if (!base.startsWith('https://')) throw new Error('LLM base URL must be https');
    const j = await RR.json(base.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.llmKey },
      body: JSON.stringify({ model: s.llmModel || 'openrouter/auto', temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    }, 60000);
    txt = j.choices?.[0]?.message?.content || '';
  }
  const m = txt.match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : txt);
};
const PAPER_SYS = `You turn research papers into accurate reel slides for PhD researchers in computer vision, deepfakes, media forensics, watermarking, document analysis and biometrics.
Use ONLY the given text. Never invent numbers or names. Plain, vivid English. Return JSON:
{"inshort":"<=60 words","why":"1-2 sentences","keypoints":["3-5 bullets"],"novelty":"1-2 sentences","architecture":["3-6 steps input→output"],
"results":["2-4 bullets, numbers only if present"],"limitations":"1-2 sentences or 'Not stated'","eli5":"2 sentences with an analogy"}`;
RR.aiSummary = async (p, extra = '') => {
  const key = 'ai3:' + p.id; const c = RR.cache.get(key, 24 * 60); if (c) return c;
  const j = await RR.llm(RR.STORY_SYS, `Title: ${p.title}\nVenue: ${p.venue} ${p.year}\nAbstract: ${p.abstract}\n${extra ? 'Method section excerpt: ' + extra : ''}`);
  const out = { inshort: j.inshort || j.one_liner, story: j, slides: [], by: 'AI (' + (RR.settings.llmModel || RR.settings.llm) + ')' };
  RR.cache.set(key, out); return out;
};
RR.aiArch = async (p, fig) => {
  const key = 'aiarch:' + p.id + ':' + fig.arch.n; const c = RR.cache.get(key, 24 * 60); if (c) return c;
  const j = await RR.llm(`Explain a deep-learning architecture figure to a PhD student using ONLY the caption and excerpts. Return JSON:
{"overview":"2 sentences","components":[{"name":"","role":"1 sentence"}],"dataflow":["4-7 steps"],"training":"losses if mentioned else ''","why_it_works":"1-2 sentences"}`,
  `Paper: ${p.title}\nFigure ${fig.arch.n} caption: ${RR.mdPlain(fig.arch.caption)}\nExcerpts:\n${fig.context.join('\n')}\nMethod: ${fig.method.slice(0, 2500)}\nAbstract: ${p.abstract}`);
  RR.cache.set(key, j); return j;
};
RR.aiIdeas = async papers => {
  const key = 'ideas:' + new Date().toISOString().slice(0, 10); const c = RR.cache.get(key, 24); if (c) return c;
  const list = papers.slice(0, 25).map(p => `- [${p.venueShort || 'preprint'} ${p.year}] ${p.title}`).join('\n');
  const j = await RR.llm(`You are a senior researcher in deepfake detection, media forensics, watermarking, document forensics and biometric security.
Propose 4 concrete, publishable research ideas that combine or extend the listed papers. Return JSON:
{"ideas":[{"title":"","domain":"${Object.keys(RR.DOMAINS).join('|')}","inshort":"<=55 words","gap":"","method":["3-5 steps"],"experiments":["datasets/metrics/baselines"],"risks":"","inspired_by":["exact titles"]}]}`, list);
  const ideas = (j.ideas || []).map((d, i) => ({
    id: 'idea:' + key + ':' + i, type: 'idea', domain: RR.DOMAINS[d.domain] ? d.domain : 'deepfake', title: d.title, inshort: d.inshort,
    authors: 'AI-generated from today’s papers — check novelty', date: new Date().toISOString().slice(0, 10),
    slides: [{ icon: '🕳️', title: 'The gap', text: d.gap }, { icon: '🛠️', title: 'Method sketch', flow: d.method },
      { icon: '🧪', title: 'Experiments', points: d.experiments }, { icon: '⚠️', title: 'Risks', text: d.risks },
      { icon: '📚', title: 'Inspired by', points: d.inspired_by }].filter(x => x.text || x.points?.length || x.flow?.length),
  }));
  RR.cache.set(key, ideas); return ideas;
};

// ------------------------------------------------------------------ live deadlines (ccfddl/ccf-deadlines)
const DDL = 'https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/conference/';
const tzOff = tz => { if (!tz || /aoe/i.test(tz)) return -12; const m = tz.match(/UTC\s*([+-]\d+)/i); return m ? +m[1] : 0; };
function toDate(s, tz) {
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/); if (!m) return null;
  return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 23), +(m[5] || 59), +(m[6] || 59)) - tzOff(tz) * 36e5);
}
RR.deadlines = async () => {
  const c = RR.cache.get('ddl', 24); if (c) return c.map(x => ({ ...x, t: x.t ? new Date(x.t) : null }));
  const files = [...new Set(window.RR_VENUES.map(v => v.ddl).filter(Boolean))];
  const res = await Promise.allSettled(files.map(f => RR.text(DDL + f + '.yml', {}, 15000).then(t => window.jsyaml.load(t)[0])));
  const out = [], now = Date.now();
  res.forEach(r => {
    if (r.status !== 'fulfilled' || !r.value?.confs) return;
    const d = r.value, confs = d.confs.slice().sort((a, b) => b.year - a.year);
    for (const c of confs) {
      const tl = (c.timeline || []).map(t => ({ dl: toDate(t.deadline, c.timezone), adl: t.abstract_deadline ? toDate(t.abstract_deadline, c.timezone) : null }));
      const next = tl.filter(t => t.dl && t.dl > now).sort((a, b) => a.dl - b.dl)[0], last = tl.filter(t => t.dl).sort((a, b) => b.dl - a.dl)[0];
      const base = { name: `${d.title} ${c.year}`, rank: d.rank, place: c.place, date: c.date, url: RR.safeUrl(c.link) };
      if (!next && !last && c === confs[0]) { out.push({ ...base, what: 'Deadline TBA', t: null }); break; }
      if (next || last) {
        if (next?.adl && next.adl > now) out.push({ ...base, what: 'Abstract registration', t: next.adl });
        out.push({ ...base, what: next ? 'Paper deadline' : 'Paper deadline (passed)', t: (next || last).dl });
        break;
      }
    }
  });
  RR.cache.set('ddl', out); return out;
};

// ------------------------------------------------------------------ "rising" papers per domain (citations per month, top venues only)
RR.rising = (papers, n = 5) => papers.filter(p => p.tier && p.tier !== 'Pre' && p.date)
  .map(p => ({ p, v: (p.cites || 0) / Math.max(1, (Date.now() - new Date(p.date)) / (30.4 * 864e5)) }))
  .sort((a, b) => b.v - a.v).slice(0, n);
})();
