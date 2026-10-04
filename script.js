const N = 41;
const $ = id => document.getElementById(id);
let words = [], mode = 'fleche', show = false;

const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// "mot : définition" -> [{w, d}]
function parse(t) {
  const seen = new Set(), out = [];
  for (let l of t.split('\n')) {
    l = l.trim();
    if (!l) continue;
    const m = l.match(/^([^;:=\t]+)[;:=\t]\s*(.*)$/), w = norm(m ? m[1] : l);
    if (w.length < 2 || seen.has(w)) continue;
    seen.add(w);
    out.push({ w, d: (m && m[2].trim()) || w.length + ' lettres' });
  }
  return out;
}

// Une tentative de placement des mots
function attempt(list, fl) {
  const g = [...Array(N)].map(() => Array(N).fill(null));
  const ws = [], b = { r0: N, r1: 0, c0: N, c1: 0 };

  const can = (w, r, c, dir) => {
    const dr = dir, dc = 1 - dir, L = w.length, er = r + dr * L, ec = c + dc * L;
    if (r < 2 || c < 2 || er >= N - 2 || ec >= N - 2) return -1;
    const before = g[r - dr][c - dc], after = g[er][ec];
    if ((before && before.t == 'L') || (after && after.t == 'L')) return -1;
    let x = 0;
    for (let i = 0; i < L; i++) {
      const rr = r + dr * i, cc = c + dc * i, k = g[rr][cc];
      if (k) {
        if (k.t != 'L' || k.ch != w[i] || (dir ? k.v : k.h)) return -1;
        x++;
      } else for (const s of [-1, 1]) {
        const a = g[rr + dc * s][cc + dr * s];
        if (a && a.t == 'L') return -1;
      }
    }
    return x;
  };

  const put = (o, r, c, dir) => {
    const dr = dir, dc = 1 - dir, pr = r - dr, pc = c - dc;
    if (fl) {
      if (!g[pr][pc]) g[pr][pc] = { t: 'C', cl: [] };
      g[pr][pc].cl.push({ d: o.d, dir });
    }
    for (let i = 0; i < o.w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      const k = g[rr][cc] || (g[rr][cc] = { t: 'L', ch: o.w[i] });
      k[dir ? 'v' : 'h'] = 1;
    }
    b.r0 = Math.min(b.r0, fl ? pr : r); b.c0 = Math.min(b.c0, fl ? pc : c);
    b.r1 = Math.max(b.r1, r + dr * (o.w.length - 1)); b.c1 = Math.max(b.c1, c + dc * (o.w.length - 1));
    ws.push({ d: o.d, r, c, dir });
  };

  put(list[0], N >> 1, (N >> 1) - (list[0].w.length >> 1), 0);
  for (const o of list.slice(1)) {
    let best = null, bs = -1e9;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const k = g[r][c];
      if (!k || k.t != 'L') continue;
      for (let i = 0; i < o.w.length; i++) if (o.w[i] == k.ch) for (const dir of [0, 1]) {
        const rr = r - dir * i, cc = c - (1 - dir) * i, x = can(o.w, rr, cc, dir);
        if (x < 1) continue;
        const h = Math.max(b.r1, rr + dir * o.w.length) - Math.min(b.r0, rr - dir) + 1;
        const w = Math.max(b.c1, cc + (1 - dir) * o.w.length) - Math.min(b.c0, cc - (1 - dir)) + 1;
        const s = x * 4 - Math.max(h, w) * 2 - Math.abs(h - w) * .5 + Math.random() * 3;
        if (s > bs) { bs = s; best = [rr, cc, dir]; }
      }
    }
    if (best) put(o, ...best);
  }
  return { g, b, ws, n: ws.length };
}

// Garde la meilleure de 80 tentatives
function build(list, fl) {
  let best = null;
  for (let t = 0; t < 80; t++) {
    const o = [...list].sort((a, c) => (c.w.length + Math.random() * 4) - (a.w.length + Math.random() * 4));
    const a = attempt(o, fl), area = (a.b.r1 - a.b.r0 + 2) * (a.b.c1 - a.b.c0 + 2);
    if (!best || a.n > best.n || (a.n == best.n && area < best.area)) { best = a; best.area = area; }
  }
  return best;
}

const inputs = () => [...document.querySelectorAll('#grid input')];
const at = (r, c) => inputs().find(i => i.dataset.r == r && i.dataset.c == c);

function render() {
  const fl = mode == 'fleche';
  const { g, b, ws, n } = build(words, fl);
  $('msg2').textContent = n < words.length
    ? `${words.length - n} mot(s) n'ont pas pu être placés (aucune lettre commune). Ajoutez-en d'autres ou cliquez sur « Nouvelle disposition ».` : '';

  // numérotation des mots croisés
  const nums = new Map();
  if (!fl) {
    let k = 0;
    [...ws].sort((x, y) => x.r - y.r || x.c - y.c).forEach(x => {
      const key = x.r + ',' + x.c;
      if (!nums.has(key)) nums.set(key, ++k);
      x.n = nums.get(key);
    });
  }

  const grid = $('grid');
  grid.className = fl ? '' : 'croise';
  grid.style.setProperty('--s', fl ? '64px' : '42px');
  grid.style.gridTemplateColumns = `repeat(${b.c1 - b.c0 + 1},var(--s))`;
  grid.innerHTML = '';

  for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) {
    const k = g[r][c];
    let e = document.createElement('div');
    if (!k) e.className = 'void';
    else if (k.t == 'C') {
      e.className = 'clue';
      const two = k.cl.length > 1;
      e.innerHTML = k.cl.map(x =>
        `<div class="cl ${x.dir ? 'v' : ''} ${two && x.dir ? 'h2' : ''}" title="${esc(x.d)}">${esc(x.d)}<i class="${x.dir ? 'd' : 'r'}">${x.dir ? '↓' : '→'}</i></div>`).join('');
    } else {
      e.className = 'cell';
      const i = document.createElement('input');
      i.maxLength = 1;
      Object.assign(i.dataset, { a: k.ch, r, c, h: k.h ? 1 : '', v: k.v ? 1 : '' });
      i.setAttribute('aria-label', 'Lettre');
      const num = nums.get(r + ',' + c);
      if (num) { const s = document.createElement('b'); s.textContent = num; e.append(s); }
      e.append(i);
    }
    grid.appendChild(e);
  }

  // listes de définitions (mots croisés)
  $('lists').hidden = fl;
  if (!fl) for (const [id, dir] of [['lh', 0], ['lv', 1]])
    $(id).innerHTML = ws.filter(x => x.dir == dir).sort((x, y) => x.n - y.n)
      .map(x => `<li value="${x.n}">${esc(x.d)}</li>`).join('');
  if (show) reveal();
}

function reveal() { inputs().forEach(i => { i.value = i.dataset.a; i.className = ''; }); }
function resetSol() { show = false; $('sol').textContent = 'Afficher la solution'; }
function go(step) { ['s1', 's2', 's3'].forEach((s, i) => $(s).hidden = i != step - 1); }

// Navigation entre les étapes
$('next').onclick = () => {
  words = parse($('in').value);
  if (words.length < 2) { $('msg').textContent = 'Entrez au moins deux mots.'; return; }
  $('msg').textContent = '';
  go(2);
};
document.querySelectorAll('.choice').forEach(btn => btn.onclick = () => {
  mode = btn.dataset.mode; resetSol(); go(3); render();
});
$('back2').onclick = () => go(1);
$('back3').onclick = () => go(2);
$('regen').onclick = () => { resetSol(); render(); };
$('print').onclick = () => print();

// Jeu : saisie, vérification, solution
$('grid').addEventListener('input', e => {
  const i = e.target;
  i.className = '';
  i.value = norm(i.value).slice(-1);
  if (!i.value) return;
  const r = +i.dataset.r, c = +i.dataset.c;
  const nx = (i.dataset.h && at(r, c + 1)) || (i.dataset.v && at(r + 1, c));
  if (nx) nx.focus();
});
$('grid').addEventListener('keydown', e => {
  const i = e.target, r = +i.dataset.r, c = +i.dataset.c;
  const m = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
  if (m) { const n = at(r + m[0], c + m[1]); if (n) { e.preventDefault(); n.focus(); } }
  else if (e.key == 'Backspace' && !i.value) { const n = (i.dataset.h && at(r, c - 1)) || at(r - 1, c); if (n) n.focus(); }
});
$('sol').onclick = () => {
  show = !show;
  $('sol').textContent = show ? 'Masquer la solution' : 'Afficher la solution';
  if (show) reveal(); else inputs().forEach(i => { i.value = ''; i.className = ''; });
};
$('chk').onclick = () => inputs().forEach(i => {
  i.className = !i.value ? '' : i.value.toUpperCase() == i.dataset.a ? 'ok' : 'bad';
});
$('clr').onclick = () => { resetSol(); inputs().forEach(i => { i.value = ''; i.className = ''; }); };
