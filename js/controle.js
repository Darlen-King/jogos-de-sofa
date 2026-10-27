/* =====================================================================
   controle.js — o celular. Ele não decide nada: só mostra o estado
   que a mesa manda e envia os pedidos (sentar, rolar, mover).
   ===================================================================== */
const Controle = (() => {
  const { $, PREFIXO } = Comum;
  const L = Ludo;
  const meuId = Comum.idDoAparelho();

  let sala = '';
  let peer = null, conn = null, timer = null;
  let E = null;          // último estado recebido da mesa
  let minhaCor = null;
  let ultimaRolagem = 0;
  let eraMinhaVez = false;

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
      if (e.type === 'peer-unavailable') {
        textoConectando('Não encontrei a sala ' + sala + '. Confira se o tabuleiro ainda está aberto. Tentando de novo…');
      }
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
      if (peer.disconnected) { peer.reconnect(); return; } // 'open' chama conectar() de novo
      conectar();
    }, 2500);
  }

  function rede(ok) {
    $('c-rede').textContent = ok ? 'Conectado' : 'Reconectando';
    $('c-rede').classList.toggle('on', ok);
  }

  // "Estou aqui" a cada 3 s, para a mesa saber que o celular continua conectado.
  setInterval(() => pedir({ t: 'ping' }), 3000);

  function pedir(msg) {
    if (conn && conn.open) conn.send(msg);
  }

  function receber(m) {
    if (!m || m.t !== 'estado') return;
    E = m.S;
    minhaCor = m.voce;
    render();
  }

  // ------------------------------------------------------------------
  // Telas
  // ------------------------------------------------------------------
  const PARTES = ['c-conectando', 'c-escolher', 'c-aguardando', 'c-jogando', 'c-fim'];
  const ver = (id) => PARTES.forEach((p) => ($(p).hidden = p !== id));

  function textoConectando(t) { $('c-conectando-msg').textContent = t; }

  function render() {
    if (!E) return ver('c-conectando');
    if (!minhaCor) return renderEscolher();
    if (E.fase === 'sala') return renderAguardando();
    if (E.fase === 'fim') return renderFim();
    renderJogando();
  }

  function renderEscolher() {
    ver('c-escolher');
    const box = $('c-cores');
    box.innerHTML = '';
    let livres = 0;
    L.CORES.forEach((c) => {
      const l = E.lugares[c];
      const pode = (!l && E.fase === 'sala') || (l && l.ausente);
      if (pode) livres++;
      const b = document.createElement('button');
      b.style.background = L.HEX[c];
      b.disabled = !pode;
      b.innerHTML = `${L.NOME[c]}<small>${!l ? (E.fase === 'sala' ? 'Livre' : 'Fora da partida') : l.ausente ? 'Assumir esta cor' : 'Ocupado'}</small>`;
      b.onclick = () => { pedir({ t: 'sentar', cor: c }); Comum.vibrar(30); };
      box.appendChild(b);
    });
    $('c-escolher-aviso').textContent = E.fase !== 'sala'
      ? 'Já tem uma partida rolando. Você só pode assumir uma cor que ficou desconectada.'
      : livres ? '' : 'Todas as cores estão ocupadas.';
  }

  function renderAguardando() {
    ver('c-aguardando');
    $('c-cartao-sala').style.background = L.HEX[minhaCor];
    $('c-nome-sala').textContent = L.NOME[minhaCor];
    const n = L.sentados(E).length;
    $('c-qtd').textContent = n < L.MIN_JOGADORES
      ? `${n} jogador na sala. Precisa de pelo menos ${L.MIN_JOGADORES}.`
      : `${n} jogadores na sala. Pode começar!`;
  }

  function renderJogando() {
    ver('c-jogando');
    const c = minhaCor;
    const minhaVez = E.vez === c;
    if (minhaVez && !eraMinhaVez) { Comum.vibrar([80, 60, 80]); Comum.Som.vez(); }
    eraMinhaVez = minhaVez;

    $('c-cartao').style.background = L.HEX[c];
    $('c-nome').textContent = L.NOME[c] + (E.vencedores.includes(c) ? ' · ' + (E.vencedores.indexOf(c) + 1) + 'º lugar' : '');
    $('c-msg').textContent = minhaVez
      ? (E.rolou ? (E.validas.length ? 'Escolha o pino que vai andar.' : E.msg) : 'Sua vez! Toque no dado.')
      : 'Vez do ' + L.NOME[E.vez] + '. ' + E.msg;

    const botao = $('c-rolar');
    botao.disabled = !(minhaVez && !E.rolou);
    $('c-rolar-txt').textContent = minhaVez && !E.rolou ? 'Toque para girar' : E.dado ? 'Saiu ' + E.dado : 'Aguarde';
    const dado = $('dado-celular');
    if (E.rolagem !== ultimaRolagem) { ultimaRolagem = E.rolagem; Comum.rolarDado(dado, E.dado); }
    else if (!dado.classList.contains('rolando')) Comum.face(dado, E.dado);

    const box = $('c-pinos');
    box.innerHTML = '';
    E.pos[c].forEach((p, i) => {
      const pode = minhaVez && E.rolou && E.validas.includes(i);
      const b = document.createElement('button');
      b.className = 'pino-btn' + (pode ? ' pode' : '');
      b.disabled = !pode;
      b.setAttribute('aria-label', 'Pino ' + (i + 1) + ', ' + L.descrever(p));
      b.innerHTML = `<span class="num" style="background:${L.HEX[c]}">${i + 1}</span><small>${L.descrever(p)}</small>`;
      b.onclick = () => { box.querySelectorAll('button').forEach((x) => (x.disabled = true)); pedir({ t: 'mover', i }); Comum.vibrar(30); };
      box.appendChild(b);
    });
  }

  function renderFim() {
    ver('c-fim');
    const lugar = E.vencedores.indexOf(minhaCor) + 1;
    $('c-fim-titulo').textContent = lugar === 1 ? 'Você venceu!' : 'Fim de jogo';
    $('c-fim-msg').textContent = 'Você ficou em ' + lugar + 'º lugar. ' + L.NOME[E.vencedores[0]] + ' venceu.';
  }

  $('c-rolar').onclick = () => { $('c-rolar').disabled = true; pedir({ t: 'rolar' }); Comum.vibrar(40); };
  $('c-trocar').onclick = () => pedir({ t: 'levantar' });

  return { iniciar };
})();
