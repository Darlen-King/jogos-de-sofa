/* =====================================================================
   guia.js — a janela "Como funciona": explica cada habilidade de pino e
   cada poder do Ludo Super. Abre no celular (na escolha das habilidades
   e durante o jogo) e na TV.
   ===================================================================== */
const Guia = (() => {
  const { $, esc } = Comum;
  const L = Ludo;
  let aba = 'pinos';
  let ctx = {};

  /**
   * Abre o guia.
   * ctx.cor / ctx.habil: cor e habilidades do jogador (mostra "Seus pinos" primeiro)
   * ctx.precos: { poder: preço atual } para mostrar quanto custa agora
   * ctx.aba: 'pinos' | 'poderes'
   */
  function abrir(opcoes) {
    ctx = opcoes || {};
    aba = ctx.aba || 'pinos';
    render();
    $('guia').hidden = false;
    $('guia-corpo').scrollTop = 0;
    $('guia-fechar').focus();
  }
  function fechar() { $('guia').hidden = true; }

  function cartao(icone, titulo, resumo, detalhe, atencao, extra) {
    const d = document.createElement('div');
    d.className = 'guia-item';
    const ic = document.createElement('div');
    ic.className = 'guia-icone';
    if (icone) ic.appendChild(icone);
    const tx = document.createElement('div');
    tx.innerHTML = `<b>${esc(titulo)}</b>${extra ? `<span class="guia-extra">${esc(extra)}</span>` : ''}` +
      (resumo ? `<p class="guia-resumo">${esc(resumo)}</p>` : '') +
      `<p>${esc(detalhe)}</p>` +
      (atencao ? `<p class="guia-atencao">Atenção: ${esc(atencao)}</p>` : '');
    d.append(ic, tx);
    return d;
  }

  function titulo(txt) {
    const h = document.createElement('h3');
    h.className = 'guia-sec';
    h.textContent = txt;
    return h;
  }

  function render() {
    document.querySelectorAll('.guia-abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
    const corpo = $('guia-corpo');
    corpo.innerHTML = '';
    const cor = ctx.cor || 'red';

    if (aba === 'pinos') {
      if (ctx.cor && ctx.habil) {
        corpo.appendChild(titulo('Seus pinos'));
        ctx.habil.forEach((h, i) => {
          const H = L.HABILIDADES[h];
          corpo.appendChild(cartao(Pecas.icone(cor, h, i + 1, 52), 'Pino ' + (i + 1) + ' — ' + H.nome, null, H.detalhe, H.ruim));
        });
        corpo.appendChild(titulo('Todas as habilidades'));
      }
      Object.entries(L.HABILIDADES).forEach(([k, H]) => {
        corpo.appendChild(cartao(Pecas.icone(cor, k, '', 52), H.nome, H.desc, H.detalhe, H.ruim));
      });
      corpo.appendChild(titulo('Sinais no tabuleiro'));
      const sinais = document.createElement('ul');
      sinais.className = 'guia-sinais';
      sinais.innerHTML = [
        '<b>♥</b> no pino: o Tanque ainda tem a vida extra.',
        '<b>Anel azul</b> em volta: pino com Proteção máxima.',
        '<b>4/10</b> embaixo do pino: preso no buraco negro (quanto já juntou para sair).',
        '<b>Casa roxa escura</b>: buraco negro.',
        '<b>Mira vermelha</b>: pino que pode ser capturado com o dado que saiu.',
        '<b>Dois pinos da mesma cor juntos</b>: ninguém captura (bloqueio).',
      ].map((t) => '<li>' + t + '</li>').join('');
      corpo.appendChild(sinais);
    } else {
      const aviso = document.createElement('p');
      aviso.className = 'guia-nota';
      aviso.textContent = 'Você ganha pontos andando (1 por casa nova), capturando (10) e levando um pino ao fim (50). Pode usar 1 poder por turno, antes de girar o dado. Cada vez que usa um poder, o preço dele dobra para você.';
      corpo.appendChild(aviso);
      Object.entries(L.PODERES).forEach(([k, P]) => {
        const agora = ctx.precos && ctx.precos[k] != null ? 'agora custa ' + ctx.precos[k] + ' pts' : 'começa em ' + P.preco + ' pts';
        corpo.appendChild(cartao(null, P.nome, P.desc, P.detalhe, null, agora));
      });
    }
  }

  document.querySelectorAll('.guia-abas button').forEach((b) => (b.onclick = () => { aba = b.dataset.aba; render(); }));
  $('guia-fechar').onclick = fechar;
  $('guia').addEventListener('click', (e) => { if (e.target === $('guia')) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('guia').hidden) fechar(); });

  return { abrir, fechar };
})();
