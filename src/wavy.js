// Pure-geometry wavy-line path generator for photon propagators.
// from/to are {x, y} points already trimmed to node boundaries by canvas.js.
// Returns an SVG 'd' string of quadratic Bézier bumps perpendicular to the line.

export function wavyPathD(from, to, { cycles = 5, amplitude = 7 } = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length; // unit along the line
  const uy = dy / length;
  const nx = -uy;         // unit perpendicular
  const ny =  ux;

  const N = cycles * 2; // two half-bumps per full cycle
  let d = `M ${from.x},${from.y}`;
  for (let i = 0; i < N; i++) {
    const t1 = (i + 1) / N;
    const tm = (i + 0.5) / N;
    const sign = i % 2 === 0 ? 1 : -1;
    const ex = from.x + ux * length * t1;
    const ey = from.y + uy * length * t1;
    const cx = from.x + ux * length * tm + nx * sign * amplitude;
    const cy = from.y + uy * length * tm + ny * sign * amplitude;
    d += ` Q ${cx},${cy} ${ex},${ey}`;
  }
  return d;
}
