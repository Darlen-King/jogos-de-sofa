/* =====================================================================
   mesa.js — a tela grande (computador/TV).
   É o "dono" da partida: guarda o estado, aplica as regras e manda
   o estado atualizado para todos os celulares conectados.
   Abra com ?teste no endereço para poder adicionar jogadores locais
   (jogar pelo mouse, sem celular).
   ===================================================================== */
const Mesa = (() => {
  const { $, PREFIXO } = Comum;
  const L = Ludo;
  const modoTeste = new URLSearchParams(location.search).has('teste');

  let S = L.novoEstado();
  let peer = null;
  let codigo = '';
  const conexoes = new Map(); // connectionId -> { conn, id }
  let pausa = 0;              // invalida timers antigos
  let ultimaRolagem = 0;
  let posAnterior = null;
  let recemChegou = null;
  const pinos = {};           // pinos[cor][i] = <g> do SVG

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
    $('link').textContent = url;
    if (location.protocol === 'file:') $('link').textContent = 'Abra pelo GitHub Pages para o QR code funcionar no celular.';
  }

  function status(txt, erro) {
    $('status-mesa').textContent = txt;
    $('status-mesa').classList.toggle('erro', !!erro);
  }

  /** Mensagens que chegam dos celulares. Nunca confiamos na cor que o celular diz: usamos o ID dele. */
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

    if (m.t === 'sentar') {
      const c = m.cor;
      if (!L.CORES.includes(c)) return;
      const lugar = S.lugares[c];
      const pode = (lugar && (lugar.id === id || lugar.ausente)) || (!lugar && S.fase === 'sala');
      if (!pode) return enviar();
      if (minha && minha !== c && S.fase === 'sala') S.lugares[minha] = null;
      S.lugares[c] = { id, tipo: 'celular', ausente: false };
      recemChegou = c;
      return enviar();
    }
    if (m.t === 'levantar') {
      if (minha && S.fase === 'sala') S.lugares[minha] = null;
      return enviar();
    }
    if (m.t === 'rolar' && minha) return rolar(minha);
    if (m.t === 'mover' && minha && Number.isInteger(m.i)) return mover(minha, m.i);
  }

  const corDe = (id) => L.CORES.find((c) => S.lugares[c] && S.lugares[c].id === id);

  function marcarAusentes() {
    const online = new Set([...conexoes.values()].map((r) => r.id).filter(Boolean));
    L.CORES.forEach((c) => {
      const l = S.lugares[c];
      if (l && l.tipo === 'celular') l.ausente = !online.has(l.id);
    });
  }

  /** O que os celulares recebem: o estado, sem os IDs dos outros aparelhos. */
  function publico() {
    const P = JSON.parse(JSON.stringify(S));
    L.CORES.forEach((c) => { if (P.lugares[c]) P.lugares[c] = { tipo: P.lugares[c].tipo, ausente: !!P.lugares[c].ausente }; });
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
  // Jogadas
  // ------------------------------------------------------------------
  function rolar(c) {
    const d = L.rolar(S, c, 1 + Math.floor(Math.random() * 6));
    if (d === null) return;
    enviar();
    if (!S.validas.length) {
      const minhaPausa = ++pausa;
      setTimeout(() => { if (minhaPausa !== pausa) return; L.passarSemJogada(S); enviar(); }, 1800);
    }
  }

  function mover(c, i) {
    const r = L.mover(S, c, i);
    if (!r) return;
    pausa++;
    enviar();
  }

  $('btn-comecar').onclick = () => { if (L.iniciar(S)) { posAnterior = null; enviar(); Comum.Som.vez(); } };
  $('btn-nova').onclick = () => { pausa++; S = L.reiniciar(S); posAnterior = null; enviar(); };
  $('btn-denovo').onclick = () => { pausa++; S = L.reiniciar(S); posAnterior = null; enviar(); };
  $('btn-qr').onclick = () => { $('qr-mini').hidden = !$('qr-mini').hidden; $('btn-qr').textContent = $('qr-mini').hidden ? 'Mostrar QR code' : 'Esconder QR code'; };
  $('btn-rolar-local').onclick = () => { const l = S.lugares[S.vez]; if (l && l.tipo === 'local') rolar(S.vez); };

  // ------------------------------------------------------------------
  // Desenho do tabuleiro (SVG em uma grade 15x15)
  // ------------------------------------------------------------------
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, pai) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }

  function desenharTabuleiro() {
    const svg = $('svg');
    if (svg.childNodes.length) return;
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

    const camada = el('g', {}, svg);
    L.CORES.forEach((c) => {
      pinos[c] = [0, 1, 2, 3].map((i) => {
        const g = el('g', { class: 'pino' }, camada);
        el('circle', { class: 'aro', r: 0.5, fill: 'none', stroke: '#1d2330', 'stroke-width': 0.09 }, g);
        el('circle', { cy: 0.06, r: 0.38, fill: 'rgba(0,0,0,.25)' }, g);
        el('circle', { r: 0.38, fill: L.HEX[c], stroke: '#fff', 'stroke-width': 0.08 }, g);
        const t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 0.44, 'font-weight': 800, fill: '#fff', 'font-family': 'Nunito, sans-serif' }, g);
        t.textContent = i + 1;
        g.addEventListener('click', () => { const l = S.lugares[c]; if (l && l.tipo === 'local') mover(c, i); });
        return g;
      });
    });
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
    // posição final de cada pino (com pinos empilhados um pouco deslocados)
    const finais = {}, grupos = {};
    L.CORES.forEach((c) => S.pos[c].forEach((p, i) => {
      const [x, y, chave] = L.onde(c, p, i);
      const o = { c, i, x, y, s: 1 };
      finais[c + i] = o;
      (grupos[chave] = grupos[chave] || []).push(o);
    }));
    Object.values(grupos).forEach((g) => {
      if (g.length < 2) return;
      const d = g.length === 2 ? [[-0.2, 0], [0.2, 0]] : [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
      g.forEach((o, k) => { const f = d[k % d.length]; o.x += f[0]; o.y += f[1]; o.s = 0.72; });
    });

    // quanto tempo o pino que andou leva, para o capturado só voltar depois
    let demoraCaptura = 0;
    if (posAnterior) L.CORES.forEach((c) => S.pos[c].forEach((p, i) => {
      const a = posAnterior[c][i];
      if (p > a && a >= 0) demoraCaptura = Math.max(demoraCaptura, (p - a) * 170);
    }));
    L.CORES.forEach((c) => S.pos[c].forEach((p, i) => {
      const g = pinos[c][i], fim = finais[c + i], antes = posAnterior ? posAnterior[c][i] : p;
      const alvo = [fim.x, fim.y, fim.s];
      if (posAnterior && p > antes && antes >= 0) {
        // andou: passa por cada casa
        const caminho = [];
        for (let k = antes + 1; k < p; k++) { const [x, y] = L.onde(c, k, i); caminho.push([x, y, 1]); }
        caminho.push(alvo);
        g.parentNode.appendChild(g); // fica por cima dos outros
        animar(g, caminho, 0, (ultimo) => (ultimo ? (p === L.FIM ? Comum.Som.chegou() : null) : Comum.Som.passo()));
      } else if (posAnterior && antes < 0 && p === 0) {
        g.parentNode.appendChild(g);
        animar(g, [alvo], 0, () => Comum.Som.passo());
      } else if (!g._em || g._em[0] !== alvo[0] || g._em[1] !== alvo[1] || g._em[2] !== alvo[2]) {
        if (posAnterior && p < 0 && antes >= 0) { // foi capturado: volta para a base depois que o outro chega
          animar(g, [alvo], demoraCaptura + 200, () => Comum.Som.captura());
        } else animar(g, [alvo], 0);
      }
      const pode = S.fase === 'jogo' && S.vez === c && S.rolou && S.validas.includes(i);
      g.classList.toggle('pode', pode);
    }));
    posAnterior = JSON.parse(JSON.stringify(S.pos));
    document.querySelectorAll('.base-borda').forEach((r) => r.classList.toggle('vez', S.vez === r.dataset.cor));
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
    const box = $('vagas');
    box.innerHTML = '';
    L.CORES.forEach((c) => {
      const l = S.lugares[c];
      const v = document.createElement('div');
      v.className = 'vaga' + (l ? ' ocupada' : '') + (recemChegou === c ? ' entrou' : '');
      v.style.color = L.HEX[c];
      const txt = !l ? 'Livre' : l.tipo === 'local' ? 'Jogador local (teste)' : l.ausente ? 'Celular desconectado' : 'Pronto!';
      v.innerHTML = `<span class="bola" style="background:${L.HEX[c]}"></span><span><b>${L.NOME[c]}</b><small>${txt}</small></span>`;
      if (modoTeste && (!l || l.tipo === 'local')) {
        const b = document.createElement('button');
        b.className = 'local';
        b.textContent = l ? 'Remover' : 'Adicionar jogador local';
        b.onclick = () => { S.lugares[c] = l ? null : { id: 'local-' + c, tipo: 'local', ausente: false }; enviar(); };
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
    const vez = S.vez;
    $('quem').textContent = S.fase === 'fim' ? 'Fim de jogo' : 'Vez do ' + L.NOME[vez];
    $('quem').style.color = vez ? L.HEX[vez] : '';
    $('msg-mesa').textContent = S.msg;
    if (S.rolagem !== ultimaRolagem) { ultimaRolagem = S.rolagem; Comum.rolarDado($('dado-mesa'), S.dado); }
    else if (!$('dado-mesa').classList.contains('rolando')) Comum.face($('dado-mesa'), S.dado);

    const lista = $('jogadores');
    lista.innerHTML = '';
    L.sentados(S).forEach((c) => {
      const l = S.lugares[c], lugar = S.vencedores.indexOf(c);
      const chegaram = S.pos[c].filter((p) => p === L.FIM).length;
      const d = document.createElement('div');
      d.className = 'jogador' + (S.vez === c ? ' vez' : '');
      d.innerHTML = `<span class="ponto" style="background:${L.HEX[c]}"></span>
        <span><div class="nome">${L.NOME[c]}</div><div class="info">${l.ausente ? 'Desconectado' : chegaram + '/4 pinos chegaram'}</div></span>
        <span class="lugar">${lugar >= 0 ? lugar + 1 + 'º' : ''}</span>`;
      lista.appendChild(d);
    });

    const local = S.fase === 'jogo' && S.lugares[vez] && S.lugares[vez].tipo === 'local';
    $('btn-rolar-local').hidden = !local;
    $('btn-rolar-local').disabled = S.rolou;
    $('btn-rolar-local').textContent = S.rolou ? 'Clique num pino no tabuleiro' : 'Girar dado';

    if (S.fase === 'fim') {
      $('ranking').innerHTML = S.vencedores.map((c, k) => `<li><span style="background:${L.HEX[c]}"></span>${k + 1}º ${L.NOME[c]}</li>`).join('');
    }
  }

  return { abrir };
})();
