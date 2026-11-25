/*!
 * PaperInShot — https://bibek-cse.github.io/research-reels/
 * Copyright (c) 2026 Bibek (GitHub: bibek-cse). All rights reserved.
 * Unauthorised copying, modification, redistribution or re-hosting of this file,
 * via any medium, is prohibited without prior written permission. See LICENSE.
 */
/* Venue quality table. Conference tiers follow CORE (as listed by ccfddl/ccf-deadlines).
   Edit freely: { short, tier, re (matches OpenAlex source name), not (exclusions), ddl (ccfddl file) } */
window.RR_VENUES = [
  // ---- A* conferences
  { short: 'CVPR',    tier: 'A*', re: /computer vision and pattern recognition/i, not: /workshop/i, ddl: 'AI/cvpr' },
  { short: 'ICCV',    tier: 'A*', re: /international conference on computer vision\b/i, not: /workshop|asian|theory|systems/i, ddl: 'AI/iccv' },
  { short: 'ECCV',    tier: 'A*', re: /european conference on computer vision|\beccv\b/i, not: /workshop/i, ddl: 'AI/eccv' },
  { short: 'NeurIPS', tier: 'A*', re: /neural information processing systems|\bneurips\b/i, not: /workshop/i, ddl: 'AI/nips' },
  { short: 'ICLR',    tier: 'A*', re: /learning representations/i, not: /workshop/i, ddl: 'AI/iclr' },
  { short: 'ICML',    tier: 'A*', re: /international conference on machine learning\b|\bicml\b/i, not: /applications|cybernetics|workshop|technolog/i, ddl: 'AI/icml' },
  { short: 'AAAI',    tier: 'A*', re: /aaai conference on artificial intelligence/i, ddl: 'AI/aaai' },
  { short: 'IJCAI',   tier: 'A*', re: /international joint conference on artificial intelligence|\bijcai\b/i, ddl: 'AI/ijcai' },
  { short: 'ACM MM',  tier: 'A*', re: /acm international conference on multimedia\b|acm multimedia\b/i, not: /retrieval|asia|workshop|in asia/i, ddl: 'CG/mm' },
  { short: 'CCS',     tier: 'A*', re: /computer and communications security/i, not: /asia/i, ddl: 'SC/ccs' },
  { short: 'IEEE S&P',tier: 'A*', re: /ieee symposium on security and privacy/i, not: /workshop/i, ddl: 'SC/sp' },
  { short: 'USENIX Sec', tier: 'A*', re: /usenix security/i, ddl: 'SC/uss' },
  { short: 'NDSS',    tier: 'A*', re: /network and distributed system security/i, ddl: 'SC/ndss' },
  { short: 'ACL',     tier: 'A*', re: /annual meeting of the association for computational linguistics/i, ddl: 'AI/acl' },
  { short: 'EMNLP',   tier: 'A*', re: /empirical methods in natural language processing/i, ddl: 'AI/emnlp' },
  // ---- A conferences
  { short: 'WACV',    tier: 'A', re: /winter conference on applications of computer vision/i, not: /workshop/i, ddl: 'AI/wacv' },
  { short: 'BMVC',    tier: 'A', re: /british machine vision/i, ddl: 'AI/bmvc' },
  { short: 'Interspeech', tier: 'A', re: /interspeech/i, ddl: 'CG/interspeech' },
  { short: 'ICME',    tier: 'A', re: /international conference on multimedia and expo/i, not: /workshop/i, ddl: 'CG/icme' },
  { short: 'ACSAC',   tier: 'A', re: /annual computer security applications/i, ddl: 'SC/acsac' },
  { short: 'ESORICS', tier: 'A', re: /esorics|european symposium on research in computer security/i, ddl: 'SC/esorics' },
  { short: 'AsiaCCS', tier: 'A', re: /asia.{0,20}computer and communications security|asiaccs/i, ddl: 'SC/asiaccs' },
  { short: 'ICDAR',   tier: 'A', re: /international conference on document analysis and recognition|\bicdar\b/i, not: /workshop/i, ddl: 'AI/icdar' },
  // ---- B conferences
  { short: 'ICASSP',  tier: 'B', re: /international conference on acoustics,? speech,? and signal processing|\bicassp\b/i, not: /workshop/i, ddl: 'CG/icassp' },
  { short: 'IJCB',    tier: 'B', re: /joint conference on biometrics|\bijcb\b/i, ddl: 'AI/ijcb' },
  { short: 'ICPR',    tier: 'B', re: /international conference on pattern recognition\b/i, not: /applications and methods|icpram|workshop/i, ddl: 'AI/icpr' },
  { short: 'ICIP',    tier: 'B', re: /international conference on image processing\b/i, not: /workshop|applications/i, ddl: 'CG/icip' },
  { short: 'FG',      tier: 'B', re: /automatic face and gesture/i, ddl: 'AI/fg' },
  { short: 'ACCV',    tier: 'B', re: /asian conference on computer vision/i, ddl: 'AI/accv' },
  { short: 'IH&MMSec',tier: 'B', re: /information hiding and multimedia security/i },
  { short: 'ICMR',    tier: 'B', re: /international conference on multimedia retrieval/i, ddl: 'CG/icmr' },
  // ---- society flagship venues (IEEE Biometrics Council, IEEE SPS IFS-TC, IAPR, EAB)
  { short: 'WIFS',    tier: 'Soc', re: /workshop on information forensics and security|\bwifs\b/i },
  { short: 'ISBA',    tier: 'Soc', re: /identity,? security,? and behavior analysis|\bisba\b/i },
  { short: 'IWBF',    tier: 'Soc', re: /workshop on biometrics and forensics|\biwbf\b/i },
  { short: 'BIOSIG',  tier: 'Soc', re: /biometrics special interest group|\bbiosig\b/i },
  { short: 'ICFHR',   tier: 'Soc', re: /frontiers in handwriting recognition|\bicfhr\b/i },
  { short: 'ICB',     tier: 'Soc', re: /international conference on biometrics\b/i, not: /theory|joint/i },
  { short: 'BTAS',    tier: 'Soc', re: /biometrics:? theory,? applications/i },
  // ---- Journals
  { short: 'IJCV',    tier: 'Q1', re: /international journal of computer vision/i },
  { short: 'Pattern Recognition', tier: 'Q1', re: /^pattern recognition$/i },
  { short: 'Information Fusion', tier: 'Q1', re: /^information fusion$/i },
  { short: 'IJDAR',   tier: 'J', re: /international journal on document analysis and recognition/i },
  { short: 'PRL',     tier: 'J', re: /^pattern recognition letters$/i },
  { short: 'IET Biometrics', tier: 'J', re: /^iet biometrics$/i },
  { short: 'ACM CSUR',tier: 'ACM', re: /acm computing surveys/i },
  { short: 'ACM Trans', tier: 'ACM', re: /^acm transactions on/i },
  { short: 'IEEE JSTSP', tier: 'IEEE', re: /ieee journal of selected topics in signal processing/i },
  { short: 'IEEE Trans', tier: 'IEEE', re: /^ieee(\/acm)? transactions on/i },
  // ---- preprints
  { short: 'arXiv',   tier: 'Pre', re: /arxiv/i },
];

/* Short names for common IEEE Transactions */
window.RR_TRANS_SHORT = [
  [/multimedia computing, communications/i, 'ACM TOMM'], [/privacy and security/i, 'ACM TOPS'],
  [/pattern analysis and machine intelligence/i, 'TPAMI'], [/information forensics and security/i, 'TIFS'],
  [/transactions on image processing/i, 'TIP'], [/transactions on multimedia/i, 'TMM'],
  [/circuits and systems for video/i, 'TCSVT'], [/neural networks and learning/i, 'TNNLS'],
  [/dependable and secure/i, 'TDSC'], [/biometrics, behavior/i, 'TBIOM'], [/audio, speech,? and language/i, 'TASLP'],
  [/cybernetics/i, 'TCYB'], [/affective computing/i, 'TAFFC'], [/knowledge and data/i, 'TKDE'],
];

window.RR_TIER_RANK = { 'A*': 6, 'A': 5, 'IEEE': 5, 'ACM': 5, 'Q1': 4, 'B': 3, 'Soc': 3, 'J': 3, 'Pre': 1 };
window.RR_TIER_LABEL = { 'A*': 'CORE A*', 'A': 'CORE A', 'B': 'CORE B', 'IEEE': 'IEEE Trans', 'ACM': 'ACM', 'Q1': 'Q1 Journal', 'Soc': 'Society flagship', 'J': 'Journal', 'Pre': 'Preprint' };
