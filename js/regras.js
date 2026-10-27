/* =====================================================================
   regras.js — as regras do Ludo, sem nada de tela nem de rede.
   Tudo aqui é "função pura" sobre o objeto de estado (S), então dá
   para testar sozinho (veja testes/regras.test.js).
   ===================================================================== */
const Ludo = (() => {
  const CORES = ['red', 'green', 'yellow', 'blue']; // ordem dos turnos (sentido horário)
  const NOME = { red: 'Vermelho', green: 'Verde', yellow: 'Amarelo', blue: 'Azul' };
  const HEX = { red: '#e2483d', green: '#2fa65a', yellow: '#f2c230', blue: '#2f7fe0' };
  const SUAVE = { red: '#f6c7c2', green: '#bfe6cb', yellow: '#fbe8a8', blue: '#c2dbf8' };

  // Casa da trilha onde cada cor entra quando sai da base
  const INICIO = { red: 0, green: 13, yellow: 26, blue: 39 };
  // Casas seguras: saídas + estrelas (ninguém é capturado nelas)
  const SEGURAS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const MIN_JOGADORES = 2;

  // Progresso de um pino: -1 = base | 0..50 = trilha | 51..55 = reta final | 56 = chegou
  const FIM = 56;

  // As 52 casas da trilha em coordenadas [coluna, linha] de uma grade 15x15
  const TRILHA = [];
  const add = (lista) => lista.forEach((p) => TRILHA.push(p));
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

  /** Onde desenhar o pino i da cor c no progresso p. Retorna [x, y, chave-da-casa]. */
  function onde(c, p, i) {
    if (p < 0) { const o = BASE[c]; return [o[0] + VAGAS[i][0], o[1] + VAGAS[i][1], 'b' + c + i]; }
    if (p <= 50) { const t = TRILHA[(INICIO[c] + p) % 52]; return [t[0] + 0.5, t[1] + 0.5, 't' + t]; }
    if (p < FIM) { const h = RETA[c][p - 51]; return [h[0] + 0.5, h[1] + 0.5, 'r' + h]; }
    return [CHEGADA[c][0], CHEGADA[c][1], 'f' + c];
  }

  function descrever(p) {
    if (p < 0) return 'Na base';
    if (p >= FIM) return 'Chegou!';
    if (p > 50) return 'Reta final ' + (p - 50) + '/5';
    return 'Casa ' + (p + 1);
  }

  function novoEstado() {
    return {
      fase: 'sala', // sala | jogo | fim
      lugares: { red: null, green: null, yellow: null, blue: null }, // {id, tipo:'celular'|'local', ausente}
      pos: { red: [-1, -1, -1, -1], green: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1], blue: [-1, -1, -1, -1] },
      vez: null, dado: null, rolou: false, validas: [], rolagem: 0,
      msg: 'Esperando jogadores', vencedores: [], ultimo: null,
    };
  }

  const sentados = (S) => CORES.filter((c) => S.lugares[c]);

  function jogadasValidas(S, c, d) {
    const out = [];
    S.pos[c].forEach((p, i) => {
      if (p >= FIM) return;
      if (p < 0) { if (d === 6) out.push(i); }
      else if (p + d <= FIM) out.push(i);
    });
    return out;
  }

  function iniciar(S) {
    const s = sentados(S);
    if (S.fase !== 'sala' || s.length < MIN_JOGADORES) return false;
    S.fase = 'jogo'; S.vez = s[0]; S.rolou = false; S.dado = null; S.validas = [];
    S.msg = 'A partida começou! Vez do ' + NOME[S.vez] + '.';
    return true;
  }

  /** Rola o dado. Retorna o valor, ou null se não era hora. */
  function rolar(S, c, d) {
    if (S.fase !== 'jogo' || S.vez !== c || S.rolou) return null;
    S.dado = d; S.rolou = true; S.rolagem++;
    S.validas = jogadasValidas(S, c, d);
    S.msg = S.validas.length
      ? NOME[c] + ' tirou ' + d + '. Escolha um pino.'
      : NOME[c] + ' tirou ' + d + ' e não tem jogada.';
    return d;
  }

  /** Chamado depois de uma rolagem sem jogada possível (após uma pausa para todos verem). */
  function passarSemJogada(S) {
    if (S.fase !== 'jogo' || !S.rolou || S.validas.length) return;
    const c = S.vez;
    S.rolou = false;
    if (S.dado === 6) S.msg = NOME[c] + ' tirou 6: joga de novo.';
    else { proximaVez(S); S.msg = 'Vez do ' + NOME[S.vez] + '.'; }
  }

  /** Move o pino i da cor c. Retorna {de, para, capturados} ou null se não pode. */
  function mover(S, c, i) {
    if (S.fase !== 'jogo' || S.vez !== c || !S.rolou || !S.validas.includes(i)) return null;
    const d = S.dado, de = S.pos[c][i], para = de < 0 ? 0 : de + d;
    S.pos[c][i] = para;

    const capturados = [];
    if (para <= 50) {
      const casa = (INICIO[c] + para) % 52;
      if (!SEGURAS.has(casa)) {
        CORES.forEach((o) => {
          if (o === c) return;
          S.pos[o].forEach((q, j) => {
            if (q >= 0 && q <= 50 && (INICIO[o] + q) % 52 === casa) { S.pos[o][j] = -1; capturados.push({ cor: o, i: j }); }
          });
        });
      }
    }

    const chegou = para === FIM;
    let msg = NOME[c] + (de < 0 ? ' saiu da base com o pino ' + (i + 1) + '.' : ' andou ' + d + ' com o pino ' + (i + 1) + '.');
    if (capturados.length) msg = NOME[c] + ' capturou o ' + NOME[capturados[0].cor] + '!';
    if (chegou) msg = 'O pino ' + (i + 1) + ' do ' + NOME[c] + ' chegou!';
    if (S.pos[c].every((q) => q === FIM) && !S.vencedores.includes(c)) {
      S.vencedores.push(c);
      msg = NOME[c] + ' terminou em ' + S.vencedores.length + 'º lugar!';
    }

    S.rolou = false; S.validas = []; S.ultimo = { cor: c, i, de, para };

    const restam = sentados(S).filter((x) => !S.vencedores.includes(x));
    if (restam.length <= 1) {
      restam.forEach((x) => S.vencedores.push(x));
      S.fase = 'fim'; S.vez = null;
      S.msg = 'Fim de jogo! ' + NOME[S.vencedores[0]] + ' venceu.';
      return { de, para, capturados };
    }

    const denovo = (d === 6 || capturados.length > 0 || chegou) && !S.vencedores.includes(c);
    if (denovo) msg += ' Joga de novo.';
    else proximaVez(S);
    S.msg = msg;
    return { de, para, capturados };
  }

  function proximaVez(S) {
    const k = CORES.indexOf(S.vez);
    for (let n = 1; n <= 4; n++) {
      const c = CORES[(k + n) % 4];
      if (S.lugares[c] && !S.vencedores.includes(c)) { S.vez = c; return; }
    }
  }

  /** Volta para a sala mantendo quem está sentado. */
  function reiniciar(S) {
    const lugares = S.lugares;
    const N = novoEstado();
    N.lugares = lugares;
    N.msg = 'Nova partida. Toque em Começar.';
    return N;
  }

  return {
    CORES, NOME, HEX, SUAVE, INICIO, SEGURAS, TRILHA, RETA, BASE, VAGAS, FIM, MIN_JOGADORES,
    onde, descrever, novoEstado, sentados, jogadasValidas, iniciar, rolar, passarSemJogada, mover, proximaVez, reiniciar,
  };
})();

if (typeof module !== 'undefined') module.exports = Ludo;
