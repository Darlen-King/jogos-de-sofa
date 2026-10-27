/* =====================================================================
   pecas.js — o desenho de cada pino, conforme a habilidade.
   O pino é desenhado em volta do ponto (0, 0), com raio ~0.4.
   Usado no tabuleiro (SVG grande) e nos botões do celular (SVG pequeno).
   ===================================================================== */
const Pecas = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, pai) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }

  /** Polígono com n pontas alternando raio externo/interno. */
  function estrela(n, rExt, rInt, giro = -Math.PI / 2) {
    const pts = [];
    for (let k = 0; k < n * 2; k++) {
      const r = k % 2 ? rInt : rExt, a = giro + (k * Math.PI) / n;
      pts.push((Math.cos(a) * r).toFixed(3) + ',' + (Math.sin(a) * r).toFixed(3));
    }
    return pts.join(' ');
  }
  function poligono(n, r, giro = Math.PI / 8) {
    const pts = [];
    for (let k = 0; k < n; k++) { const a = giro + (k * 2 * Math.PI) / n; pts.push((Math.cos(a) * r).toFixed(3) + ',' + (Math.sin(a) * r).toFixed(3)); }
    return pts.join(' ');
  }

  /** Desenha o corpo do pino dentro do grupo g. */
  function desenhar(g, cor, hab, numero) {
    const c = Ludo.HEX[cor], borda = '#fff';
    const sombra = (forma) => { const s = forma.cloneNode(); s.setAttribute('fill', 'rgba(0,0,0,.28)'); s.setAttribute('stroke', 'none'); s.setAttribute('transform', 'translate(0 0.06)'); g.insertBefore(s, forma); };
    let corpo;
    switch (hab) {
      case 'corredor':
        [-0.16, 0, 0.16].forEach((y, k) => el('line', { x1: -0.72 + k * 0.05, y1: y, x2: -0.36, y2: y, stroke: c, 'stroke-width': 0.07, 'stroke-linecap': 'round', opacity: 0.85 }, g));
        corpo = el('path', { d: 'M0.40,0 C0.40,0.26 0.20,0.38 -0.04,0.38 C-0.28,0.38 -0.40,0.22 -0.44,0 C-0.40,-0.22 -0.28,-0.38 -0.04,-0.38 C0.20,-0.38 0.40,-0.26 0.40,0 Z', fill: c, stroke: borda, 'stroke-width': 0.08 }, g);
        break;
      case 'tanque':
        corpo = el('polygon', { points: poligono(8, 0.43), fill: c, stroke: borda, 'stroke-width': 0.13, 'stroke-linejoin': 'round' }, g);
        break;
      case 'vacuo':
        el('path', { d: 'M0,-0.55 A0.55,0.55 0 0 1 0.55,0 M0,0.55 A0.55,0.55 0 0 1 -0.55,0', fill: 'none', stroke: c, 'stroke-width': 0.07, 'stroke-linecap': 'round', opacity: 0.8 }, g);
        corpo = el('circle', { r: 0.38, fill: c, stroke: borda, 'stroke-width': 0.08 }, g);
        break;
      case 'laco':
        el('circle', { r: 0.5, fill: 'none', stroke: '#a0672e', 'stroke-width': 0.08, 'stroke-dasharray': '0.07 0.05' }, g);
        corpo = el('circle', { r: 0.38, fill: c, stroke: borda, 'stroke-width': 0.08 }, g);
        break;
      case 'banqueiro':
        corpo = el('polygon', { points: estrela(14, 0.43, 0.37), fill: c, stroke: borda, 'stroke-width': 0.07, 'stroke-linejoin': 'round' }, g);
        el('circle', { r: 0.28, fill: 'none', stroke: 'rgba(255,255,255,.55)', 'stroke-width': 0.04 }, g);
        break;
      case 'vingativo':
        corpo = el('polygon', { points: estrela(8, 0.48, 0.32), fill: c, stroke: borda, 'stroke-width': 0.07, 'stroke-linejoin': 'round' }, g);
        break;
      case 'blindado':
        corpo = el('path', { d: 'M0,-0.44 L0.38,-0.3 L0.34,0.1 Q0.24,0.36 0,0.46 Q-0.24,0.36 -0.34,0.1 L-0.38,-0.3 Z', fill: c, stroke: borda, 'stroke-width': 0.08, 'stroke-linejoin': 'round' }, g);
        break;
      case 'ligeiro':
        corpo = el('circle', { r: 0.38, fill: c, stroke: borda, 'stroke-width': 0.08 }, g);
        el('polygon', { points: '0.30,-0.56 0.14,-0.26 0.26,-0.26 0.12,0.02 0.42,-0.34 0.30,-0.34 0.42,-0.56', fill: '#fff6c2', stroke: '#1d2330', 'stroke-width': 0.03 }, g);
        break;
      default:
        corpo = el('circle', { r: 0.38, fill: c, stroke: borda, 'stroke-width': 0.08 }, g);
    }
    sombra(corpo);
    const t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 0.42, 'font-weight': 800, fill: '#fff', 'font-family': 'Nunito, sans-serif', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 0.05, 'paint-order': 'stroke', y: 0.01 }, g);
    t.textContent = numero;
    return g;
  }

  /** Um <svg> pequeno com o pino, para usar em botões e listas. */
  function icone(cor, hab, numero, tamanho = 44) {
    const svg = el('svg', { viewBox: '-0.75 -0.75 1.5 1.5', width: tamanho, height: tamanho, 'aria-hidden': 'true' });
    desenhar(el('g', {}, svg), cor, hab, numero);
    return svg;
  }

  return { el, desenhar, icone, NS };
})();
