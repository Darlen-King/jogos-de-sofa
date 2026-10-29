/* =====================================================================
   regras.js — as regras do Ludo (Clássico e Super), sem tela nem rede.
   Tudo aqui mexe só no objeto de estado S, então dá para testar sozinho
   (veja testes/regras.test.js).
   ===================================================================== */
const Ludo = (() => {
  const CORES = ['red', 'green', 'yellow', 'blue']; // ordem dos turnos (sentido horário)
  const NOME = { red: 'Vermelho', green: 'Verde', yellow: 'Amarelo', blue: 'Azul' };
  const HEX = { red: '#e2483d', green: '#2fa65a', yellow: '#f2c230', blue: '#2f7fe0' };
  const SUAVE = { red: '#f6c7c2', green: '#bfe6cb', yellow: '#fbe8a8', blue: '#c2dbf8' };

  const INICIO = { red: 0, green: 13, yellow: 26, blue: 39 };   // casa onde cada cor entra
  const SEGURAS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);       // saídas + estrelas
  const MIN_JOGADORES = 2;
  const TEMPOS = [15, 30, 60, 0];                                 // 0 = sem tempo

  // Progresso de um pino: -1 = base | 0..50 = trilha | 51..55 = reta final | 56 = chegou
  const FIM = 56;

  const TRILHA = [];
  const add = (l) => l.forEach((p) => TRILHA.push(p));
  add([[1, 6], [2, 6], [3, 6], [4, 6], [5, 6]]);
  add([[6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0]]); add([[7, 0], [8, 0]]);
  add([[8, 1], [8, 2], [8, 3], [8, 4], [8, 5]]);
  add([[9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6]]); add([[14, 7], [14, 8]]);
  add([[13, 8], [12, 8], [11, 8], [10, 8], [9, 8]]);
  add([[8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14]]); add([[7, 14], [6, 14]]);
  add([[6, 13], [6, 12], [6, 11], [6, 10], [6, 9]]);
  add([[5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]); add([[0, 7], [0, 6]]);

  const RETA = {
    red: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  };
  const CHEGADA = { red: [6.65, 7.5], green: [7.5, 6.65], yellow: [8.35, 7.5], blue: [7.5, 8.35] };
  const BASE = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
  const VAGAS = [[1.9, 1.9], [4.1, 1.9], [1.9, 4.1], [4.1, 4.1]];

  // ---------------- Ludo Super ----------------
  const PODERES = {
    fuga:       { nome: 'Fuga de pino',       preco: 10, alvo: 'base',   detalhe: 'Escolha um pino que está na base: ele vai direto para a casa de saída, sem precisar tirar 6. Em troca, você não gira o dado neste turno e a vez passa.', desc: 'Tira um pino da base sem precisar de 6. Você não gira o dado neste turno.' },
    seguranca:  { nome: 'Ponto de segurança', preco: 0, depois: true, icone: 'ponto_seguranca', detalhe: 'Depois de girar o dado, toque em Ponto de segurança e escolha o pino que vai andar. A casa onde ele parar vira casa segura por 2 rodadas suas: ninguém captura ali. Só vale se ele parar no caminho principal (não na reta final). Na TV aparece uma estrela dourada com um anel girando e quantas rodadas faltam.', desc: 'Depois do dado: a casa onde o pino parar vira segura por 2 rodadas suas.' },
    dadoSuper:  { nome: 'Dado super',         preco: 15, escolha: 'categoria', detalhe: 'Antes de girar, escolha como o dado vai cair: par (2, 4, 6), ímpar (1, 3, 5), baixo (1 a 3) ou alto (4 a 6). O número sai sorteado dentro do grupo escolhido. Tirar 6 continua dando jogada extra.', desc: 'Você escolhe: par, ímpar, 1 a 3 ou 4 a 6.' },
    protecao:   { nome: 'Proteção máxima',    preco: 0, depois: true, icone: 'protecao_maxima', detalhe: 'Depois de girar o dado, toque em Proteção máxima e escolha um pino seu no caminho principal: ninguém consegue capturá-lo até a sua próxima vez (quem cair em cima divide a casa). Depois de proteger, você ainda escolhe o pino que anda com o dado. Na TV aparece uma bolha azul em volta dele.', desc: 'Depois do dado: o pino fica imune até a sua próxima vez. Você ainda anda normalmente.' },
    retroceder: { nome: 'Retroceder',         preco: 0, depois: true, icone: 'retroceder', detalhe: 'Depois de girar o dado, toque em Retroceder e escolha o pino: ele volta o número que saiu. Só vale para pino no caminho principal, e ele nunca volta para antes da casa de saída. Se cair em cima de um adversário, captura. Tirou 6, joga de novo.', desc: 'Depois do dado: um pino volta o número que saiu. Pode capturar.' },
    buraco:     { nome: 'Buraco negro',       preco: 30, alvo: 'buraco', detalhe: 'A casa onde está o seu pino vira um buraco negro (não pode ser casa segura). Quem parar nela fica preso — inclusive seus outros pinos, menos o que criou o buraco. Para sair, o dono do pino preso usa rolagens nele até somar 10. Quem sai da casa vizinha ao buraco anda só metade. O buraco some quando o primeiro preso sai.', desc: 'A casa do pino vira um buraco negro que prende quem cair nela.' },
    dedo:       { nome: 'Dado a dedo',        preco: 40, escolha: 'numero', detalhe: 'Você escolhe exatamente o número que vai sair no dado. Se escolher 6, não ganha jogada extra (só ganha se capturar alguém).', desc: 'Você escolhe o número do dado. O 6 não dá jogada extra.' },
  };
  const CATEGORIAS = { par: [2, 4, 6], impar: [1, 3, 5], baixo: [1, 2, 3], alto: [4, 5, 6] };
  const NOME_CAT = { par: 'par', impar: 'ímpar', baixo: '1 a 3', alto: '4 a 6' };

  // desc = resumo curto; detalhe = explicação completa (aparece no guia); bom/ruim = lado bom e lado ruim
  const HABILIDADES = {
    normal: { nome: 'Normal', desc: 'Sem habilidade.',
      detalhe: 'Anda exatamente o número que sair no dado. Sem vantagem e sem desvantagem.' },
    corredor: { nome: 'Corredor', desc: 'Anda 2 casas a mais em toda jogada.',
      detalhe: 'Sempre anda 2 casas a mais que o dado. Exemplo: tirou 3, anda 5.',
      ruim: 'Continua precisando de 6 para sair da base e do número exato para chegar ao centro — o +2 pode fazer passar do fim.' },
    tanque: { nome: 'Tanque', desc: 'Anda metade, mas aguenta uma captura a cada saída da base.',
      detalhe: 'Aguenta uma captura: na primeira vez que alguém cai em cima dele, ele perde o coração ♥ e continua no lugar. Se for capturado de novo, volta para a base. Toda vez que sai da base, ganha o coração de novo.',
      ruim: 'Anda só metade do dado, arredondando para cima. Exemplo: tirou 5, anda 3.' },
    vacuo: { nome: 'Vácuo', desc: 'Até 6 casas atrás de um adversário, anda de graça 1/3 do que ele andar.',
      detalhe: 'Pega carona: se um pino adversário estiver até 6 casas à frente dele e andar, o Vácuo anda de graça 1/3 do que o adversário andou. Exemplo: o adversário andou 6, o Vácuo anda 2. Funciona mesmo fora da sua vez.',
      ruim: 'Nunca passa na frente de quem está puxando, não captura com essa carona e não funciona se estiver mais de 6 casas atrás.' },
    laco: { nome: 'Laço', desc: 'Adversário até 3 casas à frente dele anda 2 a menos.',
      detalhe: 'Segura quem está logo na frente: qualquer pino adversário que esteja até 3 casas à frente do Laço anda 2 casas a menos (no mínimo 1). Ótimo para perseguir alguém.',
      ruim: 'Não afeta pinos Blindados.' },
    ligeiro: { nome: 'Ligeiro', desc: 'Sai da base com 5 ou 6.',
      detalhe: 'Sai da base tirando 5 ou 6 — os outros pinos precisam de 6. Depois de sair, anda normal.' },
    banqueiro: { nome: 'Banqueiro', desc: 'Ganha pontos em dobro andando.',
      detalhe: 'Ganha 2 pontos por casa andada em vez de 1. Bom para juntar pontos e comprar poderes.',
      ruim: 'Não anda mais rápido nem tem proteção.' },
    vingativo: { nome: 'Vingativo', desc: 'Quem capturar este pino perde 20 pontos.',
      detalhe: 'Castiga quem captura ele: em vez de ganhar 10 pontos pela captura, o adversário perde 20. Faz os outros pensarem duas vezes antes de atacar.',
      ruim: 'Volta para a base normalmente quando é capturado.' },
    blindado: { nome: 'Blindado', desc: 'Imune a Buraco negro e Laço.',
      detalhe: 'Nunca fica preso em buraco negro, não anda metade perto de um buraco e não é segurado pelo Laço.',
      ruim: 'Pode ser capturado normalmente.' },
  };
  const PONTOS_CAPTURA = 10, PONTOS_CHEGADA = 50, MULTA_VINGATIVO = 20, CARGA_BURACO = 10;
  // Poderes usados depois do dado (Retroceder, Proteção máxima, Ponto de segurança): 2 usos de cada por partida
  const USOS_DEPOIS = 2, RODADAS_ZONA = 2;
  const PODERES_DEPOIS = ['retroceder', 'protecao', 'seguranca'];

  // ---------------- utilidades ----------------
  const naTrilha = (p) => p >= 0 && p <= 50;
  const casaDe = (c, p) => (INICIO[c] + p) % 52;
  const sentados = (S) => CORES.filter((c) => S.lugares[c]);
  const ehSuper = (S) => S.modo === 'super';
  const clonar = (x) => JSON.parse(JSON.stringify(x));

  function onde(c, p, i) {
    if (p < 0) { const o = BASE[c]; return [o[0] + VAGAS[i][0], o[1] + VAGAS[i][1], 'b' + c + i]; }
    if (p <= 50) { const t = TRILHA[casaDe(c, p)]; return [t[0] + 0.5, t[1] + 0.5, 't' + t]; }
    if (p < FIM) { const h = RETA[c][p - 51]; return [h[0] + 0.5, h[1] + 0.5, 'r' + h]; }
    return [CHEGADA[c][0], CHEGADA[c][1], 'f' + c];
  }

  function descrever(p) {
    if (p < 0) return 'Na base';
    if (p >= FIM) return 'Chegou!';
    if (p > 50) return 'Reta final ' + (p - 50) + '/5';
    return 'Casa ' + (p + 1);
  }

  const quatro = (v) => [v, v, v, v];
  const porCor = (f) => Object.fromEntries(CORES.map((c) => [c, f(c)]));

  function novoEstado(modo = 'classico', tempo = 30) {
    return {
      modo, tempo,
      fase: 'sala', // sala | jogo | fim
      lugares: porCor(() => null),               // {id, tipo:'celular'|'local', ausente, nome}
      habil: porCor(() => quatro('normal')),      // só no Super
      pos: porCor(() => quatro(-1)),
      vez: null, dado: null, rolou: false, opcoes: [], validas: [], rolagem: 0, seis: 0,
      msg: 'Esperando jogadores', vencedores: [], ultimo: null,
      // Super
      pontos: porCor(() => 0), usos: porCor(() => ({})), recorde: porCor(() => quatro(0)),
      vidas: porCor(() => quatro(0)), preso: porCor(() => quatro(null)), protegido: porCor(() => quatro(false)),
      buracos: [], efeito: null, poderTurno: null, retro: false, semExtra: false, anulado: false,
      anuncio: null, anuncios: 0,
      cargas: porCor(() => Object.fromEntries(PODERES_DEPOIS.map((k) => [k, USOS_DEPOIS]))), // usos restantes
      zonas: [],        // casas seguras temporárias: {casa, cor, rodadas}
      armado: null,     // poder de depois do dado escolhido, esperando o pino
      jogadas: 0,       // conta as jogadas (a TV usa para animar o que acabou de acontecer)
    };
  }

  const nomeDe = (S, c) => (S.lugares[c] && S.lugares[c].nome) || NOME[c];

  // ---------------- sala ----------------
  function definirHabilidades(S, c, lista) {
    if (S.fase !== 'sala' || !Array.isArray(lista) || lista.length !== 4) return false;
    if (!lista.every((h) => HABILIDADES[h])) return false;
    const especiais = lista.filter((h) => h !== 'normal');
    if (new Set(especiais).size !== especiais.length) return false;
    S.habil[c] = lista.slice();
    return true;
  }

  function iniciar(S) {
    const s = sentados(S);
    if (S.fase !== 'sala' || s.length < MIN_JOGADORES) return false;
    S.fase = 'jogo'; S.vez = s[0]; S.rolou = false; S.dado = null; S.opcoes = []; S.validas = [];
    if (!ehSuper(S)) CORES.forEach((c) => (S.habil[c] = quatro('normal')));
    S.msg = 'A partida começou! Vez de ' + nomeDe(S, S.vez) + '.';
    return true;
  }

  function reiniciar(S) {
    const N = novoEstado(S.modo, S.tempo);
    N.lugares = S.lugares;
    N.habil = S.habil;
    N.msg = 'Nova partida. Toque em Começar.';
    return N;
  }

  /** Casa segura: saídas, estrelas ou um Ponto de segurança ativo. */
  const seguro = (S, casa) => SEGURAS.has(casa) || (S.zonas || []).some((z) => z.casa === casa);

  // ---------------- movimento ----------------
  /** Pinos adversários com Laço que estão até 3 casas atrás deste pino: [{cor, i}]. */
  function lacosAtras(S, c, p) {
    const minha = casaDe(c, p), out = [];
    CORES.forEach((o) => {
      if (o === c || !S.lugares[o]) return;
      S.pos[o].forEach((q, j) => {
        const dist = (minha - casaDe(o, q) + 52) % 52;
        if (S.habil[o][j] === 'laco' && naTrilha(q) && S.preso[o][j] == null && dist >= 1 && dist <= 3) out.push({ cor: o, i: j });
      });
    });
    return out;
  }
  const temLacoAtras = (S, c, p) => lacosAtras(S, c, p).length > 0;

  function vizinhoDeBuraco(S, c, i, p) {
    const minha = casaDe(c, p);
    return S.buracos.some((b) => !(b.dono.cor === c && b.dono.i === i) &&
      (b.casa === (minha + 1) % 52 || b.casa === (minha + 51) % 52));
  }

  /** Quantas casas o pino anda com o dado d, depois de habilidades e efeitos. */
  function passosEfetivos(S, c, i, d) {
    if (!ehSuper(S)) return d;
    const h = S.habil[c][i], p = S.pos[c][i];
    let m = d;
    if (h === 'tanque') m = Math.ceil(m / 2);
    if (h === 'corredor') m += 2;
    if (h !== 'blindado' && naTrilha(p) && temLacoAtras(S, c, p)) m -= 2;
    if (h !== 'blindado' && naTrilha(p) && vizinhoDeBuraco(S, c, i, p)) m = Math.ceil(m / 2);
    return Math.max(1, m);
  }

  /** Lista as jogadas possíveis com o dado d. */
  function calcularOpcoes(S, c, d, retro) {
    const out = [];
    S.pos[c].forEach((p, i) => {
      if (p >= FIM) return;
      if (ehSuper(S) && S.preso[c][i] != null) {
        if (!retro) out.push({ i, tipo: 'carga', de: p, para: p, passos: 0 });
        return;
      }
      if (retro) {
        if (p >= 1 && p <= 50) out.push({ i, tipo: 'retro', de: p, para: Math.max(0, p - d), passos: -Math.min(d, p) });
        return;
      }
      if (p < 0) {
        const sai = d === 6 || (ehSuper(S) && S.habil[c][i] === 'ligeiro' && d === 5);
        if (sai) out.push({ i, tipo: 'sair', de: -1, para: 0, passos: 1 });
        return;
      }
      const m = passosEfetivos(S, c, i, d);
      if (p + m <= FIM) out.push({ i, tipo: 'andar', de: p, para: p + m, passos: m });
    });
    out.forEach((o) => etiquetar(S, c, o, d));
    return out;
  }

  /** Marca na opção o que a habilidade do pino vai fazer nesta jogada (para a TV e o celular mostrarem). */
  function etiquetar(S, c, o, d) {
    o.tags = [];
    if (!ehSuper(S)) return;
    const h = S.habil[c][o.i], p = o.de;
    if (o.tipo === 'andar') {
      if (h === 'corredor') o.tags.push('+2');
      if (h === 'tanque') o.tags.push('metade');
      if (h === 'banqueiro') o.tags.push('2× pts');
      if (h !== 'blindado' && naTrilha(p) && temLacoAtras(S, c, p)) o.tags.push('−2 laço');
      if (h !== 'blindado' && naTrilha(p) && vizinhoDeBuraco(S, c, o.i, p)) o.tags.push('metade buraco');
    }
    if (o.tipo === 'sair' && h === 'ligeiro' && d === 5) o.tags.push('sai com 5');
    if ((o.tipo === 'andar' || o.tipo === 'sair' || o.tipo === 'retro') && naTrilha(o.para) && h !== 'blindado') {
      const casa = casaDe(c, o.para);
      if (S.buracos.some((b) => b.casa === casa && !(b.dono.cor === c && b.dono.i === o.i))) o.perigo = 'buraco!';
    }
  }

  /** Para cada jogada possível, simula em uma cópia para saber quem seria capturado. */
  function marcarCapturas(S, c) {
    S.opcoes.forEach((o) => {
      const T = clonar(S);
      T.anuncio = null;
      const r = mover(T, c, o.i, true);
      o.captura = r ? r.capturados : [];
      o.vacuo = T.ultimo && T.ultimo.vacuo ? T.ultimo.vacuo.map((v) => ({ cor: v.cor, i: v.i, ganho: v.para - v.de })) : [];
    });
  }

  // ---------------- dado ----------------
  /** Gira o dado. d é o número sorteado (1..6) — quem chama faz o sorteio. */
  function rolar(S, c, d) {
    if (S.fase !== 'jogo' || S.vez !== c || S.rolou) return null;
    S.retro = false; S.semExtra = false; S.anulado = false; S.armado = null;
    let extraMsg = '';
    if (ehSuper(S) && S.efeito) {
      const e = S.efeito;
      if (e.tipo === 'cat') { const l = CATEGORIAS[e.cat]; d = l[(d - 1) % l.length]; extraMsg = ' (dado super: ' + NOME_CAT[e.cat] + ')'; }
      if (e.tipo === 'dedo') { d = e.n; S.semExtra = true; extraMsg = ' (dado a dedo)'; }
      if (e.tipo === 'retro') { S.retro = true; extraMsg = ' para trás'; }
      S.efeito = null;
    }
    S.dado = d; S.rolou = true; S.rolagem++;
    const quem = nomeDe(S, c);

    if (d === 6) S.seis++; else S.seis = 0;
    if (S.seis >= 3) {
      S.anulado = true; S.opcoes = []; S.validas = [];
      S.msg = quem + ' tirou o terceiro 6 seguido. Essa jogada foi anulada.';
      return d;
    }

    S.opcoes = calcularOpcoes(S, c, d, S.retro);
    S.validas = S.opcoes.map((o) => o.i);
    if (S.opcoes.length) marcarCapturas(S, c);
    const extras = poderesDepoisDisponiveis(S, c);
    S.msg = S.opcoes.length
      ? quem + ' tirou ' + d + extraMsg + '. Escolha um pino.'
      : quem + ' tirou ' + d + extraMsg + (extras.length ? ' e nenhum pino anda para frente. Dá para usar ' + extras.map((k) => PODERES[k].nome).join(' ou ') + ', ou passar a vez.' : ' e não tem jogada.');
    return d;
  }

  /** Depois de uma rolagem sem jogada (ou anulada), após uma pausa para todos verem. */
  function passarSemJogada(S) {
    if (S.fase !== 'jogo' || !S.rolou || S.opcoes.length) return;
    const c = S.vez;
    const denovo = !S.anulado && S.dado === 6 && !S.semExtra;
    S.rolou = false; S.retro = false; S.armado = null;
    if (denovo) S.msg = nomeDe(S, c) + ' tirou 6: joga de novo.';
    else { proximaVez(S); S.msg = 'Vez de ' + nomeDe(S, S.vez) + '.'; }
  }

  // ---------------- chegada numa casa ----------------
  function pinoBloqueado(S, o, casa) {
    return S.pos[o].filter((q) => naTrilha(q) && casaDe(o, q) === casa).length >= 2;
  }

  /** Coloca o pino na casa "para" e resolve tudo que acontece lá. */
  function aterrissar(S, c, i, de, para, paraFrente, podeCapturar) {
    const sup = ehSuper(S);
    const res = { capturados: [], salvos: [], chegou: para === FIM && de !== FIM, preso: false };
    S.pos[c][i] = para;

    if (sup) {
      if (de < 0 && para === 0) S.vidas[c][i] = S.habil[c][i] === 'tanque' ? 1 : 0;
      if (paraFrente && para >= 0) {
        const base = Math.max(S.recorde[c][i], de < 0 ? 0 : de);
        const ganho = Math.max(0, para - base);
        S.recorde[c][i] = Math.max(S.recorde[c][i], para);
        S.pontos[c] += ganho * (S.habil[c][i] === 'banqueiro' ? 2 : 1);
      }
      if (res.chegou) S.pontos[c] += PONTOS_CHEGADA;
    }
    if (!naTrilha(para)) return res;
    const casa = casaDe(c, para);

    if (podeCapturar && !seguro(S, casa)) {
      CORES.forEach((o) => {
        if (o === c) return;
        if (sup && pinoBloqueado(S, o, casa)) return;
        S.pos[o].forEach((q, j) => {
          if (!naTrilha(q) || casaDe(o, q) !== casa) return;
          if (sup && S.protegido[o][j]) return;
          if (sup && S.vidas[o][j] > 0) { S.vidas[o][j] = 0; res.salvos.push({ cor: o, i: j }); return; }
          S.pos[o][j] = -1;
          if (sup) {
            S.preso[o][j] = null;
            S.protegido[o][j] = false;
            if (S.habil[o][j] === 'vingativo') S.pontos[c] = Math.max(0, S.pontos[c] - MULTA_VINGATIVO);
            else S.pontos[c] += PONTOS_CAPTURA;
          }
          res.capturados.push({ cor: o, i: j });
        });
      });
    }

    if (sup && S.habil[c][i] !== 'blindado') {
      const b = S.buracos.find((x) => x.casa === casa);
      if (b && !(b.dono.cor === c && b.dono.i === i)) { S.preso[c][i] = 0; res.preso = true; }
    }
    return res;
  }

  /** Vácuo: pinos adversários com Vácuo logo atrás de quem andou ganham movimento de graça. */
  function aplicarVacuo(S, c, de, para, m) {
    const movidos = [];
    if (!ehSuper(S) || !naTrilha(de) || !naTrilha(para)) return movidos;
    const ganhoBase = Math.floor(m / 3);
    if (!ganhoBase) return movidos;
    const deCasa = casaDe(c, de), paraCasa = casaDe(c, para);
    CORES.forEach((o) => {
      if (o === c || !S.lugares[o]) return;
      S.pos[o].forEach((q, j) => {
        if (S.habil[o][j] !== 'vacuo' || !naTrilha(q) || S.preso[o][j] != null) return;
        const dist = (deCasa - casaDe(o, q) + 52) % 52;
        if (dist < 1 || dist > 6) return;
        const distNova = (paraCasa - casaDe(o, q) + 52) % 52;
        const g = Math.min(ganhoBase, distNova - 1); // nunca ultrapassa quem puxou o vácuo
        if (g <= 0 || q + g > FIM) return;
        aterrissar(S, o, j, q, q + g, true, false);
        movidos.push({ cor: o, i: j, de: q, para: q + g });
      });
    });
    return movidos;
  }

  function removerBuracoEm(S, casa) { S.buracos = S.buracos.filter((b) => b.casa !== casa); }

  // ---------------- jogada ----------------
  /** Move o pino i. Retorna {capturados, chegou, ...} ou null se não pode. */
  function mover(S, c, i, simulacao) {
    if (S.fase !== 'jogo' || S.vez !== c || !S.rolou) return null;
    const op = S.opcoes.find((o) => o.i === i);
    if (!op) return null;
    const d = S.dado, quem = nomeDe(S, c), num = ' com o pino ' + (i + 1);
    const armado = S.armado;

    // Proteção máxima: protege o pino e continua a jogada normal com o mesmo dado
    if (op.tipo === 'proteger') {
      gastarCarga(S, c, 'protecao');
      S.protegido[c][i] = true;
      S.armado = null; S.retro = false;
      S.opcoes = calcularOpcoes(S, c, d, false);
      S.validas = S.opcoes.map((o) => o.i);
      if (!simulacao && S.opcoes.length) marcarCapturas(S, c);
      S.msg = quem + ' usou Proteção máxima no pino ' + (i + 1) + '. ' + (S.opcoes.length ? 'Agora escolha o pino que vai andar.' : 'Nenhum pino anda com esse dado.');
      return { capturados: [], salvos: [], chegou: false, preso: false, protegeu: true };
    }

    let r = { capturados: [], salvos: [], chegou: false, preso: false }, msg = '', vacuo = [], libertou = false;
    const eventos = [];
    const lacos = ehSuper(S) && op.tipo === 'andar' && S.habil[c][i] !== 'blindado' && naTrilha(op.de) ? lacosAtras(S, c, op.de) : [];
    if (armado === 'retroceder' && op.tipo === 'retro') gastarCarga(S, c, 'retroceder');

    if (op.tipo === 'carga') {
      const nova = S.preso[c][i] + d;
      if (nova >= CARGA_BURACO) {
        S.preso[c][i] = null;
        removerBuracoEm(S, casaDe(c, S.pos[c][i]));
        libertou = true;
        const sobra = nova - CARGA_BURACO, p = S.pos[c][i];
        msg = quem + ' libertou o pino ' + (i + 1) + ' do buraco negro!';
        if (sobra > 0 && p + sobra <= FIM) r = aterrissar(S, c, i, p, p + sobra, true, true);
      } else {
        S.preso[c][i] = nova;
        msg = quem + ' juntou ' + nova + '/' + CARGA_BURACO + ' para sair do buraco negro.';
      }
    } else if (op.tipo === 'retro') {
      r = aterrissar(S, c, i, op.de, op.para, false, true);
      msg = quem + ' voltou ' + (op.de - op.para) + ' casas' + num + '.';
    } else {
      r = aterrissar(S, c, i, op.de, op.para, true, true);
      msg = quem + (op.tipo === 'sair' ? ' saiu da base' + num + '.' : ' andou ' + op.passos + num + '.');
      if (op.tipo === 'andar') vacuo = aplicarVacuo(S, c, op.de, op.para, op.passos);
    }

    // Ponto de segurança: a casa onde o pino parou vira segura por 2 rodadas do dono
    if (armado === 'seguranca' && (op.tipo === 'andar' || op.tipo === 'sair')) {
      gastarCarga(S, c, 'seguranca');
      const p = S.pos[c][i];
      if (naTrilha(p) && !r.preso) {
        const casa = casaDe(c, p);
        S.zonas = S.zonas.filter((z) => z.casa !== casa);
        S.zonas.push({ casa, cor: c, rodadas: RODADAS_ZONA });
        eventos.push({ tipo: 'zona', cor: c, i, txt: quem + ' criou um Ponto de segurança' });
      }
    }
    S.armado = null;

    // o que as habilidades fizeram (a TV mostra um aviso no topo)
    if (ehSuper(S)) {
      const h = S.habil[c][i];
      if (op.tipo === 'andar' && h === 'corredor') eventos.push({ tipo: 'corredor', cor: c, i, txt: 'Corredor de ' + quem + ' andou +2' });
      if (op.tipo === 'sair' && h === 'ligeiro' && d === 5) eventos.push({ tipo: 'ligeiro', cor: c, i, txt: 'Ligeiro de ' + quem + ' saiu com 5' });
      lacos.forEach((l) => eventos.push({ tipo: 'laco', cor: l.cor, i: l.i, alvo: { cor: c, i }, txt: 'Laço de ' + nomeDe(S, l.cor) + ' segurou ' + quem + ' (−2)' }));
      vacuo.forEach((v) => eventos.push({ tipo: 'vacuo', cor: v.cor, i: v.i, txt: 'Vácuo de ' + nomeDe(S, v.cor) + ' pegou carona +' + (v.para - v.de) }));
      r.salvos.forEach((s) => eventos.push({ tipo: 'tanque', cor: s.cor, i: s.i, txt: 'O Tanque de ' + nomeDe(S, s.cor) + ' aguentou!' }));
      r.capturados.forEach((x) => { if (S.habil[x.cor][x.i] === 'vingativo') eventos.push({ tipo: 'vingativo', cor: x.cor, i: x.i, txt: 'Vingativo! ' + quem + ' perdeu ' + MULTA_VINGATIVO + ' pontos' }); });
      if (r.preso) eventos.push({ tipo: 'buraco', cor: c, i, txt: quem + ' caiu no buraco negro!' });
      if (libertou) eventos.push({ tipo: 'libertou', cor: c, i, txt: quem + ' saiu do buraco negro!' });
    }

    if (r.capturados.length) msg = quem + ' capturou ' + r.capturados.map((x) => nomeDe(S, x.cor)).join(' e ') + '!';
    if (r.salvos.length) msg += ' O Tanque de ' + nomeDe(S, r.salvos[0].cor) + ' aguentou!';
    if (r.preso) msg = quem + ' caiu no buraco negro!';
    if (r.chegou) msg = 'O pino ' + (i + 1) + ' de ' + quem + ' chegou!';
    if (vacuo.length) msg += ' Vácuo de ' + nomeDe(S, vacuo[0].cor) + '!';
    if (S.pos[c].every((q) => q === FIM) && !S.vencedores.includes(c)) {
      S.vencedores.push(c);
      msg = quem + ' terminou em ' + S.vencedores.length + 'º lugar!';
    }

    S.rolou = false; S.opcoes = []; S.validas = []; S.retro = false;
    S.ultimo = { cor: c, i, de: op.de, para: S.pos[c][i], tipo: op.tipo, capturados: r.capturados, vacuo, libertou, preso: r.preso, eventos, poder: armado, n: ++S.jogadas };
    if (simulacao) return r;

    const restam = sentados(S).filter((x) => !S.vencedores.includes(x));
    if (restam.length <= 1) {
      restam.forEach((x) => S.vencedores.push(x));
      S.fase = 'fim'; S.vez = null;
      S.msg = 'Fim de jogo! ' + nomeDe(S, S.vencedores[0]) + ' venceu.';
      return r;
    }

    const denovo = ((d === 6 && !S.semExtra) || r.capturados.length > 0 || r.chegou) && !S.vencedores.includes(c);
    if (denovo) msg += ' Joga de novo.';
    else proximaVez(S);
    S.msg = msg;
    return r;
  }

  function proximaVez(S) {
    S.seis = 0; S.poderTurno = null; S.efeito = null; S.retro = false; S.semExtra = false; S.anulado = false; S.armado = null;
    const k = CORES.indexOf(S.vez);
    for (let n = 1; n <= 4; n++) {
      const c = CORES[(k + n) % 4];
      if (S.lugares[c] && !S.vencedores.includes(c)) { S.vez = c; comecarVez(S, c); return; }
    }
  }

  /** Começo da vez do dono: a Proteção acaba e os Pontos de segurança dele perdem uma rodada. */
  function comecarVez(S, c) {
    if (!ehSuper(S)) return;
    S.protegido[c] = quatro(false);
    S.zonas.forEach((z) => { if (z.cor === c) z.rodadas--; });
    S.zonas = S.zonas.filter((z) => z.rodadas > 0);
  }

  // ---------------- poderes ----------------
  const preco = (S, c, poder) => PODERES[poder].preco * Math.pow(2, S.usos[c][poder] || 0);
  function gastarCarga(S, c, poder) {
    S.cargas[c][poder] = Math.max(0, (S.cargas[c][poder] || 0) - 1);
    S.usos[c][poder] = (S.usos[c][poder] || 0) + 1;
    S.poderTurno = poder;
    S.anuncio = { cor: c, poder, n: ++S.anuncios };
  }

  /** Opções de jogada de um poder de depois do dado. */
  function opcoesDepois(S, c, poder) {
    const d = S.dado;
    if (poder === 'retroceder') return calcularOpcoes(S, c, d, true).filter((o) => o.tipo === 'retro');
    if (poder === 'protecao') {
      return S.pos[c].map((p, i) => ({ i, tipo: 'proteger', de: p, para: p, passos: 0, tags: [] }))
        .filter((o) => naTrilha(o.de) && !S.protegido[c][o.i] && S.preso[c][o.i] == null);
    }
    if (poder === 'seguranca') return calcularOpcoes(S, c, d, false).filter((o) => (o.tipo === 'andar' || o.tipo === 'sair') && naTrilha(o.para));
    return [];
  }

  /** Quais poderes de depois do dado dá para usar agora. */
  function poderesDepoisDisponiveis(S, c) {
    return PODERES_DEPOIS.filter((k) => podeUsar(S, c, k));
  }

  /** Escolhe (ou cancela, se tocar de novo) um poder de depois do dado. */
  function armar(S, c, poder) {
    if (S.armado === poder) return desarmar(S, c);
    if (!podeUsar(S, c, poder)) return false;
    S.armado = poder;
    S.retro = poder === 'retroceder';
    S.opcoes = opcoesDepois(S, c, poder);
    S.validas = S.opcoes.map((o) => o.i);
    marcarCapturas(S, c);
    const P = PODERES[poder];
    S.msg = nomeDe(S, c) + ' escolheu ' + P.nome + ': toque no pino.';
    return true;
  }
  function desarmar(S, c) {
    if (S.fase !== 'jogo' || S.vez !== c || !S.rolou || !S.armado) return false;
    S.armado = null; S.retro = false;
    S.opcoes = calcularOpcoes(S, c, S.dado, false);
    S.validas = S.opcoes.map((o) => o.i);
    if (S.opcoes.length) marcarCapturas(S, c);
    S.msg = nomeDe(S, c) + ' tirou ' + S.dado + '. Escolha um pino.';
    return true;
  }

  /** Passar a vez quando nenhum pino anda para frente (mesmo podendo usar um poder). */
  function passar(S, c) {
    if (S.fase !== 'jogo' || S.vez !== c || !S.rolou) return false;
    if (!S.anulado && calcularOpcoes(S, c, S.dado, false).length) return false;
    S.armado = null; S.retro = false; S.opcoes = []; S.validas = [];
    passarSemJogada(S);
    return true;
  }

  /** Casa segura mais próxima atrás do pino (em progresso), ou null. */
  function seguraAtras(c, p) {
    for (let k = p - 1; k >= 0; k--) if (SEGURAS.has(casaDe(c, k))) return k;
    return null;
  }

  /** Se o poder pode ser usado agora neste pino (i pode ser undefined para poderes sem alvo). */
  function podeUsar(S, c, poder, args) {
    const P = PODERES[poder];
    if (!P || !ehSuper(S) || S.fase !== 'jogo' || S.vez !== c || S.poderTurno) return false;
    args = args || {};
    const i = args.i;
    if (P.depois) {
      if (!S.rolou || S.anulado || (S.cargas[c][poder] || 0) <= 0) return false;
      const ops = opcoesDepois(S, c, poder);
      return Number.isInteger(i) ? ops.some((o) => o.i === i) : ops.length > 0;
    }
    if (S.rolou) return false;
    if (S.pontos[c] < preco(S, c, poder)) return false;
    const p = Number.isInteger(i) ? S.pos[c][i] : undefined;
    const preso = Number.isInteger(i) && S.preso[c][i] != null;
    switch (poder) {
      case 'fuga': return Number.isInteger(i) ? p < 0 : S.pos[c].some((q) => q < 0);
      case 'buraco': {
        if (S.buracos.some((b) => b.cor === c)) return false;
        const ok = (q, j) => naTrilha(q) && S.preso[c][j] == null && !seguro(S, casaDe(c, q)) && !S.buracos.some((b) => b.casa === casaDe(c, q));
        if (!Number.isInteger(i)) return S.pos[c].some(ok);
        return ok(p, i) && !preso;
      }
      case 'dadoSuper': return args.cat === undefined || !!CATEGORIAS[args.cat];
      case 'dedo': return args.n === undefined || (Number.isInteger(args.n) && args.n >= 1 && args.n <= 6);
      default: return false;
    }
  }

  /** Usa um poder. Retorna true se deu certo. (Os de depois do dado só ficam escolhidos: o efeito vem ao tocar no pino.) */
  function usarPoder(S, c, poder, args) {
    if (PODERES[poder] && PODERES[poder].depois) return armar(S, c, poder);
    args = args || {};
    const precisaPino = ['fuga', 'buraco'].includes(poder);
    if (precisaPino && !Number.isInteger(args.i)) return false;
    if (poder === 'dadoSuper' && !CATEGORIAS[args.cat]) return false;
    if (poder === 'dedo' && !(Number.isInteger(args.n) && args.n >= 1 && args.n <= 6)) return false;
    if (!podeUsar(S, c, poder, args)) return false;

    S.pontos[c] -= preco(S, c, poder);
    S.usos[c][poder] = (S.usos[c][poder] || 0) + 1;
    S.poderTurno = poder;
    const quem = nomeDe(S, c), i = args.i;
    S.anuncio = { cor: c, poder, n: ++S.anuncios };
    let msg = quem + ' usou ' + PODERES[poder].nome + '!';

    switch (poder) {
      case 'fuga': {
        const r = aterrissar(S, c, i, -1, 0, true, true);
        S.ultimo = { cor: c, i, de: -1, para: 0, tipo: 'sair', capturados: r.capturados, vacuo: [], libertou: false, preso: false, eventos: [], poder, n: ++S.jogadas };
        proximaVez(S);
        msg += ' Agora é a vez de ' + nomeDe(S, S.vez) + '.';
        break;
      }
      case 'buraco': S.buracos.push({ cor: c, casa: casaDe(c, S.pos[c][i]), dono: { cor: c, i } }); break;
      case 'dadoSuper': S.efeito = { tipo: 'cat', cat: args.cat }; msg += ' O dado vai cair ' + NOME_CAT[args.cat] + '.'; break;
      case 'dedo': S.efeito = { tipo: 'dedo', n: args.n }; msg += ' Escolheu o ' + args.n + '.'; break;
    }
    S.msg = msg;
    return true;
  }
  // ---------------- jogada automática (tempo esgotado) ----------------
  /** Escolhe o pino que está mais à frente entre os que podem jogar. */
  function escolhaAutomatica(S) {
    if (!S.opcoes.length) return null;
    return S.opcoes.reduce((a, b) => (b.de > a.de ? b : a)).i;
  }

  return {
    CORES, NOME, HEX, SUAVE, INICIO, SEGURAS, TRILHA, RETA, BASE, VAGAS, FIM, MIN_JOGADORES, TEMPOS,
    PODERES, HABILIDADES, CATEGORIAS, NOME_CAT, CARGA_BURACO,
    onde, descrever, novoEstado, sentados, nomeDe, definirHabilidades, iniciar, reiniciar,
    passosEfetivos, calcularOpcoes, rolar, passarSemJogada, mover, proximaVez,
    preco, podeUsar, usarPoder, escolhaAutomatica, casaDe, naTrilha,
    USOS_DEPOIS, RODADAS_ZONA, PODERES_DEPOIS, seguro, armar, desarmar, passar, poderesDepoisDisponiveis, opcoesDepois, comecarVez,
  };
})();

if (typeof module !== 'undefined') module.exports = Ludo;
