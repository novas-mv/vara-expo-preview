/* ===================== THE HERO ELEMENT (3D) =====================
   Lifted verbatim out of pages/home/index.html so more than one page can
   mount it. It is unchanged apart from the worker URL, which now resolves
   against this module instead of the host document.

   It mounts itself on load and expects two elements in the page:
     #hero    the section it lives in (it transforms the .ambilight inside it)
     #stage   the canvas it renders into
   and an import map providing "three".

   Used by:  pages/home/index.html          the real hero
             pages/logo-animation/index.html  the animation on its own
   ================================================================= */
import * as THREE from 'three';
import { buildElement, studioEnv, drawOn } from './vara-element.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('stage');
const heroEl = document.getElementById('hero');

/* ---------------------------------------------------------------------
   WHERE THE MESHES ARE BUILT.

   Surface Nets over the four strokes is ≈1.2s of straight-line CPU for
   ≈320k triangles. Run on the main thread that is 1.2s of total freeze —
   no paint, no CSS animation, and the hero entrance cannot even begin.
   Deferring it off the critical path only moved the freeze; it did not
   remove it.

   So it now runs in a module worker (element-worker.js). Geometry needs no
   WebGL context, so this is legal; materials are NOT transferable and are
   rebuilt fresh here from the handoff's gummy parameters. The worker posts
   one message per stroke, in the handoff's phase order — coral, green,
   violet, cyan — with every typed array in the transfer list, so nothing is
   copied and each stroke can join the timeline the moment it lands.

   The renderer, lights, camera and the rAF loop are all up and running
   before the first stroke arrives, so the dolly and the cursor drift are
   live while the build is still going.

   If module workers are unavailable, or the worker faults, the synchronous
   path below is used instead — the hero is never left blank.
   --------------------------------------------------------------------- */

/* The worker is kicked off HERE, at module evaluation — not inside init().
   The build is the long pole, it needs no renderer, and starting it before
   the WebGLRenderer, the lights and the env map are even constructed means
   those seconds overlap instead of queueing. Deliveries are buffered until
   init() is ready to take them. */
const inbox = [];
let sink = d => inbox.push(d);
let wk = null, wkReady = false, wkFailed = false;
try {
  if (typeof Worker === 'function'){
    /* Resolved against THIS MODULE's url, not the document's. The hero module
       is loaded by more than one page now (see pages/logo-animation/), and a
       bare './element-worker.js' would resolve against whichever page it is
       embedded in and 404 everywhere but /pages/home/. */
    wk = new Worker(new URL('./element-worker.js', import.meta.url), { type:'module' });
    wk.onmessage = ev => { if (ev.data.type === 'ready') wkReady = true; else sink(ev.data); };
    wk.onerror = e => { e.preventDefault && e.preventDefault(); wkFailed = true; sink({ type:'error' }); };
    wk.postMessage('build');
  } else { wkFailed = true; }
} catch (e){ wkFailed = true; }
function killWorker(){ if (wk){ wk.terminate(); wk = null; } if (window.__varaProbe) window.__varaProbe.workerAlive = false; }
if (window.__varaProbe) window.__varaProbe.workerAlive = !!wk;

/* colorAt is pure maths over DATA[name].colors. buildElement returns one, but
   on the worker path buildElement never runs here, so it lives locally.
   Identical to the module's — keep them in step. */
const srgb = hex => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
function colorAt(stops, t){
  const f = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  return srgb(stops[i]).lerp(srgb(stops[i + 1]), f - i);
}

/* The approved gummy finish, rebuilt here because a MeshPhysicalMaterial
   cannot cross a postMessage boundary. Values are the handoff's, verbatim. */
/* Transmission is the most expensive thing in this shader and Mufhim compared
   both builds on the real hero at full size — no difference on an isolated cap,
   and none where strokes cross, which is the only place it can show. Off by
   default; ?transmission=1 restores it for a re-check. */
const TRANSMISSION = /[?&]transmission=1/.test(location.search) ? 0.3 : 0;
function gummyMaterial(name, colors){
  const mid = srgb(colors[Math.floor(colors.length / 2)]);
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors:true, color:0xffffff, metalness:0 });
  mat.name = name + '_surface';
  mat.userData.mid = mid;
  Object.assign(mat, {
    roughness:0.22, clearcoat:0.75, clearcoatRoughness:0.14, ior:1.45,
    transmission:TRANSMISSION, thickness:0.07, attenuationDistance:0.1,
    sheen:0.2, sheenRoughness:0.6, emissiveIntensity:0.05, envMapIntensity:0.7
  });
  mat.attenuationColor = mid;
  mat.emissive = mid;
  mat.sheenColor = new THREE.Color(0xffffff);
  return mat;
}

/* aArc MUST survive with itemSize 1 — drawOn's injected shader reads it. */
function geometryFrom(d){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
  g.setAttribute('normal',   new THREE.BufferAttribute(d.normal,   3));
  g.setAttribute('color',    new THREE.BufferAttribute(d.color,    3));
  g.setAttribute('aArc',     new THREE.BufferAttribute(d.aArc,     1));
  g.setIndex(new THREE.BufferAttribute(d.index, 1));
  g.computeBoundingSphere();
  return g;
}
/* init() is wrapped: if the device cannot create a WebGL context at all
   (no GPU, a blocked/exhausted context, a driver fault) the hero must still
   be a finished hero — its navy gradient, its type and its countdown are all
   CSS/DOM and owe nothing to three.js. Never let a GPU fault take the page. */
function safeInit(){
  try { init(); }
  catch (e){
    console.warn('VARA: 3D hero unavailable, falling back to the static hero.', e);
    killWorker();                       // nothing left to deliver the meshes to
    if (canvas) canvas.style.display = 'none';
    window.__varaWebGL = { alive:false, failed:true };
  }
}
/* The element used to wait for the `load` event, THEN up to 900ms of idle
   time, THEN run its ~1.2s mesh build — so the entrance began very late.
   Two rAFs after DOMContentLoaded is enough to guarantee the type has
   painted (which is the actual requirement), without waiting on every font
   and image first. Same "off the critical path" guarantee, seconds sooner. */
/* ONE rAF, not two — one frame is enough to guarantee the hero type has
   painted, and the ~1.2s mesh build is the dominant delay so every frame
   saved before it counts. */
const boot = () => requestAnimationFrame(safeInit);
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot, {once:true});
else boot();

function init(){
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias:true, alpha:true, preserveDrawingBuffer:true   // alpha: navy page shows through
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  /* NoToneMapping, per the handoff: ACES collapses the brand ramps to pastel
     — measured median saturation falls from ~0.70 to ~0.36. */
  renderer.toneMapping = THREE.NoToneMapping;
  /* DELIBERATE DEVIATION: the handoff says setClearColor(0x37002c) — plum.
     The brand ground moved from plum to NAVY (#001D61), so the canvas is
     cleared TRANSPARENT over the navy page instead. Do not revert to plum. */
  renderer.setClearColor(0x001D61, 0);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 0.95);
  const key  = new THREE.DirectionalLight(0xffffff, 1.76); key.position.set(4, 7, 5);
  const fill = new THREE.DirectionalLight(0xfff4e6, 0.40); fill.position.set(-5, 3, -4);
  scene.add(hemi, key, fill);
  const env = studioEnv(THREE, renderer);
  scene.environment = env;

  /* The group starts EMPTY. Strokes are added as the worker delivers them,
     so the scene, the camera dolly and the cursor drift are all live while
     the ~1.2s build is still running on the other thread. */
  const group = new THREE.Group(); group.name = 'vara_element';
  const strokes = {};
  const rig = new THREE.Group(); rig.add(group); scene.add(rig);

  const REST = { z: 1.28 };
  function layout(){
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    const wide = innerWidth >= 900;
    /* Entry/exit bias follows the copy: left half on wide, overhead on narrow.
       `var` on purpose — layout() runs before the fly constants below are
       evaluated, and a const/let there would be in its temporal dead zone. */
    flyWide = wide;
    const span = 0.78;   // NOTE: larger span => greater camera distance => SMALLER on canvas
    /* SPLIT LAYOUT: the element owns the right half and may bleed off the right
       edge, so it is framed LARGER than it was when it sat behind a centred
       poster stack (0.889 wide / 0.778 narrow). Narrow screens stack the copy
       above it and keep the smaller framing. */
    const fit = span / (wide ? 0.97 : 0.92);
    const dist = fit / (2 * Math.tan(cam.fov * Math.PI / 360) * (cam.aspect < 1 ? cam.aspect : 1));
    REST.z = Math.max(1.15, dist);
    cam.position.set(0, 0, REST.z);
    cam.lookAt(0, 0, 0);                            // stays on axis — the rest pose reads face-on
    /* NEVER translate the element to reposition it: moving it sideways views
       it obliquely and changes which strokes occlude which. Shift the frustum
       window instead, so the approved pose is preserved exactly. */
    /* The narrow offset was 0.120, lifting the element clear of copy that used
       to sit UNDER it — the canvas was full-bleed at every width and the two
       overlapped. Narrow now gives the element its own grid row, so there is
       nothing to lift clear of and the offset only left dead space beneath it:
       measured 11.9%-72.9% of a row it should fill. 0.030 centres it.

       Move the element into the right half by sliding the frustum WINDOW left
       (a negative x offset moves rendered content right), never by translating
       the mesh — see the note above. On narrow screens the copy stacks above
       the element, so it stays centred and only drops down the frame. */
    cam.setViewOffset(w, h,
                      wide ? -w * 0.220 : 0,
                      h * (wide ? 0.020 : 0.030),
                      w, h);
    cam.updateProjectionMatrix();
    /* Hand the element's on-screen centre to the ambilight, so the glow is
       always under the element and never beside it. The x centre is the
       frustum shift expressed as a percentage, mirrored: shifting the window
       left by 23.5% puts the element's centre at 50 + 23.5 = 73.5%. */
    /* Moved with a TRANSFORM, not with left/top.

       Writing --amb-x/--amb-y drove `left` and `top`, and this runs after the
       glow has already painted at its CSS default — so every load moved a
       laid-out element and booked a layout shift. It was the only shift on the
       page (CLS 0.0163, DIV.ambilight, confirmed by four independent
       instruments). Worse on narrow than the number suggests: the media query
       parks it at top:62% and this wrote 38%, a 24-point jump.

       Transform moves never count as layout shift, so the offset is applied as
       one instead. It is measured rather than computed because `left`
       resolves its percentage against #hero while `translate` resolves against
       the element's own box, and .ambilight's width differs by breakpoint —
       so the only exact conversion is to read where it actually landed and
       carry the difference. Reset first so repeated layout() calls do not
       accumulate. */
    const hero = canvas.parentElement;
    const amb = hero && hero.querySelector('.ambilight');
    if (amb){
      const sx = wide ? 22.0 : 0, sy = wide ? -2.0 : -12.0;
      const BASE = 'translate(-50%,-50%)';
      amb.style.transform = BASE;
      const hr = hero.getBoundingClientRect(), ar = amb.getBoundingClientRect();
      const dx = hr.width  * (50 + sx) / 100 - (ar.left + ar.width  / 2 - hr.left);
      const dy = hr.height * (50 + sy) / 100 - (ar.top  + ar.height / 2 - hr.top);
      amb.style.transform = BASE + ' translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)';
    }
  }
  layout();
  const ro = new ResizeObserver(layout); ro.observe(canvas);

  /* ---- the entrance. ONE master clock drives everything. ---- */
  /* 1.9s. Was 2.7, briefly 3.2. The mesh build already costs ~1.2s before
     this can start, so the entrance itself has to be brisk or the element
     arrives far too late. SEED stays a large FRACTION so the onset is still
     soft (0.20 x 1.9 = 380ms, gentler than the original 0.12 x 2.7 = 324ms)
     while the whole thing completes a full second sooner. */
  /* 2.2, up from 1.9 — a modest lengthening, because the real problem was
     never the clock. See the grow curve below: the entrance was spending a
     third of itself invisible. ?entrance=N overrides it for tuning. */
  const MT = (() => { const m=/entrance=([\d.]+)/.exec(location.search); return m?parseFloat(m[1]):2.2; })();
  const PHASE = { coral:0.00, green:0.02, violet:0.035, cyan:0.05 };   // nearly simultaneous by design
  /* SEED was 0.12 (~324ms) which snapped on. Longer, softer swell and an
     earlier, longer grow so the element is already moving when you look. */
  const SEED = 0.20, GROW = 0.82;
  const BIRTH = { coral:0.50, green:0.46, violet:0.50, cyan:0.42 };
  const TILT  = [0.30, -0.42, 0.10];                                   // one shared tilt, easing to zero

  /* ---- the LOOP: draw on, hold, draw off, repeat -----------------------
     Once the entrance has finished the element used to sit dead still while
     the rAF loop kept rendering it 60x a second anyway. This gives that work
     something to do. The cost is genuinely nil: the reveal is two float
     uniforms per stroke feeding a `discard` in the fragment shader, so
     nothing is rebuilt, re-uploaded or re-allocated per frame.

     The CAMERA deliberately does not loop. Repeating the dolly-out reads as
     a stuck GIF; the element redrawing itself inside a settled frame reads
     as a living mark.

     Seconds. OUT is slower than IN — retracting is the quiet half of the
     breath, arriving is the accent. GAP is deliberately short: the empty
     beat is a turnaround, not a pause. */
  const HOLD = 2.4, OUT = 1.6, GAP = 0.18, IN = 1.35;
  const LOOP = HOLD + OUT + GAP + IN;
  /* ?noloop pins the old behaviour (draw on once, then hold) so the two can
     be compared on the same build. Reduced-motion never loops. */
  const LOOP_ON = !reduce && !location.search.includes('noloop');
  /* Seconds the finished mark HOLDS before the loop takes over, measured from
     the end of the entrance. The entrance is the hero's first impression and
     it earns a beat to be read as a finished mark, at rest, before anything
     starts moving again — without this the element arrives and immediately
     begins dismantling itself, which undercuts the thing it just built.
     ?loopwait=N overrides it for tuning. */
  const LOOP_AFTER = (() => {
    const m = /loopwait=([\d.]+)/.exec(location.search);
    return m ? parseFloat(m[1]) : 5.0;
  })();

  /* ---- LOOP MODE ---------------------------------------------------------
     'fly' (default): each stroke travels in from off-frame, the four settle
     into the lockup, hold, then leave the way they came. This is the motion
     in the brand's own title sequence — pieces arriving and assembling — and
     it is what the draw-on does NOT convey: a draw-on is a line being drawn,
     not an object arriving.
     'draw' (?loop=draw): the earlier spine reveal, kept for comparison.

     Cost is the same either way, and the same as doing nothing: the rAF loop
     already renders every frame. 'fly' writes four positions and scales per
     frame; 'draw' writes two uniforms per stroke. Both are nothing. */
  const FLY_MODE = !location.search.includes('loop=draw');
  /* ?loop=sweep keeps the earlier version, where the draw happened WHILE the
     stroke was travelling and oversized. Side by side is the only way to see
     what the sequencing buys. */
  const SWEEP = location.search.includes('loop=sweep');
  /* ?loop=same makes every cycle travel, instead of alternating. */
  const SAME = location.search.includes('loop=same');

  /* ---- THE REFERENCE, read off the storyboard ---------------------------
     A stroke is BORN AS A DOT. The dot stretches into a capsule, the capsule
     keeps drawing itself along the stroke's own path until it is the full
     ribbon — and it does all of that while ENORMOUS and close to camera,
     overflowing the frame, before retreating and contracting into the small
     lockup. The scale journey is the whole feeling: not pieces sliding into
     a frame, but pieces rushing past you and then resolving.

     So the loop's IN is: dot -> draw along the spine -> contract into place.
     That growth is the entrance's own drawOn machinery (lo/hi walking apart
     from BIRTH), just run at 3x scale while the stroke travels.

     The loop's OUT is the entrance rewound: the stroke swells back up toward
     camera and sweeps out of frame. It never shrinks to nothing — it simply
     becomes too big and too close to still be in shot.

     CONSTRAINT: the hero copy shares this screen. On wide screens it sits in
     the LEFT half, so every entry and exit is biased RIGHT — nothing sweeps
     across the type. On narrow screens the copy stacks ABOVE, so the bias
     turns downward instead. Directions are picked at layout time. */

  /* [x, y, z] per stroke: the side it arrives from and leaves through. All
     four have positive x on wide — they come and go through the right edge,
     never across the copy. Varied y so they do not travel as one block. */
  const FLY_WIDE = { coral:[ 0.95,-0.62, 0.20], green:[ 0.72, 0.88,-0.10],
                     violet:[ 1.05, 0.34, 0.26], cyan:[ 0.86,-1.00,-0.16] };
  /* Narrow: the copy is overhead, so everything leaves through the BOTTOM. */
  const FLY_NARROW = { coral:[-0.70,-0.92, 0.20], green:[ 0.62,-0.86,-0.10],
                       violet:[ 0.95,-0.55, 0.26], cyan:[-0.45,-1.05,-0.16] };
  var flyWide;                              // set by layout() above; undefined === wide
  const flyDir = name => (flyWide === false ? FLY_NARROW : FLY_WIDE)[name];

  /* Scale is the headline. BIG_IN is how oversized a stroke is at the moment
     it is still a dot; it contracts to 1 as it settles. BIG_OUT is smaller
     because leaving is quick — it only has to get past the frame edge. */
  /* PEAK is how oversized a stroke gets at the top of its arc — the "huge and
     close" beat. It is NOT as big as the reference, on purpose: that is a
     full-frame title sequence with nothing else on screen, and this hero has
     copy in the left half. Past ~2.2 a stroke spills across the type. BIG_OUT
     can be bolder because the exit travels RIGHT as it swells, so the growth
     leaves the frame instead of crossing the words. */
  const PEAK_WIDE = 2.10;
  const PEAK_NARROW = (() => { const m=/peak=([\d.]+)/.exec(location.search); return m?parseFloat(m[1]):1.40; })();
  const BIG_OUT = 2.00;
  /* Which END each stroke is consumed from on the way out. +1 eats it from
     the start of the spine toward the finish, -1 the other way. Mixed on
     purpose: four strokes erasing the same direction reads like a wipe. */
  const ERASE = { coral:1, green:-1, violet:1, cyan:-1 };
  /* Small: the dot is BORN IN FRAME, just off the lockup, the way the
     storyboard opens. Spawning it off-frame meant the first half-second of
     every cycle was an empty right half and the dot beat was never seen. */
  /* IN_DIST is generous again: what travels is now a DOT, and a dot can come
     from properly off-frame without ever covering the copy. When the whole
     drawn stroke was the thing travelling this had to be kept small. */
  const IN_DIST = 1.05, OUT_DIST = 1.15;    // world units, at rest scale
  /* ---- how fly and draw are COMBINED --------------------------------------
     They used to run on top of each other: the stroke drew itself while it was
     travelling and oversized, and the draw was simply not legible through the
     motion — you read movement, not a line being made.

     They are SEQUENCED now, with a small overlap, so each beat gets its own
     moment:
        travel   a dot flies in from off-frame and settles          [0 .. 0.55]
        draw     it stretches along its spine, in place             [0.45 .. 1]
     and on the way out, the reverse:
        erase    it is consumed back down to a dot, in place        [0 .. 0.62]
        travel   the dot flies out                                  [0.50 .. 1]
     The 0.10 overlap is what keeps it from feeling like two separate moves
     bolted together — the draw starts just before the dot finishes arriving. */
  /* IN_DRAW starts INSIDE the travel, not after it. At 0.45 the dot arrived,
     came to a stop, and only then began to draw — an intermediate settle
     between two related moves, which is the thing that reads as stop-and-go.
     At 0.38 the draw is already underway while the overshoot is still
     settling, so the landing LAUNCHES the growth as one continuous gesture.
     It stays legible because the stroke is barely 15% drawn until the dot is
     home — the draw proper still happens in place. */
  const IN_TRAVEL = 0.55, IN_DRAW = 0.38;
  const OUT_ERASE = 0.58, OUT_TRAVEL = 0.46;

  /* ---- the animation principles, applied ---------------------------------
     Straight lines and symmetrical curves are what made this read as software
     moving objects around. Four things fix that, and they are the standard
     ones:

     ARCS. Nothing in nature travels in a straight line. The dot now flies in
     on a curve — a perpendicular offset that peaks mid-flight and returns to
     zero — and bows the OTHER way on the exit, so the in and the out are not
     the same path run backwards.

     FOLLOW THROUGH. The dot does not stop dead on its mark. It slides a little
     past the lockup and settles back into it.

     SQUASH. It takes the impact: a brief compression at the moment it lands,
     right before the draw inflates it. Nothing rigid survives an arrival.

     ANTICIPATION. Before it leaves, it gathers — a small pull back AGAINST
     its exit direction, then it goes. An exit with no wind-up reads as the
     object being deleted rather than leaving. */
  const ARC = 0.26;          // world units of bow at the peak of the flight
  const SQUASH = 0.86;       // scale at the bottom of the impact compression
  const ANTICIPATE = 0.13;   // world units of gather before the exit
  /* Which way each stroke bows. Mixed, or four strokes curve as one shoal. */
  const ARC_SIGN = { coral:1, green:-1, violet:-1, cyan:1 };
  /* Each stroke covers its flight at its OWN rate, not just on its own delay.
     Offsetting four identical curves gives a rigid formation moving in step;
     varying the rate is what makes them read as four separate things that
     happen to be arriving together. Small on purpose — this is drag, not
     choreography. */
  const FLY_RATE = { coral:1.00, green:0.92, violet:1.08, cyan:0.96 };
  /* Overshoot and settle. ~10% past the mark, which is the amount that reads
     as weight rather than as a wobble. */
  const backOut = t => { const c = 1.70158, u = t - 1; return 1 + (c+1)*u*u*u + c*u*u; };
  const bell = t => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  /* z is kept small deliberately: the camera sits ~1.2 out, so pushing a
     stroke toward it clips through the near plane long before it reads as
     "close". SCALE is what sells proximity, not z. */
  const Z_LIMIT = 0.42;
  /* A real tumble: each stroke now sits in its own pivot group at its
     geometry centre, so this rotates the stroke about itself. */
  const SPIN_IN = 1.25, SPIN_OUT = 0.85;

  const inCubic = t => t*t*t;
  const sstep = (a, b, t) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u*u*(3 - 2*u); };

  /* IN is long because it has to read as three beats — dot, draw, settle.
     OUT is short and accelerating: it is an exit, not a performance. */
  /* ---- PACE ---------------------------------------------------------------
     ONE multiplier over the whole cycle. Every phase, and the stagger between
     the strokes, scales together — so the rhythm the motion was tuned at is
     preserved and only the tempo changes. Reach for this first when it wants
     to be slower or quicker; retiming the phases individually will pull the
     proportions apart. 1.0 is the tuned rhythm; 1.34 is where it settled.

     Everything downstream is expressed as a FRACTION of its phase (the arc,
     the overshoot, the squash, the gather, the erase), so none of it needs
     touching when this moves. */
  const PACE = 1.34;
  /* F_OUT is the long one. The exit used to be the shortest phase in the
     cycle and it read as the strokes being snatched away — an accelerating
     erase into a cubic-out departure, over in under a second. Leaving is not
     an accent; it is the quiet half of the breath, and it wants room. The gap
     is long too, so the empty beat lands as a held pause rather than a
     stumble between cycles. */
  /* CADENCE — the held mark is the payoff, so it gets the runtime. The four
     phases used to be near-equal (2.08 / 2.28 / 2.01 / 0.54), which meant the
     loop spent more time taking the mark apart than showing it assembled.
     Slowness belongs in the HOLD, not spread evenly over the motion: motion
     should be the minority of the runtime, with the settled state dominating.
     The gap is trimmed hard for the same reason — a beat of empty frame is
     dead air, not a pause. */
  const F_IN  = 1.45 * PACE, F_HOLD = 3.05 * PACE,
        F_OUT = 1.40 * PACE, F_GAP  = 0.26 * PACE;
  const FLY_LOOP = F_IN + F_HOLD + F_OUT + F_GAP;
  /* Wide enough to read as four pieces arriving one after another, as they do
     in the storyboard. Coral leads, as it does there. */
  const flyStagger = { coral:0, green:0.13*PACE, violet:0.26*PACE, cyan:0.38*PACE };

  /* One scratch object, reused every frame for every stroke.
       grow  0 = still a dot, 1 = the full ribbon drawn along its spine
       off   how far out along its direction, in rest-scale world units
       big   scale multiplier: >1 is oversized and close to camera
       spin  tumble, radians
       erase 0 = whole stroke, 1 = consumed away to nothing (exit only)
       vis   whether it is in shot at all */
  const FK = { grow:0, off:0, arc:0, big:1, spin:0, erase:0, vis:true };
  function flyK(name){
    const tt = loopT - flyStagger[name];
    const cyc = Math.floor(tt / FLY_LOOP);
    const t = tt - cyc * FLY_LOOP;              // always inside [0, FLY_LOOP)
    /* ALTERNATION. Even cycles travel, odd cycles stay put and simply draw
       themselves in place. Four identical arrivals in a row is what makes a
       loop read as a GIF; giving every other cycle a quieter form is what
       makes it read as a mark that is alive. ?loop=same turns it off. */
    const travels = SAME || ((cyc % 2) + 2) % 2 === 0;
    const M = travels ? 1 : 0;

    if (t < F_IN){
      const u = t / F_IN;
      if (SWEEP){
        /* The earlier, overlapped version, kept for comparison. */
        FK.grow = sstep(0.12, 0.78, u);
        FK.off  = IN_DIST * (1 - sstep(0, 1, u)) * M;
        FK.big  = 1 + ((flyWide === false ? PEAK_NARROW : PEAK_WIDE) - 1) * (sstep(0.04, 0.46, u) * (1 - sstep(0.56, 1.0, u)));
        FK.spin = SPIN_IN * (1 - sstep(0.12, 1.0, u)) * M;
        FK.arc  = bell(sstep(0, 1, u)) * M;
      } else {
        /* TRAVEL first: what flies in is a dot, so it can come from properly
           off-frame without ever covering the copy. */
        const x = Math.min(1, u / (IN_TRAVEL * FLY_RATE[name]));
        /* A decelerating flight with the overshoot added only at the END.
           Feeding a smoothstep into easeOutBack double-eased it: the dot was
           on its mark by a quarter of the way in and then hung there doing
           nothing for the rest of the window. One cubic-out spends the whole
           window travelling; the bell bolts the follow-through onto the last
           third, where it belongs. */
        const a = (1 - Math.pow(1 - x, 3)) + 0.09 * bell((x - 0.70) / 0.30);
        FK.off  = IN_DIST * (1 - a) * M;
        FK.arc  = bell(x) * M;
        FK.spin = SPIN_IN * (1 - x) * M;
        /* THEN draw, in place, where it is actually legible. */
        FK.grow = sstep(IN_DRAW, 1, u);
        /* The swell rides the DRAW, not the travel — the stroke inflates as it
           makes itself and settles to size as it finishes. */
        FK.big  = 1 + ((flyWide === false ? PEAK_NARROW : PEAK_WIDE) - 1) * (sstep(IN_DRAW, IN_DRAW + 0.28, u) * (1 - sstep(0.74, 1.0, u)));
        /* The impact, landed on the frame the travel ends. A narrow dent in
           the scale, just before the draw inflates it — arrival, then growth. */
        FK.big *= 1 - (1 - SQUASH) * Math.exp(-Math.pow((u - IN_TRAVEL) / 0.075, 2)) * M;
      }
      FK.erase = 0; FK.vis = true;

    } else if (t < F_IN + F_HOLD){
      FK.grow = 1; FK.off = 0; FK.arc = 0; FK.big = 1; FK.spin = 0; FK.erase = 0; FK.vis = true;

    } else if (t < F_IN + F_HOLD + F_OUT){
      const r = (t - F_IN - F_HOLD) / F_OUT;
      FK.grow = 1;
      /* ERASE first, in place: the stroke is eaten along its own spine back
         down to the dot it was born as. Mildly accelerating, not double-eased
         — a cubic-on-smoothstep left the first quarter doing visibly nothing. */
      /* A plain smoothstep — eased in AND out. The old pow(_, 1.35) on top of
         it was back-loaded, so the stroke sat there and then vanished in a
         rush. Deliberate means the consume has a slow start, a steady middle
         and a soft finish, like a breath going out. */
      FK.erase = SWEEP ? Math.pow(r, 1.55) : sstep(0, OUT_ERASE, r);
      /* THEN the dot that is left flies out, swelling toward camera as it
         goes. It never shrinks away — it gets too big and too close to stay
         in shot. On a non-travelling cycle it simply finishes erasing. */
      /* A gentle, CONTINUOUS acceleration away — not a cubic-out off a
         smoothstep, which snapped hard and then flattened just as the dot
         should still have been gaining. It eases off its mark and keeps
         building all the way out of frame. */
      const ox = Math.min(1, Math.max(0, (r - OUT_TRAVEL) / (1 - OUT_TRAVEL)));
      const a = SWEEP ? inCubic(r) : Math.pow(ox, 1.9);
      /* The gather: a short pull back against the exit direction before it
         goes. Peaks just before the travel starts and is spent by the time
         it does. */
      const anti = SWEEP ? 0 : ANTICIPATE * bell(sstep(OUT_TRAVEL - 0.34, OUT_TRAVEL + 0.04, r));
      FK.off  = (OUT_DIST * a - anti) * M;
      FK.arc  = -bell(a) * M;               // bows the other way on the way out
      FK.big  = 1 + (BIG_OUT - 1) * a * M;
      FK.spin = SPIN_OUT * a * M;
      /* Held visible to the end of the phase: past full erase the mesh is
         gone but the cap remains, and that lone dot IS what leaves. */
      FK.vis  = M ? true : FK.erase < 0.995;

    } else {
      FK.grow = 0; FK.off = IN_DIST; FK.arc = 0; FK.big = 1; FK.spin = SPIN_IN; FK.erase = 0;
      FK.vis  = false;
    }
    return FK;
  }
  /* Own accumulator rather than wall-clock: the rAF loop stops while the hero
     is off-screen or the tab is hidden, and an accumulator simply does not
     advance across that gap — so coming back resumes mid-breath instead of
     snapping to wherever the wall clock had got to. */
  /* NOT zero. The entrance hands over with all four strokes settled, so the
     loop has to pick up INSIDE the hold — at zero, a stroke with a stagger
     reads its phase from the previous cycle and starts 85% erased, which
     pops. Starting at the top of the hold, past the largest stagger, means
     every stroke is holding on the handoff frame. */
  let loopT = F_IN + Math.max(...Object.values(flyStagger)), lastNow = 0;
  /* Stagger, seconds. The strokes are near-simultaneous by design, so this is
     the same PHASE spread stretched just enough to read as four strokes
     answering each other rather than one four-colour object. */
  const loopPhase = { coral:0, green:0.07, violet:0.12, cyan:0.17 };
  function loopGrow(name){
    let t = (loopT - loopPhase[name]) % LOOP;
    if (t < 0) t += LOOP;
    if (t < HOLD) return 1;
    if (t < HOLD + OUT) return 1 - inOutQuint((t - HOLD) / OUT);
    if (t < HOLD + OUT + GAP) return 0;
    return inOutQuint((t - HOLD - OUT - GAP) / IN);
  }

  const clamp01 = t => Math.min(1, Math.max(0, t));
  const inOutCubic = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const inOutQuint = t => t < 0.5 ? 16*t*t*t*t*t : 1 - Math.pow(-2*t + 2, 5) / 2;
  const outCubic   = t => 1 - Math.pow(1 - t, 3);
  const smooth = (t,a,b) => inOutCubic(clamp01((t - a) / (b - a)));

  /* Declared up here: the worker plumbing below closes over all three, and
     the synchronous fallback can fire during init itself. */
  let started = false, t0 = 0, dead = false;

  /* Below this much growth the two end caps are still effectively the same
     sphere — the gap between them is exactly `grow` in arc units, and a
     stroke's radius is a good tenth of its length, so under ~0.10 they
     overlap almost completely. Two coincident spheres Z-FIGHT: the depth
     buffer cannot separate them, and the winner flips across the surface in
     hard-edged patches. That is what read as a sliced dot on the violet at
     the start of the entrance, and as a seam arcing over the others.
     One sphere is geometrically sufficient there — the sliver of stroke
     between the two bounds is far shorter than the cap's own radius — so the
     far cap simply stays hidden until they have genuinely separated. */
  /* The cap matches the tube's radius EXACTLY. It has to: any clearance big
     enough to stop the tube's facets poking through (the Surface Nets grid is
     0.0038, so up to half a cell — 0.0019 — of error) is also big enough to
     read as a collar, because that is 5-7% of a stroke's radius. Tried at
     0.0026 and it showed immediately as bulbs sitting proud of the tube where
     the caps were. There is no value that is both sufficient and invisible, so
     matching exactly is the right call and the seam is dealt with in DEPTH
     instead — polygonOffset, below, biases the cap toward the camera without
     changing its size at all.
     ?capm=N adds absolute clearance back, for testing only. */
  const CAP_MARGIN = (() => { const m=/capm=([\d.]+)/.exec(location.search); return m?parseFloat(m[1]):0; })();
  const CAP_PROUD  = (() => { const m=/capp=([\d.]+)/.exec(location.search); return m?parseFloat(m[1]):1.0; })();
  /* Below this much growth a stroke's two end caps are still effectively the
     same sphere — the gap between them is exactly `grow` in arc units — and two
     coincident spheres cannot be ordered by a depth buffer. The far one waits
     until they have genuinely separated. */
  const CAP_SPLIT = 0.10;
  /* Below this a stroke is a bare sphere, not a stroke, so it is not drawn at
     all: no lone spheres on first load. */
  const STROKE_MIN = 0.035;
  const capGeo = new THREE.SphereGeometry(1, 32, 24);
  const heads = {};


  /* One delivered stroke: rebuild its geometry from the transferred buffers,
     give it a FRESH material (cloning would inherit a draw-on injection and
     render nothing), attach its spherical caps and start its timeline. */
  function attach(name, m, spine, colors){
    m.userData.spine = spine; m.userData.colors = colors;
    /* Every stroke gets its own pivot group, parked at the stroke's geometry
       centre, with the mesh offset back by the same amount. The fly loop moves
       the GROUP, so rotation happens about the stroke itself — a tumble — and
       the settled pose is restored exactly, making a holding frame identical
       to the static hero. */
    const piv = m.userData.pivot || new THREE.Vector3();
    const pv = new THREE.Group();
    pv.position.set(m.position.x + piv.x, m.position.y + piv.y, m.position.z + piv.z);
    m.position.set(-piv.x, -piv.y, -piv.z);
    pv.userData.rest = pv.position.clone();
    pv.add(m);
    m.userData.pv = pv;
    const birth = BIRTH[name];
    /* The cap is THE SAME SUBSTANCE as the stroke it ends. It used to be a
       duller, fully opaque material — roughness .42 vs .22, clearcoat .35 vs
       .75, no transmission, no sheen, no emissive, half the env intensity — so
       even with the depth sorted you saw a matte blob welded onto a glossy
       translucent ribbon, for the whole length of the extrude. Same gummy
       recipe, solid colour instead of vertex colours.

       polygonOffset on top: the cap and the tube still share a surface where
       they overlap, and biasing the cap toward the camera in DEPTH resolves
       that without moving it in SPACE — which is the honest fix, since the
       two really are meant to be the same surface there. */
    const matOf = t => {
      const mat = gummyMaterial(name, colors);
      mat.vertexColors = false;
      mat.color = colorAt(colors, t);
      mat.polygonOffset = true;
      /* Stronger than a token bias: this is now the ONLY thing separating two
         surfaces that are deliberately in the same place. Depth units are
         coarse here (a 0.1/40 frustum spends most of its precision before the
         model), so it takes a large number to move the cap a useful amount. */
      mat.polygonOffsetFactor = -4;
      mat.polygonOffsetUnits = -24;
      return mat;
    };
    const lo = new THREE.Mesh(capGeo, matOf(birth));
    const hi = new THREE.Mesh(capGeo, matOf(birth));
    m.add(lo, hi);                                  // children, so they inherit the stroke transform
    heads[name] = { lo, hi, sp: spine, birth, set: drawOn(THREE, m) };
    m.visible = false;
    strokes[name] = m;
    group.add(pv);
    /* The master clock starts on the FIRST arrival, not at page boot — the
       handoff's phase offsets then still read as designed instead of being
       eaten by however long the build took. */
    /* Compile and link this stroke's programs NOW, while it is still hidden
       and the clock has not started. The first draw of a MeshPhysicalMaterial
       with transmission is expensive, and a trace on a 4x-throttled machine
       caught a single 1,050ms frame inside `frame` with GPU work hanging off
       it — the shape of a first-draw compile. The cost does not disappear,
       but it lands here, on a blank canvas, instead of on the entrance's
       first visible frame. compile() walks VISIBLE objects, hence the flip. */
    m.visible = true;
    try { renderer.compile(scene, cam); } catch (e){ /* never block the hero on a warm-up */ }
    m.visible = false;
    if (!started){ started = true; t0 = performance.now() / 1000; }
    if (window.__varaProbe && !window.__varaProbe.done)
      window.__varaProbe.done = performance.now();
  }

  /* Worker delivery. */
  function fromWorker(d){
    (window.__varaTimes || (window.__varaTimes = [])).push([d.name, +performance.now().toFixed(0)]);
    const m = new THREE.Mesh(geometryFrom(d), gummyMaterial(d.name, d.colors));
    m.name = d.name;
    m.position.z = d.baseZ;
    m.userData.baseZ = d.baseZ;
    m.userData.pivot = m.geometry.boundingSphere.center.clone();
    m.castShadow = m.receiveShadow = true;
    if (!group.userData.offset){
      group.position.set(d.groupOffset[0], d.groupOffset[1], d.groupOffset[2]);
      group.userData.offset = true;
    }
    attach(d.name, m, d.spine, d.colors);
  }

  /* Synchronous fallback — only if the worker is unavailable or faults.
     Same ~1.2s freeze as before, but the hero is never left blank. */
  let syncDone = false;
  function buildSync(){
    if (syncDone || dead) return; syncDone = true;
    console.warn('VARA: building the element on the main thread (worker unavailable).');
    const built = buildElement(THREE, { gummy:true, gap:0.075, cell:0.0038 });
    group.position.copy(built.group.position);
    group.userData.offset = true;
    for (const [name, m] of Object.entries(built.strokes)){
      built.group.remove(m);
      attach(name, m, m.userData.spine, m.userData.colors);
    }
  }

  /* ?probe-only test hook — see the probe block in <head>. A no-op otherwise. */
  if (window.__varaProbe) window.__varaProbe.drift = () => ({ y: group.rotation.y, x: group.rotation.x });

  function handle(d){
    if (dead) return;
    if (d.type === 'stroke'){ fromWorker(d); if (d.last) killWorker(); }
    else if (d.type === 'error'){ killWorker(); buildSync(); }
    else if (d.type === 'done'){ killWorker(); }
  }
  /* ?sync forces the old main-thread path. Kept only so the worker can be
     measured against it on the same code — not a production switch. */
  if (location.search.includes('sync')){ killWorker(); buildSync(); }
  else {
    sink = handle;
    while (inbox.length) handle(inbox.shift());
    if (wkFailed) buildSync();
    /* A module worker that 404s or fails to parse can go quiet rather than
       error on some engines, so there is a guard — but it watches for the
       worker's 'ready' ping, NOT for the finished meshes. The build itself
       legitimately takes seconds; timing THAT out would race a healthy worker
       and hand the user back the freeze this change exists to remove. */
    setTimeout(() => { if (!wkReady && !started && !dead){ killWorker(); buildSync(); } }, 5000);
  }
  function cap(mesh, sp, t){
    const f = clamp01(t) * (sp.length - 1);
    const i = Math.min(sp.length - 2, Math.floor(f)), k = f - i;
    const a = sp[i], b = sp[i+1];
    mesh.position.set(a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k);
    /* PROUD of the tube, deliberately. The cap's radius is the spine radius,
       and the tube's surface is the isosurface at exactly that radius around
       the same spine — so at scale 1.0 the cap's inner hemisphere and the tube
       are THE SAME SURFACE IN THE SAME PLACE. Two coplanar surfaces cannot be
       ordered by a depth buffer, and the winner flickers across the whole
       overlap: that is the artifacting all through the extrude. Sitting the
       cap 4% outside puts it strictly in front everywhere, so it simply wins.
       4% of a ~0.04 radius is under two thousandths of a world unit — far
       below anything the eye can pick out against the tube's own silhouette. */
    mesh.scale.setScalar((a[3]+(b[3]-a[3])*k) * CAP_PROUD + CAP_MARGIN);
  }

  /* Before the first stroke lands the clock is held at T=0, so the element
     enters from the designed start pose rather than part-way through it. */
  const clock = now => reduce ? 1e9 : (started ? (now - t0) / MT : 0);

  window.__peakProbe = () => ({ flyWide, narrowUsed: flyWide === false,
    PEAK_WIDE, PEAK_NARROW, effective: (flyWide === false ? PEAK_NARROW : PEAK_WIDE),
    loopT: +loopT.toFixed(2), F_IN:+F_IN.toFixed(2), LOOP_AFTER,
    bigNow: Object.keys(strokes).map(n => n + ':' + (strokes[n].userData.pv ? strokes[n].userData.pv.scale.x.toFixed(2) : '-')).join(' ') });
  function pose(now){
    const T = clock(now);
    /* The entrance owns the clock until it is finished, and then the mark
       holds for LOOP_AFTER seconds before the loop takes over. T is in
       entrance-lengths, so (T - 1) * MT is seconds since it finished.
       clamp on dt so a long pause (off-screen, hidden tab) cannot
       fast-forward the breath on the frame we come back. */
    const looping = LOOP_ON && (T - 1) * MT >= LOOP_AFTER;
    if (looping){
      if (lastNow) loopT += Math.min(0.1, now - lastNow);
      lastNow = now;
    } else lastNow = 0;

    for (const [name, m] of Object.entries(strokes)){
      const H = heads[name], ph = PHASE[name], birth = H.birth, sp = H.sp;
      const flying = looping && FLY_MODE;

      /* FLY: the stroke stays fully drawn and TRAVELS. Rest pose is restored
         exactly on the settled frames, so the lockup is pixel-identical to
         the static hero whenever it is holding. */
      if (flying){
        const pv = m.userData.pv, rest = pv.userData.rest, dir = flyDir(name);
        const fk = flyK(name);
        if (!fk.vis){ m.visible = false; H.lo.visible = H.hi.visible = false; continue; }
        m.visible = true;
        /* The flight path, bowed. The arc offset is perpendicular to the
           direction of travel in the screen plane, so the dot swings out and
           back instead of running down a ruled line. */
        const ax = -dir[1], ay = dir[0], an = Math.hypot(ax, ay) || 1;
        const bow = fk.arc * ARC * ARC_SIGN[name];
        pv.position.set(rest.x + dir[0]*fk.off + (ax/an)*bow,
                        rest.y + dir[1]*fk.off + (ay/an)*bow,
                        rest.z + Math.max(-Z_LIMIT, Math.min(Z_LIMIT, dir[2]*fk.off)));
        pv.rotation.set(dir[1]*fk.spin, -dir[0]*fk.spin, dir[2]*fk.spin*0.6);
        pv.scale.setScalar(fk.big);
        /* The SAME draw-on the entrance uses: lo and hi walk apart from the
           birth point, so grow 0 is a dot, and grow 1 is the finished stroke.
           This is the morph — the stroke drawing itself along its own path,
           not a formed object sliding in. */
        if (fk.erase > 0){
          /* LEAVING: the same window, used as a wipe. One bound sweeps along
             the spine and eats the stroke; the cap rides that bound, so what
             you watch is the stroke collapsing into a travelling dot — the
             birth run backwards, not a solid being dragged off. */
          const e = fk.erase, fwd = ERASE[name] > 0;
          const edge = fwd ? e : 1 - e;
          H.set(fwd ? e : 0, fwd ? 1 : edge);
          cap(H.lo, sp, edge);
          H.lo.visible = true; H.hi.visible = false;
          H.lo.material.color.copy(colorAt(m.userData.colors, edge));
          continue;
        }
        const g = fk.grow;
        const loT = birth * (1 - g), hiT = birth + (1 - birth) * g;
        H.set(loT, hiT);
        cap(H.lo, sp, loT); cap(H.hi, sp, hiT);
        /* Caps stay full size all the way down to grow 0 — at zero they sit
           on top of each other AT the birth point, and that overlap IS the
           dot the stroke is born as. */
        H.lo.visible = g < 1;
        H.hi.visible = H.lo.visible && g > CAP_SPLIT;    // see CAP_SPLIT
        if (g < 1) for (const c of [H.lo, H.hi])
          c.material.color.copy(colorAt(m.userData.colors, c === H.lo ? loT : hiT));
        continue;
      }
      if (m.userData.pv && !m.userData.pv.position.equals(m.userData.pv.userData.rest)){
        const pv = m.userData.pv;          // coming back from fly mode
        pv.position.copy(pv.userData.rest);
        pv.rotation.set(0,0,0); pv.scale.setScalar(1);
      }

      const seed = looping ? 1 : smooth(T, ph, ph + SEED);
      /* outCubic, not inOutQuint. The old curve is deliberately slow off the
         mark — it spends its first ~30% below the length at which a stroke is
         drawn at all (STROKE_MIN). That slow start used to be VISIBLE as the
         dot swelling at the birth point; now that the lone-sphere stage is
         gone it is simply dead air, and the draw that remained was crammed
         into the back two thirds. outCubic reaches the visible threshold in
         about 1% of the window, so the extrude starts immediately and uses
         the WHOLE of it, decelerating into the finish. Same duration, nearly
         twice the visible transition. */
      const grow = looping ? loopGrow(name)
                           : outCubic(clamp01((T - (ph + SEED*0.6)) / GROW));
      /* A stroke is not shown until it is a STROKE. Below this much growth the
         only thing on screen is its end cap — a bare sphere sitting on its own
         with no ribbon between the bounds — and a lone sphere is both off-brief
         and the thing that kept showing up clipped. Past it there is always a
         real capsule with rounded ends, which is what the mark is made of.
         The seed ramp still swells it in; it just swells in as a stroke. */
      if (seed <= 0 || grow < STROKE_MIN){ m.visible = false; H.lo.visible = H.hi.visible = false; continue; }
      m.visible = true;
      const loT = birth * (1 - grow), hiT = birth + (1 - birth) * grow;
      H.set(loT, hiT);
      cap(H.lo, sp, loT); cap(H.hi, sp, hiT);
      /* At full retraction lo and hi have collapsed onto the birth point, so
         two full-size spheres would sit there with no stroke between them.
         On the entrance `seed` hid that; in the loop the caps are scaled out
         over the last sliver of travel instead. */
      const s = looping ? clamp01(grow / 0.05) : (grow > 0 ? 1 : seed);
      H.lo.scale.multiplyScalar(s); H.hi.scale.multiplyScalar(s);
      const growing = grow < 1;
      H.lo.visible = growing && s > 0.001;
      H.hi.visible = H.lo.visible && grow > CAP_SPLIT;   // see CAP_SPLIT
      if (growing) for (const c of [H.lo, H.hi])
        c.material.color.copy(colorAt(m.userData.colors, c === H.lo ? loT : hiT));
    }
  }
  function dolly(now){
    const T = clock(now);
    const k = inOutQuint(clamp01(T));
    /* 0.62, not 0.30. At 0.30 the camera starts so far inside the element that
       three of the four birth points are OUTSIDE the frame — measured, coral
       does not enter until 0.81s, violet 0.77s, green 0.58s. So for the first
       three quarters of a second there is nothing to see no matter how fast
       the meshes arrive, and on narrow, where the canvas is its own row, that
       reads as a blank box. The mesh build was never the cause; the dolly was.
       At 0.62 every birth point is in frame from the first rendered frame, and
       it is still a pull-out — just one that starts where the mark is. */
    cam.position.z = REST.z * (0.62 + 0.38 * k);
    rig.rotation.set(TILT[0]*(1-k), TILT[1]*(1-k), TILT[2]*(1-k));
  }

  /* cursor drift, exactly the handoff constants */
  let mx = 0, my = 0, cx = 0, cy = 0;
  const onMove = ev => { mx = (ev.clientX/innerWidth - 0.5)*2; my = (ev.clientY/innerHeight - 0.5)*2; };
  if (!reduce) addEventListener('pointermove', onMove, {passive:true});

  let raf = 0;
  let __varaFrames = 0;
  Object.defineProperty(window, '__varaFrames', { get: () => __varaFrames, configurable: true });
  function frame(){
    __varaFrames++;                                  // probe: proves pause() stops the loop
    const now = performance.now() / 1000;
    pose(now); dolly(now);
    const tx = reduce ? 0 : mx, ty = reduce ? 0 : my;
    cx += (tx - cx) * 0.045; cy += (ty - cy) * 0.045;
    group.rotation.y = cx * 0.22;
    group.rotation.x = cy * 0.16;
    renderer.render(scene, cam);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  let onScreen = true;          /* the hero starts in view */
  window.__varaWebGL = { alive:true };

  /* Visibility and viewport are TWO independent reasons to stop, so they are
     tracked separately and the loop runs only when neither says no. This used
     to restart the loop on tab-return unconditionally: scroll the hero away,
     switch tabs, come back, and the most expensive thing on the page rendered
     every frame while off screen — with no intersection change left to stop it
     again until the next scroll crossed the boundary. */
  document.addEventListener('visibilitychange', ()=>{
    if (dead) return;
    document.hidden ? pause() : resume();
  }, {passive:true});

  /* ---- TEARDOWN — on leaving the PAGE, never on leaving the viewport ----
     This used to run the moment the hero scrolled off the top, which made
     scrolling back up show an empty hero for the rest of the session: the
     renderer is disposed, the context explicitly lost and the canvas removed,
     and none of that is recoverable without a full rebuild. Scrolling is not
     leaving. The scroll case is handled by pause()/resume() below; this now
     runs only on pagehide, where freeing the context is unambiguously right. */
  function teardown(){
    if (dead) return; dead = true;
    killWorker();                                   // the worker has delivered; it owes us nothing more
    if (raf) cancelAnimationFrame(raf); raf = 0;
    removeEventListener('pointermove', onMove);
    ro.disconnect();
    /* No static snapshot on teardown. It pinned a ~670KB data-URL image over
       the hero so scrolling back up still showed the element — but the image
       carries whatever the canvas held, gets scaled to a box it was not
       captured at, and sits as an extra layer over the shared field. It was
       one of the two horizontal bands found by the scroll sweep.
       Scrolling back up now shows the hero type on the continuous field,
       which is seamless. Losing the element on scroll-back is the smaller
       cost, and re-initialising it would be the better fix if it matters. */
    scene.traverse(o=>{
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());
    });
    capGeo.dispose();
    if (env && env.dispose) env.dispose();
    const gl = renderer.getContext();
    renderer.dispose();
    const lose = gl && gl.getExtension && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    canvas.remove();
    window.__varaWebGL = { alive:false };
  }
  /* ---- PAUSE while the hero is off-screen ----
     Stopping the rAF loop removes essentially all of the per-frame cost — the
     hero is the most expensive thing on the page, and there is no reason to
     render it while it is not on screen. The context and the built geometry
     stay resident, so coming back is instant and costs no rebuild. That is
     the whole difference between this and teardown(). */
  function pause(){
    if (dead || !raf) return;
    cancelAnimationFrame(raf); raf = 0;
  }
  function resume(){
    if (dead || raf || document.hidden || !onScreen) return;
    /* Re-base past BOTH the entrance and the hold, not just the entrance —
       otherwise scrolling the hero out of view and back re-serves the full
       LOOP_AFTER wait every time, and the element sits dead on return. loopT
       is an accumulator, so the loop picks up mid-cycle where it left off. */
    if (started) t0 = performance.now()/1000 - (MT + LOOP_AFTER);
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(es=>{
    onScreen = es[0].isIntersecting;
    onScreen ? resume() : pause();
  },{threshold:0}).observe(heroEl);

  /* The context is worth freeing when the page is actually going away. */
  addEventListener('pagehide', teardown, {passive:true});
}
