/* =====================================================================
   controle.js — o celular. Mostra a SUA mão e manda os pedidos para a
   TV (jogar, negar, comprar…). Quem decide se vale é sempre a TV.
   ===================================================================== */
const Controle = (() => {
  const { $, esc } = Comum;
  const B = Bomba;
  const PREFIXO = 'jogos-de-sofa-bomba-v1-';
  // ?eu=2 no endereço vira outro "aparelho" (para testar com várias abas no mesmo navegador)
  const meuId = Comum.idDoAparelho() + (new URLSearchParams(location.search).get('eu') || '');

  let sala = '';
  let peer = null, conn = null, timer = null;
  let V = null;                 // o que a TV mandou para este jogador
  let meuNome = Comum.nomeSalvo();
  let nomeConfirmado = false;
  let prazo = null, prazoReacao = null, totalVez = 0, totalReacao = 5000;
  let ultimoAlerta = 0, eraMinhaVez = false, ultimaPilha = null;
  let ultimoPrivado = 0, ultimaVisao = 0, ultimoAnuncio = 0;
  const sel = new Set();        // cartas escolhidas na mão

  function iniciar(codigo) {
    sala = codigo;
    Comum.mostrar('controle');
    $('c-titulo').textContent = 'Sala ' + sala;
    Comum.manterAcesa();
    criarPeer();
    render();
  }

  // ------------------------------------------------------------------
  // Rede (reconecta sozinho se cair)
  // ------------------------------------------------------------------
  function criarPeer() {
    peer = new Peer(Comum.opcoesPeer());
    peer.on('open', conectar);
    peer.on('disconnected', () => { rede(false); agendar(); });
    peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') $('c-conectando-msg').textContent = 'Não encontrei a sala ' + sala + '. Confira se a TV ainda está com a sala aberta. Tentando de novo…';
      rede(false);
      agendar();
    });
  }
  function conectar() {
    if (conn && conn.open) return;
    if (conn) { try { conn.close(); } catch (e) { /* ignora */ } }
    conn = peer.connect(PREFIXO + sala, { reliable: true });
    conn.on('open', () => { rede(true); conn.send({ t: 'ola', id: meuId }); });
    conn.on('data', receber);
    conn.on('close', () => { rede(false); agendar(); });
    conn.on('error', () => { rede(false); agendar(); });
  }
  function agendar() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (peer.destroyed) { criarPeer(); return; }
      if (peer.disconnected) { peer.reconnect(); return; }
      conectar();
    }, 2500);
  }
  function rede(ok) {
    $('c-rede').textContent = ok ? 'Conectado' : 'Reconectando';
    $('c-rede').classList.toggle('on', ok);
  }
  setInterval(() => pedir({ t: 'ping' }), 3000);
  function pedir(msg) { if (conn && conn.open) conn.send(msg); }

  function receber(m) {
    if (!m || m.t !== 'estado') return;
    V = m.V;
    const agora = Date.now();
    prazo = m.tempos.restante != null ? agora + m.tempos.restante : null;
    totalVez = m.tempos.total;
    prazoReacao = m.tempos.reacaoRestante != null ? agora + m.tempos.reacaoRestante : null;
    totalReacao = m.tempos.reacaoTotal;
    if (V.eu != null) nomeConfirmado = true;
    // tira da seleção cartas que não estão mais na mão
    const ids = new Set(V.mao.map((c) => c.id));
    [...sel].forEach((id) => { if (!ids.has(id)) sel.delete(id); });
    avisos();
    render();
  }

  // ------------------------------------------------------------------
  // Avisos: vez, janela do Não, cartas recebidas, espiar
  // ------------------------------------------------------------------
  const eu = () => (V && V.eu != null ? V.jogadores[V.eu] : null);
  const tenho = (t) => V.mao.some((c) => c.t === t);
  const ultimoDaCadeia = (P) => (P.naos.length ? P.naos[P.naos.length - 1] : P.autor);
  const possoNegar = () => !!(V && V.pilha && eu() && eu().vivo && tenho('nao') && ultimoDaCadeia(V.pilha) !== V.eu);
  const possoAgir = () => !!(V && V.fase === 'jogo' && V.vez === V.eu && !V.pilha && !V.espera && eu() && eu().vivo);
  const esperaMinha = () => !!(V && V.espera && V.espera.j === V.eu);

  function avisos() {
    if (V.eu == null || V.fase !== 'jogo') { eraMinhaVez = false; return; }
    const minha = possoAgir() || esperaMinha();
    if (minha && !eraMinhaVez) { Comum.vibrar([150, 80, 150]); Comum.Som.vez(); piscar(); ultimoAlerta = Date.now(); }
    eraMinhaVez = minha;

    const chave = V.pilha ? V.pilha.texto + '|' + V.pilha.naos.length : null;
    if (chave && chave !== ultimaPilha && possoNegar()) { Comum.vibrar([60, 40, 60, 40, 60]); Comum.Som.tique(); piscar(); }
    ultimaPilha = chave;

    if (V.privado && V.privado.n !== ultimoPrivado) { if (ultimoPrivado) toast(V.privado.texto); ultimoPrivado = V.privado.n; }
    if (V.visao && V.visao.n !== ultimaVisao) { ultimaVisao = V.visao.n; mostrarFuturo(); }
    if (V.anuncio && V.anuncio.n !== ultimoAnuncio) {
      const A = V.anuncio;
      if (ultimoAnuncio && A.autor === V.eu && A.tipo === 'explodiu') { Comum.vibrar([400, 100, 400]); Comum.Som.captura(); }
      if (ultimoAnuncio && A.autor === V.eu && A.tipo === 'desarmou') { Comum.vibrar([300]); }
      ultimoAnuncio = A.n;
    }
  }

  function piscar() {
    const c = $('controle');
    c.classList.remove('piscar'); void c.offsetWidth; c.classList.add('piscar');
  }

  setInterval(() => {
    if (!V || V.fase !== 'jogo') return;
    const agora = Date.now();
    // janela do Não
    if (prazoReacao) {
      const ms = prazoReacao - agora;
      barra($('c-reacao-barra'), ms, totalReacao);
      $('c-nao').dataset.seg = Math.max(0, Math.ceil(ms / 1000));
    }
    // tempo da vez
    const rel = $('relogio-cel');
    const mostrar = !!prazo && !V.pilha;
    rel.hidden = !mostrar;
    if (!mostrar) { $('controle').classList.remove('urgente'); return; }
    const ms = prazo - agora;
    barra(rel, ms, totalVez);
    const minha = possoAgir() || esperaMinha();
    $('controle').classList.toggle('urgente', minha && ms <= 5000);
    if (!minha || ms <= 0) return;
    const intervalo = ms <= 3000 ? 500 : ms <= 5000 ? 1000 : ms <= 10000 ? 2000 : null;
    if (intervalo && agora - ultimoAlerta >= intervalo) {
      ultimoAlerta = agora;
      Comum.vibrar(70);
      if (!Comum.podeVibrar) { Comum.Som.tique(); piscar(); }
    }
  }, 150);

  function barra(el, ms, total) {
    const frac = Math.max(0, Math.min(1, ms / total));
    el.firstElementChild.style.transform = 'scaleX(' + frac + ')';
    el.classList.toggle('pouco', frac <= 0.5 && frac > 0.25);
    el.classList.toggle('acabando', frac <= 0.25);
  }

  // ------------------------------------------------------------------
  // Telas
  // ------------------------------------------------------------------
  const PARTES = ['c-conectando', 'c-nome-form', 'c-assumir', 'c-aguardando', 'c-jogando', 'c-fim'];
  const ver = (id) => PARTES.forEach((p) => ($(p).hidden = p !== id));

  function toast(txt) {
    const t = $('c-toast');
    t.textContent = txt; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 3200);
  }

  $('c-ajuda').onclick = () => Guia.abrir('cartas');
  $('c-guia-sala').onclick = () => Guia.abrir('regras');

  function render() {
    if (!V) return ver('c-conectando');
    if (V.eu == null) {
      if (!nomeConfirmado || V.fase === 'sala') return renderNome();
      return renderAssumir();
    }
    if (!nomeConfirmado) return renderNome();
    if (V.fase === 'sala') return renderAguardando();
    if (V.fase === 'fim') return renderFim();
    renderJogando();
  }

  function renderNome() {
    ver('c-nome-form');
    const inp = $('c-nome-input');
    if (!inp.value) inp.value = meuNome;
    let aviso = '';
    if (V.fase !== 'sala' && V.eu == null) aviso = 'A partida já começou. Digite seu nome para ver se dá para entrar no lugar de alguém.';
    else if (V.eu == null && nomeConfirmado && V.jogadores.length >= B.MAX_JOGADORES) aviso = 'A sala está cheia (5 jogadores).';
    $('c-nome-aviso').textContent = aviso;
  }
  $('c-nome-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = Comum.limparNome($('c-nome-input').value);
    if (!n) return;
    meuNome = n; Comum.salvarNome(n); nomeConfirmado = true;
    if (V && (V.fase === 'sala' || V.eu != null)) pedir({ t: 'entrar', nome: n });
    render();
  });
  $('c-mudar-nome').onclick = () => { nomeConfirmado = false; render(); };
  $('c-sair').onclick = () => { pedir({ t: 'sair' }); nomeConfirmado = false; };

  function renderAssumir() {
    ver('c-assumir');
    const box = $('c-assumir-lista');
    box.innerHTML = '';
    let livres = 0;
    V.jogadores.forEach((p, j) => {
      if (!p.ausente || !p.vivo) return;
      livres++;
      const b = document.createElement('button');
      b.className = 'opcao';
      b.style.setProperty('--cor', p.cor);
      b.innerHTML = `<span class="bola" style="background:${p.cor}"></span>Assumir o lugar de <b>${esc(p.nome)}</b>`;
      b.onclick = () => pedir({ t: 'assumir', j, nome: meuNome });
      box.appendChild(b);
    });
    $('c-assumir-aviso').textContent = livres ? '' : 'Ninguém caiu. Espere esta partida acabar para entrar na próxima.';
  }

  function renderAguardando() {
    ver('c-aguardando');
    const p = eu();
    $('c-cartao-sala').style.background = p.cor;
    $('c-nome-sala').textContent = p.nome;
    $('c-modo-sala').textContent = 'Bomba no Sofá · ' + V.reacao + ' s para o Não · ' + (V.tempo ? V.tempo + ' s por vez' : 'sem tempo');
    const n = V.jogadores.length;
    $('c-qtd').textContent = n < B.MIN_JOGADORES ? `${n} jogador na sala. Precisa de pelo menos ${B.MIN_JOGADORES}.` : `${n} jogadores na sala. Pode começar!`;
  }

  function renderFim() {
    ver('c-fim');
    const ganhei = V.vencedor === V.eu;
    $('c-fim-ic').textContent = ganhei ? '🏆' : '💥';
    $('c-fim-titulo').textContent = ganhei ? 'Você venceu!' : 'Fim de jogo';
    $('c-fim-msg').textContent = ganhei ? 'Você foi o último a sobrar no sofá.' : B.nomeDe({ jogadores: V.jogadores }, V.vencedor) + ' venceu.';
  }

  // ---------------- jogando ----------------
  function renderJogando() {
    ver('c-jogando');
    const p = eu(), vivo = p.vivo;
    const minhaVez = possoAgir();
    $('c-cartao').style.background = p.cor;
    $('c-nome').textContent = p.nome;
    $('c-turnos').hidden = !(V.vez === V.eu && V.turnos > 1 && vivo);
    $('c-turnos').textContent = '×' + V.turnos + ' vezes';
    $('c-msg').textContent = !vivo ? 'Você explodiu.'
      : V.pilha ? 'Janela do Não aberta…'
      : esperaMinha() ? 'Sua escolha!'
      : minhaVez ? 'Sua vez! Jogue cartas ou compre uma para terminar.'
      : V.espera ? 'Esperando ' + V.jogadores[V.espera.j].nome + ' escolher…'
      : 'Vez de ' + V.jogadores[V.vez].nome + '.';

    renderReacao();
    renderEspera();
    $('c-explodiu').hidden = vivo;

    // espiar o futuro
    $('c-visao').hidden = !V.visao;
    if (V.visao) {
      const box = $('c-visao-cartas');
      box.innerHTML = '';
      V.visao.cartas.forEach((t) => box.appendChild(Cartas.frente(t, 44)));
    }

    renderMao();
    $('c-acoes').hidden = !minhaVez; // botões só aparecem na sua vez
    $('c-comprar').disabled = !minhaVez;
    $('c-comprar').textContent = minhaVez ? 'Comprar carta e terminar' : 'Comprar carta';
  }

  function renderReacao() {
    const P = V.pilha;
    $('c-reacao').hidden = !P;
    if (!P) return;
    $('c-reacao-txt').textContent = P.texto;
    $('c-reacao-cadeia').textContent = P.naos.map((j, k) => V.jogadores[j].nome + (k ? ' negou o Não' : ' disse NÃO')).join(' → ') + (P.naos.length ? (P.naos.length % 2 ? ' · por enquanto cancelada' : ' · por enquanto vale') : '');
    const pode = possoNegar();
    $('c-nao').hidden = !pode;
    $('c-nao').textContent = P.naos.length ? '✋ NÃO ao Não!' : '✋ NÃO!';
    $('c-reacao-espera').textContent = pode ? '' : P.autor === V.eu && !P.naos.length ? 'Esperando para ver se alguém nega…' : 'Aguarde…';
  }
  $('c-nao').onclick = () => { $('c-nao').hidden = true; pedir({ t: 'negar' }); Comum.vibrar(40); };

  function renderEspera() {
    const E = V.espera;
    const minha = esperaMinha();
    $('c-espera').hidden = !minha;
    if (!minha) return;
    const box = $('c-espera-opcoes');
    box.innerHTML = '';
    box.className = 'lista-btns';
    if (E.tipo === 'favor') {
      $('c-espera-txt').textContent = V.jogadores[E.para].nome + ' pediu um Favor: toque na carta da sua mão que você vai dar.';
    } else if (E.tipo === 'esconder') {
      $('c-espera-txt').textContent = 'Você desarmou a bomba! Onde escondê-la de volta no monte? Ninguém mais vai saber.';
      const n = V.monte;
      const opcoes = [['No topo (o próximo compra!)', 0], ['2ª carta', 1], ['3ª carta', 2], ['No meio', Math.floor(n / 2)], ['No fundo', n], ['Lugar aleatório', Math.floor(Math.random() * (n + 1))]];
      opcoes.filter(([, pos], k) => k >= 3 || pos <= n).forEach(([txt, pos]) => {
        const b = document.createElement('button');
        b.className = 'opcao';
        b.textContent = txt;
        b.onclick = () => { pedir({ t: 'esconder', pos }); Comum.vibrar(30); };
        box.appendChild(b);
      });
    } else if (E.tipo === 'descarte') {
      $('c-espera-txt').textContent = 'Escolha a carta que você quer pegar do descarte.';
      box.className = 'cartas-opcoes';
      [...new Set(V.descarte)].filter((t) => t !== 'bomba').forEach((t) => {
        const c = Cartas.frente(t, 72, { botao: true });
        c.onclick = () => { pedir({ t: 'descarte', tipo: t }); Comum.vibrar(30); };
        box.appendChild(c);
      });
    }
  }

  function renderMao() {
    const box = $('c-mao');
    box.innerHTML = '';
    const darFavor = esperaMinha() && V.espera.tipo === 'favor';
    const mao = Cartas.ordenar(V.mao);
    const largura = mao.length > 10 ? 64 : 76;
    mao.forEach((c) => {
      const el = Cartas.frente(c.t, largura, { botao: true });
      el.classList.toggle('escolhida', sel.has(c.id));
      el.onclick = () => {
        if (darFavor) {
          folha('Dar ' + B.CARTAS[c.t].nome + ' para ' + V.jogadores[V.espera.para].nome + '?', [['Dar esta carta', () => pedir({ t: 'dar', id: c.id })]]);
          return;
        }
        if (sel.has(c.id)) sel.delete(c.id); else sel.add(c.id);
        Comum.vibrar(15);
        renderMao();
      };
      box.appendChild(el);
    });
    if (!mao.length) box.innerHTML = '<p class="aviso">Sem cartas na mão.</p>';
    renderSelecao();
  }

  function selecionadas() { return V.mao.filter((c) => sel.has(c.id)); }

  function renderSelecao() {
    const cs = selecionadas();
    const info = $('c-selecao');
    const jogar = $('c-jogar');
    if (!cs.length) {
      info.textContent = possoAgir() ? 'Toque nas cartas para escolher. Toque em “Comprar” para terminar a vez.' : 'Toque numa carta para ver o que ela faz.';
      jogar.disabled = true; jogar.textContent = 'Jogar';
      return;
    }
    const an = B.analisar(cs.map((c) => c.t));
    if (cs.length === 1) {
      const C = B.CARTAS[cs[0].t];
      info.innerHTML = `<b>${esc(C.nome)}:</b> ${esc(C.desc)}` + (an ? '' : cs[0].t === 'nao' ? ' <i>Usa-se quando alguém joga uma carta.</i>' : cs[0].t === 'desarmar' ? ' <i>É usado sozinho quando você compra uma Bomba.</i>' : ' <i>Escolha mais uma igual para fazer um par.</i>');
    } else if (an) {
      info.innerHTML = `<b>${esc(B.COMBOS[an.tipo].nome)}:</b> ${esc(B.COMBOS[an.tipo].desc)}`;
    } else info.textContent = 'Essa combinação não vale. Combos: 2 iguais, 3 iguais ou 5 diferentes.';
    jogar.disabled = !an || !possoAgir();
    jogar.textContent = !an ? 'Jogar' : an.tipo === 'acao' ? 'Jogar ' + B.CARTAS[an.carta].nome : 'Jogar ' + B.COMBOS[an.tipo].nome.toLowerCase();
  }

  $('c-jogar').onclick = () => {
    const cs = selecionadas();
    const an = B.analisar(cs.map((c) => c.t));
    if (!an || !possoAgir()) return;
    const ids = cs.map((c) => c.id);
    const enviarJogada = (alvo, nome) => { pedir({ t: 'jogar', ids, alvo, nome }); sel.clear(); Comum.vibrar(40); };
    if (!an.alvo) return enviarJogada();
    const alvos = V.jogadores.map((p, j) => j).filter((j) => j !== V.eu && V.jogadores[j].vivo && V.jogadores[j].cartas > 0);
    if (!alvos.length) { toast('Ninguém tem cartas para isso.'); return; }
    folha('De quem?', alvos.map((j) => [V.jogadores[j].nome + ' (' + V.jogadores[j].cartas + ')', () => {
      if (!an.nome) return enviarJogada(j);
      setTimeout(() => folha('Que carta você pede a ' + V.jogadores[j].nome + '?', B.TIPOS.filter((t) => t !== 'bomba').map((t) => [B.CARTAS[t].icone + ' ' + B.CARTAS[t].nome, () => enviarJogada(j, t)])), 50);
    }]));
  };
  $('c-comprar').onclick = () => { if (!possoAgir()) return; $('c-comprar').disabled = true; sel.clear(); pedir({ t: 'comprar' }); Comum.vibrar(40); };

  // ---------------- folha de escolhas ----------------
  function folha(titulo, opcoes, conteudo, textoFechar = 'Cancelar') {
    $('c-folha-titulo').textContent = titulo;
    const box = $('c-folha-opcoes');
    box.innerHTML = '';
    box.className = conteudo ? 'folha-cartas' : 'folha-opcoes';
    if (conteudo) conteudo.forEach((e) => box.appendChild(e));
    opcoes.forEach(([txt, fn]) => {
      const b = document.createElement('button');
      b.textContent = txt;
      b.onclick = () => { $('c-folha').hidden = true; fn(); Comum.vibrar(30); };
      box.appendChild(b);
    });
    $('c-folha-cancelar').textContent = textoFechar;
    $('c-folha').hidden = false;
  }
  $('c-folha-cancelar').onclick = () => ($('c-folha').hidden = true);

  function mostrarFuturo() {
    const cs = V.visao.cartas.map((t, k) => {
      const w = document.createElement('div');
      w.className = 'futuro-carta';
      w.appendChild(Cartas.frente(t, 92));
      const s = document.createElement('small');
      s.textContent = k === 0 ? '1ª (a próxima)' : k + 1 + 'ª';
      w.appendChild(s);
      return w;
    });
    folha(cs.length ? 'As próximas cartas do monte' : 'O monte está vazio', [], cs, 'Entendi');
  }

  return { iniciar };
})();
