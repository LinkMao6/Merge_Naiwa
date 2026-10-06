// SAT against the convex pieces, including transparent holes in compound bodies.
// A merged body must be clear before it is rendered or a reward freezes physics.
export function overlapDepth(body, others, stopEarly = false) {
  const { Bounds, Collision } = window.Matter;
  let depth = 0;
  for (const other of others) {
    if (other === body || !Bounds.overlaps(body.bounds, other.bounds)) continue;
    for (const a of body.parts.slice(1)) for (const b of other.parts.slice(1)) {
      if (!Bounds.overlaps(a.bounds, b.bounds)) continue;
      const hit = Collision.collides(a, b);
      if (hit) depth = Math.max(depth, hit.depth);
      if (stopEarly && depth > .15) return depth;
    }
  }
  return depth;
}

// Bounds from real vertices exclude Matter's predicted velocity padding.
export function silhouetteBounds(body) {
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  const parts=body.parts.length>1?body.parts.slice(1):[body];
  for(const part of parts)for(const v of part.vertices){
    minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);
    minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
  }
  return {minX,maxX,minY,maxY};
}
export function containBirth(body, {left,right,floor}, margin=1.5) {
  const {Body}=window.Matter,b=silhouetteBounds(body);
  if(b.maxX-b.minX>right-left-2*margin)throw new Error('Character is wider than the playfield');
  const dx=Math.max(0,left+margin-b.minX)+Math.min(0,right-margin-b.maxX);
  const dy=Math.min(0,floor-margin-b.maxY);
  if(dx||dy)Body.translate(body,{x:dx,y:dy});
  return {dx,dy};
}
export function placeMergedBody(body, others, { left, right, floor }) {
  const { Body } = window.Matter;
  const original = { ...body.position };
  const before = overlapDepth(body, others);
  // Constrain the actual silhouette, not the source-image rectangle.
  const bounds = silhouetteBounds(body);
  const minX = original.x + left - bounds.minX + 1.5;
  const maxX = original.x + right - bounds.maxX - 1.5;
  const x = Math.max(minX, Math.min(maxX, original.x));
  const y = original.y + Math.min(0, floor - bounds.maxY - 1.5);
  const top = others.length ? Math.min(...others.map(b => b.bounds.min.y)) : y;
  const escape = Math.max(4, bounds.maxY - top + 4);
  let probes = 0;
  // Prefer a nearby position in the vacated area, then rise out of a tight pile.
  // Never push down through supporting bodies or use a sensor/ghost birth phase.
  for (let up = 0; up <= escape + 4; up += 4) {
    for (const side of [0, -4, 4, -12, 12, -24, 24]) {
      Body.setPosition(body, { x: Math.max(minX, Math.min(maxX, x + side)), y: y - up });
      probes++;
      if (overlapDepth(body, others, true) <= .15) {
        return { before, after: overlapDepth(body, others), dx: body.position.x - original.x, dy: body.position.y - original.y, probes };
      }
    }
  }
  throw new Error('No clear merge placement found');
}

export { birthScale } from './effects.js';
