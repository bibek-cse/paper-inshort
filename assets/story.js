/*!
 * PaperInShot — https://bibek-cse.github.io/paper-inshort/
 * Copyright (c) 2026 Bibek (GitHub: bibek-cse). All rights reserved.
 * Unauthorised copying, modification, redistribution or re-hosting of this file,
 * via any medium, is prohibited without prior written permission. See LICENSE.
 */
/* Paper-centric storytelling: turns ONE paper (abstract + figures + metadata) into a deck whose
   slides, order and titles depend on what kind of paper it is and what it actually contains. */
(() => {
'use strict';
const RR = window.RR;

// ------------------------------------------------------------------ beginner glossary (shown only if the paper uses the term)
const GLOSS = {
  'AUC': 'Area under the ROC curve. 1.0 = perfect separation, 0.5 = coin flip.',
  'EER': 'Equal Error Rate: where false accepts = false rejects. Lower is better.',
  'ACC': 'Accuracy: share of samples classified correctly.',
  'F1': 'Balance of precision and recall; 1.0 is perfect.',
  'IoU': 'Overlap between predicted and true region (0–1). Used for localization.',
  'PSNR': 'Image quality after a change, in dB. Higher = closer to the original.',
  'SSIM': 'Structural similarity (0–1). Higher = looks more like the original.',
  'APCER': 'Attacks wrongly accepted as genuine (spoof gets through).',
  'BPCER': 'Genuine users wrongly rejected as attacks.',
  'ViT': 'Vision Transformer: cuts an image into patches and lets them "talk" via attention.',
  'CNN': 'Convolutional network: slides small filters over the image to find patterns.',
  'CLIP': 'Model trained on image–caption pairs; its features generalise very well.',
  'GAN': 'Two networks compete: one fakes, one detects. Produces realistic images.',
  'diffusion': 'Generates images by removing noise step by step.',
  'transformer': 'Architecture built on attention: every token can look at every other token.',
  'attention': 'Lets the model weigh which parts of the input matter most.',
  'contrastive': 'Learning by pulling matching pairs together and pushing others apart.',
  'self-supervised': 'Learning from unlabeled data by creating its own training signal.',
  'zero-shot': 'Working on classes or data never seen during training.',
  'generalization': 'How well a model works on new, unseen data or generators.',
  'cross-dataset': 'Trained on one dataset, tested on another: a tough generalisation test.',
  'watermark': 'A hidden signal embedded in content to prove origin.',
  'steganography': 'Hiding a message inside a file so nobody notices it is there.',
  'adversarial': 'Tiny, crafted changes that fool a model.',
  'localization': 'Not just "is it fake?" but "where exactly is it fake?" (pixel mask).',
  'frequency': 'Looking at the image as waves (e.g. FFT/DCT); fakes often leave traces there.',
  'DCT': 'Discrete Cosine Transform: the frequency view JPEG uses.',
  'JPEG': 'Common lossy compression; it can erase subtle forgery traces.',
  'anti-spoofing': 'Detecting fake inputs (photo, mask, synthetic voice) to a biometric system.',
  'presentation attack': 'Showing a fake (print, replay, mask) to a biometric sensor.',
  'speaker verification': 'Checking whether a voice belongs to the claimed person.',
  'LoRA': 'Cheap fine-tuning: trains small extra matrices instead of the whole model.',
  'prototype': 'A learned "typical example" the model compares inputs against.',
  'Mamba': 'State-space sequence model: transformer-like power, linear cost.',
  'VLM': 'Vision-language model: understands images and text together.',
  'LLM': 'Large language model.',
  'benchmark': 'A standard test set so methods can be compared fairly.',
  'ablation': 'Removing one part at a time to see what really helps.',
};
const DATASETS = ['FaceForensics++', 'FF++', 'Celeb-DF', 'DFDC', 'DFD', 'DeeperForensics', 'WildDeepfake', 'DeepfakeBench', 'GenImage', 'ForenSynths', 'DiffusionForensics',
  'CASIA', 'Columbia', 'Coverage', 'NIST16', 'IMD2020', 'DocTamper', 'ASVspoof', 'In-the-Wild', 'WaveFake', 'VoxCeleb', 'LibriSpeech', 'LFW', 'IJB-C', 'IJB-B', 'MS1M',
  'CASIA-WebFace', 'OULU-NPU', 'SiW', 'CelebA', 'FFHQ', 'COCO', 'ImageNet', 'LAION', 'CEDAR', 'GPDS', 'MCYT', 'BHSig260', 'IAM', 'FUNSD', 'DocVQA', 'ADE20K', 'Kinetics'];

// ------------------------------------------------------------------ helpers
/* split on sentence ends only (keeps decimals like 1.76×, "et al.", "e.g." intact) */
const sents = t => String(t || '').replace(/\b(et al|e\.g|i\.e|vs|Fig|Eq|Sec|Tab|resp)\.\s/g, '$1\u0003 ').split(/(?<=[.!?])\s+(?=[A-Z0-9(\["“])/).map(s => s.replace(/\u0003/g, '.').trim()).filter(s => s.length > 20);
const has = (t, re) => re.test(t || '');
const clip = (s, n = 160) => s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s || '';

RR.paperKind = p => {
  const t = (p.title + ' ' + (p.abstract || '')).toLowerCase();
  if (/\b(survey|review|overview of|systematic literature)\b/.test(p.title.toLowerCase())) return 'survey';
  if (/\b(we (introduce|present|release|construct|collect|build) (a |the )?(new |large[- ]scale |first )?(dataset|benchmark|database|corpus))|\b(dataset|benchmark) (for|of)\b/.test(t) && /dataset|benchmark/.test(p.title.toLowerCase())) return 'dataset';
  if (/\b(attack|evasion|adversarial|removal|forge[sd]? the watermark|fool)\b/.test(p.title.toLowerCase())) return 'attack';
  if (/\b(we (study|investigate|analy[sz]e|revisit|examine)|empirical (study|analysis)|rethinking|do .* really|sanity check)\b/.test(t)) return 'study';
  return 'method';
};
RR.methodName = p => {
  const pre = (p.title.split(/[:—–-]\s/)[0] || '').trim();
  if (pre && pre.split(/\s+/).length <= 3 && pre.length <= 24 && /[A-Z]/.test(pre)) return pre;
  const m = (p.abstract || '').match(/(?:propose|introduce|present|call|named|dubbed)[^.]{0,80}?\b([A-Z][A-Za-z0-9]*[A-Z0-9][A-Za-z0-9+-]*)\b/) || (p.abstract || '').match(/\(([A-Z][A-Za-z0-9+-]{1,14})\)/);
  return m ? m[1] : '';
};
function hookQuestion(p, kind, why) {
  const title = p.title.replace(/\.$/, ''), sub = (title.split(/:\s/)[1] || title);
  const low = sub.split(' ').map(w => /^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w).join(' ');
  if (kind === 'survey') return `What do we really know about ${low.replace(/^(a |the )?(survey|review|overview)( of| on)?\s*/i, '')}?`;
  if (kind === 'dataset') return `What is missing from today's data, and does this ${/benchmark/i.test(title) ? 'benchmark' : 'dataset'} fix it?`;
  if (kind === 'attack') { const l = low.replace(/^(An?|The) /, m => m.toLowerCase()); return `Can ${/^(an? |the )/i.test(l) ? l : 'a ' + l} really break today's defences?`; }
  if (/^towards?\s/i.test(sub)) return `How do we get ${sub.replace(/^towards?\s/i, '').replace(/^an?\s/i, '')}?`;
  if (/^(can|do|does|is|are|how|why|what|when)\b/i.test(sub)) return sub.endsWith('?') ? sub : sub + '?';
  if (why) { const w = why.replace(/^(however|yet|but),?\s*/i, ''); return clip(w.charAt(0).toUpperCase() + w.slice(1), 140).replace(/\.$/, '') + ' — so what can we do?'; }
  return `What problem does “${clip(sub, 80)}” solve?`;
}
function extractStats(abs) {
  const out = [], seen = new Set(), re = /([+-]?\d+(?:\.\d+)?)\s?(%|×|x\b|dB|times|fps)/g; let m;
  while ((m = re.exec(abs || '')) && out.length < 4) {
    const v = m[1] + (m[2] === 'times' ? '×' : m[2]); if (seen.has(v)) continue; seen.add(v);
    const after = abs.slice(m.index + m[0].length, m.index + m[0].length + 40).split(/[,.;]/)[0], before = abs.slice(Math.max(0, m.index - 60), m.index).split(/[.;]/).pop();
    const MRE = /\b(AUC|EER|accuracy|ACC|F1|IoU|mAP|PSNR|SSIM|bit accuracy|TPR|FPR|APCER|BPCER|parameters|FLOPs)\b/gi;
    const metric = ([...before.matchAll(MRE)].pop() || [...after.matchAll(MRE)][0] || [])[1];
    const verb = /(above|over|more than|at least|exceeding)\s*$/i.test(before) ? 'above' : /(below|under|less than|at most)\s*$/i.test(before) ? 'below' : (after.match(/^\s*(faster|slower|smaller|fewer|less)\b/i) || [])[1] || (/(improv|outperform|gain|boost|increase|surpass)/i.test(before) ? 'better' : /(reduc|lower|decreas|drop)/i.test(before + after) ? 'lower' : '');
    const ctx = before + after;
    out.push({ v, l: (/^(faster|slower|smaller|fewer|less)$/i.test(verb) ? verb : [metric, verb].filter(Boolean).join(' · ')) || clip(ctx.replace(/\s+/g, ' ').trim(), 50) });
  }
  return out;
}
const terms = p => {
  const t = p.title + ' ' + (p.abstract || '');
  return Object.entries(GLOSS).filter(([k]) => new RegExp('\\b' + k.replace(/[+]/g, '\\+') + '(s|es)?\\b', k.length <= 4 ? '' : 'i').test(t)).slice(0, 4).map(([k, d]) => ({ t: k, d }));
};
const datasets = p => { const t = p.abstract || ''; return [...new Set(DATASETS.filter(d => t.includes(d)))].slice(0, 6); };
const READ_IF = {
  deepfake: 'you build or evaluate deepfake / AI-image detectors', forensics: 'you work on forgery detection or localization',
  watermark: 'you care about provenance, watermarking or content authenticity', voice: 'you work on speech anti-spoofing or speaker verification',
  face: 'you work on face recognition or face anti-spoofing', signature: 'you work on handwriting or signature verification',
  biometrics: 'you work on biometric security, PAD or template protection', document: 'you work on document analysis, OCR or document forgery',
  architecture: 'you choose backbones or design new architectures', cv: 'you follow general computer-vision progress',
};

/* Build the story. `sum` = quick or AI summary; `fig` = figures result (may be null/undefined); `peers` = other papers for the quiz. */
RR.story = (p, sum, fig, peers = [], txt = null) => {
  const ai = sum.story || null, kind = ai?.kind || RR.paperKind(p), name = ai?.name || RR.methodName(p) || 'this paper';
  const ss = sents(p.abstract), find = re => ss.find(s => re.test(s));
  const why = find(/\b(however|challeng|limitation|existing|remain|lack|suffer|vulnerab|fail|struggl|threat|problem)/i);
  const nov = find(/\b(we propose|we introduce|we present|we develop|this paper|in this work|novel)/i);
  const res = ss.filter(s => /(outperform|achiev|state-of-the-art|%|improv|surpass|demonstrat|experiment)/i.test(s)).slice(0, 3);
  const archSteps = ai?.pipeline || ss.filter(s => /\b(module|encoder|decoder|branch|backbone|attention|fusion|network|stage|loss|graph|head)\b/i.test(s)).slice(0, 3);
  const out = [], f = fig || null, T = f?.sec || txt || null, fx = f || txt || null;

  // 0) The abstract, colour-coded by role (problem · idea · method · result)
  const absSlide = !ss.length ? null : ({ type: 'abstract', icon: '🧾', title: 'Abstract, decoded', parts: ss.map(x => ({ t: x,
    r: /(outperform|achiev|state-of-the-art|%|improv|surpass|demonstrat|experiment|results? show)/i.test(x) ? 'res'
      : /\b(we propose|we introduce|we present|we develop|this paper|in this work|novel)/i.test(x) ? 'idea'
      : /\b(however|challeng|limitation|existing|remain|lack|suffer|vulnerab|fail|struggl|threat|problem|increasingly)/i.test(x) ? 'prob'
      : /\b(module|encoder|decoder|branch|backbone|attention|fusion|network|loss|train|we (use|design|leverage|adopt))\b/i.test(x) ? 'meth' : '' })) });


  // 1) Hook — the problem in this paper's own words + a curiosity question about THIS paper
  const qName = name === 'this paper' ? 'this paper' : name;
  const hookQ = ai?.hook || ({ method: `How does ${qName} solve it?`, dataset: `What does ${qName} add that was missing?`, survey: 'What does the field know so far?',
    attack: `How does ${qName} break it?`, study: 'What did they find?' }[kind]);
  out.push({ type: 'hook', icon: '🤔', title: { method: 'The problem', dataset: 'The data gap', survey: 'Why this survey', attack: 'The weak spot', study: 'The open question' }[kind],
    problem: ai?.before || (why ? clip(why, 200) : hookQuestion(p, kind, null)), question: hookQ, sub: ai?.one_liner || sum.tldr || '' });
  if (absSlide) out.push(absSlide);

  // 1b) Read from the full text: problem statement · literature review · novelty / contributions
  if (T?.problem?.length) out.push({ type: 'problem', icon: '🎯', title: 'Problem statement', points: T.problem, intro: T.intro });
  if (T?.lit?.length) out.push({ type: 'litreview', icon: '📚', title: 'Literature review', cards: T.lit });
  if (T?.contrib?.length) out.push({ type: 'contrib', icon: '💡', title: 'Novelty & contributions', items: T.contrib });

  // 2) Before vs after — only when we have distinct, paper-specific text for both sides (AI)
  if (ai?.before && ai?.after && kind !== 'survey')
    out.push({ type: 'versus', icon: '⚖️', title: kind === 'attack' ? 'Defender vs attacker' : kind === 'dataset' ? 'Old data vs new data' : `Before ${name} → with ${name}`,
      left: { h: kind === 'attack' ? '🛡️ Defenders assume' : '😕 Before', t: ai.before }, right: { h: kind === 'attack' ? '🗡️ This attack shows' : '✨ This paper', t: ai.after } });

  // 3) Architecture / pipeline (figure slide; titles depend on the kind)
  if (f?.arch) out.push({ type: 'figfull', fig: f.arch, kicker: kind === 'dataset' ? 'How the data was built' : kind === 'attack' ? 'The attack pipeline' : 'Architecture · full view', note: f.ctxOf?.[f.arch.n] || '' });
  if (p.type === 'paper') out.push({ arch: true, icon: kind === 'dataset' ? '🧱' : kind === 'survey' ? '🗺️' : kind === 'attack' ? '🎯' : '🏗️',
    title: { method: `How ${name} works`, dataset: 'How the data was built', survey: 'The big picture', attack: 'How the attack works', study: 'The experimental setup' }[kind],
    flow: archSteps.length > 1 ? archSteps.map(s => clip(s, 120)) : [], points: archSteps.length === 1 ? archSteps : [] });

  // 3b) Every other figure of the paper gets its own slide, with the sentence where the authors cite it
  const kick = g => /heat ?map|grad-?cam|attention map|visuali[sz]|qualitative/i.test(g.caption) ? 'Visualization' : /ablation/i.test(g.caption) ? 'Ablation' : /compar|versus|vs\.?\s/i.test(g.caption) ? 'Comparison'
      : /example|sample|dataset|data distribution/i.test(g.caption) ? 'Examples & data' : /overview|pipeline|framework|illustrat/i.test(g.caption) ? 'Overview' : /curve|plot|roc|trade-?off|performance|accuracy|auc/i.test(g.caption) ? 'Performance plot' : 'Figure';
  const RES_K = /^(Visualization|Ablation|Comparison|Performance plot)$/;
  const rest = f ? f.figs.filter(g => g !== f.arch && g !== f.results && g !== f.teaser).map(g => ({ type: 'figfull', fig: g, note: f.ctxOf?.[g.n] || '', kicker: kick(g) })) : [];
  rest.filter(x => !RES_K.test(x.kicker)).forEach(x => out.push(x));
  (f?.algos || []).forEach(a => out.push({ type: 'algo', icon: '🧮', title: `Algorithm ${a.n}`, algo: a }));

  // 4) Words you'll meet — beginner glossary, only terms this paper uses
  const tm = ai?.terms?.length ? ai.terms.map(x => ({ t: x.term, d: x.simple })) : terms(p);
  if (tm.length) out.push({ type: 'terms', icon: '📖', title: 'Words you’ll meet', terms: tm });

  // 5) Numbers that matter + results figure
  const stats = ai?.numbers?.length ? ai.numbers.map(x => ({ v: x.value, l: x.label })) : extractStats(p.abstract);
  // 5) RESULT ANALYSIS — main results figure, result tables, visualizations/ablations, key numbers, findings
  const RES_T = /result|compar|perform|accura|auc|eer|sota|state-of-the-art|benchmark|ablation|evaluat|psnr|ssim|bit|detection|f1|precision/i;
  const tabs = f?.tables || [], resTabs = tabs.filter(t => RES_T.test(t.caption)), othTabs = tabs.filter(t => !RES_T.test(t.caption));
  if (f?.results) out.push({ type: 'figfull', fig: f.results, kicker: 'Results · full view', note: f.ctxOf?.[f.results.n] || '' });
  resTabs.forEach(t => out.push({ type: 'table', icon: /ablation/i.test(t.caption) ? '🔬' : '📊', title: `${/ablation/i.test(t.caption) ? 'Ablation' : 'Results'} · Table ${t.n}`, table: t }));
  rest.filter(x => RES_K.test(x.kicker)).forEach(x => out.push(x));
  if (stats.length || res.length) out.push({ type: 'stats', results: true, icon: '📈', title: kind === 'dataset' ? 'By the numbers' : 'Does it work?', stats, points: ai?.results || res.map(s => clip(s, 160)) });
  if (T?.findings?.length) out.push({ type: 'findings', icon: '🔎', title: 'Result analysis', points: T.findings });
  othTabs.forEach(t => out.push({ type: 'table', icon: '📋', title: `Table ${t.n}`, table: t }));

  // 6) Tested on
  const ds = ai?.datasets?.length ? ai.datasets : datasets(p);
  if (ds.length) out.push({ type: 'chips', icon: '🧪', title: kind === 'dataset' ? 'Compared against' : 'Tested on', chips: ds, note: 'Look for these in the paper’s tables.' });

  // 7) Explain like I'm new / limitations (AI only — never invented)
  if (ai?.eli5) out.push({ type: 'eli5', icon: '🧒', title: 'Explain it like I’m new', text: ai.eli5 });
  if (f?.figs?.length > 1) out.push({ gallery: true });
  const lim = fx?.limitations || (ai?.limitations && !/not stated/i.test(ai.limitations) ? ai.limitations : '');
  out.push({ type: 'limits', icon: '⚠️', title: 'Limitations', text: lim, from: fx?.limitations ? 'paper' : lim ? 'ai' : '' });
  if (fx?.conclusion) out.push({ type: 'conclusion', icon: '🏁', title: 'The authors conclude', text: fx.conclusion });
  if (p.type === 'paper') out.push({ type: 'related', icon: '🔗', title: 'Related & SOTA papers' });

  // 8) Quick check — spot this paper's idea among peers (interactive)
  const mine = clip(nov || ss[0], 150), others = peers.filter(x => x.id !== p.id && x.abstract && x.domain === p.domain).slice(0, 8)
    .map(x => clip(sents(x.abstract).find(s => /\b(we propose|we introduce|we present|this paper|novel)/i.test(s)) || '', 150)).filter(Boolean);
  if (mine && others.length >= 2) {
    const opts = [mine, others[0], others[1]].map((t, i) => ({ t, ok: i === 0 })).sort(() => Math.random() - .5);
    out.push({ type: 'quiz', icon: '🎯', title: 'Quick check', q: `Which one is ${name === 'this paper' ? 'this paper’s' : name + '’s'} idea?`, opts });
  }

  // 9) Should you read it? — a reading path anchored on its own figures
  const path = ['Abstract (1 min)', f?.arch ? `Figure ${f.arch.n} — the architecture` : 'The overview figure', /method|approach/i.test(f?.method || 'method') ? 'Method section' : 'Section 3', f?.results ? `Figure ${f.results.n} + main results table` : 'Main results table', 'Limitations / conclusion'];
  out.push({ type: 'guide', icon: '🧭', title: 'Should you read it?', readIf: ai?.who_should_read || `Read it if ${READ_IF[p.domain] || READ_IF.cv}.`, path,
    time: f?.figs?.length ? `~${8 + f.figs.length * 2} min smart skim` : '~10 min smart skim' });
  return { kind, name, slides: out };
};

// ------------------------------------------------------------------ AI prompt for the same structure (used when the user adds a key)
RR.STORY_SYS = `You are a science communicator for PhD students in computer vision, deepfakes, forensics, watermarking, documents and biometrics.
Turn ONE paper into a beginner-friendly, paper-specific story. Use ONLY the given text; never invent numbers, datasets or names. Return JSON:
{"kind":"method|dataset|survey|attack|study","name":"method/dataset name or ''","hook":"a curiosity question specific to this paper (<=18 words)",
"one_liner":"what they did, in plain words (<=30 words)","inshort":"<=60 words","before":"how things were before / the gap (<=30 words)","after":"what this paper changes (<=30 words)",
"pipeline":["3-6 short steps, input → output"],"terms":[{"term":"jargon used in the paper","simple":"<=18-word plain explanation"}],
"numbers":[{"value":"e.g. +4.2%","label":"metric · dataset"}],"results":["2-3 bullets"],"datasets":["names in the text"],
"limitations":"1 sentence or 'Not stated'","eli5":"2 sentences with an everyday analogy","who_should_read":"Read it if you … (1 sentence)"}`;
})();
