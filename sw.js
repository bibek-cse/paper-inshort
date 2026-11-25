/*!
 * ResearchReels — https://bibek-cse.github.io/research-reels/
 * Copyright (c) 2026 Bibek (GitHub: bibek-cse). All rights reserved.
 * Unauthorised copying, modification, redistribution or re-hosting of this file,
 * via any medium, is prohibited without prior written permission. See LICENSE.
 */
// ResearchReels service worker: app shell = stale-while-revalidate; never touches third-party API traffic.
const C = 'rr-v17';
const SHELL = ['./', 'index.html', 'manifest.json', 'assets/style.css', 'assets/app.js', 'assets/api.js', 'assets/story.js', 'assets/venue.js', 'assets/venues.js',
  'assets/vendor/js-yaml.min.js', 'assets/icons/icon-192.png', 'data/feed.json', 'data/concepts.json', 'data/conferences.json', 'data/sota.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
