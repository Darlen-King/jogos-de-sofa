/* =====================================================================
   guia.js — a janela "Como jogar": regras da vez, a janela do "Não!",
   combos e o que cada carta faz. Abre na TV e no celular.
   ===================================================================== */
const Guia = (() => {
  const { $, esc } = Comum;
  const B = Bomba;
  let aba = 'regras';

  function abrir(qual) {
    aba = qual || 'regras';
    render();
    $('guia').hidden = false;
    $('guia-corpo').scrollTop = 0;
    $('guia-fechar').focus();
  }
  function fechar() { $('guia').hidden = true; }

  function item(icone, titulo, resumo, detalhe) {
    const d = document.createElement('div');
    d.className = 'guia-item';
    const ic = document.createElement('div');
    ic.className = 'guia-icone';
    if (icone) ic.appendChild(icone);
    const tx = document.createElement('div');
    tx.innerHTML = `<b>${esc(titulo)}</b>` + (resumo ? `<p class="guia-resumo">${esc(resumo)}</p>` : '') + (detalhe ? `<p>${esc(detalhe)}</p>` : '');
    d.append(ic, tx);
    return d;
  }
  function sec(txt) { const h = document.createElement('h3'); h.className = 'guia-sec'; h.textContent = txt; return h; }
  function lista(linhas) {
    const ul = document.createElement('ul');
    ul.className = 'guia-sinais';
    ul.innerHTML = linhas.map((t) => '<li>' + t + '</li>').join('');
    return ul;
  }

  function render() {
    document.querySelectorAll('.guia-abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
    const corpo = $('guia-corpo');
    corpo.innerHTML = '';
    if (aba === 'regras') {
      corpo.appendChild(sec('O objetivo'));
      corpo.appendChild(lista([
        'No monte tem <b>bombas</b>. Quem compra uma e não tem <b>Desarmar</b> explode e sai do jogo.',
        '<b>O último que sobrar ganha.</b>',
        'Todo mundo começa com 7 cartas + 1 Desarmar. As cartas ficam só no seu celular.',
      ]));
      corpo.appendChild(sec('Sua vez'));
      corpo.appendChild(lista([
        'Jogue quantas cartas quiser (ou nenhuma). Toque nas cartas para escolher e depois em <b>Jogar</b>.',
        'Para terminar a vez, toque em <b>Comprar carta</b>. Comprar é sempre o fim da vez.',
        'Ataque e Pular terminam a vez <b>sem comprar</b>: é assim que se foge da bomba.',
      ]));
      corpo.appendChild(sec('A janela do Não!'));
      corpo.appendChild(lista([
        'Depois de cada carta jogada, a TV conta alguns segundos (5, se ninguém mudar).',
        'Quem tem um <b>Não!</b> vê um botão vermelho grande no celular. Tocou, cancelou a jogada.',
        'Alguém pode negar o Não (a jogada volta a valer), e assim por diante. Cada Não recomeça a contagem.',
        'Quem não tem Não só vê a contagem, assim ninguém descobre quem tem.',
        'Acabou o tempo sem Não, a carta vale.',
      ]));
      corpo.appendChild(sec('Combos'));
      Object.values(B.COMBOS).forEach((c) => corpo.appendChild(item(null, c.nome, c.desc, null)));
      corpo.appendChild(lista([
        'Os combos valem com qualquer carta repetida (até 2 Ataques), mas aí ela não faz o efeito normal.',
        'As cartas de sofá (Pipoca, Chinelo, Controle, Meia, Ursinho) só servem para combos.',
      ]));
      corpo.appendChild(sec('Tempo'));
      corpo.appendChild(lista([
        'Se a TV estiver com tempo por vez e ele acabar, o jogo compra uma carta por você.',
        'Nas escolhas (dar uma carta, esconder a bomba), o tempo esgotado escolhe ao acaso.',
      ]));
    } else {
      B.TIPOS.forEach((t) => {
        const C = B.CARTAS[t];
        corpo.appendChild(item(Cartas.frente(t, 52), C.nome + (C.qtd ? ' · ' + C.qtd + ' no baralho' : ''), C.desc, C.detalhe));
      });
    }
  }

  document.querySelectorAll('.guia-abas button').forEach((b) => (b.onclick = () => { aba = b.dataset.aba; render(); }));
  $('guia-fechar').onclick = fechar;
  $('guia').addEventListener('click', (e) => { if (e.target === $('guia')) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('guia').hidden) fechar(); });

  return { abrir, fechar };
})();
