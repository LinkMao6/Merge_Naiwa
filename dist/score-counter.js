// Each place rolls independently. Retarget from the visible position when merges overlap.
export function createScoreCounter(element, { reduced = false } = {}) {
  const accessible = document.createElement('span');
  accessible.className = 'sr-only';
  const visual = document.createElement('span');
  visual.className = 'score-reels';
  visual.setAttribute('aria-hidden', 'true');
  element.replaceChildren(accessible, visual);
  const cells = new Map();
  const digitAt = value => ((Math.floor(value) % 10) + 10) % 10;
  function paint(cell) {
    const whole = Math.floor(cell.position), fraction = cell.position - whole;
    cell.rows.forEach((row, i) => row.textContent = digitAt(whole + i - 1));
    cell.strip.style.transform = `translateY(${-1.1 * (1 + fraction)}em)`;
    cell.node.dataset.digit = String(digitAt(cell.position));
    cell.node.dataset.rolling = String(cell.elapsed < cell.duration);
  }
  function set(value, { immediate = false } = {}) {
    const text = String(Math.max(0, Math.trunc(value)));
    element.style.setProperty('--score-digits',String(text.length));
    accessible.textContent = Number(text).toLocaleString('en-US');
    const nodes = [];
    [...text].forEach((char, index) => {
      const place = text.length - index - 1, target = Number(char);
      let cell = cells.get(place);
      if (!cell) {
        const node = document.createElement('span'), strip = document.createElement('span');
        node.className = 'score-digit'; strip.className = 'score-strip';
        const rows = Array.from({ length: 3 }, () => document.createElement('span'));
        strip.append(...rows); node.append(strip);
        cell = { node, strip, rows, position: 0, start: 0, target: 0, elapsed: 0, duration: 0 };
        cells.set(place, cell);
      }
      if (immediate || reduced) {
        cell.position = cell.target = target; cell.elapsed = cell.duration = 0;
      } else if (digitAt(cell.target) !== target) {
        const first = Math.ceil(cell.position);
        cell.start = cell.position;
        cell.target = first + (target - digitAt(first) + 10) % 10;
        cell.elapsed = 0;
        cell.duration = 500 + Math.min(10, cell.target - cell.start) * 24;
      }
      paint(cell); nodes.push(cell.node);
      if (place > 0 && place % 3 === 0) {
        const comma = document.createElement('span'); comma.className = 'score-comma'; comma.textContent = ','; nodes.push(comma);
      }
    });
    for (const place of cells.keys()) if (place >= text.length) cells.delete(place);
    visual.replaceChildren(...nodes);
  }
  function tick(dt) {
    for (const cell of cells.values()) {
      if (cell.elapsed >= cell.duration) continue;
      cell.elapsed = Math.min(cell.duration, cell.elapsed + dt);
      const t = cell.elapsed / cell.duration;
      cell.position = cell.start + (cell.target - cell.start) * (1 - (1 - t) ** 3);
      if (t === 1) cell.position = cell.target = digitAt(cell.target);
      paint(cell);
    }
  }
  set(0, { immediate: true });
  return { set, tick };
}
