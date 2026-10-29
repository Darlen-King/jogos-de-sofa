// Testes das regras. Rode com:  node ludo/testes/regras.test.js
const L = require('../js/regras.js');
let ok = 0, falhas = 0, grupo = '';
function secao(n) { grupo = n; console.log('\n' + n); }
function teste(nome, fn) {
  try { fn(); ok++; console.log('  ✓ ' + nome); }
  catch (e) { falhas++; console.log('  ✗ ' + nome + '\n     ' + e.message); }
}
function igual(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a)); }
function mesa(modo, ...cores) { const S = L.novoEstado(modo); cores.forEach((c) => (S.lugares[c] = { id: c, tipo: 'local', nome: c })); return S; }
function jogo(modo, ...cores) { const S = mesa(modo, ...cores); L.iniciar(S); return S; }
const op = (S, i) => S.opcoes.find((o) => o.i === i);

// ===================================================================
secao('Tabuleiro');
teste('trilha tem 52 casas, todas diferentes', () => { igual(L.TRILHA.length, 52); igual(new Set(L.TRILHA.map(String)).size, 52); });
teste('casas de saída certas', () => {
  igual(L.TRILHA[L.INICIO.red], [1, 6]); igual(L.TRILHA[L.INICIO.green], [8, 1]);
  igual(L.TRILHA[L.INICIO.yellow], [13, 8]); igual(L.TRILHA[L.INICIO.blue], [6, 13]);
});
teste('última casa de cada cor fica ao lado da reta final', () => {
  L.CORES.forEach((c) => { const u = L.TRILHA[(L.INICIO[c] + 50) % 52], r = L.RETA[c][0]; igual(Math.abs(u[0] - r[0]) + Math.abs(u[1] - r[1]), 1, c); });
});

// ===================================================================
secao('Clássico');
teste('não começa com 1 jogador', () => { const S = mesa('classico', 'red'); igual(L.iniciar(S), false); });
teste('começa com 2, vez do primeiro na ordem', () => { const S = mesa('classico', 'yellow', 'green'); L.iniciar(S); igual(S.vez, 'green'); });
teste('só sai da base com 6, e 6 dá jogada extra', () => {
  const S = jogo('classico', 'red', 'blue');
  L.rolar(S, 'red', 3); igual(S.validas, []); L.passarSemJogada(S); igual(S.vez, 'blue');
  L.rolar(S, 'blue', 6); igual(S.validas, [0, 1, 2, 3]); L.mover(S, 'blue', 2); igual(S.pos.blue[2], 0); igual(S.vez, 'blue');
});
teste('fora da vez não rola', () => { const S = jogo('classico', 'red', 'blue'); igual(L.rolar(S, 'blue', 6), null); });
teste('captura manda para a base e dá jogada extra', () => {
  const S = jogo('classico', 'red', 'green'); S.pos.red[0] = 15; S.pos.green[1] = 4;
  L.rolar(S, 'red', 2); const r = L.mover(S, 'red', 0);
  igual(r.capturados, [{ cor: 'green', i: 1 }]); igual(S.pos.green[1], -1); igual(S.vez, 'red');
});
teste('estrela protege', () => {
  const S = jogo('classico', 'red', 'green'); S.pos.red[0] = 5; S.pos.green[0] = 47;
  L.rolar(S, 'red', 3); L.mover(S, 'red', 0); igual(S.pos.green[0], 47);
});
teste('no Clássico, dois pinos juntos NÃO protegem', () => {
  const S = jogo('classico', 'red', 'green'); S.pos.red[0] = 15; S.pos.green[0] = 4; S.pos.green[1] = 4;
  L.rolar(S, 'red', 2); L.mover(S, 'red', 0); igual(S.pos.green.slice(0, 2), [-1, -1]);
});
teste('precisa do número exato para chegar', () => {
  const S = jogo('classico', 'red', 'green'); S.pos.red = [54, 56, 56, 56];
  L.rolar(S, 'red', 3); igual(S.validas, []); L.passarSemJogada(S); igual(S.vez, 'green');
});
teste('vitória com 2 jogadores encerra', () => {
  const S = jogo('classico', 'red', 'green'); S.pos.red = [54, 56, 56, 56];
  L.rolar(S, 'red', 2); L.mover(S, 'red', 0); igual(S.fase, 'fim'); igual(S.vencedores, ['red', 'green']);
});
teste('com 3 jogadores continua depois do 1º lugar', () => {
  const S = jogo('classico', 'red', 'green', 'blue'); S.pos.red = [54, 56, 56, 56];
  L.rolar(S, 'red', 2); L.mover(S, 'red', 0); igual(S.fase, 'jogo'); igual(S.vez, 'green');
});
teste('três 6 seguidos: o terceiro é anulado e a vez passa', () => {
  const S = jogo('classico', 'red', 'green');
  L.rolar(S, 'red', 6); L.mover(S, 'red', 0); igual(S.pos.red[0], 0);
  L.rolar(S, 'red', 6); L.mover(S, 'red', 0); igual(S.pos.red[0], 6);
  L.rolar(S, 'red', 6); igual(S.anulado, true); igual(S.validas, []);
  L.passarSemJogada(S); igual(S.vez, 'green'); igual(S.pos.red[0], 6, 'só os dois primeiros 6 valem');
});
teste('um número diferente de 6 zera a contagem', () => {
  const S = jogo('classico', 'red', 'green'); S.pos.red[0] = 10; S.pos.green[0] = 30;
  L.rolar(S, 'red', 6); L.mover(S, 'red', 0); igual(S.seis, 1);
  L.rolar(S, 'red', 6); L.mover(S, 'red', 0); igual(S.seis, 2);
  L.rolar(S, 'red', 2); igual(S.seis, 0);
});
teste('dica de captura aparece na opção certa', () => {
  const S = jogo('classico', 'red', 'green'); S.pos.red[0] = 15; S.pos.red[1] = 20; S.pos.green[1] = 4;
  L.rolar(S, 'red', 2);
  igual(op(S, 0).captura, [{ cor: 'green', i: 1 }]); igual(op(S, 1).captura, []);
  igual(S.pos.green[1], 4, 'simulação não mexe no estado real');
});
teste('jogada automática escolhe o pino mais à frente', () => {
  const S = jogo('classico', 'red', 'green'); S.pos.red = [3, 20, 10, -1];
  L.rolar(S, 'red', 2); igual(L.escolhaAutomatica(S), 1);
});

// ===================================================================
secao('Super — pontos');
teste('+1 por casa andada', () => {
  const S = jogo('super', 'red', 'green'); S.pos.red[0] = 10; S.recorde.red[0] = 10;
  L.rolar(S, 'red', 4); L.mover(S, 'red', 0); igual(S.pontos.red, 4);
});
teste('+10 por captura, +50 por chegar', () => {
  const S = jogo('super', 'red', 'green'); S.pos.red[0] = 15; S.recorde.red[0] = 15; S.pos.green[1] = 4;
  L.rolar(S, 'red', 2); L.mover(S, 'red', 0); igual(S.pontos.red, 12);
  S.pos.red[1] = 53; S.recorde.red[1] = 53; S.vez = 'red';
  L.rolar(S, 'red', 3); L.mover(S, 'red', 1); igual(S.pontos.red, 12 + 3 + 50);
});
teste('não ganha pontos de novo andando por casas já percorridas', () => {
  const S = jogo('super', 'red', 'green'); S.pos.red[0] = 10; S.recorde.red[0] = 20;
  L.rolar(S, 'red', 5); L.mover(S, 'red', 0); igual(S.pontos.red, 0);
  S.vez = 'red'; L.rolar(S, 'red', 6); L.mover(S, 'red', 0); igual(S.pontos.red, 1); // 15 -> 21
});
teste('Banqueiro ganha em dobro andando', () => {
  const S = mesa('super', 'red', 'green'); L.definirHabilidades(S, 'red', ['banqueiro', 'normal', 'normal', 'normal']); L.iniciar(S);
  S.pos.red[0] = 10; S.recorde.red[0] = 10; L.rolar(S, 'red', 4); L.mover(S, 'red', 0); igual(S.pontos.red, 8);
});

// ===================================================================
secao('Super — bloqueio');
teste('dois pinos da mesma cor juntos não são capturados', () => {
  const S = jogo('super', 'red', 'green'); S.pos.red[0] = 15; S.pos.green[0] = 4; S.pos.green[1] = 4;
  L.rolar(S, 'red', 2); L.mover(S, 'red', 0);
  igual(S.pos.green.slice(0, 2), [4, 4]); igual(S.pos.red[0], 17, 'adversário pode parar na mesma casa');
});

// ===================================================================
secao('Super — poderes');
function superCom(pontos) { const S = jogo('super', 'red', 'green'); S.pontos.red = pontos; return S; }
teste('preço dobra a cada uso, separado por poder', () => {
  const S = superCom(1000);
  igual(L.preco(S, 'red', 'dadoSuper'), 15); L.usarPoder(S, 'red', 'dadoSuper', { cat: 'par' });
  igual(L.preco(S, 'red', 'dadoSuper'), 30); igual(L.preco(S, 'red', 'dedo'), 40); igual(S.pontos.red, 985);
});
teste('só 1 poder por turno, inclusive na jogada extra', () => {
  const S = superCom(1000);
  igual(L.usarPoder(S, 'red', 'dedo', { n: 5 }), true);
  igual(L.usarPoder(S, 'red', 'dadoSuper', { cat: 'par' }), false);
  const S2 = superCom(1000); S2.pos.red[0] = 10;
  L.usarPoder(S2, 'red', 'dadoSuper', { cat: 'alto' }); L.rolar(S2, 'red', 3); igual(S2.dado, 6);
  L.mover(S2, 'red', 0); igual(S2.vez, 'red', 'joga de novo'); igual(L.usarPoder(S2, 'red', 'dedo', { n: 3 }), false);
});
teste('sem pontos suficientes não usa', () => { const S = superCom(5); igual(L.usarPoder(S, 'red', 'fuga', { i: 0 }), false); });
teste('Dado super: cai só na categoria', () => {
  for (let d = 1; d <= 6; d++) {
    for (const [cat, l] of Object.entries(L.CATEGORIAS)) {
      const S = superCom(100); L.usarPoder(S, 'red', 'dadoSuper', { cat }); L.rolar(S, 'red', d);
      if (!l.includes(S.dado)) throw new Error(cat + ' deu ' + S.dado);
    }
  }
});
teste('Dado a dedo: cai o número escolhido e o 6 não dá jogada extra', () => {
  const S = superCom(100); S.pos.red[0] = 10;
  L.usarPoder(S, 'red', 'dedo', { n: 6 }); L.rolar(S, 'red', 2); igual(S.dado, 6);
  L.mover(S, 'red', 0); igual(S.vez, 'green');
});
teste('Dado a dedo: capturando ainda joga de novo', () => {
  const S = superCom(100); S.pos.red[0] = 15; S.pos.green[1] = 4;
  L.usarPoder(S, 'red', 'dedo', { n: 2 }); L.rolar(S, 'red', 5); L.mover(S, 'red', 0); igual(S.vez, 'red');
});
teste('Fuga: tira da base e passa a vez sem girar', () => {
  const S = superCom(100); L.usarPoder(S, 'red', 'fuga', { i: 2 }); igual(S.pos.red[2], 0); igual(S.vez, 'green');
});
// ---- poderes de depois do dado ----
teste('poderes de depois do dado: só depois de girar, 2 usos cada', () => {
  const S = superCom(0); S.pos.red[0] = 20;
  igual(L.usarPoder(S, 'red', 'retroceder'), false, 'antes do dado não');
  L.rolar(S, 'red', 3); igual(L.podeUsar(S, 'red', 'retroceder'), true, 'não precisa de pontos');
  igual(S.cargas.red.retroceder, 2);
  L.armar(S, 'red', 'retroceder'); L.mover(S, 'red', 0); igual(S.pos.red[0], 17); igual(S.cargas.red.retroceder, 1);
  S.vez = 'red'; S.poderTurno = null; L.rolar(S, 'red', 2); L.armar(S, 'red', 'retroceder'); L.mover(S, 'red', 0);
  igual(S.cargas.red.retroceder, 0);
  S.vez = 'red'; S.poderTurno = null; L.rolar(S, 'red', 2); igual(L.armar(S, 'red', 'retroceder'), false, 'acabaram os usos');
});
teste('tocar de novo no poder cancela e volta às jogadas normais', () => {
  const S = superCom(0); S.pos.red[0] = 20; L.rolar(S, 'red', 3);
  L.armar(S, 'red', 'retroceder'); igual(op(S, 0).tipo, 'retro'); igual(S.armado, 'retroceder');
  L.armar(S, 'red', 'retroceder'); igual(S.armado, null); igual(op(S, 0).tipo, 'andar'); igual(S.cargas.red.retroceder, 2);
});
teste('1 poder por jogada: depois de usar um antes do dado, não usa outro depois', () => {
  const S = superCom(100); S.pos.red[0] = 20;
  L.usarPoder(S, 'red', 'dedo', { n: 3 }); L.rolar(S, 'red', 1); igual(L.armar(S, 'red', 'retroceder'), false);
});
teste('Retroceder: anda para trás, captura, e 6 joga de novo', () => {
  const S = superCom(0); S.pos.red[0] = 20; S.pos.green[0] = 4; // verde na casa 17 = vermelho 17
  L.rolar(S, 'red', 3); L.armar(S, 'red', 'retroceder'); igual(op(S, 0).para, 17);
  const r = L.mover(S, 'red', 0); igual(r.capturados, [{ cor: 'green', i: 0 }]); igual(S.pontos.red, 10);
  const T = superCom(0); T.pos.red[0] = 20; L.rolar(T, 'red', 6); L.armar(T, 'red', 'retroceder'); L.mover(T, 'red', 0);
  igual(T.pos.red[0], 14); igual(T.vez, 'red');
});
teste('Retroceder: para na saída e não vale na reta final', () => {
  const S = superCom(0); S.pos.red = [3, 52, -1, -1];
  L.rolar(S, 'red', 5); L.armar(S, 'red', 'retroceder'); igual(S.validas, [0]); igual(op(S, 0).para, 0);
});
teste('sem jogada para frente, dá para usar Retroceder ou passar', () => {
  const S = superCom(0); S.pos.red = [54, 10, -1, -1]; S.preso.red[1] = 2; S.buracos.push({ cor: 'green', casa: 10, dono: { cor: 'green', i: 0 } });
  L.rolar(S, 'red', 4); // 54+4 passa do fim; pino 1 preso só carrega
  igual(S.validas, [1]);
  const T = superCom(0); T.pos.red = [54, -1, -1, -1]; L.rolar(T, 'red', 5);
  igual(T.validas, []); igual(L.passar(T, 'red'), true); igual(T.vez, 'green');
  const U = superCom(0); U.pos.red = [10, -1, -1, -1]; L.rolar(U, 'red', 3); igual(L.passar(U, 'red'), false, 'tem jogada normal');
});
teste('Proteção máxima: protege, ainda anda, e dura até a próxima vez do dono', () => {
  const S = superCom(0); S.pos.red = [15, 30, -1, -1];
  L.rolar(S, 'red', 2); L.armar(S, 'red', 'protecao'); igual(op(S, 0).tipo, 'proteger');
  L.mover(S, 'red', 0); igual(S.protegido.red[0], true); igual(S.vez, 'red'); igual(S.rolou, true, 'ainda move com o dado');
  igual(op(S, 1).tipo, 'andar'); L.mover(S, 'red', 0); igual(S.pos.red[0], 17); igual(S.protegido.red[0], true, 'continua protegido andando');
  // verde cai em cima e não captura (vermelho 17 = verde 4)
  S.pos.green[0] = 2; L.rolar(S, 'green', 2); L.mover(S, 'green', 0); igual(S.pos.red[0], 17); igual(S.pos.green[0], 4);
  igual(S.vez, 'red'); igual(S.protegido.red[0], false, 'acabou na vez do dono');
});
teste('Proteção máxima sem jogada depois: passa a vez', () => {
  const S = superCom(0); S.pos.red = [54, 20, -1, -1]; S.preso.red[1] = 0; S.buracos.push({ cor: 'green', casa: 20, dono: { cor: 'green', i: 0 } });
  S.pos.red[2] = 30; L.rolar(S, 'red', 5);
  // pino 2 anda; protege o 2 e depois só ele anda
  L.armar(S, 'red', 'protecao'); igual(S.validas, [2]); L.mover(S, 'red', 2); igual(S.validas.includes(2), true);
});
teste('Ponto de segurança: a casa onde parar fica segura por 2 rodadas do dono', () => {
  const S = superCom(0); S.pos.red[0] = 15;
  L.rolar(S, 'red', 2); L.armar(S, 'red', 'seguranca'); L.mover(S, 'red', 0);
  igual(S.zonas, [{ casa: 17, cor: 'red', rodadas: 2 }]); igual(S.cargas.red.seguranca, 1);
  // verde não captura lá
  S.pos.green[0] = 2; L.rolar(S, 'green', 2); L.mover(S, 'green', 0); igual(S.pos.red[0], 17);
  igual(S.vez, 'red'); igual(S.zonas[0].rodadas, 1);
  L.proximaVez(S); L.proximaVez(S); igual(S.vez, 'red'); igual(S.zonas, [], 'acabou depois de 2 rodadas');
});
teste('Ponto de segurança: só vale parando no caminho principal', () => {
  const S = superCom(0); S.pos.red = [48, 20, -1, -1]; L.rolar(S, 'red', 4); L.armar(S, 'red', 'seguranca');
  igual(S.validas, [1], 'o pino 0 entraria na reta final');
});
teste('opções mostram o que a habilidade vai fazer (etiquetas)', () => {
  const S = comHab('red', ['corredor', 'tanque', 'ligeiro', 'banqueiro']); S.pos.red = [10, 20, -1, 30];
  L.rolar(S, 'red', 5);
  igual(op(S, 0).tags, ['+2']); igual(op(S, 1).tags, ['metade']); igual(op(S, 2).tags, ['sai com 5']); igual(op(S, 3).tags, ['2× pts']);
});
teste('destino no buraco negro vem marcado como perigo', () => {
  const S = superCom(0); S.pos.red[0] = 10; S.buracos.push({ cor: 'green', casa: 13 + 0, dono: { cor: 'green', i: 0 } });
  S.buracos[0].casa = 14; L.rolar(S, 'red', 4); igual(op(S, 0).perigo, 'buraco!');
});
teste('eventos: corredor, laço, tanque e buraco aparecem na última jogada', () => {
  const S = comHab('red', ['corredor', 'normal', 'normal', 'normal']); S.pos.red[0] = 10;
  L.rolar(S, 'red', 3); L.mover(S, 'red', 0); igual(S.ultimo.eventos.map((e) => e.tipo), ['corredor']);
  const T = superCom(0); T.pos.red[0] = 10; T.buracos.push({ cor: 'green', casa: 13, dono: { cor: 'green', i: 0 } });
  L.rolar(T, 'red', 3); L.mover(T, 'red', 0); igual(T.ultimo.preso, true); igual(T.ultimo.eventos.map((e) => e.tipo), ['buraco']);
});
teste('Buraco negro: prende quem cai, dono imune, carga de 10 com sobra', () => {
  const S = superCom(100); S.pos.red[0] = 20;
  L.usarPoder(S, 'red', 'buraco', { i: 0 }); igual(S.buracos.length, 1);
  L.rolar(S, 'red', 1); L.mover(S, 'red', 0); // dono sai sem ficar preso
  igual(S.preso.red[0], null);
  // verde cai no buraco (casa 20 do vermelho = verde 7)
  S.vez = 'green'; S.pos.green[0] = 4; L.rolar(S, 'green', 3); L.mover(S, 'green', 0);
  igual(S.preso.green[0], 0);
  S.vez = 'green'; L.rolar(S, 'green', 6); igual(op(S, 0).tipo, 'carga'); L.mover(S, 'green', 0); igual(S.preso.green[0], 6);
  S.vez = 'green'; L.rolar(S, 'green', 6); L.mover(S, 'green', 0);
  igual(S.preso.green[0], null); igual(S.pos.green[0], 9, 'sobra de 2 vira movimento'); igual(S.buracos, []);
});
teste('Buraco negro: seu outro pino também fica preso', () => {
  const S = superCom(100); S.pos.red[0] = 20; S.pos.red[1] = 17;
  L.usarPoder(S, 'red', 'buraco', { i: 0 }); L.rolar(S, 'red', 3); L.mover(S, 'red', 1); igual(S.preso.red[1], 0);
});
teste('Buraco negro: vizinho anda metade (arredonda pra cima)', () => {
  const S = superCom(100); S.pos.red[0] = 20; L.usarPoder(S, 'red', 'buraco', { i: 0 });
  S.pos.red[1] = 19; L.rolar(S, 'red', 5); igual(op(S, 1).passos, 3); igual(op(S, 0).passos, 5, 'dono não é afetado');
});
teste('Buraco negro: quem cai em cima do preso captura e fica preso', () => {
  const S = superCom(100); S.buracos.push({ cor: 'red', casa: 20, dono: { cor: 'red', i: 3 } });
  S.pos.green[0] = 7; S.preso.green[0] = 4; S.pos.red[0] = 17;
  L.rolar(S, 'red', 3); L.mover(S, 'red', 0);
  igual(S.pos.green[0], -1); igual(S.preso.green[0], null); igual(S.preso.red[0], 0);
});
teste('Buraco negro não pode em casa segura e só 1 por jogador', () => {
  const S = superCom(1000); S.pos.red[0] = 8; igual(L.usarPoder(S, 'red', 'buraco', { i: 0 }), false);
  S.buracos.push({ cor: 'red', casa: 30, dono: { cor: 'red', i: 1 } }); S.pos.red[0] = 10;
  igual(L.usarPoder(S, 'red', 'buraco', { i: 0 }), false);
});
teste('três 6 seguidos também valem com poder', () => {
  const S = superCom(1000); S.pos.red[0] = 10;
  L.usarPoder(S, 'red', 'dadoSuper', { cat: 'par' }); L.rolar(S, 'red', 6); igual(S.dado, 6); L.mover(S, 'red', 0);
  L.rolar(S, 'red', 6); L.mover(S, 'red', 0); L.rolar(S, 'red', 6); igual(S.anulado, true);
  L.passarSemJogada(S); igual(S.vez, 'green'); igual(S.pos.red[0], 22);
});

// ===================================================================
secao('Super — habilidades');
function comHab(cor, lista, ...outros) { const S = mesa('super', 'red', 'green', ...outros); L.definirHabilidades(S, cor, lista); L.iniciar(S); return S; }
teste('não pode repetir habilidade (exceto Normal)', () => {
  const S = mesa('super', 'red', 'green');
  igual(L.definirHabilidades(S, 'red', ['tanque', 'tanque', 'normal', 'normal']), false);
  igual(L.definirHabilidades(S, 'red', ['tanque', 'laco', 'normal', 'normal']), true);
});
teste('habilidades são ignoradas no Clássico', () => {
  const S = mesa('classico', 'red', 'green'); L.definirHabilidades(S, 'red', ['corredor', 'normal', 'normal', 'normal']); L.iniciar(S);
  S.pos.red[0] = 10; L.rolar(S, 'red', 3); igual(op(S, 0).passos, 3);
});
teste('Corredor +2 (mas precisa de 6 para sair)', () => {
  const S = comHab('red', ['corredor', 'normal', 'normal', 'normal']); S.pos.red[0] = 10;
  L.rolar(S, 'red', 3); igual(op(S, 0).passos, 5); igual(S.validas, [0]);
});
teste('Tanque anda metade', () => {
  const S = comHab('green', ['tanque', 'normal', 'normal', 'normal']);
  S.pos.green[0] = 10; S.vez = 'green'; L.rolar(S, 'green', 5); igual(op(S, 0).passos, 3);
});
teste('Tanque: aguenta 1 captura, a 2ª manda para a base, e a vida volta ao sair de novo', () => {
  const T = comHab('green', ['tanque', 'normal', 'normal', 'normal']);
  T.vez = 'green'; L.rolar(T, 'green', 6); L.mover(T, 'green', 0); igual(T.vidas.green[0], 1, 'ganha vida ao sair');
  T.pos.green[0] = 4; T.vez = 'red'; T.rolou = false; T.pos.red[0] = 15;
  L.rolar(T, 'red', 2); L.mover(T, 'red', 0); igual(T.pos.green[0], 4, 'primeira captura gasta a vida'); igual(T.vidas.green[0], 0);
  T.vez = 'red'; T.pos.red[1] = 14; L.rolar(T, 'red', 3); L.mover(T, 'red', 1); igual(T.pos.green[0], -1, 'segunda vai para a base');
  T.vez = 'green'; T.rolou = false; L.rolar(T, 'green', 6); L.mover(T, 'green', 0); igual(T.vidas.green[0], 1, 'vida volta');
});
teste('Ligeiro sai com 5', () => { const S = comHab('red', ['ligeiro', 'normal', 'normal', 'normal']); L.rolar(S, 'red', 5); igual(S.validas, [0]); });
teste('Laço: adversário até 3 casas à frente anda 2 a menos (mínimo 1)', () => {
  const S = comHab('green', ['laco', 'normal', 'normal', 'normal']);
  S.pos.green[0] = 2; S.pos.red[0] = 17; // verde casa 15, vermelho casa 17: 2 à frente
  L.rolar(S, 'red', 5); igual(op(S, 0).passos, 3);
  const T = comHab('green', ['laco', 'normal', 'normal', 'normal']); T.pos.green[0] = 2; T.pos.red[0] = 17;
  L.rolar(T, 'red', 1); igual(op(T, 0).passos, 1);
});
teste('Blindado ignora Laço e buraco vizinho', () => {
  const S = mesa('super', 'red', 'green'); L.definirHabilidades(S, 'green', ['laco', 'normal', 'normal', 'normal']);
  L.definirHabilidades(S, 'red', ['blindado', 'normal', 'normal', 'normal']); L.iniciar(S);
  S.pos.green[0] = 2; S.pos.red[0] = 17; S.buracos.push({ cor: 'green', casa: 18, dono: { cor: 'green', i: 1 } });
  L.rolar(S, 'red', 5); igual(op(S, 0).passos, 5);
});
teste('ordem dos ajustes: Tanque, Corredor, Laço, buraco, mínimo 1', () => {
  const S = mesa('super', 'red', 'green'); L.definirHabilidades(S, 'green', ['laco', 'normal', 'normal', 'normal']);
  L.definirHabilidades(S, 'red', ['corredor', 'tanque', 'normal', 'normal']); L.iniciar(S);
  S.pos.green[0] = 2; S.pos.red[0] = 17; S.pos.red[1] = 17;
  S.buracos.push({ cor: 'green', casa: 18, dono: { cor: 'green', i: 1 } });
  L.rolar(S, 'red', 5);
  igual(op(S, 0).passos, Math.ceil((5 + 2 - 2) / 2), 'corredor'); // 3
  igual(op(S, 1).passos, Math.max(1, Math.ceil((Math.ceil(5 / 2) - 2) / 2)), 'tanque'); // 1
});
teste('Vácuo anda 1/3 de graça, sem ultrapassar e sem capturar', () => {
  const S = comHab('green', ['vacuo', 'normal', 'normal', 'normal']);
  S.pos.green[0] = 2;  // casa 15
  S.pos.red[0] = 17;   // casa 17 (2 à frente)
  S.pos.red[1] = 16;   // casa 16 (entre eles) — não deve ser capturado pelo vácuo
  L.rolar(S, 'red', 6); L.mover(S, 'red', 0);
  igual(S.pos.green[0], 4, 'ganhou 2 (6/3)'); igual(S.pos.red[1], 16, 'vácuo não captura');
});
teste('Vácuo não funciona longe (mais de 6 casas)', () => {
  const S = comHab('green', ['vacuo', 'normal', 'normal', 'normal']);
  S.pos.green[0] = 2; S.pos.red[0] = 22; // 7 à frente
  L.rolar(S, 'red', 6); L.mover(S, 'red', 0); igual(S.pos.green[0], 2);
});
teste('Vingativo: quem captura perde 20', () => {
  const S = comHab('green', ['vingativo', 'normal', 'normal', 'normal']);
  S.pontos.red = 30; S.pos.red[0] = 15; S.recorde.red[0] = 15; S.pos.green[0] = 4;
  L.rolar(S, 'red', 2); L.mover(S, 'red', 0); igual(S.pontos.red, 30 + 2 - 20);
});

// ===================================================================
secao('Partidas aleatórias');
function partida(modo, poderes) {
  const S = mesa(modo, 'red', 'green', 'yellow', 'blue');
  if (modo === 'super') {
    const hs = Object.keys(L.HABILIDADES);
    L.CORES.forEach((c, k) => L.definirHabilidades(S, c, [hs[(k * 2 + 1) % 9], hs[(k * 2 + 2) % 9], hs[(k * 2 + 3) % 9] === hs[(k * 2 + 1) % 9] ? 'normal' : hs[(k * 2 + 3) % 9], 'normal']));
  }
  L.iniciar(S);
  let passos = 0;
  while (S.fase === 'jogo' && passos++ < 20000) {
    const c = S.vez;
    if (poderes && Math.random() < 0.3) {
      const nomes = Object.keys(L.PODERES).filter((k) => !L.PODERES[k].depois), p = nomes[Math.floor(Math.random() * nomes.length)];
      L.usarPoder(S, c, p, { i: Math.floor(Math.random() * 4), cat: 'alto', n: 1 + Math.floor(Math.random() * 6) });
      if (S.vez !== c) continue;
    }
    L.rolar(S, c, 1 + Math.floor(Math.random() * 6));
    if (poderes && Math.random() < 0.3) L.armar(S, c, L.PODERES_DEPOIS[Math.floor(Math.random() * 3)]);
    let giros = 0;
    while (S.fase === 'jogo' && S.vez === c && S.rolou && giros++ < 5) {
      if (S.opcoes.length) L.mover(S, c, S.opcoes[Math.floor(Math.random() * S.opcoes.length)].i);
      else if (!L.passar(S, c)) L.passarSemJogada(S);
    }
    // invariantes
    L.CORES.forEach((cc) => S.pos[cc].forEach((p) => { if (p < -1 || p > 56) throw new Error('posição inválida ' + p); }));
    L.CORES.forEach((cc) => { if (S.pontos[cc] < 0) throw new Error('pontos negativos'); });
  }
  if (S.fase !== 'fim') throw new Error('partida não terminou (' + modo + ')');
  igual(S.vencedores.length, 4);
}
teste('200 partidas clássicas até o fim', () => { for (let k = 0; k < 200; k++) partida('classico'); });
teste('200 partidas super com habilidades e poderes até o fim', () => { for (let k = 0; k < 200; k++) partida('super', true); });

console.log(`\n${ok} passaram, ${falhas} falharam`);
process.exitCode = falhas ? 1 : 0;
