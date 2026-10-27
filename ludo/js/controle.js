/* =====================================================================
   controle.js — o celular. Ele não decide nada: mostra o estado que a
   mesa manda e envia os pedidos (sentar, rolar, mover, usar poder…).
   Usa as mesmas regras (regras.js) só para saber o que deixar clicável.
   ===================================================================== */
const Controle = (() => {
  const { $, esc } = Comum;
  const L = Ludo;
  const PREFIXO = 'jogos-de-sofa-ludo-v2-';
  const meuId = Comum.idDoAparelho();

  let sala = '';
  let peer = null, conn = null, timer = null;
  let E = null;            // último estado recebido da mesa
  let minhaCor = null;
  let meuNome = Comum.nomeSalvo();
  let nomeConfirmado = false;
  let ultimaRolagem = 0, ultimoAnuncio = 0;
  let eraMinhaVez = false;
  let prazo = null, ultimoAlerta = 0;
  let escolhendo = null;   // poder esperando a escolha de um pino

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
      if (e.type === 'peer-unavailable') $('c-conectando-msg').textContent = 'Não encontrei a sala ' + sala + '. Confira se o tabuleiro ainda está aberto. Tentando de novo…';
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

  // "Estou aqui" a cada 3 s, para a mesa saber que o celular continua conectado.
  setInterval(() => pedir({ t: 'ping' }), 3000);

  function pedir(msg) { if (conn && conn.open) conn.send(msg); }

  function receber(m) {
    if (!m || m.t !== 'estado') return;
    E = m.S;
    minhaCor = m.voce;
    if (minhaCor) nomeConfirmado = true;
    prazo = E.restante != null ? Date.now() + E.restante : null;
    if (escolhendo && !L.podeUsar(E, minhaCor, escolhendo)) escolhendo = null;
    if (E.anuncio && E.anuncio.n !== ultimoAnuncio) {
      if (ultimoAnuncio) toast(L.nomeDe(E, E.anuncio.cor) + ' usou ' + L.PODERES[E.anuncio.poder].nome + '!');
      ultimoAnuncio = E.anuncio.n;
    }
    render();
  }

  // ------------------------------------------------------------------
  // Tempo e alertas da vez
  // ------------------------------------------------------------------
  const decidindo = () => E && E.fase === 'jogo' && E.vez === minhaCor && (!E.rolou || E.opcoes.length > 0);

  function piscar() {
    const c = $('controle');
    c.classList.remove('piscar'); void c.offsetWidth; c.classList.add('piscar');
  }

  setInterval(() => {
    const rel = $('relogio-cel');
    const mostrar = !!(prazo && E && E.fase === 'jogo');
    rel.hidden = !mostrar;
    if (!mostrar) { $('controle').classList.remove('urgente'); return; }
    const ms = prazo - Date.now();
    const frac = Math.max(0, Math.min(1, ms / (E.tempo * 1000)));
    rel.firstElementChild.style.transform = 'scaleX(' + frac + ')';
    rel.classList.toggle('pouco', ms <= 10000 && ms > 5000);
    rel.classList.toggle('acabando', ms <= 5000);
    const minha = decidindo();
    $('controle').classList.toggle('urgente', minha && ms <= 5000);
    if (!minha || ms <= 0) return;
    // vibra cada vez mais rápido perto do fim
    const intervalo = ms <= 3000 ? 500 : ms <= 5000 ? 1000 : ms <= 10000 ? 2000 : null;
    if (intervalo && Date.now() - ultimoAlerta >= intervalo) {
      ultimoAlerta = Date.now();
      Comum.vibrar(70);
      if (!Comum.podeVibrar) { Comum.Som.tique(); piscar(); } // iPhone: som + tela piscando
    }
  }, 200);

  // ------------------------------------------------------------------
  // Telas
  // ------------------------------------------------------------------
  const PARTES = ['c-conectando', 'c-nome-form', 'c-escolher', 'c-aguardando', 'c-jogando', 'c-fim'];
  const ver = (id) => PARTES.forEach((p) => ($(p).hidden = p !== id));

  function toast(txt) {
    const t = $('c-toast');
    t.textContent = txt; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2600);
  }

  /** O que o guia precisa saber deste jogador. */
  function contextoGuia(aba) {
    const meu = minhaCor && E;
    const precos = meu && E.fase === 'jogo' ? Object.fromEntries(Object.keys(L.PODERES).map((k) => [k, L.preco(E, minhaCor, k)])) : null;
    return { aba, cor: meu ? minhaCor : null, habil: meu ? E.habil[minhaCor] : null, precos };
  }
  $('c-ajuda').onclick = () => Guia.abrir(contextoGuia('pinos'));
  $('c-guia-sel').onclick = () => Guia.abrir(contextoGuia('pinos'));
  $('c-guia-pinos').onclick = () => Guia.abrir(contextoGuia('pinos'));
  $('c-guia-poderes').onclick = () => Guia.abrir(contextoGuia('poderes'));

  function render() {
    $('c-ajuda').hidden = !(E && E.modo === 'super');
    if (!E) return ver('c-conectando');
    if (!minhaCor && !nomeConfirmado) return renderNome();
    if (!minhaCor) return renderEscolher();
    if (E.fase === 'sala') return renderAguardando();
    if (E.fase === 'fim') return renderFim();
    renderJogando();
  }

  function renderNome() {
    ver('c-nome-form');
    const inp = $('c-nome-input');
    if (!inp.value) inp.value = meuNome;
  }
  $('c-nome-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = Comum.limparNome($('c-nome-input').value);
    if (!n) return;
    meuNome = n; Comum.salvarNome(n); nomeConfirmado = true;
    if (minhaCor) pedir({ t: 'nome', nome: n });
    render();
  });
  $('c-mudar-nome').onclick = () => { nomeConfirmado = false; render(); };

  function renderEscolher() {
    ver('c-escolher');
    $('c-ola').textContent = meuNome;
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
      b.innerHTML = `${L.NOME[c]}<small>${!l ? (E.fase === 'sala' ? 'Livre' : 'Fora da partida') : l.ausente ? 'Assumir (' + esc(l.nome) + ')' : 'Ocupado por ' + esc(l.nome)}</small>`;
      b.onclick = () => { pedir({ t: 'sentar', cor: c, nome: meuNome }); Comum.vibrar(30); };
      box.appendChild(b);
    });
    $('c-escolher-aviso').textContent = E.fase !== 'sala'
      ? 'Já tem uma partida rolando. Você só pode assumir uma cor que ficou desconectada.'
      : livres ? '' : 'Todas as cores estão ocupadas.';
  }

  function nomeModo() { return (E.modo === 'super' ? 'Ludo Super' : 'Ludo Clássico') + ' · ' + (E.tempo ? E.tempo + ' s por jogada' : 'sem tempo'); }

  function renderAguardando() {
    ver('c-aguardando');
    $('c-cartao-sala').style.background = L.HEX[minhaCor];
    $('c-nome-sala').textContent = E.lugares[minhaCor].nome || meuNome;
    $('c-modo-sala').textContent = nomeModo();
    const n = L.sentados(E).length;
    $('c-qtd').textContent = n < L.MIN_JOGADORES
      ? `${n} jogador na sala. Precisa de pelo menos ${L.MIN_JOGADORES}.`
      : `${n} jogadores na sala. Pode começar!`;
    $('c-habilidades').hidden = E.modo !== 'super';
    if (E.modo === 'super') renderHabilidades();
  }

  function renderHabilidades() {
    const lista = E.habil[minhaCor];
    const box = $('c-hab-lista');
    // não recria enquanto o jogador está mexendo num seletor
    if (box.contains(document.activeElement) && box.dataset.cor === minhaCor) return;
    box.dataset.cor = minhaCor;
    box.innerHTML = '';
    lista.forEach((h, i) => {
      const linha = document.createElement('div');
      linha.className = 'hab-linha';
      linha.appendChild(Pecas.icone(minhaCor, h, i + 1, 48));
      const dir = document.createElement('div');
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Habilidade do pino ' + (i + 1));
      Object.entries(L.HABILIDADES).forEach(([k, v]) => {
        const o = document.createElement('option');
        o.value = k; o.textContent = 'Pino ' + (i + 1) + ': ' + v.nome;
        o.disabled = k !== 'normal' && k !== h && lista.includes(k);
        if (k === h) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = () => { const nova = lista.slice(); nova[i] = sel.value; pedir({ t: 'habil', lista: nova }); sel.blur(); };
      const desc = document.createElement('small');
      desc.textContent = L.HABILIDADES[h].desc;
      dir.append(sel, desc);
      linha.appendChild(dir);
      box.appendChild(linha);
    });
  }

  function textoOpcao(o) {
    if (o.tipo === 'carga') return 'carrega +' + E.dado;
    if (o.tipo === 'retro') return 'volta ' + (o.de - o.para);
    if (o.tipo === 'sair') return 'sai da base';
    return 'anda ' + o.passos;
  }

  function renderJogando() {
    ver('c-jogando');
    const c = minhaCor, sup = E.modo === 'super';
    const minhaVez = E.vez === c;
    if (minhaVez && !eraMinhaVez) { Comum.vibrar([150, 80, 150]); Comum.Som.vez(); piscar(); ultimoAlerta = Date.now(); }
    eraMinhaVez = minhaVez;

    $('c-cartao').style.background = L.HEX[c];
    $('c-nome').textContent = (E.lugares[c].nome || meuNome) + (E.vencedores.includes(c) ? ' · ' + (E.vencedores.indexOf(c) + 1) + 'º' : '');
    $('c-pontos').hidden = !sup;
    if (sup) $('c-pontos').textContent = E.pontos[c] + ' pts';
    $('c-msg').textContent = minhaVez
      ? (E.rolou ? (E.opcoes.length ? 'Escolha o pino que vai andar.' : E.msg) : 'Sua vez! Toque no dado.')
      : 'Vez de ' + L.nomeDe(E, E.vez) + '. ' + E.msg;

    const botao = $('c-rolar');
    botao.disabled = !(minhaVez && !E.rolou) || !!escolhendo;
    $('c-rolar-txt').textContent = minhaVez && !E.rolou ? (E.efeito && E.efeito.tipo === 'retro' ? 'Girar (para trás)' : 'Toque para girar') : E.dado ? 'Saiu ' + E.dado : 'Aguarde';
    const dado = $('dado-celular');
    if (E.rolagem !== ultimaRolagem) { ultimaRolagem = E.rolagem; Comum.rolarDado(dado, E.dado); }
    else if (!dado.classList.contains('rolando')) Comum.face(dado, E.dado);

    // escolha de pino para um poder
    $('c-escolha-pino').hidden = !escolhendo;
    if (escolhendo) $('c-escolha-txt').textContent = 'Escolha o pino para ' + L.PODERES[escolhendo].nome;

    const box = $('c-pinos');
    box.innerHTML = '';
    E.pos[c].forEach((p, i) => {
      const o = minhaVez && E.rolou ? E.opcoes.find((x) => x.i === i) : null;
      const alvoPoder = escolhendo && L.podeUsar(E, c, escolhendo, { i });
      const b = document.createElement('button');
      b.className = 'pino-btn' + (o ? ' pode' : '') + (alvoPoder ? ' alvo-poder' : '');
      b.disabled = escolhendo ? !alvoPoder : !o;
      const hab = sup ? E.habil[c][i] : 'normal';
      const preso = sup && E.preso[c][i] != null;
      b.setAttribute('aria-label', 'Pino ' + (i + 1) + (sup ? ' (' + L.HABILIDADES[hab].nome + ')' : '') + ', ' + L.descrever(p));
      b.appendChild(Pecas.icone(c, hab, i + 1, 46));
      const st = document.createElement('small');
      st.textContent = preso ? 'Preso ' + E.preso[c][i] + '/' + L.CARGA_BURACO : L.descrever(p);
      b.appendChild(st);
      if (o) { const a = document.createElement('span'); a.className = 'anda'; a.textContent = textoOpcao(o); b.appendChild(a); }
      if (o && o.captura && o.captura.length) { const s = document.createElement('span'); s.className = 'selo'; s.textContent = 'Captura!'; b.appendChild(s); }
      b.onclick = () => {
        if (escolhendo) { pedir({ t: 'poder', poder: escolhendo, args: { i } }); escolhendo = null; Comum.vibrar(30); render(); return; }
        box.querySelectorAll('button').forEach((x) => (x.disabled = true));
        pedir({ t: 'mover', i }); Comum.vibrar(30);
      };
      box.appendChild(b);
    });

    $('c-guia-pinos').hidden = !sup;

    // poderes
    $('c-poderes-box').hidden = !sup;
    if (sup) {
      const pb = $('c-poderes');
      pb.innerHTML = '';
      Object.entries(L.PODERES).forEach(([k, P]) => {
        const b = document.createElement('button');
        b.className = 'poder';
        b.disabled = !L.podeUsar(E, c, k) || !!escolhendo;
        b.innerHTML = `<b>${P.nome}</b><span>${L.preco(E, c, k)} pts</span>`;
        b.title = P.desc;
        b.onclick = () => escolherPoder(k);
        pb.appendChild(b);
      });
    }
  }

  function escolherPoder(k) {
    const P = L.PODERES[k];
    if (P.alvo) { escolhendo = k; toast(P.desc); render(); return; }
    if (P.escolha === 'categoria') {
      folha('Dado super: como o dado vai cair?', Object.entries(L.NOME_CAT).map(([cat, txt]) => [txt, () => pedir({ t: 'poder', poder: k, args: { cat } })]));
      return;
    }
    if (P.escolha === 'numero') {
      folha('Dado a dedo: escolha o número', [1, 2, 3, 4, 5, 6].map((n) => [String(n), () => pedir({ t: 'poder', poder: k, args: { n } })]));
      return;
    }
    folha(P.nome + ': ' + P.desc, [['Usar', () => pedir({ t: 'poder', poder: k, args: {} })]]);
  }

  function folha(titulo, opcoes) {
    $('c-folha-titulo').textContent = titulo;
    const box = $('c-folha-opcoes');
    box.innerHTML = '';
    opcoes.forEach(([txt, fn]) => {
      const b = document.createElement('button');
      b.textContent = txt;
      b.onclick = () => { $('c-folha').hidden = true; fn(); Comum.vibrar(30); };
      box.appendChild(b);
    });
    $('c-folha').hidden = false;
  }
  $('c-folha-cancelar').onclick = () => ($('c-folha').hidden = true);
  $('c-cancelar').onclick = () => { escolhendo = null; render(); };

  function renderFim() {
    ver('c-fim');
    const lugar = E.vencedores.indexOf(minhaCor) + 1;
    $('c-fim-titulo').textContent = lugar === 1 ? 'Você venceu!' : 'Fim de jogo';
    $('c-fim-msg').textContent = 'Você ficou em ' + lugar + 'º lugar. ' + L.nomeDe(E, E.vencedores[0]) + ' venceu.';
  }

  $('c-rolar').onclick = () => { $('c-rolar').disabled = true; pedir({ t: 'rolar' }); Comum.vibrar(40); };
  $('c-trocar').onclick = () => pedir({ t: 'levantar' });

  return { iniciar };
})();
