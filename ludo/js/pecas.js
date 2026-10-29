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
    if (hab && hab !== 'normal') selo(g, hab);
    return g;
  }

  /**
   * Selo da habilidade: um círculo escuro pequeno no canto de baixo à direita,
   * com um símbolo (forma, não só cor). Não cobre a cor do jogador.
   * Vácuo = vento · Laço = corrente · Corredor = raio · Tanque = ½ · Ligeiro = seta de saída
   * Banqueiro = $ · Vingativo = ! · Blindado = escudo
   */
  function selo(g, hab) {
    const s = el('g', { class: 'selo-hab', transform: 'translate(0.31 0.31)' }, g);
    el('circle', { r: 0.19, fill: '#1d2330', stroke: '#fff', 'stroke-width': 0.035 }, s);
    const traco = { fill: 'none', stroke: '#fff', 'stroke-width': 0.045, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const txt = (t, cor) => { const e = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 0.24, 'font-weight': 800, fill: cor || '#fff', 'font-family': 'Nunito, sans-serif', y: 0.01 }, s); e.textContent = t; };
    switch (hab) {
      case 'vacuo': el('path', Object.assign({ d: 'M-0.11,-0.07 H0.05 M-0.12,0 H0.11 M-0.1,0.07 H0.03' }, traco, { stroke: '#7fe7ff' }), s); break;
      case 'laco':
        el('ellipse', Object.assign({ cx: -0.05, cy: 0, rx: 0.075, ry: 0.045, transform: 'rotate(-35 -0.05 0)' }, traco, { stroke: '#f2c27a' }), s);
        el('ellipse', Object.assign({ cx: 0.05, cy: 0, rx: 0.075, ry: 0.045, transform: 'rotate(-35 0.05 0)' }, traco, { stroke: '#f2c27a' }), s);
        break;
      case 'corredor': el('path', { d: 'M0.03,-0.13 L-0.07,0.02 H-0.005 L-0.03,0.13 L0.08,-0.03 H0.015 Z', fill: '#f5b700' }, s); break;
      case 'tanque': txt('½'); break;
      case 'ligeiro': el('path', Object.assign({ d: 'M0,0.11 V-0.09 M-0.07,-0.02 L0,-0.1 L0.07,-0.02' }, traco, { stroke: '#9cf2a8' }), s); break;
      case 'banqueiro': txt('$', '#ffd76a'); break;
      case 'vingativo': txt('!', '#ff8a7a'); break;
      case 'blindado': el('path', { d: 'M0,-0.11 L0.09,-0.07 L0.08,0.03 Q0.05,0.09 0,0.12 Q-0.05,0.09 -0.08,0.03 L-0.09,-0.07 Z', fill: '#cfd6e6' }, s); break;
    }
    return s;
  }

  /** Um <svg> pequeno com o pino, para usar em botões e listas. */
  function icone(cor, hab, numero, tamanho = 44) {
    const svg = el('svg', { viewBox: '-0.75 -0.75 1.5 1.5', width: tamanho, height: tamanho, 'aria-hidden': 'true' });
    desenhar(el('g', {}, svg), cor, hab, numero);
    return svg;
  }

  return { el, desenhar, icone, selo, NS };
})();
