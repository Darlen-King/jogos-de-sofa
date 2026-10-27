/* =====================================================================
   mesa.js — a tela grande (computador/TV).
   É o "dono" da partida: guarda o estado (inclusive as mãos e a ordem do
   monte), aplica as regras, conta o tempo do "Não!" e da vez, e manda a
   cada celular só o que aquele jogador pode ver.
   ===================================================================== */
const Mesa = (() => {
  const { $, esc } = Comum;
  const B = Bomba;
  const PREFIXO = 'jogos-de-sofa-bomba-v1-';

  let S = B.novoEstado(60, 5);
  let peer = null;
  let codigo = '';
  const conexoes = new Map(); // connectionId -> { conn, id, visto }
  let prazo = null;           // fim do tempo da vez (ou da escolha)
  let prazoReacao = null;     // fim da janela do "Não!"
  let ultimoAnuncio = 0, ultimaReacao = -1;

  // ------------------------------------------------------------------
  // Rede
  // ------------------------------------------------------------------
  function abrir() {
    Comum.mostrar('mesa');
    Comum.manterAcesa();
    novaSala();
    render();
  }

  function novaSala() {
    codigo = String(1000 + Math.floor(Math.random() * 9000));
    $('codigo').textContent = codigo;
    status('Conectando ao servidor de salas…');
    peer = new Peer(PREFIXO + codigo, Comum.opcoesPeer());
    peer.on('open', () => { mostrarQR(); status('Sala aberta. Esperando os celulares.'); });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') { peer.destroy(); novaSala(); return; }
      if (e.type === 'peer-unavailable') return;
      status('Problema de conexão (' + e.type + '). Tentando de novo…', true);
    });
    peer.on('disconnected', () => {
      status('Conexão com o servidor caiu. Reconectando…', true);
      setTimeout(() => { if (peer && !peer.destroyed) peer.reconnect(); }, 1500);
    });
    peer.on('connection', (conn) => {
      conexoes.set(conn.connectionId, { conn, id: null, visto: Date.now() });
      conn.on('data', (m) => receber(conn, m));
      conn.on('close', () => { conexoes.delete(conn.connectionId); marcarAusentes(); enviar(); });
      conn.on('error', () => {});
    });
  }

  setInterval(() => {
    let mudou = false;
    for (const [k, r] of conexoes) if (Date.now() - r.visto > 10000) { conexoes.delete(k); try { r.conn.close(); } catch (e) { /* ignora */ } mudou = true; }
    if (mudou) { marcarAusentes(); enviar(); }
  }, 2000);

  const linkDaSala = () => location.origin + location.pathname + '?sala=' + codigo + Comum.extraLink();

  function mostrarQR() {
    const qr = qrcode(0, 'M');
    qr.addData(linkDaSala());
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    $('qr').innerHTML = svg;
    $('qr2').innerHTML = svg;
    $('link').textContent = location.protocol === 'file:' ? 'Abra pelo GitHub Pages para o QR code funcionar no celular.' : linkDaSala();
  }

  function status(txt, erro) {
    $('status-mesa').textContent = txt;
    $('status-mesa').classList.toggle('erro', !!erro);
  }

  const indice = (id) => S.jogadores.findIndex((p) => p.id === id);

  /** Mensagens dos celulares. Quem fala é identificado pelo ID do aparelho. */
  function receber(conn, m) {
    const reg = conexoes.get(conn.connectionId);
    if (!reg || !m || typeof m !== 'object') return;
    reg.visto = Date.now();
    if (m.t === 'ping') return;

    if (m.t === 'ola') {
      if (typeof m.id !== 'string' || m.id.length > 60) return;
      for (const [k, r] of conexoes) if (k !== conn.connectionId && r.id === m.id) { conexoes.delete(k); r.conn.close(); }
      reg.id = m.id;
      marcarAusentes();
      return enviar();
    }
    const id = reg.id;
    if (!id) return;
    const j = indice(id);

    switch (m.t) {
      case 'entrar': {
        const nome = Comum.limparNome(m.nome);
        if (!nome) return;
        B.entrar(S, id, nome);
        return enviar();
      }
      case 'assumir': {
        const k = m.j;
        if (j >= 0 || S.fase === 'sala' || !Number.isInteger(k) || !S.jogadores[k] || !S.jogadores[k].ausente) return enviar();
        S.jogadores[k].id = id;
        S.jogadores[k].ausente = false;
        const nome = Comum.limparNome(m.nome);
        if (nome) S.jogadores[k].nome = nome;
        return enviar();
      }
      case 'sair': B.sair(S, id); return enviar();
      case 'jogar':
        if (j >= 0 && Array.isArray(m.ids) && m.ids.length <= 5 && B.jogar(S, j, m.ids.filter(Number.isInteger), { alvo: m.alvo, nome: typeof m.nome === 'string' ? m.nome : undefined })) abrirReacao();
        else enviar();
        return;
      case 'negar':
        if (j >= 0 && B.negar(S, j)) abrirReacao();
        return;
      case 'comprar': if (j >= 0 && B.comprar(S, j)) depois(); return;
      case 'dar': if (j >= 0 && B.dar(S, j, m.id)) depois(); return;
      case 'esconder': if (j >= 0 && B.esconder(S, j, m.pos)) depois(); return;
      case 'descarte': if (j >= 0 && typeof m.tipo === 'string' && B.pegarDescarte(S, j, m.tipo)) depois(); return;
    }
  }

  function marcarAusentes() {
    const online = new Set([...conexoes.values()].map((r) => r.id).filter(Boolean));
    S.jogadores.forEach((p) => { if (p.tipo === 'celular') p.ausente = !online.has(p.id); });
  }

  function enviar() {
    render();
    const agora = Date.now();
    const tempos = {
      restante: prazo ? Math.max(0, prazo - agora) : null,
      total: (S.espera ? S.tempo || B.TEMPO_ESPERA : S.tempo) * 1000,
      reacaoRestante: prazoReacao ? Math.max(0, prazoReacao - agora) : null,
      reacaoTotal: S.reacao * 1000,
    };
    for (const r of conexoes.values()) {
      if (!r.conn.open) continue;
      const j = r.id ? indice(r.id) : -1;
      try { r.conn.send({ t: 'estado', V: B.visaoDe(S, j >= 0 ? j : null), tempos, sala: codigo }); } catch (e) { /* ignora */ }
    }
  }

  // ------------------------------------------------------------------
  // Tempo: janela do "Não!" e tempo da vez
  // ------------------------------------------------------------------
  function abrirReacao() {
    prazo = null;
    prazoReacao = Date.now() + S.reacao * 1000;
    enviar();
  }
  function armarRelogio() {
    const t = S.espera ? S.tempo || B.TEMPO_ESPERA : S.tempo;
    prazo = B.quemAge(S) != null && t ? Date.now() + t * 1000 : null;
  }
  function depois() { armarRelogio(); enviar(); }

  setInterval(() => {
    const agora = Date.now();
    if (prazoReacao) {
      atualizarBarra($('reacao-barra'), prazoReacao - agora, S.reacao * 1000);
      $('reacao-num').textContent = Math.max(0, Math.ceil((prazoReacao - agora) / 1000));
      if (agora >= prazoReacao) { prazoReacao = null; B.resolver(S); depois(); }
      return;
    }
    if (prazo) {
      const total = (S.espera ? S.tempo || B.TEMPO_ESPERA : S.tempo) * 1000;
      atualizarBarra($('relogio-mesa'), prazo - agora, total);
      if (agora >= prazo) { prazo = null; B.automatico(S); depois(); }
    }
  }, 100);

  function atualizarBarra(el, ms, total) {
    const frac = Math.max(0, Math.min(1, ms / total));
    el.firstElementChild.style.transform = 'scaleX(' + frac + ')';
    el.classList.toggle('pouco', frac <= 0.5 && frac > 0.25);
    el.classList.toggle('acabando', frac <= 0.25);
  }

  // ------------------------------------------------------------------
  // Botões
  // ------------------------------------------------------------------
  $('btn-comecar').onclick = () => { if (B.iniciar(S)) { ultimaReacao = -1; depois(); Comum.Som.vez(); } };
  const voltarSala = () => { prazo = null; prazoReacao = null; S = B.reiniciar(S); enviar(); };
  $('btn-nova').onclick = voltarSala;
  $('btn-denovo').onclick = voltarSala;
  $('btn-qr').onclick = () => { $('qr-mini').hidden = !$('qr-mini').hidden; $('btn-qr').textContent = $('qr-mini').hidden ? 'Mostrar QR code' : 'Esconder QR code'; };
  $('btn-guia-sala').onclick = () => Guia.abrir('regras');
  $('btn-guia-jogo').onclick = () => Guia.abrir('regras');

  function botoesTempo(box, lista, rotulo, campo) {
    lista.forEach((t) => {
      const b = document.createElement('button');
      b.textContent = rotulo(t);
      b.dataset.v = t;
      b.onclick = () => { if (S.fase === 'sala') { S[campo] = t; enviar(); } };
      box.appendChild(b);
    });
  }
  botoesTempo($('reacoes'), B.REACOES, (t) => t + ' s', 'reacao');
  botoesTempo($('tempos'), B.TEMPOS, (t) => (t ? t + ' s' : 'Sem tempo'), 'tempo');

  // ------------------------------------------------------------------
  // Telas
  // ------------------------------------------------------------------
  function render() {
    $('sala').hidden = S.fase !== 'sala';
    $('jogo').hidden = S.fase === 'sala';
    $('fim').hidden = S.fase !== 'fim';
    if (S.fase === 'sala') renderSala(); else renderJogo();
  }

  function renderSala() {
    document.querySelectorAll('#reacoes button').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.v) === S.reacao));
    document.querySelectorAll('#tempos button').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.v) === S.tempo));
    const box = $('lugares');
    box.innerHTML = '';
    for (let k = 0; k < B.MAX_JOGADORES; k++) {
      const p = S.jogadores[k];
      const v = document.createElement('div');
      v.className = 'lugar' + (p ? ' ocupado' : '');
      if (p) v.style.color = p.cor;
      v.innerHTML = p
        ? `<span class="bola" style="background:${p.cor}">${esc(p.nome.slice(0, 1).toUpperCase())}</span><span><b>${esc(p.nome)}</b><small>${p.ausente ? 'Celular desconectado' : 'Pronto!'}</small></span>`
        : `<span class="bola"></span><span><b>Lugar livre</b><small>Leia o QR code</small></span>`;
      box.appendChild(v);
    }
    const n = S.jogadores.length;
    $('btn-comecar').disabled = n < B.MIN_JOGADORES;
    $('dica-comecar').textContent = n < B.MIN_JOGADORES
      ? `Precisa de pelo menos ${B.MIN_JOGADORES} jogadores (${n}/${B.MIN_JOGADORES}).`
      : `${n} jogadores prontos. ${n - 1} bomba${n > 2 ? 's' : ''} no monte.`;
  }

  function renderJogo() {
    // jogadores
    const faixa = $('faixa');
    faixa.innerHTML = '';
    S.jogadores.forEach((p, j) => {
      const d = document.createElement('div');
      const vez = S.fase === 'jogo' && S.vez === j && p.vivo;
      d.className = 'chip' + (vez ? ' vez' : '') + (!p.vivo ? ' fora' : '') + (S.espera && S.espera.j === j ? ' escolhendo' : '');
      d.style.setProperty('--cor', p.cor);
      d.innerHTML = `<span class="bola" style="background:${p.cor}">${p.vivo ? esc(p.nome.slice(0, 1).toUpperCase()) : '💥'}</span>
        <span class="chip-txt"><b>${esc(p.nome)}</b><small>${!p.vivo ? 'Explodiu' : p.ausente ? 'Desconectado' : p.mao.length + (p.mao.length === 1 ? ' carta' : ' cartas')}</small></span>
        ${vez && S.turnos > 1 ? `<span class="turnos">×${S.turnos}</span>` : ''}`;
      faixa.appendChild(d);
    });

    // pilhas
    $('monte-n').textContent = S.baralho.length;
    const topo = $('descarte-topo');
    topo.innerHTML = '';
    topo.className = S.descarte.length ? '' : 'descarte-vazio';
    if (S.descarte.length) topo.appendChild(Cartas.frente(S.descarte[S.descarte.length - 1].t, 150));

    // textos
    const quem = S.fase === 'fim' ? 'Fim de jogo' : 'Vez de ' + B.nomeDe(S, S.vez) + (S.turnos > 1 ? ' · joga ' + S.turnos + ' vezes' : '');
    $('quem').textContent = quem;
    $('quem').style.color = S.jogadores[S.vez] ? S.jogadores[S.vez].cor : '';
    $('msg-mesa').textContent = S.espera ? esperaTexto() : '';
    $('relogio-mesa').hidden = !prazo;
    $('historico').innerHTML = S.log.slice().reverse().map((t) => '<li>' + esc(t) + '</li>').join('');

    renderReacao();
    efeitos();

    if (S.fase === 'fim') {
      $('fim-titulo').textContent = B.nomeDe(S, S.vencedor) + ' venceu!';
      $('fim-msg').textContent = 'Foi o último a sobrar no sofá.';
    }
  }

  function esperaTexto() {
    const E = S.espera;
    if (E.tipo === 'favor') return B.nomeDe(S, E.j) + ' está escolhendo uma carta para dar a ' + B.nomeDe(S, E.para) + '…';
    if (E.tipo === 'esconder') return B.nomeDe(S, E.j) + ' está escondendo a bomba no monte…';
    return B.nomeDe(S, E.j) + ' está escolhendo uma carta do descarte…';
  }

  function renderReacao() {
    const P = S.pilha;
    $('reacao').hidden = !P;
    if (!P) { ultimaReacao = -1; return; }
    if (ultimaReacao !== P.naos.length || !$('reacao-cartas').childElementCount) {
      const box = $('reacao-cartas');
      box.innerHTML = '';
      P.cartas.forEach((t) => box.appendChild(Cartas.frente(t, P.cartas.length > 2 ? 110 : 170)));
      $('reacao-txt').textContent = B.descreverJogada(S, P.autor, P.jogada);
      $('reacao-cadeia').innerHTML = P.naos.map((j, k) => `<li style="--cor:${S.jogadores[j].cor}">✋ <b>${esc(B.nomeDe(S, j))}</b>: ${k === 0 ? 'NÃO!' : 'NÃO ao Não!'}</li>`).join('');
      const cancelada = B.cancelada(P);
      $('reacao-estado').textContent = cancelada ? 'Por enquanto: CANCELADA' : 'Por enquanto: VAI VALER';
      $('reacao-estado').className = 'estado-jogada ' + (cancelada ? 'cancelada' : 'vale');
      $('reacao-dica').textContent = P.naos.length ? 'Alguém nega esse Não?' : 'Alguém tem um Não?';
      if (P.naos.length) { const c = $('reacao').querySelector('.reacao-caixa'); c.classList.remove('treme'); void c.offsetWidth; c.classList.add('treme'); }
      ultimaReacao = P.naos.length;
    }
  }

  /** Sons e animações quando acontece algo novo. */
  function efeitos() {
    const A = S.anuncio;
    if (!A || A.n === ultimoAnuncio) return;
    ultimoAnuncio = A.n;
    if (A.tipo === 'jogou') Comum.Som.poder();
    else if (A.tipo === 'nao') Comum.Som.captura();
    else if (A.tipo === 'explodiu') { flash('💥', B.nomeDe(S, A.autor) + ' EXPLODIU!', 'explodiu'); explosao(); }
    else if (A.tipo === 'desarmou') { flash('✂️', B.nomeDe(S, A.autor) + ' tirou uma bomba e desarmou!', 'desarmou'); Comum.Som.buraco(); }
  }

  function flash(ic, txt, classe) {
    const f = $('flash');
    $('flash-ic').textContent = ic;
    $('flash-txt').textContent = txt;
    f.className = 'flash ' + classe;
    f.hidden = true; void f.offsetWidth; f.hidden = false;
    clearTimeout(f._t); f._t = setTimeout(() => (f.hidden = true), 2800);
  }
  function explosao() {
    Comum.Som.captura();
    setTimeout(() => Comum.Som.buraco(), 150);
    document.body.classList.remove('tremor'); void document.body.offsetWidth; document.body.classList.add('tremor');
  }

  // No modo de teste, deixa o estado acessível no console para montar situações.
  if (new URLSearchParams(location.search).has('teste')) window.bombaTeste = { estado: () => S, atualizar: (f) => { f(S); enviar(); } };

  return { abrir };
})();
