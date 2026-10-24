const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const medal = p => p === 1 ? 'gold' : p === 2 ? 'silver' : p === 3 ? 'bronze' : '';
const chip = (p, cls = '') => p == null ? '<span class="chip">–</span>' : `<span class="chip ${medal(p) || (p <= 6 ? 'mid' : '')} ${cls}">${p}.</span>`;
const live = render => io().on('state', render);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function countUp(el, to) {
  const from = +el.dataset.v || 0; el.dataset.v = to;
  if (from === to || reduced) { el.textContent = to; return; }
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
