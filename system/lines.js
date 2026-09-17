/* ============================================================================
   VARA Expo 2026 — section line sets

   Dynamic ribbon shapes as graphic elements: the same family of long, round-
   capped, generously curved strokes the landing page uses, but a CHEAP version
   — hand-authored beziers instead of the 23KB traced model spines, flat brand
   hues instead of 36-stop model gradients, and a LIBRARY of distinct shapes so
   no section repeats another section's line.

   Three earlier attempts were each wrong differently:
     1. generic beziers at 2.4px / .5 opacity — faint wallpaper, not graphics.
     2. the real traced spines with full model gradients — right weight, but
        576 gradient nodes per page and far more machinery than a subpage needs.
     3. the traced spines flattened — cheap enough, but only four shapes, so
        every section drew the same line again.
   This is the synthesis: many shapes, flat colour, big and confident.

   Construction follows ILLUSTRATION.md: round caps and joins, generous radii,
   open ends that bleed off the frame, no sharp corners, and the over-under
   weave via a casing painted in the page ground.

   Usage: `data-lines` on any section. Optional `data-lines="3"` pins a set.

   MOTION (DESIGN-SYSTEM.md 6): one hero stroke leads, the rest answer near-
   unison, expo-out because the value is SCRUBBED by scroll, complete by ~60%
   of the window then holds, plus a slow parallax drift.

   PERF: one shared rAF, transform + stroke-dashoffset only, off-screen
   sections culled, loop stops when scrolling settles and on visibilitychange.
   ============================================================================ */
(() => {
  const VBW = 1000, VBH = 800, VB = '0 0 ' + VBW + ' ' + VBH;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ---- the shape library -------------------------------------------------
     Long single gestures on a 1000x800 box. Each starts and ends outside the
     box so it bleeds rather than terminating in view. */
  const SHAPES = {
    sweepA: 'M-60,620 C180,620 300,140 560,140 S900,420 1060,300',
    sweepB: 'M-60,240 C200,240 340,680 620,680 S940,380 1060,470',
    sweepC: 'M-60,460 C220,460 380,120 660,180 S960,560 1060,420',
    hookA:  'M120,-60 C120,220 420,300 420,560 S180,820 260,880',
    hookB:  'M880,-60 C880,200 560,290 560,540 S820,800 740,880',
    loopA:  'M200,740 C200,420 420,300 620,380 S760,640 600,700 S380,600 470,420',
    loopB:  'M820,60 C820,400 600,520 400,440 S260,180 420,120 S640,220 550,400',
    archA:  'M-80,540 C260,160 740,160 1080,540',
    archB:  'M-80,280 C260,660 740,660 1080,280',
    riseA:  'M420,-60 C420,180 180,260 180,440 S420,660 420,880',
    riseB:  'M580,-60 C580,180 820,260 820,440 S580,660 580,880',
    crestA: 'M-60,700 C240,700 300,240 520,260 S640,520 860,420 S1000,180 1060,240',
    crestB: 'M-60,180 C240,180 320,600 540,600 S660,340 880,440 S1010,700 1060,640',
    coilA:  'M300,780 C140,560 220,320 440,300 S700,420 640,600 S420,660 430,500',
    coilB:  'M700,40 C860,280 780,520 560,540 S300,420 360,240 S580,180 570,320',
    driftA: 'M-60,120 C300,120 420,520 760,520 S1000,300 1060,360',
  };

  /* ---- layouts ----------------------------------------------------------
     [shape, hue, sizeVW, xPct, yPct, rotDeg, strokePx, alpha, parallax]
     Stroke weights are the approved BOLD set (hero ~58px rendered at 1440) —
     the ribbons read as tubes, matching how the element is shown in the brand
     guideline, rather than as drawn lines.
     Rank 0 is the hero of the set. Sizes stay <=96vw ON PURPOSE: anything
     wider makes the document wider than the screen, which then needs an
     overflow clip somewhere, and every place to put that clip either chops the
     ribbons at a section seam or kills vertical scrolling. The paths already
     run from -60 to 1060 inside their own 1000-unit viewBox, so they still
     bleed off their box without overflowing the page.
     No shape repeats inside a set, and no two sets share a hero shape — that
     repetition is exactly what read as "the same line over and over". */
  const LAYOUTS = [
    [['sweepA', 'coral', 96, 70, 52, 16, 48, .40, 0.50],
     ['hookB', 'violet', 62, 12, 88, -14, 34, .22, 0.28],
     ['loopA', 'cyan', 38, 30, 105, 10, 27, .16, 0.42],
     ['archB', 'green', 86, 92, 84, 26, 20, .12, 0.23]],

    [['archA', 'cyan', 96, 26, 72, -22, 48, .40, -0.50],
     ['riseB', 'green', 58, 88, 84, 26, 34, .22, -0.28],
     ['coilB', 'violet', 36, 92, 50, -34, 27, .16, -0.42],
     ['sweepC', 'coral', 82, 8, 92, 16, 20, .12, 0.24]],

    [['loopB', 'violet', 96, 74, 34, 24, 48, .40, 0.53],
     ['crestA', 'coral', 66, 16, 82, -18, 34, .22, 0.30],
     ['driftA', 'green', 40, 92, 104, 14, 27, .16, 0.40],
     ['hookA', 'cyan', 84, 8, 60, 30, 20, .12, -0.25]],

    [['crestB', 'green', 96, 24, 60, -26, 48, .40, -0.50],
     ['sweepB', 'cyan', 64, 86, 32, 20, 34, .22, -0.29],
     ['riseA', 'coral', 38, 8, 94, -12, 27, .16, -0.41],
     ['coilA', 'violet', 88, 92, 72, 20, 20, .12, 0.23]],

    [['coilA', 'coral', 96, 68, 44, 20, 48, .40, 0.47],
     ['archB', 'violet', 60, 10, 80, -16, 34, .22, 0.29],
     ['sweepC', 'green', 40, 92, 102, 12, 27, .16, 0.39],
     ['riseB', 'cyan', 84, 8, 58, 28, 20, .12, -0.26]],

    [['driftA', 'cyan', 96, 30, 66, -20, 48, .40, -0.49],
     ['loopB', 'coral', 62, 84, 86, 22, 34, .22, -0.28],
     ['crestB', 'violet', 38, 92, 48, -32, 27, .16, -0.40],
     ['hookB', 'green', 82, 8, 90, 18, 20, .12, 0.25]],
  ];

  const clamp = (v,a,b) => (v<a?a:v>b?b:v);
  /* expo-out: moves with the scroll immediately, decelerates into place.
     Ease-in-out stalls at both ends while the finger moves linearly. */
  /* Was 2^-9t over a 0.34 window: 59% of the stroke drawn in the first tenth
     of the travel, which is what read as abrupt — the line snapped in rather
     than being drawn. Gentler exponent over a window twice as long, so the
     gesture actually has time to happen. */
  const expoOut = t => (t >= 1 ? 1 : 1 - Math.pow(2, -4.2*t));
  const win = r => (r === 0 ? [0,0.58] : [0.26+(r-1)*0.05, 0.86+(r-1)*0.04]);

  /* on-screen px -> viewBox units, so a ribbon stays a ribbon at any viewport */
  const widthUnits = (sizeVW, targetPx) =>
    (targetPx * VBW / Math.max(1,(sizeVW/100)*innerWidth)).toFixed(2);

  const NS = 'http://www.w3.org/2000/svg';
  const drawables = [];
  let cycle = 0;

  document.querySelectorAll('[data-lines]').forEach(sec => {
    const pin = parseInt(sec.dataset.lines, 10);
    const set = LAYOUTS[Number.isFinite(pin) ? pin % LAYOUTS.length
                                             : cycle++ % LAYOUTS.length];
    const host = document.createElement('div');
    host.className = 'lineset';
    host.setAttribute('aria-hidden','true');
    sec.prepend(host);

    set.forEach((spec, i) => {
      const shape = spec[0], hue = spec[1];
      const sizeVW = spec[2], strokePx = spec[6], alpha = spec[7];
      const xPct = spec[3], yPct = spec[4], rot = spec[5], par = spec[8];
      const d = SHAPES[shape];
      if (!d) return;

      const svg = document.createElementNS(NS,'svg');
      svg.setAttribute('viewBox', VB);
      svg.setAttribute('preserveAspectRatio','xMidYMid meet');
      svg.setAttribute('aria-hidden','true');
      svg.style.width = sizeVW + 'vw';
      svg.style.left = xPct + '%';
      svg.style.top = yPct + '%';
      svg.style.opacity = alpha;
      svg.style.transform = 'translate(-50%,-50%) rotate(' + rot + 'deg)';

      /* WEAVE OFF by default. The casing is a navy path 1.55x the stroke width
         painted underneath, so a later ribbon masks an earlier one where they
         cross — over-and-under rather than stacked. At thin weights it is
         invisible machinery; at bold weights it reads as a dark outline around
         every ribbon, which is not what the brand's tubes look like.
         Re-enable per section with data-lines-weave="on". */
      const w = widthUnits(sizeVW, strokePx);
      let casing = null;
      if (sec.dataset.linesWeave === 'on'){
        casing = document.createElementNS(NS,'path');
        casing.setAttribute('d', d);
        casing.setAttribute('class','casing');
        casing.setAttribute('stroke-width', (parseFloat(w)*1.55).toFixed(2));
        svg.appendChild(casing);
      }

      const p = document.createElementNS(NS,'path');
      p.setAttribute('d', d);
      /* Tied to the SECTION's accent, not a per-stroke hue. The homepage mixes
         all four in one band because the element is the subject there; on a
         subpage the band already means one zone, so a green ribbon in the
         Market band just contradicts the heading. Variety comes from rank
         (weight + alpha), not from hue. `hue` is kept in the layout table for
         the few places that want an explicit cross-zone stroke. */
      p.setAttribute('stroke', sec.dataset.linesHue === 'mixed'
        ? 'var(--' + hue + ')' : 'var(--accent)');
      p.setAttribute('stroke-width', w);
      svg.appendChild(p);
      host.appendChild(svg);

      const len = p.getTotalLength();
      [p, casing].filter(Boolean).forEach(el => {
        el.style.strokeDasharray = len;
        el.style.strokeDashoffset = reduce ? 0 : len;
      });

      drawables.push({ svg:svg, p:p, casing:casing, len:len, sec:sec,
                       sizeVW:sizeVW, strokePx:strokePx, rot:rot, par:par,
                       w:win(i), dir: i>0 && i%2===0 ? -1 : 1 });
    });
  });

  if (drawables.length && !reduce){
    let raf = 0, idle = 0, lastY = scrollY;

    function paint(){
      const vh = innerHeight;
      for (let k=0;k<drawables.length;k++){
        const d = drawables[k];
        const r = d.sec.getBoundingClientRect();
        if (r.bottom < -vh*0.4 || r.top > vh*1.4) continue;      // cull

        const t = clamp(1 - (r.top - vh*0.08)/(vh*0.82), 0, 1);
        const e = expoOut(clamp((t - d.w[0])/(d.w[1]-d.w[0]), 0, 1));
        const off = ((d.dir<0?-1:1) * d.len * (1-e)).toFixed(1);
        d.p.style.strokeDashoffset = off;
        if (d.casing) d.casing.style.strokeDashoffset = off;

        const rel = (r.top + r.height/2 - vh/2)/vh;
        d.svg.style.transform =
          'translate(-50%,-50%) translate3d(' + (rel*d.par*12).toFixed(1) + 'px,'
          + (-rel*d.par*46).toFixed(1) + 'px,0) rotate(' + d.rot + 'deg)';
      }
    }

    function frame(){
      paint();
      if (Math.abs(scrollY-lastY) < 0.5) idle++; else idle = 0;
      lastY = scrollY;
      if (idle > 20){ raf = 0; return; }       // settled — stop entirely
      raf = requestAnimationFrame(frame);
    }
    const kick = () => { idle = 0; if (!raf) raf = requestAnimationFrame(frame); };

    addEventListener('scroll', kick, {passive:true});
    addEventListener('resize', () => {
      for (let k=0;k<drawables.length;k++){
        const d = drawables[k];
        const w = widthUnits(d.sizeVW, d.strokePx);
        d.p.setAttribute('stroke-width', w);
        if (d.casing) d.casing.setAttribute('stroke-width', (parseFloat(w)*1.55).toFixed(2));
      }
      paint(); kick();
    }, {passive:true});
    document.addEventListener('visibilitychange', () => {
      if (document.hidden){ if (raf) cancelAnimationFrame(raf); raf = 0; }
      else { lastY = scrollY; kick(); }
    }, {passive:true});

    paint(); kick();
  }

  window.__varaSectionLines = drawables;     // probe for verification
})();
