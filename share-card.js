// v76: resumen para compartir como imagen (Instagram, TikTok, WhatsApp) e invitación a la app.
// Se dibuja en el teléfono con <canvas>: no se sube nada a ningún servidor. Solo usa los datos que la persona eligió compartir.
(function (root) {
  'use strict';
  const W = 1080, H = 1350;
  const fmt = n => Number(n).toLocaleString('es-UY', { maximumFractionDigits: 1 });
  // Los textos de la imagen siguen el idioma elegido en la app.
  const tr = s => (root.FittFormaI18n && root.FittFormaI18n.translate ? root.FittFormaI18n.translate(s) : s) || s;
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fitText(ctx, text, max, size, weight) { let s = size; do { ctx.font = `${weight} ${s}px Inter, system-ui, sans-serif`; s -= 2; } while (ctx.measureText(text).width > max && s > 28); return text; }
  // Métricas que se muestran: solo las que tienen valor.
  function metricsOf(d) {
    const out = [];
    if (d.minutes > 0) out.push([`${Math.round(d.minutes)} min`, tr('Tiempo')]);
    if (d.distanceKm > 0) out.push([`${fmt(d.distanceKm)} km`, tr('Distancia')]);
    if (d.pace) out.push([d.pace, tr('Ritmo /km')]);
    if (d.exercises > 0) out.push([String(d.exercises), tr('Ejercicios')]);
    if (d.sets > 0) out.push([String(d.sets), tr('Series')]);
    if (d.volumeKg > 0) out.push([`${fmt(d.volumeKg)} kg`, tr('Kilos levantados')]);
    if (d.kcal > 0) out.push([`~${Math.round(d.kcal)}`, tr('kcal estimadas')]);
    return out.slice(0, 6);
  }
  function draw(canvas, d) {
    canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0b1226'); bg.addColorStop(.55, '#1e2f5e'); bg.addColorStop(1, '#3a1d6e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * .8, H * .15, 20, W * .8, H * .15, 520); glow.addColorStop(0, 'rgba(25,184,255,.35)'); glow.addColorStop(1, 'rgba(25,184,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 54px Inter, system-ui, sans-serif'; ctx.fillText('FittForma', 80, 130);
    ctx.fillStyle = '#9d8cff'; ctx.fillText(' AI', 80 + ctx.measureText('FittForma').width, 130);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '600 34px Inter, system-ui, sans-serif'; ctx.fillText(tr(d.kicker || 'Entrenamiento completado'), 80, 250);
    ctx.fillStyle = '#ffffff'; fitText(ctx, d.title || 'Entrenamiento', W - 160, 84, 850); ctx.fillText(d.title || 'Entrenamiento', 80, 350);
    if (d.dateLabel) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '500 34px Inter, system-ui, sans-serif'; ctx.fillText(d.dateLabel, 80, 410); }
    const m = metricsOf(d), cols = 2, gw = (W - 160 - 30) / cols, gh = 190;
    m.forEach(([value, label], i) => {
      const x = 80 + (i % cols) * (gw + 30), y = 480 + Math.floor(i / cols) * (gh + 30);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; roundRect(ctx, x, y, gw, gh, 36); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffffff'; fitText(ctx, value, gw - 60, 72, 800); ctx.fillText(value, x + 32, y + 100);
      ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = '600 30px Inter, system-ui, sans-serif'; ctx.fillText(label, x + 32, y + 152);
    });
    const bar = ctx.createLinearGradient(80, 0, W - 80, 0); bar.addColorStop(0, '#2a6dff'); bar.addColorStop(.5, '#19b8ff'); bar.addColorStop(1, '#6ff2cf');
    ctx.fillStyle = bar; roundRect(ctx, 80, H - 200, W - 160, 10, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '600 32px Inter, system-ui, sans-serif'; ctx.fillText(tr(d.footer || 'Registrado con FittForma AI'), 80, H - 120);
    return canvas;
  }
  function toBlob(canvas) { return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo crear la imagen.')), 'image/png')); }
  async function makeBlob(d) { const c = (root.document || document).createElement('canvas'); draw(c, d); return toBlob(c); }
  // Comparte la imagen si el teléfono lo permite; si no, la descarga. Devuelve 'shared', 'downloaded' o 'cancelled'.
  async function share(d) {
    const blob = await makeBlob(d), name = `fittforma-${String(d.dateKey || 'resumen').replace(/[^0-9a-z-]/gi, '')}.png`;
    const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
    const nav = root.navigator;
    if (file && nav?.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: d.title || 'FittForma AI', text: d.shareText || '' }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); return 'downloaded';
  }
  // Invitación: comparte el enlace de la app (o lo copia). No manda datos de la persona.
  async function invite() {
    const url = `${root.location.origin}/`, text = tr('Entrená conmigo en FittForma AI: rutinas, comidas, carreras con GPS y retos con amigos.');
    const nav = root.navigator;
    if (nav?.share) { try { await nav.share({ title: 'FittForma AI', text, url }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; } }
    try { await nav.clipboard.writeText(`${text} ${url}`); return 'copied'; } catch { return 'failed'; }
  }
  root.FittFormaShareCard = Object.freeze({ draw, makeBlob, share, invite, metricsOf, W, H });
})(typeof window !== 'undefined' ? window : globalThis);
