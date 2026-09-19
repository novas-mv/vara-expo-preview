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
  /* [shape, hue, sizeVW, side, yPct, rotDeg, strokePx, alpha, parallax]

     COMPLETE FORMS, NOT CROPPED ONES. These used to be enormous ribbons
     anchored in a gutter with most of the shape off-frame, so what you saw was
     a fragment chopped by the viewport edge — an abrupt ending into a bleed,
     which reads as a mistake rather than as a graphic. A ribbon that leaves
     the frame has to be going somewhere; one that just stops has not earned
     the crop.

     So the whole form is now on the page. Only four shapes in the library are
     self-contained — loopA, loopB, coilA, coilB. The rest (sweeps, arches,
     rises, crests, drift, and the hooks) are authored to bleed: their paths
     run past the viewBox on purpose, which is right for a band that spans a
     hero and wrong for a deliberate object. They stay in the library, unused
     here.

     Placement is computed from each shape's own INK bounds rather than from
     its box, so the drawn form sits EDGE% from the page edge whatever its
     size — the box is mostly empty space and anchoring by it put the ink in a
     different place for every shape.

     These sit BEHIND the content (.lineset is z-index 0, everything else 1),
     so they can pass under copy without blocking it. */
  const LAYOUTS = [
    /* Placement is the whole job now that the forms are complete. A curl that
       sits through a heading is obtrusive however pretty it is, so these are
       biased LOW (yPct 60+) and to the RIGHT, because every one of these pages
       sets its copy left and ranged. Rank 0 leads on the right; the smaller
       two fill the opposite corner and the band below. */
    [['loopA', 'coral',  52, 'R', 74,  14, 68, 1,  0.50],
     ['coilB', 'violet', 38, 'L', 96, -12, 56, 1,  0.28],
     ['loopB', 'cyan',   28, 'R', 34,  18, 44, 1,  0.42]],

    [['coilA', 'cyan',   52, 'R', 68, -18, 68, 1, -0.50],
     ['loopB', 'green',  38, 'L', 98,  22, 56, 1, -0.28],
     ['coilB', 'violet', 28, 'L', 30, -14, 44, 1, -0.42]],

    [['loopB', 'violet', 52, 'R', 78,  20, 68, 1,  0.53],
     ['loopA', 'coral',  38, 'L', 94, -16, 56, 1,  0.30],
     ['coilA', 'green',  28, 'R', 28,  12, 44, 1,  0.40]],

    [['coilB', 'green',  52, 'R', 70, -22, 68, 1, -0.50],
     ['coilA', 'cyan',   38, 'L', 92,  16, 56, 1, -0.29],
     ['loopA', 'coral',  28, 'L', 32, -10, 44, 1, -0.41]],

    [['loopA', 'coral',  52, 'R', 66,  18, 68, 1,  0.47],
     ['coilB', 'violet', 38, 'L', 90, -14, 56, 1,  0.29],
     ['loopB', 'green',  28, 'R', 26,  10, 44, 1,  0.39]],

    [['coilA', 'cyan',   52, 'R', 80, -16, 68, 1, -0.49],
     ['loopA', 'coral',  38, 'L', 95,  20, 56, 1, -0.28],
     ['coilB', 'violet', 28, 'L', 24, -12, 44, 1, -0.40]],
  ];
;

  /* Where each shape's INK actually lies inside its 1000x800 viewBox. The box
     is mostly empty; anchoring by it would put the drawn form somewhere
     different for every shape. */
  const INK = { loopA:[200,760], loopB:[260,820], coilA:[140,700], coilB:[300,860] };

  /* how far the drawn form sits from the page edge, % of viewport width */
  const EDGE = (() => {
    const m = /[?&]lines=in:(-?\d+(?:\.\d+)?)/.exec(location.search);
    return m ? Math.min(40, Math.max(-10, parseFloat(m[1]))) : 3;
  })();
;

  /* How far the ribbon's BOX reaches into the page, as % of viewport width.
     Note it is the box, not the ink: these shapes do not fill their own
     viewBox, so at 38 the painted ribbon reads as roughly a tenth of the page,
     which is the intent. Tune by eye with ?lines=in:N — at 28 the curl falls
     off the edge and you get a faint sliver; past 45 it walks into the copy. */
  const GUTTER_IN = (() => {
    const m = /[?&]lines=in:(\d+(?:\.\d+)?)/.exec(location.search);
    return m ? Math.min(60, Math.max(2, parseFloat(m[1]))) : 38;
  })();
  /* the box is centred, so anchoring its INNER edge at GUTTER_IN puts the rest
     of the ribbon off-frame and lets the curl crop against the gutter */
  /* The intrusion takes the same responsive step the weight does. 38% of a
     1440 desktop is a gutter; 38% of a 370 phone is a third of the screen, and
     the ribbon walks straight through the copy. One lever, already decided —
     --rung-scale — rather than a second breakpoint of its own. */
  const xFor = (shape, side, sizeVW) => {
    const ink = INK[shape] || [0,1000];
    const fL = ink[0]/1000, fR = ink[1]/1000;
    /* A phone has no empty margin to put anything in — the copy is the full
       width. Below 640 the form is pushed a third of its own width back out
       of the page, so a curl reads as something passing behind the column
       rather than sitting on it. */
    const edge = innerWidth < 640 ? EDGE - sizeVW*0.34 : EDGE;
    return side === 'L' ? edge - fL*sizeVW + sizeVW/2
                        : 100 - edge - fR*sizeVW + sizeVW/2;
  };

;

  const clamp = (v,a,b) => (v<a?a:v>b?b:v);
  /* expo-out: moves with the scroll immediately, decelerates into place.
     Ease-in-out stalls at both ends while the finger moves linearly. */
  /* Was 2^-9t over a 0.34 window: 59% of the stroke drawn in the first tenth
     of the travel, which is what read as abrupt — the line snapped in rather
     than being drawn. Gentler exponent over a window twice as long, so the
     gesture actually has time to happen. */
  const expoOut = t => (t >= 1 ? 1 : 1 - Math.pow(2, -4.2*t));
  const win = r => (r === 0 ? [0,0.58] : [0.26+(r-1)*0.05, 0.86+(r-1)*0.04]);

  /* Reads --rung-scale (system/tokens.css), the one definition of the ladder's
     responsive step: below 640 every rung goes to 0.6 of itself, because a
     rank-0 rung is 4.7% of a 1440 desktop and 18.4% of a 370 phone. A token
     rather than a constant here because this file is a classic script on the
     seventeen subpages and cannot import what the two module call sites use.
     Falls back to 1 — full weight — if the token is missing. */
  const rungScale = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rung-scale')) || 1;

  /* on-screen px -> viewBox units, so a ribbon stays a ribbon at any viewport */
  const widthUnits = (sizeVW, targetPx) =>
    (targetPx * rungScale() * VBW / Math.max(1,(sizeVW/100)*innerWidth)).toFixed(2);

  const NS = 'http://www.w3.org/2000/svg';
  const drawables = [];
  let cycle = 0;

  /* ---- THE SHADED SURFACE ------------------------------------------------
     These ribbons are the brand element, so they get the same tube surface the
     homepage bands do (ILLUSTRATION.md, Tier 1.5) rather than a flat stroke.

     paintStack, not paintTube: concentric full-length strokes rather than 72
     per-ribbon segments. ~226 DOM nodes a ribbon against ~820, no <mask>, and
     the same look family. Across 42 ribbons that is the difference between
     ~9,500 nodes and ~34,000 on pages that also render a 150-row directory.
     ?lines=seg forces the segmented renderer if the difference ever matters.

     tube.js is a MODULE and this file is a classic script, so it arrives by
     dynamic import. The URL is resolved against this script's own src, because
     a document-relative path would break on pages at different depths. If the
     import fails for any reason the flat stroke is drawn instead — the same
     reason --rung-scale lives in a CSS token: a missing piece should degrade,
     never blank the page. A cached tube.js without an expected export has
     taken every ribbon on this site down once already. */
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  const SEGMENTED = /[?&]lines=seg\b/.test(location.search);
  /* ?lines=flat pins the old flat stroke, so the surface can be judged as a
     before/after on the same page rather than from memory. */
  const FLAT = /[?&]lines=flat\b/.test(location.search);

  /* A ramp from the section's own accent. The homepage passes the model's
     36-stop ramps; here the colour is a CSS custom property, so three stops
     are synthesised around it — enough for the shading to read as a tube, and
     it keeps this file independent of the element's spine data. */
  const hx = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const hex = c => '#' + c.map(v => Math.round(v<0?0:v>255?255:v).toString(16).padStart(2,'0')).join('');
  function hsl(c){
    let [r,g,b]=c.map(v=>v/255);
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2;
    if (mx===mn) return [0,0,l];
    const dd=mx-mn, sa = l>.5 ? dd/(2-mx-mn) : dd/(mx+mn);
    const h = mx===r ? (g-b)/dd+(g<b?6:0) : mx===g ? (b-r)/dd+2 : (r-g)/dd+4;
    return [h/6,sa,l];
  }
  function rgbOf([h,s,l]){
    if (!s) return [l*255,l*255,l*255];
    const q = l<.5 ? l*(1+s) : l+s-l*s, pp = 2*l-q;
    const f = t => { t=(t+1)%1;
      return t<1/6 ? pp+(q-pp)*6*t : t<.5 ? q : t<2/3 ? pp+(q-pp)*(2/3-t)*6 : pp; };
    return [f(h+1/3)*255, f(h)*255, f(h-1/3)*255];
  }
  const cl01 = v => v<0?0:v>1?1:v;
  function rampFor(sec, hue){
    const name = sec.dataset.linesHue === 'mixed' ? hue : 'accent';
    const v = getComputedStyle(sec).getPropertyValue('--' + name).trim();
    const base = /^#[0-9a-f]{6}$/i.test(v) ? hx(v) : [140,150,190];
    const [h,sa,l] = hsl(base);
    return [ hex(rgbOf([h, cl01(sa-.10), cl01(l+.10)])),
             hex(base),
             hex(rgbOf([h, cl01(sa+.12), cl01(l-.12)])) ];
  }

  let TUBE = null;

  function start(){
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
        const xPct = xFor(shape, spec[3], spec[2]), yPct = spec[4], rot = spec[5], par = spec[8];
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

        if (TUBE && !FLAT){
          const stops = rampFor(sec, hue);
          const La = (150 - rot) * Math.PI / 180;   // one light, held as each svg rotates
          const bands = (SEGMENTED ? null : TUBE.paintStack(svg, d, parseFloat(w), stops, La));
          let first, extra, len;
          if (bands){ first = bands[0]; extra = bands.slice(1); len = first.getTotalLength(); }
          else { const t = TUBE.paintTube(svg, d, parseFloat(w), stops, La);
                 first = null; extra = null; len = t.len; var seg = t; }
          host.appendChild(svg);
          for (const b of [first, ...(extra||[])].filter(Boolean)){
            b.style.strokeDasharray = len;
            b.style.strokeDashoffset = reduce ? 0 : len;
          }
          if (seg && reduce) seg.reveal(1, 1);
          drawables.push({ svg:svg, p:first, extra:extra, seg:seg||null, casing:null,
                           len:len, sec:sec, stops:stops, La:La,
                           sizeVW:sizeVW, strokePx:strokePx, rot:rot, par:par, d:d,
                           w:win(i), dir: i>0 && i%2===0 ? -1 : 1 });
          return;
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
          if (d.seg){
            d.seg.reveal(e, d.dir);                       // segmented: show the first N quads
          } else {
            const off = ((d.dir<0?-1:1) * d.len * (1-e)).toFixed(1);
            d.p.style.strokeDashoffset = off;
            if (d.extra) for (let j=0;j<d.extra.length;j++) d.extra[j].style.strokeDashoffset = off;
            if (d.casing) d.casing.style.strokeDashoffset = off;
          }

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
          if (TUBE && (d.p || d.seg)){
            /* radius is in viewBox units and depends on the viewport, so the
               shaded geometry is rebuilt — on resize only, never per frame */
            const off = d.p ? d.p.style.strokeDashoffset : '';
            if (d.seg){ d.seg = TUBE.paintTube(d.svg, d.d, parseFloat(w), d.stops, d.La); d.len = d.seg.len; }
            else {
              const bands = TUBE.paintStack(d.svg, d.d, parseFloat(w), d.stops, d.La);
              d.p = bands[0]; d.extra = bands.slice(1); d.len = d.p.getTotalLength();
              for (const b of bands){ b.style.strokeDasharray = d.len;
                b.style.strokeDashoffset = reduce ? 0 : (off || d.len); }
            }
            continue;
          }
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

  }

  /* Draw shaded if the module is there, flat if it is not. Never nothing. */
  if (SCRIPT_SRC){
    import(new URL('./tube.js', SCRIPT_SRC).href)
      .then(m => { TUBE = (m && m.paintStack && m.paintTube) ? m : null; })
      .catch(e => { console.warn('VARA lines: tube surface unavailable, drawing flat.', e); })
      .then(start);
  } else {
    start();                       // no script src to resolve against: flat
  }

  window.__varaSectionLines = drawables;     // probe for verification
})();
