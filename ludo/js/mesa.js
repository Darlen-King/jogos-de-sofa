/* =====================================================================
   mesa.js — a tela grande (computador/TV).
   É o "dono" da partida: guarda o estado, aplica as regras, controla o
   tempo de cada jogada e manda o estado para todos os celulares.
   Abra com ?teste no endereço para poder adicionar jogadores locais
   (jogar pelo mouse, sem celular).
   ===================================================================== */
const Mesa = (() => {
  const { $, esc } = Comum;
  const L = Ludo;
  const PREFIXO = 'jogos-de-sofa-ludo-v2-';
  const modoTeste = new URLSearchParams(location.search).has('teste');

  let S = L.novoEstado('classico', 30);
  let peer = null;
  let codigo = '';
  const conexoes = new Map(); // connectionId -> { conn, id, visto }
  let pausa = 0;              // invalida timers antigos
  let prazo = null;           // quando acaba o tempo da jogada atual (relógio desta tela)
  let ultimaRolagem = 0, ultimoAnuncio = 0;
  let posAnterior = null;
  let recemChegou = null;
  let assinaturaPinos = '';
  const pinos = {};           // pinos[cor][i] = { g, ... }
  let camadaEfeitos, camadaPinos, camadaMarcas;

  // ------------------------------------------------------------------
  // Rede
  // ------------------------------------------------------------------
  function abrir() {
    Comum.mostrar('mesa');
    Comum.manterAcesa();
    desenharTabuleiro();
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
      if (e.type === 'unavailable-id') { peer.destroy(); novaSala(); return; } // código já em uso: sorteia outro
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

  // Celular que ficou 10 s sem dar sinal (tela bloqueada, saiu do Wi-Fi…) é marcado como desconectado.
  setInterval(() => {
    let mudou = false;
    for (const [k, r] of conexoes) if (Date.now() - r.visto > 10000) { conexoes.delete(k); try { r.conn.close(); } catch (e) { /* ignora */ } mudou = true; }
    if (mudou) { marcarAusentes(); enviar(); }
  }, 2000);

  function linkDaSala() {
    return location.origin + location.pathname + '?sala=' + codigo + Comum.extraLink();
  }

  function mostrarQR() {
    const url = linkDaSala();
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    $('qr').innerHTML = svg;
    $('qr2').innerHTML = svg;
    $('link').textContent = location.protocol === 'file:' ? 'Abra pelo GitHub Pages para o QR code funcionar no celular.' : url;
  }

  function status(txt, erro) {
    $('status-mesa').textContent = txt;
    $('status-mesa').classList.toggle('erro', !!erro);
  }

  /** Mensagens que chegam dos celulares. A cor de quem fala vem do ID do aparelho, nunca do que o celular diz. */
  function receber(conn, m) {
    const reg = conexoes.get(conn.connectionId);
    if (!reg || !m || typeof m !== 'object') return;
    reg.visto = Date.now();
    if (m.t === 'ping') return;

    if (m.t === 'ola') {
      if (typeof m.id !== 'string' || m.id.length > 40) return;
      for (const [k, r] of conexoes) if (k !== conn.connectionId && r.id === m.id) { conexoes.delete(k); r.conn.close(); }
      reg.id = m.id;
      marcarAusentes();
      return enviar();
    }

    const id = reg.id;
    if (!id) return;
    const minha = corDe(id);

    switch (m.t) {
      case 'sentar': {
        const c = m.cor;
        if (!L.CORES.includes(c)) return;
        const lugar = S.lugares[c];
        const pode = (lugar && (lugar.id === id || lugar.ausente)) || (!lugar && S.fase === 'sala');
        if (!pode) return enviar();
        if (minha && minha !== c && S.fase === 'sala') S.lugares[minha] = null;
        const nome = Comum.limparNome(m.nome) || L.NOME[c];
        S.lugares[c] = { id, tipo: 'celular', ausente: false, nome };
        recemChegou = c;
        return enviar();
      }
      case 'nome':
        if (minha) { S.lugares[minha].nome = Comum.limparNome(m.nome) || L.NOME[minha]; enviar(); }
        return;
      case 'levantar':
        if (minha && S.fase === 'sala') S.lugares[minha] = null;
        return enviar();
      case 'habil':
        if (minha && L.definirHabilidades(S, minha, m.lista)) enviar();
        return;
      case 'rolar': if (minha) rolar(minha); return;
      case 'mover': if (minha && Number.isInteger(m.i)) mover(minha, m.i); return;
      case 'poder':
        if (minha && typeof m.poder === 'string' && L.PODERES[m.poder]) usarPoder(minha, m.poder, m.args && typeof m.args === 'object' ? m.args : {});
        return;
    }
  }

  const corDe = (id) => L.CORES.find((c) => S.lugares[c] && S.lugares[c].id === id);

  function marcarAusentes() {
    const online = new Set([...conexoes.values()].map((r) => r.id).filter(Boolean));
    L.CORES.forEach((c) => {
      const l = S.lugares[c];
      if (l && l.tipo === 'celular') l.ausente = !online.has(l.id);
    });
  }

  /** O que os celulares recebem: o estado sem os IDs dos aparelhos, e quanto tempo falta. */
  function publico() {
    const P = JSON.parse(JSON.stringify(S));
    L.CORES.forEach((c) => { const l = P.lugares[c]; if (l) P.lugares[c] = { tipo: l.tipo, ausente: !!l.ausente, nome: l.nome }; });
    P.restante = prazo ? Math.max(0, prazo - Date.now()) : null;
    return P;
  }

  function enviar() {
    render();
    const P = publico();
    for (const r of conexoes.values()) {
      if (r.conn.open) { try { r.conn.send({ t: 'estado', S: P, voce: r.id ? corDe(r.id) || null : null, sala: codigo }); } catch (e) { /* ignora */ } }
    }
  }

  // ------------------------------------------------------------------
  // Tempo da jogada
  // ------------------------------------------------------------------
  function armarRelogio() {
    prazo = S.fase === 'jogo' && S.tempo > 0 ? Date.now() + S.tempo * 1000 : null;
  }

  setInterval(() => {
    if (prazo) atualizarRelogio($('relogio-mesa'), prazo - Date.now(), S.tempo);
    if (!prazo || Date.now() < prazo || S.fase !== 'jogo') return;
    prazo = null;
    const c = S.vez;
    if (!S.rolou) { rolar(c, true); return; }
    const i = L.escolhaAutomatica(S);
    if (i !== null) mover(c, i, true);
  }, 200);

  function atualizarRelogio(el, ms, total) {
    const frac = Math.max(0, Math.min(1, ms / (total * 1000)));
    el.firstElementChild.style.transform = 'scaleX(' + frac + ')';
    el.classList.toggle('pouco', ms <= 10000 && ms > 5000);
    el.classList.toggle('acabando', ms <= 5000);
  }

  // ------------------------------------------------------------------
  // Jogadas
  // ------------------------------------------------------------------
  function rolar(c, automatico) {
    const d = L.rolar(S, c, 1 + Math.floor(Math.random() * 6));
    if (d === null) return;
    if (automatico) S.msg = 'Tempo esgotado! ' + S.msg;
    if (!S.opcoes.length) {
      prazo = null;
      enviar();
      const minhaPausa = ++pausa;
      setTimeout(() => { if (minhaPausa !== pausa) return; L.passarSemJogada(S); armarRelogio(); enviar(); }, 1800);
    } else {
      armarRelogio();
      enviar();
    }
  }

  function mover(c, i, automatico) {
    const r = L.mover(S, c, i);
    if (!r) return;
    if (automatico) S.msg = 'Tempo esgotado! ' + S.msg;
    pausa++;
    armarRelogio();
    enviar();
  }

  function usarPoder(c, poder, args) {
    const antes = S.vez;
    const a = { i: Number.isInteger(args.i) ? args.i : undefined, cat: typeof args.cat === 'string' ? args.cat : undefined, n: Number.isInteger(args.n) ? args.n : undefined };
    if (!L.usarPoder(S, c, poder, a)) return enviar();
    if (S.vez !== antes) armarRelogio(); // a Fuga passa a vez
    enviar();
  }

  $('btn-comecar').onclick = () => {
    if (L.iniciar(S)) { posAnterior = null; armarRelogio(); enviar(); Comum.Som.vez(); }
  };
  const voltarSala = () => { pausa++; prazo = null; S = L.reiniciar(S); posAnterior = null; enviar(); };
  $('btn-nova').onclick = voltarSala;
  $('btn-denovo').onclick = voltarSala;
  $('btn-qr').onclick = () => { $('qr-mini').hidden = !$('qr-mini').hidden; $('btn-qr').textContent = $('qr-mini').hidden ? 'Mostrar QR code' : 'Esconder QR code'; };
  $('btn-rolar-local').onclick = () => { const l = S.lugares[S.vez]; if (l && l.tipo === 'local') rolar(S.vez); };

  // modo e tempo (só na sala)
  $('modos').addEventListener('click', (e) => {
    const b = e.target.closest('.modo');
    if (!b || S.fase !== 'sala') return;
    S.modo = b.dataset.modo;
    enviar();
  });
  L.TEMPOS.forEach((t) => {
    const b = document.createElement('button');
    b.textContent = t ? t + ' s' : 'Sem tempo';
    b.dataset.tempo = t;
    b.onclick = () => { if (S.fase === 'sala') { S.tempo = t; enviar(); } };
    $('tempos').appendChild(b);
  });

  // ------------------------------------------------------------------
  // Desenho do tabuleiro (SVG em uma grade 15x15)
  // ------------------------------------------------------------------
  const el = Pecas.el;

  function desenharTabuleiro() {
    const svg = $('svg');
    if (svg.childNodes.length) return;
    const defs = el('defs', {}, svg);
    const grad = el('radialGradient', { id: 'grad-buraco' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#000' }, grad);
    el('stop', { offset: '60%', 'stop-color': '#1a0b33' }, grad);
    el('stop', { offset: '100%', 'stop-color': '#6b3fd1' }, grad);

    el('rect', { x: 0, y: 0, width: 15, height: 15, fill: '#fbf3e4' }, svg);
    L.CORES.forEach((c) => {
      const [ox, oy] = L.BASE[c];
      el('rect', { x: ox, y: oy, width: 6, height: 6, fill: L.HEX[c] }, svg);
      el('rect', { x: ox + 0.15, y: oy + 0.15, width: 5.7, height: 5.7, rx: 0.3, fill: 'none', stroke: '#fff', 'stroke-width': 0.14, class: 'base-borda', 'data-cor': c }, svg);
      el('rect', { x: ox + 1, y: oy + 1, width: 4, height: 4, rx: 0.4, fill: '#fbf3e4' }, svg);
      L.VAGAS.forEach((v) => el('circle', { cx: ox + v[0], cy: oy + v[1], r: 0.55, fill: L.SUAVE[c], stroke: L.HEX[c], 'stroke-width': 0.06 }, svg));
    });
    L.TRILHA.forEach((t, k) => {
      const saida = L.CORES.find((c) => L.INICIO[c] === k);
      el('rect', { x: t[0], y: t[1], width: 1, height: 1, fill: saida ? L.HEX[saida] : '#fffaf0', stroke: '#c9bda6', 'stroke-width': 0.04 }, svg);
      if (L.SEGURAS.has(k) && !saida) {
        const s = el('text', { x: t[0] + 0.5, y: t[1] + 0.56, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 0.7, fill: '#b5a98f' }, svg);
        s.textContent = '★';
      }
    });
    L.CORES.forEach((c) => L.RETA[c].forEach((h) => el('rect', { x: h[0], y: h[1], width: 1, height: 1, fill: L.HEX[c], stroke: '#c9bda6', 'stroke-width': 0.04 }, svg)));
    el('polygon', { points: '6,6 6,9 7.5,7.5', fill: L.HEX.red }, svg);
    el('polygon', { points: '6,6 9,6 7.5,7.5', fill: L.HEX.green }, svg);
    el('polygon', { points: '9,6 9,9 7.5,7.5', fill: L.HEX.yellow }, svg);
    el('polygon', { points: '6,9 9,9 7.5,7.5', fill: L.HEX.blue }, svg);

    camadaEfeitos = el('g', {}, svg);
    camadaPinos = el('g', {}, svg);
    camadaMarcas = el('g', { 'pointer-events': 'none' }, svg);
  }

  /** (Re)cria os pinos com o formato da habilidade de cada um. */
  function criarPinos() {
    camadaPinos.innerHTML = '';
    L.CORES.forEach((c) => {
      pinos[c] = [0, 1, 2, 3].map((i) => {
        const hab = S.modo === 'super' ? S.habil[c][i] : 'normal';
        const g = el('g', { class: 'pino' }, camadaPinos);
        el('circle', { class: 'aro', r: 0.56, fill: 'none', stroke: '#1d2330', 'stroke-width': 0.09 }, g);
        const escudo = el('circle', { r: 0.58, fill: 'rgba(120,220,255,.18)', stroke: '#5fd4ff', 'stroke-width': 0.08, visibility: 'hidden' }, g);
        Pecas.desenhar(el('g', {}, g), c, hab, i + 1);
        const vida = el('text', { x: 0.36, y: -0.3, 'font-size': 0.32, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#ff4d6d', stroke: '#fff', 'stroke-width': 0.04, 'paint-order': 'stroke', visibility: 'hidden' }, g);
        vida.textContent = '♥';
        const carga = el('text', { y: 0.72, 'font-size': 0.3, 'text-anchor': 'middle', 'font-weight': 800, fill: '#fff', stroke: '#1a0b33', 'stroke-width': 0.08, 'paint-order': 'stroke', 'font-family': 'Nunito, sans-serif', visibility: 'hidden' }, g);
        g.addEventListener('click', () => { const l = S.lugares[c]; if (l && l.tipo === 'local') mover(c, i); });
        return { g, escudo, vida, carga };
      });
    });
    posAnterior = null;
  }

  // ---- animação dos pinos: anda casa por casa ----
  const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pos = (g, x, y, s) => { g._em = [x, y, s]; g.setAttribute('transform', `translate(${x} ${y}) scale(${s})`); };

  function animar(g, pontos, atraso, aoPasso) {
    const id = (g._anim = (g._anim || 0) + 1);
    if (!g._em || semMovimento) { const a = pontos[pontos.length - 1]; pos(g, a[0], a[1], a[2]); return; }
    const dur = pontos.length > 1 ? 170 : 380;
    let k = 0;
    const proximo = () => {
      if (id !== g._anim || k >= pontos.length) return;
      const alvo = pontos[k++], ini = g._em, t0 = performance.now();
      const quadro = (agora) => {
        if (id !== g._anim) return;
        const t = Math.min(1, (agora - t0) / dur), e = 1 - Math.pow(1 - t, 3), pulo = Math.sin(Math.PI * t) * 0.3;
        pos(g, ini[0] + (alvo[0] - ini[0]) * e, ini[1] + (alvo[1] - ini[1]) * e, (ini[2] + (alvo[2] - ini[2]) * e) * (1 + pulo));
        if (t < 1) requestAnimationFrame(quadro);
        else { pos(g, alvo[0], alvo[1], alvo[2]); if (aoPasso) aoPasso(k === pontos.length); proximo(); }
      };
      requestAnimationFrame(quadro);
    };
    setTimeout(proximo, atraso || 0);
  }

  function renderPinos() {
    const assinatura = S.modo + JSON.stringify(S.habil);
    if (assinatura !== assinaturaPinos) { assinaturaPinos = assinatura; criarPinos(); }
    const sup = S.modo === 'super';

    // posição final de cada pino (com pinos empilhados um pouco deslocados)
    const finais = {}, grupos = {};
    L.CORES.forEach((c) => S.pos[c].forEach((p, i) => {
      const [x, y, chave] = L.onde(c, p, i);
      const o = { x, y, s: 1 };
      finais[c + i] = o;
      (grupos[chave] = grupos[chave] || []).push(o);
    }));
    Object.values(grupos).forEach((g) => {
      if (g.length < 2) return;
      const d = g.length === 2 ? [[-0.2, 0], [0.2, 0]] : [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
      g.forEach((o, k) => { const f = d[k % d.length]; o.x += f[0]; o.y += f[1]; o.s = 0.68; });
    });

    // quanto tempo o pino que andou leva, para o capturado só voltar depois
    let demora = 0;
    if (posAnterior) L.CORES.forEach((c) => S.pos[c].forEach((p, i) => {
      const a = posAnterior[c][i];
      if (a >= 0 && p >= 0 && p !== a) demora = Math.max(demora, Math.abs(p - a) * 170);
    }));

    L.CORES.forEach((c) => S.pos[c].forEach((p, i) => {
      const P = pinos[c][i], g = P.g, fim = finais[c + i], antes = posAnterior ? posAnterior[c][i] : p;
      const alvo = [fim.x, fim.y, fim.s];
      if (posAnterior && antes >= 0 && p >= 0 && p !== antes && Math.abs(p - antes) <= 12) {
        // andou (para frente ou para trás): passa por cada casa
        const caminho = [], passo = p > antes ? 1 : -1;
        for (let k = antes + passo; k !== p; k += passo) { const [x, y] = L.onde(c, k, i); caminho.push([x, y, 1]); }
        caminho.push(alvo);
        camadaPinos.appendChild(g);
        animar(g, caminho, 0, (ultimo) => (ultimo ? (p === L.FIM ? Comum.Som.chegou() : null) : Comum.Som.passo()));
      } else if (posAnterior && antes < 0 && p === 0) {
        camadaPinos.appendChild(g);
        animar(g, [alvo], 0, () => Comum.Som.passo());
      } else if (!g._em || g._em[0] !== alvo[0] || g._em[1] !== alvo[1] || g._em[2] !== alvo[2]) {
        if (posAnterior && p < 0 && antes >= 0) animar(g, [alvo], demora + 200, () => Comum.Som.captura());
        else animar(g, [alvo], 0);
      }
      const pode = S.fase === 'jogo' && S.vez === c && S.rolou && S.validas.includes(i);
      g.classList.toggle('pode', pode);
      // efeitos do Super
      P.escudo.setAttribute('visibility', sup && S.protegido[c] === i ? 'visible' : 'hidden');
      P.vida.setAttribute('visibility', sup && S.vidas[c][i] > 0 && p >= 0 ? 'visible' : 'hidden');
      const preso = sup && S.preso[c][i] != null;
      g.classList.toggle('preso', preso);
      P.carga.setAttribute('visibility', preso ? 'visible' : 'hidden');
      if (preso) P.carga.textContent = S.preso[c][i] + '/' + L.CARGA_BURACO;
    }));
    posAnterior = JSON.parse(JSON.stringify(S.pos));
    document.querySelectorAll('.base-borda').forEach((r) => r.classList.toggle('vez', S.vez === r.dataset.cor));

    // buracos negros
    camadaEfeitos.innerHTML = '';
    if (sup) S.buracos.forEach((b) => {
      const t = L.TRILHA[b.casa];
      el('rect', { x: t[0] + 0.02, y: t[1] + 0.02, width: 0.96, height: 0.96, fill: 'url(#grad-buraco)' }, camadaEfeitos);
      el('path', { class: 'buraco-giro', d: `M${t[0] + 0.5},${t[1] + 0.2} a0.3,0.3 0 1,1 -0.28,0.42 a0.18,0.18 0 1,0 0.2,-0.22`, fill: 'none', stroke: '#c9a8ff', 'stroke-width': 0.05, 'stroke-linecap': 'round' }, camadaEfeitos);
    });

    // alvos de captura (dica)
    camadaMarcas.innerHTML = '';
    if (S.fase === 'jogo' && S.rolou) {
      const vistos = new Set();
      S.opcoes.forEach((o) => (o.captura || []).forEach((a) => {
        const k = a.cor + a.i;
        if (vistos.has(k)) return;
        vistos.add(k);
        const f = finais[k];
        const m = el('g', { class: 'alvo' }, camadaMarcas);
        el('circle', { cx: f.x, cy: f.y, r: 0.5 * f.s, fill: 'none', stroke: '#ff3b30', 'stroke-width': 0.08 }, m);
        [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => el('line', { x1: f.x + dx * 0.36 * f.s, y1: f.y + dy * 0.36 * f.s, x2: f.x + dx * 0.66 * f.s, y2: f.y + dy * 0.66 * f.s, stroke: '#ff3b30', 'stroke-width': 0.08, 'stroke-linecap': 'round' }, m));
      }));
    }
  }

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
    document.querySelectorAll('.modo').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === S.modo));
    document.querySelectorAll('#tempos button').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.tempo) === S.tempo));
    const box = $('vagas');
    box.innerHTML = '';
    L.CORES.forEach((c) => {
      const l = S.lugares[c];
      const v = document.createElement('div');
      v.className = 'vaga' + (l ? ' ocupada' : '') + (recemChegou === c ? ' entrou' : '');
      v.style.color = L.HEX[c];
      const txt = !l ? L.NOME[c] + ' · livre' : l.tipo === 'local' ? 'Jogador local (teste)' : l.ausente ? 'Celular desconectado' : 'Pronto!';
      v.innerHTML = `<span class="bola" style="background:${L.HEX[c]}"></span><span><b>${esc(l ? l.nome || L.NOME[c] : 'Esperando…')}</b><small>${esc(txt)}</small></span>`;
      if (l && S.modo === 'super') {
        const mini = document.createElement('div');
        mini.className = 'mini-pinos';
        S.habil[c].forEach((h, i) => { const ic = Pecas.icone(c, h, i + 1, 28); ic.setAttribute('aria-label', L.HABILIDADES[h].nome); mini.appendChild(ic); });
        v.children[1].appendChild(mini);
      }
      if (modoTeste && (!l || l.tipo === 'local')) {
        const b = document.createElement('button');
        b.className = 'local';
        b.textContent = l ? 'Remover' : 'Adicionar jogador local';
        b.onclick = () => { S.lugares[c] = l ? null : { id: 'local-' + c, tipo: 'local', ausente: false, nome: L.NOME[c] }; enviar(); };
        v.children[1].appendChild(b);
      }
      box.appendChild(v);
    });
    recemChegou = null;
    const n = L.sentados(S).length;
    $('btn-comecar').disabled = n < L.MIN_JOGADORES;
    $('dica-comecar').textContent = n < L.MIN_JOGADORES
      ? `Precisa de pelo menos ${L.MIN_JOGADORES} jogadores (${n}/${L.MIN_JOGADORES}).`
      : `${n} jogadores prontos.`;
  }

  function renderJogo() {
    renderPinos();
    const vez = S.vez, sup = S.modo === 'super';
    $('quem').textContent = S.fase === 'fim' ? 'Fim de jogo' : 'Vez de ' + L.nomeDe(S, vez);
    $('quem').style.color = vez ? L.HEX[vez] : '';
    $('msg-mesa').textContent = S.msg;
    $('relogio-mesa').hidden = !prazo;
    if (S.rolagem !== ultimaRolagem) { ultimaRolagem = S.rolagem; Comum.rolarDado($('dado-mesa'), S.dado); }
    else if (!$('dado-mesa').classList.contains('rolando')) Comum.face($('dado-mesa'), S.dado);

    // anúncio de poder
    if (S.anuncio && S.anuncio.n !== ultimoAnuncio) {
      ultimoAnuncio = S.anuncio.n;
      const a = $('anuncio');
      $('anuncio-nome').textContent = L.nomeDe(S, S.anuncio.cor) + ' usou';
      $('anuncio-nome').style.color = L.HEX[S.anuncio.cor];
      $('anuncio-poder').textContent = L.PODERES[S.anuncio.poder].nome + '!';
      a.hidden = true; void a.offsetWidth; a.hidden = false;
      clearTimeout(a._t); a._t = setTimeout(() => (a.hidden = true), 2400);
      if (S.anuncio.poder === 'buraco') Comum.Som.buraco(); else Comum.Som.poder();
    }

    const lista = $('jogadores');
    lista.innerHTML = '';
    L.sentados(S).forEach((c) => {
      const l = S.lugares[c], lugar = S.vencedores.indexOf(c);
      const chegaram = S.pos[c].filter((p) => p === L.FIM).length;
      const d = document.createElement('div');
      d.className = 'jogador' + (S.vez === c ? ' vez' : '');
      d.innerHTML = `<span class="ponto" style="background:${L.HEX[c]}"></span>
        <span style="min-width:0"><div class="nome">${esc(l.nome || L.NOME[c])}</div><div class="info">${l.ausente ? 'Desconectado' : chegaram + '/4 pinos chegaram'}</div></span>
        <span class="lado">${lugar >= 0 ? `<span class="lugar">${lugar + 1}º</span>` : ''}${sup ? `<span class="pts">${S.pontos[c]} pts</span>` : ''}</span>`;
      lista.appendChild(d);
    });

    const local = S.fase === 'jogo' && S.lugares[vez] && S.lugares[vez].tipo === 'local';
    $('btn-rolar-local').hidden = !local;
    $('btn-rolar-local').disabled = S.rolou;
    $('btn-rolar-local').textContent = S.rolou ? 'Clique num pino no tabuleiro' : 'Girar dado';

    if (S.fase === 'fim') {
      $('ranking').innerHTML = S.vencedores.map((c, k) => `<li><span style="background:${L.HEX[c]}"></span>${k + 1}º ${esc(L.nomeDe(S, c))}${sup ? `<small>${S.pontos[c]} pts</small>` : ''}</li>`).join('');
    }
  }

  // No modo de teste, deixa o estado acessível no console para montar situações (ex.: buraco negro).
  if (modoTeste) window.ludoTeste = { estado: () => S, atualizar: (f) => { f(S); enviar(); } };

  return { abrir };
})();
