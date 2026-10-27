// Testes das regras. Rode com:  node testes/regras.test.js
const L = require('../js/regras.js');
let ok = 0, falhas = 0;
function teste(nome, fn) {
  try { fn(); ok++; console.log('  ✓ ' + nome); }
  catch (e) { falhas++; console.log('  ✗ ' + nome + '\n     ' + e.message); }
}
function igual(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a)); }
function mesa(...cores) { const S = L.novoEstado(); cores.forEach((c) => (S.lugares[c] = { id: c, tipo: 'local' })); return S; }

console.log('Regras do Ludo');

teste('trilha tem 52 casas, todas diferentes', () => {
  igual(L.TRILHA.length, 52);
  igual(new Set(L.TRILHA.map(String)).size, 52);
});

teste('casas de saída são as coloridas certas', () => {
  igual(L.TRILHA[L.INICIO.red], [1, 6]); igual(L.TRILHA[L.INICIO.green], [8, 1]);
  igual(L.TRILHA[L.INICIO.yellow], [13, 8]); igual(L.TRILHA[L.INICIO.blue], [6, 13]);
});

teste('a última casa de cada cor fica ao lado da sua reta final', () => {
  L.CORES.forEach((c) => {
    const ult = L.TRILHA[(L.INICIO[c] + 50) % 52], r = L.RETA[c][0];
    igual(Math.abs(ult[0] - r[0]) + Math.abs(ult[1] - r[1]), 1, c);
  });
});

teste('não começa com só 1 jogador', () => {
  const S = mesa('red'); igual(L.iniciar(S), false); igual(S.fase, 'sala');
});

teste('começa com 2 jogadores, vez do primeiro na ordem', () => {
  const S = mesa('yellow', 'green'); igual(L.iniciar(S), true); igual(S.vez, 'green');
});

teste('só sai da base com 6', () => {
  const S = mesa('red', 'blue'); L.iniciar(S);
  L.rolar(S, 'red', 3); igual(S.validas, []);
  L.passarSemJogada(S); igual(S.vez, 'blue');
  L.rolar(S, 'blue', 6); igual(S.validas, [0, 1, 2, 3]);
  L.mover(S, 'blue', 2); igual(S.pos.blue[2], 0); igual(S.vez, 'blue', '6 dá jogada extra:');
});

teste('fora da vez não rola', () => {
  const S = mesa('red', 'blue'); L.iniciar(S);
  igual(L.rolar(S, 'blue', 6), null);
});

teste('captura manda o adversário para a base e dá jogada extra', () => {
  const S = mesa('red', 'green'); L.iniciar(S);
  S.pos.red[0] = 15;          // casa absoluta 15
  S.pos.green[1] = 4;         // 13+4 = 17
  L.rolar(S, 'red', 2);
  const r = L.mover(S, 'red', 0);
  igual(r.capturados, [{ cor: 'green', i: 1 }]); igual(S.pos.green[1], -1); igual(S.vez, 'red');
});

teste('casa segura (estrela) protege', () => {
  const S = mesa('red', 'green'); L.iniciar(S);
  S.pos.red[0] = 5;           // vai para 8 (estrela)
  S.pos.green[0] = 47;        // (13+47)%52 = 8
  L.rolar(S, 'red', 3); L.mover(S, 'red', 0);
  igual(S.pos.green[0], 47);
});

teste('precisa do número exato para chegar', () => {
  const S = mesa('red', 'green'); L.iniciar(S);
  S.pos.red = [54, 56, 56, 56];
  L.rolar(S, 'red', 3); igual(S.validas, []);
  L.passarSemJogada(S); igual(S.vez, 'green');
});

teste('quem leva os 4 pinos vence e a partida acaba com 2 jogadores', () => {
  const S = mesa('red', 'green'); L.iniciar(S);
  S.pos.red = [54, 56, 56, 56];
  L.rolar(S, 'red', 2); L.mover(S, 'red', 0);
  igual(S.fase, 'fim'); igual(S.vencedores, ['red', 'green']);
});

teste('com 3 jogadores, o jogo continua depois do 1º lugar', () => {
  const S = mesa('red', 'green', 'blue'); L.iniciar(S);
  S.pos.red = [54, 56, 56, 56];
  L.rolar(S, 'red', 2); L.mover(S, 'red', 0);
  igual(S.fase, 'jogo'); igual(S.vez, 'green');
});

teste('partida aleatória inteira termina sem erro', () => {
  for (let k = 0; k < 200; k++) {
    const S = mesa('red', 'green', 'yellow', 'blue'); L.iniciar(S);
    let passos = 0;
    while (S.fase === 'jogo' && passos++ < 5000) {
      L.rolar(S, S.vez, 1 + Math.floor(Math.random() * 6));
      if (S.validas.length) L.mover(S, S.vez, S.validas[Math.floor(Math.random() * S.validas.length)]);
      else L.passarSemJogada(S);
    }
    igual(S.fase, 'fim'); igual(S.vencedores.length, 4);
  }
});

console.log(`\n${ok} passaram, ${falhas} falharam`);
process.exitCode = falhas ? 1 : 0;
