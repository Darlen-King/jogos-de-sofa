/* =====================================================================
   regras.js — as regras do Bomba no Sofá, sem tela nem rede.
   Tudo aqui mexe só no objeto de estado S, então dá para testar sozinho
   (veja testes/regras.test.js). A mesa (TV) é quem chama estas funções.

   Uma vez: jogue quantas cartas quiser e termine comprando uma carta.
   Toda carta jogada abre uma janela de alguns segundos para alguém usar
   um "Não!" (que também pode ser negado). Comprou uma Bomba sem ter
   Desarmar? Explodiu. O último que sobrar ganha.
   ===================================================================== */
const Bomba = (() => {
  const MIN_JOGADORES = 2, MAX_JOGADORES = 5;
  const MAO_INICIAL = 7;                    // + 1 Desarmar
  const CORES = ['#e2483d', '#2f7fe0', '#2fa65a', '#f2c230', '#b78bff'];
  const TEMPOS = [30, 60, 90, 0];           // tempo da vez (0 = sem tempo)
  const REACOES = [3, 5, 8];                // segundos para alguém dizer "Não!"
  const TEMPO_ESPERA = 30;                  // para escolhas (dar carta, esconder bomba) quando não há tempo da vez

  const SOFA_DETALHE = 'Sozinha não faz nada. Junte 2 iguais (par) para roubar uma carta aleatória de alguém, ou 3 iguais (trio) para pedir uma carta pelo nome.';
  const CARTAS = {
    bomba: { nome: 'Bomba', icone: '💣', cor: '#1d2330', qtd: 0,
      desc: 'Comprou e não tem Desarmar? Você explode e sai do jogo.',
      detalhe: 'Não dá para jogar a Bomba: ela só aparece quando alguém compra. O monte sempre tem uma bomba a menos que o número de jogadores vivos, então alguém sempre vai explodir.' },
    desarmar: { nome: 'Desarmar', icone: '✂️', cor: '#2fa65a', qtd: 6,
      desc: 'Salva você de uma Bomba.',
      detalhe: 'Se você compra uma Bomba e tem Desarmar, ele é usado na hora. Aí você escolhe, em segredo, onde a Bomba volta no monte: no topo (o próximo compra!), no meio, no fundo ou num lugar aleatório. Ninguém pode negar um Desarmar. Todo mundo começa com um.' },
    ataque: { nome: 'Ataque', icone: '⚔️', cor: '#e2483d', qtd: 4, acao: true,
      desc: 'Termina sua vez sem comprar. O próximo joga 2 vezes seguidas.',
      detalhe: 'Se você foi atacado e joga outro Ataque, suas vezes acabam e o próximo fica com as que faltavam para você mais 2. Exemplo: você tinha 2 vezes, joga Ataque logo na primeira, o próximo joga 4.' },
    pular: { nome: 'Pular', icone: '⏭️', cor: '#2f7fe0', qtd: 4, acao: true,
      desc: 'Termina sua vez sem comprar carta.',
      detalhe: 'Se você foi atacado (2 vezes), o Pular encerra só uma delas.' },
    favor: { nome: 'Favor', icone: '🙏', cor: '#d9822b', qtd: 4, acao: true, alvo: true,
      desc: 'Escolha alguém: a pessoa escolhe uma carta da mão dela para te dar.',
      detalhe: 'Quem dá é que escolhe qual carta. Só dá para pedir a quem tem pelo menos uma carta.' },
    embaralhar: { nome: 'Embaralhar', icone: '🔀', cor: '#8a5a2b', qtd: 4, acao: true,
      desc: 'Embaralha o monte.',
      detalhe: 'Bom quando você sabe que a Bomba está perto do topo, ou quando alguém acabou de espiar o futuro.' },
    futuro: { nome: 'Espiar o futuro', icone: '🔮', cor: '#8b5cf6', qtd: 5, acao: true,
      desc: 'Veja em segredo as 3 próximas cartas do monte.',
      detalhe: 'Aparece só no seu celular e não muda a ordem das cartas.' },
    nao: { nome: 'Não!', icone: '✋', cor: '#c2185b', qtd: 5,
      desc: 'Cancela a carta que alguém acabou de jogar.',
      detalhe: 'Depois de cada jogada, todo mundo tem alguns segundos para usar um Não, até fora da vez. Um Não também pode ser negado (aí a jogada volta a valer), e assim por diante. Cada Não recomeça a contagem. Não funciona contra Bomba nem Desarmar.' },
    pipoca: { nome: 'Pipoca', icone: '🍿', cor: '#e8a317', qtd: 4, sofa: true, desc: 'Carta de sofá: junte iguais.', detalhe: SOFA_DETALHE },
    chinelo: { nome: 'Chinelo', icone: '🩴', cor: '#14b8a6', qtd: 4, sofa: true, desc: 'Carta de sofá: junte iguais.', detalhe: SOFA_DETALHE },
    controle: { nome: 'Controle', icone: '🎮', cor: '#64748b', qtd: 4, sofa: true, desc: 'Carta de sofá: junte iguais.', detalhe: SOFA_DETALHE },
    meia: { nome: 'Meia', icone: '🧦', cor: '#ec4899', qtd: 4, sofa: true, desc: 'Carta de sofá: junte iguais.', detalhe: SOFA_DETALHE },
    ursinho: { nome: 'Ursinho', icone: '🧸', cor: '#a16207', qtd: 4, sofa: true, desc: 'Carta de sofá: junte iguais.', detalhe: SOFA_DETALHE },
  };
  const TIPOS = Object.keys(CARTAS);
  const COMBOS = {
    par: { nome: 'Par', desc: '2 cartas iguais: roube uma carta aleatória de alguém.' },
    trio: { nome: 'Trio', desc: '3 cartas iguais: diga o nome de uma carta. Se a pessoa tiver, tem que te dar.' },
    cinco: { nome: '5 diferentes', desc: '5 cartas todas diferentes: pegue a carta que quiser do descarte.' },
  };

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  function embaralhar(lista, rng = Math.random) {
    for (let i = lista.length - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      [lista[i], lista[k]] = [lista[k], lista[i]];
    }
    return lista;
  }
  const nomeDe = (S, j) => (S.jogadores[j] ? S.jogadores[j].nome : '?');
  const vivos = (S) => S.jogadores.map((p, j) => (p.vivo ? j : -1)).filter((j) => j >= 0);
  function proximoVivo(S, j) {
    const n = S.jogadores.length;
    for (let k = 1; k <= n; k++) { const x = (j + k) % n; if (S.jogadores[x].vivo) return x; }
    return j;
  }
  function registrar(S, txt) {
    S.msg = txt;
    S.log.push(txt);
    if (S.log.length > 8) S.log.shift();
  }
  function anunciar(S, tipo, dados) { S.anuncio = Object.assign({ n: ++S.n, tipo }, dados); }
  function avisar(S, j, texto) { S.privado[j] = { n: ++S.n, texto }; }
  const temCarta = (p, t) => p.mao.some((c) => c.t === t);
  function tirar(p, t) { const k = p.mao.findIndex((c) => c.t === t); return k < 0 ? null : p.mao.splice(k, 1)[0]; }

  // ------------------------------------------------------------------
  // Sala
  // ------------------------------------------------------------------
  function novoEstado(tempo = 60, reacao = 5) {
    return {
      fase: 'sala', tempo, reacao, jogadores: [], baralho: [], descarte: [], explodidas: [],
      vez: 0, turnos: 1, pilha: null, espera: null, visao: {}, privado: {},
      log: [], msg: '', anuncio: null, n: 0, vencedor: null, proxId: 1,
    };
  }

  /** Coloca um jogador na sala. Devolve o índice dele, ou -1. */
  function entrar(S, id, nome, tipo = 'celular') {
    const ja = S.jogadores.findIndex((p) => p.id === id);
    if (ja >= 0) { if (nome) S.jogadores[ja].nome = nome; return ja; }
    if (S.fase !== 'sala' || S.jogadores.length >= MAX_JOGADORES) return -1;
    const usadas = new Set(S.jogadores.map((p) => p.cor));
    const cor = CORES.find((c) => !usadas.has(c));
    S.jogadores.push({ id, nome: nome || 'Jogador ' + (S.jogadores.length + 1), tipo, ausente: false, cor, vivo: true, mao: [] });
    return S.jogadores.length - 1;
  }
  function sair(S, id) {
    if (S.fase !== 'sala') return false;
    const j = S.jogadores.findIndex((p) => p.id === id);
    if (j < 0) return false;
    S.jogadores.splice(j, 1);
    return true;
  }

  function iniciar(S, rng = Math.random) {
    const n = S.jogadores.length;
    if (S.fase !== 'sala' || n < MIN_JOGADORES) return false;
    const nova = (t) => ({ id: S.proxId++, t });
    let monte = [];
    TIPOS.forEach((t) => { if (t !== 'desarmar' && t !== 'bomba') for (let k = 0; k < CARTAS[t].qtd; k++) monte.push(nova(t)); });
    embaralhar(monte, rng);
    S.jogadores.forEach((p) => {
      p.vivo = true;
      p.mao = monte.splice(0, MAO_INICIAL);
      p.mao.push(nova('desarmar'));
    });
    const sobra = Math.min(CARTAS.desarmar.qtd - n, 2);
    for (let k = 0; k < sobra; k++) monte.push(nova('desarmar'));
    for (let k = 0; k < n - 1; k++) monte.push(nova('bomba'));
    S.baralho = embaralhar(monte, rng);
    S.descarte = []; S.explodidas = [];
    S.fase = 'jogo';
    S.vez = Math.floor(rng() * n);
    S.turnos = 1;
    S.pilha = null; S.espera = null; S.visao = {}; S.privado = {}; S.log = []; S.vencedor = null;
    registrar(S, 'Começou! Vez de ' + nomeDe(S, S.vez) + '.');
    return true;
  }

  function reiniciar(S) {
    const T = novoEstado(S.tempo, S.reacao);
    T.jogadores = S.jogadores.filter((p) => !p.ausente).map((p) => Object.assign({}, p, { vivo: true, mao: [] }));
    T.proxId = S.proxId; T.n = S.n;
    return T;
  }

  // ------------------------------------------------------------------
  // Vez
  // ------------------------------------------------------------------
  function passarVez(S) {
    S.vez = proximoVivo(S, S.vez);
    S.turnos = 1;
  }
  function fimDeTurno(S) {
    S.turnos -= 1;
    const mesmo = S.turnos > 0;
    if (!mesmo) passarVez(S);
    // completa a última mensagem em vez de criar outra linha
    S.msg += mesmo ? ' ' + nomeDe(S, S.vez) + ' ainda joga mais ' + S.turnos + (S.turnos > 1 ? ' vezes.' : ' vez.') : ' Vez de ' + nomeDe(S, S.vez) + '.';
    if (S.log.length) S.log[S.log.length - 1] = S.msg;
  }
  const podeAgir = (S, j) => S.fase === 'jogo' && S.vez === j && !S.pilha && !S.espera && !!S.jogadores[j] && S.jogadores[j].vivo;

  /** Que jogada é essa combinação de cartas? */
  function analisar(tipos) {
    const n = tipos.length;
    if (!n || tipos.some((t) => !CARTAS[t] || t === 'bomba')) return null;
    const iguais = tipos.every((t) => t === tipos[0]);
    if (n === 1) return CARTAS[tipos[0]].acao ? { tipo: 'acao', carta: tipos[0], alvo: !!CARTAS[tipos[0]].alvo, nome: false } : null;
    if (n === 2 && iguais) return { tipo: 'par', carta: tipos[0], alvo: true, nome: false };
    if (n === 3 && iguais) return { tipo: 'trio', carta: tipos[0], alvo: true, nome: true };
    if (n === 5 && new Set(tipos).size === 5) return { tipo: 'cinco', alvo: false, nome: false };
    return null;
  }

  /** Quem pode ser alvo de Favor, par ou trio. */
  const alvosValidos = (S, j) => vivos(S).filter((x) => x !== j && S.jogadores[x].mao.length > 0);

  function descreverJogada(S, autor, jg) {
    const quem = nomeDe(S, autor);
    if (jg.tipo === 'acao') return quem + ' jogou ' + CARTAS[jg.carta].nome + (jg.alvo != null ? ' em ' + nomeDe(S, jg.alvo) : '');
    if (jg.tipo === 'par') return quem + ' jogou um par de ' + CARTAS[jg.carta].nome + ' para roubar uma carta de ' + nomeDe(S, jg.alvo);
    if (jg.tipo === 'trio') return quem + ' jogou um trio de ' + CARTAS[jg.carta].nome + ' e pediu ' + CARTAS[jg.nome].nome + ' a ' + nomeDe(S, jg.alvo);
    return quem + ' jogou 5 cartas diferentes para pegar uma do descarte';
  }

  /** Joga cartas da mão (ids). opc: { alvo, nome }. Abre a janela do "Não!". */
  function jogar(S, j, ids, opc = {}) {
    if (!podeAgir(S, j) || !Array.isArray(ids)) return false;
    const p = S.jogadores[j];
    if (new Set(ids).size !== ids.length) return false;
    const cartas = ids.map((id) => p.mao.find((c) => c.id === id));
    if (cartas.some((c) => !c)) return false;
    const an = analisar(cartas.map((c) => c.t));
    if (!an) return false;
    const jg = { tipo: an.tipo, carta: an.carta || null, alvo: null, nome: null };
    if (an.alvo) {
      if (!Number.isInteger(opc.alvo) || !alvosValidos(S, j).includes(opc.alvo)) return false;
      jg.alvo = opc.alvo;
    }
    if (an.nome) {
      if (!CARTAS[opc.nome] || opc.nome === 'bomba') return false;
      jg.nome = opc.nome;
    }
    if (an.tipo === 'cinco' && !S.descarte.length) return false;
    p.mao = p.mao.filter((c) => !ids.includes(c.id));
    S.descarte.push(...cartas);
    S.pilha = { autor: j, jogada: jg, cartas: cartas.map((c) => c.t), naos: [] };
    registrar(S, descreverJogada(S, j, jg) + '.');
    anunciar(S, 'jogou', { autor: j });
    return true;
  }

  /** Quem foi o último a agir na cadeia (a jogada ou o último "Não!"). */
  const ultimoDaCadeia = (S) => (S.pilha.naos.length ? S.pilha.naos[S.pilha.naos.length - 1] : S.pilha.autor);
  const podeNegar = (S, j) => S.fase === 'jogo' && !!S.pilha && !!S.jogadores[j] && S.jogadores[j].vivo && temCarta(S.jogadores[j], 'nao') && ultimoDaCadeia(S) !== j;

  function negar(S, j) {
    if (!podeNegar(S, j)) return false;
    S.descarte.push(tirar(S.jogadores[j], 'nao'));
    S.pilha.naos.push(j);
    const k = S.pilha.naos.length;
    registrar(S, nomeDe(S, j) + (k === 1 ? ' disse NÃO!' : ' negou o Não! (' + (k % 2 ? 'cancelada de novo' : 'volta a valer') + ')'));
    anunciar(S, 'nao', { autor: j, k });
    return true;
  }

  const cancelada = (pilha) => pilha.naos.length % 2 === 1;

  /** Fim da janela do "Não!": a jogada vale ou é cancelada. */
  function resolver(S, rng = Math.random) {
    const P = S.pilha;
    if (!P) return false;
    S.pilha = null;
    const a = P.autor, jg = P.jogada, eu = S.jogadores[a];
    if (cancelada(P)) { registrar(S, 'A jogada de ' + nomeDe(S, a) + ' foi cancelada.'); return true; }

    if (jg.tipo === 'acao') {
      switch (jg.carta) {
        case 'ataque': {
          const extra = S.turnos > 1 ? S.turnos : 0;
          passarVez(S);
          S.turnos = extra + 2;
          registrar(S, nomeDe(S, a) + ' atacou! ' + nomeDe(S, S.vez) + ' joga ' + S.turnos + ' vezes seguidas.');
          return true;
        }
        case 'pular':
          registrar(S, nomeDe(S, a) + ' pulou a vez.');
          fimDeTurno(S);
          return true;
        case 'favor': {
          if (!S.jogadores[jg.alvo].mao.length) { registrar(S, nomeDe(S, jg.alvo) + ' não tinha cartas para dar.'); return true; }
          S.espera = { tipo: 'favor', j: jg.alvo, para: a };
          registrar(S, nomeDe(S, jg.alvo) + ' está escolhendo uma carta para dar a ' + nomeDe(S, a) + '.');
          return true;
        }
        case 'embaralhar':
          embaralhar(S.baralho, rng);
          S.visao = {};
          registrar(S, nomeDe(S, a) + ' embaralhou o monte.');
          return true;
        case 'futuro':
          S.visao[a] = { n: ++S.n, cartas: S.baralho.slice(0, 3).map((c) => c.t) };
          registrar(S, nomeDe(S, a) + ' espiou o futuro.');
          return true;
      }
    }
    if (jg.tipo === 'par') {
      const alvo = S.jogadores[jg.alvo];
      if (!alvo.mao.length) { registrar(S, nomeDe(S, jg.alvo) + ' não tinha cartas.'); return true; }
      const c = alvo.mao.splice(Math.floor(rng() * alvo.mao.length), 1)[0];
      eu.mao.push(c);
      avisar(S, a, 'Você roubou ' + CARTAS[c.t].nome + ' de ' + nomeDe(S, jg.alvo) + '.');
      avisar(S, jg.alvo, nomeDe(S, a) + ' roubou seu ' + CARTAS[c.t].nome + '.');
      registrar(S, nomeDe(S, a) + ' roubou uma carta de ' + nomeDe(S, jg.alvo) + '.');
      return true;
    }
    if (jg.tipo === 'trio') {
      const c = tirar(S.jogadores[jg.alvo], jg.nome);
      if (c) {
        eu.mao.push(c);
        registrar(S, nomeDe(S, jg.alvo) + ' tinha ' + CARTAS[jg.nome].nome + ' e teve que dar a ' + nomeDe(S, a) + '!');
      } else registrar(S, nomeDe(S, jg.alvo) + ' não tinha ' + CARTAS[jg.nome].nome + '.');
      return true;
    }
    if (jg.tipo === 'cinco') {
      S.espera = { tipo: 'descarte', j: a };
      registrar(S, nomeDe(S, a) + ' está escolhendo uma carta do descarte.');
      return true;
    }
    return true;
  }

  /** Comprar a carta do topo termina a vez. Devolve o tipo comprado. */
  function comprar(S, j) {
    if (!podeAgir(S, j) || !S.baralho.length) return null;
    const p = S.jogadores[j];
    const c = S.baralho.shift();
    S.visao = {};
    if (c.t !== 'bomba') {
      p.mao.push(c);
      avisar(S, j, 'Você comprou ' + CARTAS[c.t].nome + '.');
      registrar(S, nomeDe(S, j) + ' comprou uma carta.');
      fimDeTurno(S);
      return c.t;
    }
    const d = tirar(p, 'desarmar');
    if (d) {
      S.descarte.push(d);
      S.espera = { tipo: 'esconder', j, bomba: c };
      registrar(S, nomeDe(S, j) + ' comprou uma BOMBA… e desarmou! Agora vai escondê-la de volta no monte.');
      anunciar(S, 'desarmou', { autor: j });
      return 'bomba';
    }
    // explodiu
    p.vivo = false;
    S.explodidas.push(c, ...p.mao); // a mão de quem explodiu sai do jogo
    p.mao = [];
    anunciar(S, 'explodiu', { autor: j });
    const resta = vivos(S);
    if (resta.length === 1) {
      S.fase = 'fim';
      S.vencedor = resta[0];
      registrar(S, nomeDe(S, j) + ' EXPLODIU! ' + nomeDe(S, resta[0]) + ' venceu!');
      return 'bomba';
    }
    passarVez(S);
    registrar(S, nomeDe(S, j) + ' EXPLODIU! Vez de ' + nomeDe(S, S.vez) + '.');
    return 'bomba';
  }

  /** Posições para esconder a bomba: 0 = topo … baralho.length = fundo. */
  function esconder(S, j, pos) {
    if (!S.espera || S.espera.tipo !== 'esconder' || S.espera.j !== j || !Number.isInteger(pos)) return false;
    pos = Math.max(0, Math.min(S.baralho.length, pos));
    S.baralho.splice(pos, 0, S.espera.bomba);
    S.espera = null;
    S.visao = {};
    avisar(S, j, 'Bomba escondida: ' + (pos === 0 ? 'no topo' : pos === S.baralho.length - 1 ? 'no fundo' : 'na posição ' + (pos + 1)) + '.');
    registrar(S, nomeDe(S, j) + ' escondeu a bomba de volta no monte.');
    fimDeTurno(S);
    return true;
  }

  /** Resposta ao Favor: o alvo escolhe qual carta dar. */
  function dar(S, j, id) {
    const E = S.espera;
    if (!E || E.tipo !== 'favor' || E.j !== j) return false;
    const p = S.jogadores[j], k = p.mao.findIndex((c) => c.id === id);
    if (k < 0) return false;
    const c = p.mao.splice(k, 1)[0];
    S.jogadores[E.para].mao.push(c);
    S.espera = null;
    avisar(S, E.para, nomeDe(S, j) + ' te deu ' + CARTAS[c.t].nome + '.');
    avisar(S, j, 'Você deu ' + CARTAS[c.t].nome + ' a ' + nomeDe(S, E.para) + '.');
    registrar(S, nomeDe(S, j) + ' deu uma carta a ' + nomeDe(S, E.para) + '.');
    return true;
  }

  /** 5 diferentes: pega uma carta do descarte pelo tipo. */
  function pegarDescarte(S, j, tipo) {
    const E = S.espera;
    if (!E || E.tipo !== 'descarte' || E.j !== j) return false;
    let k = -1;
    for (let x = S.descarte.length - 1; x >= 0; x--) if (S.descarte[x].t === tipo) { k = x; break; }
    if (k < 0) return false;
    S.jogadores[j].mao.push(S.descarte.splice(k, 1)[0]);
    S.espera = null;
    registrar(S, nomeDe(S, j) + ' pegou ' + CARTAS[tipo].nome + ' do descarte.');
    return true;
  }

  /** Quem precisa agir agora (para o relógio). */
  const quemAge = (S) => (S.fase !== 'jogo' || S.pilha ? null : S.espera ? S.espera.j : S.vez);

  /** Tempo esgotado: faz a jogada mais simples por quem estava demorando. */
  function automatico(S, rng = Math.random) {
    if (S.fase !== 'jogo' || S.pilha) return false;
    const E = S.espera;
    if (E) {
      const p = S.jogadores[E.j];
      if (E.tipo === 'favor') return dar(S, E.j, p.mao[Math.floor(rng() * p.mao.length)].id);
      if (E.tipo === 'esconder') return esconder(S, E.j, Math.floor(rng() * (S.baralho.length + 1)));
      if (E.tipo === 'descarte') return pegarDescarte(S, E.j, S.descarte[S.descarte.length - 1].t);
      return false;
    }
    return comprar(S, S.vez) !== null;
  }

  /** O que um celular pode ver: sem as mãos dos outros e sem a ordem do monte. */
  function visaoDe(S, j) {
    const eu = Number.isInteger(j) && S.jogadores[j] ? j : null;
    const P = S.pilha;
    return {
      fase: S.fase, tempo: S.tempo, reacao: S.reacao, vez: S.vez, turnos: S.turnos, vencedor: S.vencedor,
      msg: S.msg, log: S.log.slice(), anuncio: S.anuncio ? Object.assign({}, S.anuncio) : null,
      jogadores: S.jogadores.map((p) => ({ nome: p.nome, cor: p.cor, vivo: p.vivo, ausente: !!p.ausente, tipo: p.tipo, cartas: p.mao.length })),
      monte: S.baralho.length,
      descarte: S.descarte.map((c) => c.t),
      pilha: P ? { autor: P.autor, jogada: Object.assign({}, P.jogada), cartas: P.cartas.slice(), naos: P.naos.slice(), texto: descreverJogada(S, P.autor, P.jogada) } : null,
      espera: S.espera ? { tipo: S.espera.tipo, j: S.espera.j, para: S.espera.para } : null,
      eu,
      mao: eu != null ? S.jogadores[eu].mao.map((c) => ({ id: c.id, t: c.t })) : [],
      visao: eu != null && S.visao[eu] ? { n: S.visao[eu].n, cartas: S.visao[eu].cartas.slice() } : null,
      privado: eu != null && S.privado[eu] ? Object.assign({}, S.privado[eu]) : null,
    };
  }

  return {
    MIN_JOGADORES, MAX_JOGADORES, MAO_INICIAL, CORES, TEMPOS, REACOES, TEMPO_ESPERA, CARTAS, TIPOS, COMBOS,
    embaralhar, nomeDe, vivos, proximoVivo, novoEstado, entrar, sair, iniciar, reiniciar,
    podeAgir, analisar, alvosValidos, descreverJogada, jogar, podeNegar, negar, cancelada, resolver,
    comprar, esconder, dar, pegarDescarte, quemAge, automatico, visaoDe,
  };
})();

if (typeof module !== 'undefined') module.exports = Bomba;
