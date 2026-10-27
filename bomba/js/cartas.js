/* =====================================================================
   cartas.js — o desenho das cartas (frente e verso), usado na TV, no
   celular e no guia. Cada carta: borda e faixa na cor dela, figura
   grande no meio e o nome embaixo.
   ===================================================================== */
const Cartas = (() => {
  const C = Bomba.CARTAS;

  /** Uma carta virada para cima. tam = largura em px. */
  function frente(t, tam = 86, extra = {}) {
    const d = document.createElement(extra.botao ? 'button' : 'div');
    if (extra.botao) d.type = 'button';
    d.className = 'carta' + (C[t].sofa ? ' sofa' : '') + (t === 'bomba' ? ' escura' : '') + (C[t].nome.length > 9 ? ' longo' : '');
    d.style.setProperty('--cor', C[t].cor);
    d.style.setProperty('--w', tam + 'px');
    d.dataset.t = t;
    d.innerHTML = `<span class="ic" aria-hidden="true">${C[t].icone}</span><b>${C[t].nome}</b>`;
    d.setAttribute('aria-label', C[t].nome);
    return d;
  }

  /** O verso (monte). */
  function verso(tam = 86) {
    const d = document.createElement('div');
    d.className = 'verso';
    d.style.setProperty('--w', tam + 'px');
    d.innerHTML = '<span class="verso-logo" aria-hidden="true">💣</span>';
    return d;
  }

  /** Ordem para arrumar a mão: ações primeiro, depois as de sofá. */
  const ORDEM = Bomba.TIPOS;
  const ordenar = (mao) => mao.slice().sort((a, b) => ORDEM.indexOf(a.t) - ORDEM.indexOf(b.t) || a.id - b.id);

  return { frente, verso, ordenar };
})();
