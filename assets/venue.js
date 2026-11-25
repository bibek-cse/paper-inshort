/*!
 * PaperInShot — https://bibek-cse.github.io/paper-inshort/
 * Copyright (c) 2026 Bibek (GitHub: bibek-cse). All rights reserved.
 * Unauthorised copying, modification, redistribution or re-hosting of this file,
 * via any medium, is prohibited without prior written permission. See LICENSE.
 */
/* Venue explorer: type "icpr", "tifs", "cvpr"… → ranking, next deadline, stats and the right links.
   Live data: ccfddl/ccf-deadlines (CORE / CCF / THCPL ranks, dates) + OpenAlex sources (h-index, output, citations). */
(() => {
'use strict';
const RR = window.RR;
const DDL_RAW = 'https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/conference/';
const SUBS = { AI: 'Artificial Intelligence', CG: 'Graphics & Multimedia', SC: 'Network & System Security', DB: 'Databases / Data Mining / IR', MX: 'Interdisciplinary / Emerging',
  HI: 'Human–Computer Interaction', NW: 'Computer Networks', DS: 'Architecture / Parallel / Storage', SE: 'Software Engineering / Systems', CT: 'Theory' };
RR.RANK_HELP = {
  core: { 'A*': 'Flagship — a leading venue in the discipline.', A: 'Excellent — highly respected in the field.', B: 'Good — well regarded, solid venue.', C: 'Meets minimum standards for a ranked venue.' },
  ccf: { A: 'Top tier on the China Computer Federation list.', B: 'Second tier on the CCF list.', C: 'Third tier on the CCF list.' },
};
/* Journals: short name → full title (used for OpenAlex lookup and display) */
RR.JOURNALS = {
  TPAMI: 'IEEE Transactions on Pattern Analysis and Machine Intelligence', TIFS: 'IEEE Transactions on Information Forensics and Security',
  TIP: 'IEEE Transactions on Image Processing', TMM: 'IEEE Transactions on Multimedia', TCSVT: 'IEEE Transactions on Circuits and Systems for Video Technology',
  TNNLS: 'IEEE Transactions on Neural Networks and Learning Systems', TDSC: 'IEEE Transactions on Dependable and Secure Computing',
  TBIOM: 'IEEE Transactions on Biometrics, Behavior, and Identity Science', TASLP: 'IEEE/ACM Transactions on Audio, Speech, and Language Processing',
  TCYB: 'IEEE Transactions on Cybernetics', TAFFC: 'IEEE Transactions on Affective Computing', TKDE: 'IEEE Transactions on Knowledge and Data Engineering',
  JSTSP: 'IEEE Journal of Selected Topics in Signal Processing', SPL: 'IEEE Signal Processing Letters', TOMM: 'ACM Transactions on Multimedia Computing, Communications, and Applications',
  TOPS: 'ACM Transactions on Privacy and Security', CSUR: 'ACM Computing Surveys', IJCV: 'International Journal of Computer Vision', PR: 'Pattern Recognition',
  PRL: 'Pattern Recognition Letters', IJDAR: 'International Journal on Document Analysis and Recognition', 'IET BIOMETRICS': 'IET Biometrics',
  'INFORMATION FUSION': 'Information Fusion', 'IEEE ACCESS': 'IEEE Access', CVIU: 'Computer Vision and Image Understanding', TIST: 'ACM Transactions on Intelligent Systems and Technology',
};
RR.VENUE_SUGGEST = ['CVPR', 'ICCV', 'ECCV', 'ICPR', 'WACV', 'ICDAR', 'IJCB', 'FG', 'ICASSP', 'Interspeech', 'ACM MM', 'NeurIPS', 'TPAMI', 'TIFS', 'TIP', 'TBIOM', 'IJCV', 'PR'];

async function findDdlPath(q) {
  const key = q.toLowerCase().replace(/[^a-z0-9]/g, '');
  const v = window.RR_VENUES.find(x => x.ddl && x.short.toLowerCase().replace(/[^a-z0-9]/g, '') === key);
  if (v) return v.ddl;
  const cached = RR.cache.get('ddltree', 24 * 7);
  let files = cached;
  if (!files) {
    try {
      const t = await RR.json('https://api.github.com/repos/ccfddl/ccf-deadlines/git/trees/main?recursive=1', {}, 12000);
      files = (t.tree || []).map(x => x.path).filter(p => /^conference\/[A-Z]+\/[^/]+\.yml$/.test(p)).map(p => p.slice(11, -4));
      RR.cache.set('ddltree', files);
    } catch (e) { files = null; }
  }
  if (files) return files.find(f => f.split('/')[1] === key) || null;
  // no API access → try each category folder directly
  const tries = await Promise.allSettled(Object.keys(SUBS).map(s => RR.text(DDL_RAW + s + '/' + key + '.yml', {}, 8000).then(() => s + '/' + key)));
  return tries.find(t => t.status === 'fulfilled')?.value || null;
}
const tzOff = tz => { if (!tz || /aoe/i.test(tz)) return -12; const m = tz.match(/UTC\s*([+-]\d+)/i); return m ? +m[1] : 0; };
const toDate = (s, tz) => { const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/); return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 23), +(m[5] || 59)) - tzOff(tz) * 36e5) : null; };

async function openalexSource(name, type) {
  const p = new URLSearchParams({ search: name, 'per-page': 10, select: 'id,display_name,type,host_organization_name,issn_l,works_count,cited_by_count,summary_stats,homepage_url,counts_by_year,is_oa' });
  if (RR.settings.email) p.set('mailto', RR.settings.email);
  const j = await RR.json('https://api.openalex.org/sources?' + p);
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, ''), res = (j.results || []).filter(r => !type || r.type === type || (type === 'conference' && /conference|repository/.test(r.type)));
  const score = r => { const d = r.display_name.toLowerCase().replace(/[^a-z0-9 ]/g, ''); return (d === n ? 100 : d.includes(n) ? 40 : 0) - (/workshop/.test(d) && !/workshop/.test(n) ? 50 : 0) + Math.log10((r.works_count || 0) + 1) * 4; };
  return res.sort((a, b) => score(b) - score(a))[0] || null;
}

/* Main lookup. Returns a plain object the UI renders. Cached 1 day. */
RR.venueInfo = async raw => {
  const q = raw.trim(); if (!q) return null;
  const ckey = 'venue:' + q.toLowerCase(); const c = RR.cache.get(ckey, 24); if (c) return c;
  const up = q.toUpperCase().replace(/^IEEE\s+/, '');
  const jFull = RR.JOURNALS[up] || Object.values(RR.JOURNALS).find(v => v.toLowerCase() === q.toLowerCase());
  const local = window.RR_VENUES.find(v => v.short.toLowerCase() === q.toLowerCase()) || window.RR_VENUES.find(v => v.re.test(q) && !(v.not && v.not.test(q)));
  const out = { query: q, kind: jFull ? 'journal' : 'conference', short: jFull ? (RR.JOURNALS[up] ? up : q) : (local?.short || q.toUpperCase()), links: [] };

  if (!jFull) {
    const path = await findDdlPath(local?.short || q);
    if (path) {
      try {
        const d = window.jsyaml.load(await RR.text(DDL_RAW + path + '.yml', {}, 12000))[0];
        out.full = d.description; out.short = d.title; out.area = SUBS[d.sub] || d.sub; out.rank = d.rank || {}; out.dblp = d.dblp;
        const now = Date.now(), eds = (d.confs || []).slice().sort((a, b) => b.year - a.year);
        out.editions = eds.slice(0, 4).map(e => {
          const tl = (e.timeline || []).map(t => ({ dl: toDate(t.deadline, e.timezone), adl: t.abstract_deadline ? toDate(t.abstract_deadline, e.timezone) : null, comment: t.comment || '' }));
          const main = tl.filter(t => t.dl).sort((a, b) => a.dl - b.dl);
          return { year: e.year, link: RR.safeUrl(e.link || ''), date: e.date || '', place: e.place || '', tz: e.timezone || '',
            deadline: main.find(t => t.dl > now)?.dl || main.pop()?.dl || null, abstract: tl.find(t => t.adl)?.adl || null, tba: !main.length };
        });
        out.next = out.editions.find(e => e.deadline && e.deadline > now) || null;
      } catch (e) {}
    }
    if (!out.rank && local) out.rank = { core: ['A*', 'A', 'B'].includes(local.tier) ? local.tier : '' };
  } else out.full = jFull;

  try {
    const src = await openalexSource(out.full || q, out.kind === 'journal' ? 'journal' : null);
    if (src) out.oa = { name: src.display_name, publisher: src.host_organization_name, issn: src.issn_l, works: src.works_count, cites: src.cited_by_count,
      h: src.summary_stats?.h_index, i10: src.summary_stats?.i10_index, impact: src.summary_stats?.['2yr_mean_citedness'], home: RR.safeUrl(src.homepage_url || ''),
      oaJournal: src.is_oa, years: (src.counts_by_year || []).slice(0, 6).reverse(), id: src.id };
  } catch (e) {}

  const name = encodeURIComponent(out.short || q), full = encodeURIComponent(out.full || q);
  const L = (label, url, note) => { const u = RR.safeUrl(url); if (u) out.links.push({ label, url: u, note }); };
  if (out.kind === 'conference') {
    L('Official website', out.next?.link || out.editions?.[0]?.link || out.oa?.home, 'Latest edition');
    L('CORE ranking portal', `https://portal.core.edu.au/conf-ranks/?search=${name}&by=all&source=all&sort=atitle&page=1`, 'Official CORE rank & history');
    if (out.dblp) L('DBLP — all papers', `https://dblp.org/db/conf/${encodeURIComponent(out.dblp)}/index.html`, 'Proceedings by year');
    L('WikiCFP', `http://www.wikicfp.com/cfp/servlet/tool.search?q=${name}&year=t`, 'Calls for papers');
  } else {
    L('Journal homepage', out.oa?.home, out.oa?.publisher);
    L('SCImago (SJR & quartile)', `https://www.scimagojr.com/journalsearch.php?q=${out.oa?.issn || full}`, 'Q1–Q4 by subject area');
    L('DBLP — all papers', `https://dblp.org/search/venue?q=${full}`, 'Volumes & issues');
  }
  L('Google Scholar Metrics', `https://scholar.google.com/citations?hl=en&view_op=search_venues&vq=${name}`, 'h5-index');
  if (out.oa?.id) L('OpenAlex profile', out.oa.id.replace('https://openalex.org/', 'https://openalex.org/sources/'), 'Live publication data');
  out.found = !!(out.full || out.oa);
  RR.cache.set(ckey, out); return out;
};
})();
