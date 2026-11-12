/* Saut dimensionnel : quitter l'espace (étoiles), traverser une grille vectorielle, arriver dans l'univers.
   Projection en perspective sur canvas. Sans effet si l'utilisateur préfère réduire les animations. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CY = '#00ffcc', PK = '#ff007f';

  function overlay() {
    var c = document.createElement('canvas');
    c.id = 'warp';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = (c.width = Math.floor(innerWidth * dpr));
    var H = (c.height = Math.floor(innerHeight * dpr));
    return { c: c, x: c.getContext('2d'), W: W, H: H, dpr: dpr };
  }

  function stars(n, W, H) {
    var a = [];
    for (var i = 0; i < n; i++) a.push({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random(), pink: Math.random() < 0.25 });
    return a;
  }

  /* dir = 1 : départ (étoiles puis grille) ; dir = -1 : arrivée (grille puis fondu) */
  function run(dir, color, done) {
    var o = overlay(), x = o.x, W = o.W, H = o.H, cx = W / 2, cy = H / 2;
    var S = stars(260, W, H);
    var dur = dir === 1 ? 1500 : 900, t0 = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - t0) / dur);
      var q = dir === 1 ? p : 1 - p; // q : 0 = espace, 1 = grille puis blanc
      x.fillStyle = 'rgba(5,5,8,' + (dir === 1 ? 0.28 : 0.5) + ')';
      x.fillRect(0, 0, W, H);

      // 1) étoiles qui filent vers nous (accélération)
      var speed = 0.004 + Math.pow(Math.min(q * 1.6, 1), 2.4) * 0.08;
      var starAlpha = 1 - Math.max(0, (q - 0.55) / 0.45);
      for (var i = 0; i < S.length; i++) {
        var s = S[i], pz = s.z;
        s.z -= speed;
        if (s.z <= 0.01) { s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; s.z = 1; pz = 1; }
        var k = 0.9 / s.z, kp = 0.9 / Math.max(pz, 0.011);
        var sx = cx + s.x * k * W * 0.18, sy = cy + s.y * k * H * 0.18;
        var px = cx + s.x * kp * W * 0.18, py = cy + s.y * kp * H * 0.18;
        x.strokeStyle = s.pink ? PK : '#dde4f0';
        x.globalAlpha = Math.max(0, Math.min(1, (1 - s.z) * 1.4)) * starAlpha;
        x.lineWidth = Math.max(1, (1 - s.z) * 2.4 * o.dpr);
        x.beginPath(); x.moveTo(px, py); x.lineTo(sx, sy); x.stroke();
      }
      x.globalAlpha = 1;

      // 2) grille vectorielle en perspective : le sol monte, l'horizon descend
      var g = Math.max(0, (q - 0.35) / 0.65);
      if (g > 0) {
        var hor = cy * (1.1 - 0.9 * g) + (H * 0.0);
        x.save();
        x.globalAlpha = Math.min(1, g * 1.3);
        x.strokeStyle = color; x.lineWidth = 1.4 * o.dpr; x.shadowColor = color; x.shadowBlur = 12 * o.dpr;
        var rows = 14, off = (now / 900) % 1;
        for (var r = 0; r < rows; r++) {
          var z = (r + off) / rows, y = hor + (H - hor) * Math.pow(z, 2.2);
          x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
        }
        for (var cI = -14; cI <= 14; cI++) {
          x.beginPath(); x.moveTo(cx + cI * W * 0.012, hor); x.lineTo(cx + cI * W * 0.21, H); x.stroke();
        }
        // soleil / planète à l'horizon
        var grd = x.createRadialGradient(cx, hor, 0, cx, hor, H * 0.35 * g);
        grd.addColorStop(0, 'rgba(255,0,127,0.55)'); grd.addColorStop(1, 'rgba(255,0,127,0)');
        x.fillStyle = grd; x.shadowBlur = 0; x.fillRect(0, 0, W, H);
        x.restore();
      }

      // 3) flash de franchissement
      var f = Math.max(0, (q - 0.9) / 0.1);
      if (f > 0) { x.fillStyle = 'rgba(221,228,240,' + f * 0.9 + ')'; x.fillRect(0, 0, W, H); }

      if (p < 1) requestAnimationFrame(frame);
      else done(o);
    }
    if (dir === -1) { x.fillStyle = '#dde4f0'; x.fillRect(0, 0, W, H); }
    requestAnimationFrame(frame);
  }

  /* Arrivée */
  var arriving = false;
  try { arriving = !!sessionStorage.getItem('warp'); sessionStorage.removeItem('warp'); } catch (e) {}
  if (arriving && !reduce) {
    run(-1, '#00ffcc', function (o) {
      document.documentElement.classList.remove('warp-in');
      o.c.style.transition = 'opacity .35s'; o.c.style.opacity = '0';
      setTimeout(function () { o.c.remove(); }, 400);
    });
    document.documentElement.classList.remove('warp-in');
  } else document.documentElement.classList.remove('warp-in');

  /* Départ : liens vers un univers différent de la page courante */
  var UNIV = /^\/(studio|arena|screen|insights|market)\/$/;
  var here = (location.pathname.match(/^\/(studio|arena|screen|insights|market)(\/|$)/) || [])[1] || '';
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.origin !== location.origin) return;
    var m = a.pathname.match(UNIV);
    if (!m || m[1] === here || reduce) return;
    e.preventDefault();
    var pink = m[1] === 'arena' || m[1] === 'insights';
    try { sessionStorage.setItem('warp', '1'); } catch (er) {}
    var go = a.href, done = false;
    var nav = function () { if (!done) { done = true; location.href = go; } };
    setTimeout(nav, 2200); // garde-fou
    run(1, pink ? PK : CY, nav);
  });

  /* Inclinaison 3D des cartes du portail au pointeur */
  if (!reduce) {
    document.querySelectorAll('.doors5 .door').forEach(function (d) {
      d.addEventListener('pointermove', function (e) {
        var r = d.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        d.style.setProperty('--ry', (px * 12).toFixed(2) + 'deg');
        d.style.setProperty('--rx', (-py * 12).toFixed(2) + 'deg');
      });
      d.addEventListener('pointerleave', function () { d.style.setProperty('--rx', '0deg'); d.style.setProperty('--ry', '0deg'); });
    });
  }
  // retour arrière depuis le cache : ne pas rester sur l'overlay
  window.addEventListener('pageshow', function (e) { if (e.persisted) { var w = document.getElementById('warp'); if (w) w.remove(); } });
})();
