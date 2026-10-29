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
        '<b>Selo no canto do pino</b>: a habilidade dele (vento = Vácuo, corrente = Laço, raio = Corredor, ½ = Tanque, seta = Ligeiro, $ = Banqueiro, ! = Vingativo, escudo = Blindado). Quando o selo pulsa, a habilidade vai funcionar com o dado que saiu.',
        '<b>Etiqueta amarela no destino</b>: o que a habilidade vai fazer ("+2", "metade", "−2 laço").',
        '<b>♥</b> no pino: o Tanque ainda tem a vida extra.',
        '<b>Bolha azul</b> em volta: pino com Proteção máxima (até a próxima vez do dono).',
        '<b>Estrela dourada com anel girando</b>: Ponto de segurança. O número diz quantas rodadas faltam.',
        '<b>Cadeado e 4/10</b>: pino preso no buraco negro (quanto já juntou para sair).',
        '<b>Redemoinho escuro</b>: buraco negro. <b>Casas roxas com ½</b> ao lado: quem sai delas anda metade.',
        '<b>Destino vermelho "buraco!"</b>: se escolher esse pino, ele cai no buraco negro.',
        '<b>Mira vermelha</b>: pino que pode ser capturado com o dado que saiu.',
        '<b>Dois pinos da mesma cor juntos</b>: ninguém captura (bloqueio).',
      ].map((t) => '<li>' + t + '</li>').join('');
      corpo.appendChild(sinais);
    } else {
      const aviso = document.createElement('p');
      aviso.className = 'guia-nota';
      aviso.textContent = 'Pode usar 1 poder por turno. Os poderes de depois do dado (Retroceder, Proteção máxima e Ponto de segurança) não custam pontos: cada um pode ser usado 2 vezes por partida (as bolinhas). Gire o dado, toque no poder e depois no pino; tocar de novo no poder cancela. Os de antes do dado custam pontos — você ganha andando (1 por casa nova), capturando (10) e levando um pino ao fim (50) — e o preço dobra a cada uso.';
      corpo.appendChild(aviso);
      corpo.appendChild(titulo('Depois de girar o dado'));
      Object.entries(L.PODERES).filter(([, P]) => P.depois).forEach(([k, P]) => {
        const resta = ctx.cargas && ctx.cargas[k] != null ? 'restam ' + ctx.cargas[k] + ' de ' + L.USOS_DEPOIS : L.USOS_DEPOIS + ' usos por partida';
        const img = document.createElement('img');
        img.src = 'img/' + P.icone + '_128.png'; img.alt = ''; img.width = 52; img.height = 52;
        corpo.appendChild(cartao(img, P.nome, P.desc, P.detalhe, null, resta));
      });
      corpo.appendChild(titulo('Antes de girar o dado'));
      Object.entries(L.PODERES).filter(([, P]) => !P.depois).forEach(([k, P]) => {
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
