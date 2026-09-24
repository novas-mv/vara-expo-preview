/* ====================== VARA element build worker ======================

   Surface Nets over four strokes is ~1.2s of straight-line CPU. On the main
   thread that is 1.2s in which nothing paints, nothing animates and the hero
   entrance cannot begin — so it runs here instead.

   Geometry construction needs no WebGL context (buildElement only touches
   THREE's BufferGeometry/Math classes), so it is legal in a worker. What is
   NOT legal, and is deliberately not attempted, is shipping materials or
   meshes back: those are bound to a renderer. Only the raw typed arrays
   cross, in the transfer list, so nothing is copied.

   The strokes are BUILT AND POSTED one at a time in the order coral, green,
   violet, cyan — the handoff's phase order — so the main thread starts each
   stroke's timeline the moment its buffers land.

   This used to call buildElement() once (which builds all four) and only then
   loop posting them, so despite the per-stroke messages nothing could appear
   until the slowest stroke finished and all four arrived together. The build
   is now genuinely per-stroke: first paint is one stroke's build, not four.  */

import * as THREE from 'https://unpkg.com/three@0.184.0/build/three.module.min.js';
import { buildElement } from './vara-element.js';

/* Matches the handoff's phase offsets: coral 0, green 0.02, violet 0.035,
   cyan 0.05. Arrival order therefore matches animation order. */
const ORDER = ['coral', 'green', 'violet', 'cyan'];

function shipStroke(name, mesh, groupOffset, last){
  const g = mesh.geometry;
  const position = g.attributes.position.array;
  const normal   = g.attributes.normal.array;
  const color    = g.attributes.color.array;
  const aArc     = g.attributes.aArc.array;     // itemSize 1 — drawOn depends on it
  const index    = g.index.array;

  postMessage({
    type: 'stroke',
    name, last, groupOffset,
    position, normal, color, aArc, index,
    spine:  mesh.userData.spine,
    colors: mesh.userData.colors,
    baseZ:  mesh.userData.baseZ
  }, [position.buffer, normal.buffer, color.buffer, aArc.buffer, index.buffer]);
}

/* Sent the instant the module has loaded. The main thread's fallback timer
   watches for THIS, not for the finished meshes — the build legitimately takes
   seconds, and a timeout on the build would race a healthy worker. */
postMessage({ type: 'ready' });

/* Surface Nets cost scales with 1/CELL^3. The traced tubes are ~0.08 across,
   so the shipped 0.0022 put ~36 voxels through each tube's diameter and cost
   2.6s for 1.01M triangles — for an element that renders about 600px wide.
   0.0038 keeps ~21 voxels across the tube (still far past the point the
   silhouette stops changing) and costs 673ms for 113k triangles. */
const CELL = 0.0038;

onmessage = () => {
  try {
    const t0 = performance.now();
    for (let i = 0; i < ORDER.length; i++){
      const name = ORDER[i];
      /* one stroke per iteration — each is posted before the next is built,
         so the hero fills in progressively instead of all at once at the end */
      const { group, strokes } = buildElement(THREE, {
        gummy: true, gap: 0.075, cell: CELL, only: name
      });
      /* the centring offset is computed from the spine data for all four
         strokes, so it is the same on every message and nothing shifts. */
      const groupOffset = [group.position.x, group.position.y, group.position.z];
      shipStroke(name, strokes[name], groupOffset, i === ORDER.length - 1);
    }
    postMessage({ type: 'done', ms: performance.now() - t0 });
  } catch (err){
    postMessage({ type: 'error', message: String(err && err.message || err) });
  }
};
