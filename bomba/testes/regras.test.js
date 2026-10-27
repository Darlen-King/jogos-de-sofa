// Testes das regras do Bomba no Sofá. Rode com:  node bomba/testes/regras.test.js
const B = require('../js/regras.js');
let ok = 0, falhas = 0;
function secao(n) { console.log('\n' + n); }
function teste(nome, fn) {
  try { fn(); ok++; console.log('  ✓ ' + nome); }
  catch (e) { falhas++; console.log('  ✗ ' + nome + '\n     ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n     ')); }
}
function igual(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a)); }
function verdade(v, msg) { if (!v) throw new Error(msg || 'esperado verdadeiro'); }

// gerador previsível
function semente(s) { return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
function jogo(n = 3, s = 1) {
  const S = B.novoEstado(60, 5);
  for (let k = 0; k < n; k++) B.entrar(S, 'p' + k, 'P' + k);
  B.iniciar(S, semente(s));
  S.vez = 0; S.turnos = 1;
  return S;
}
let idx = 10000;
const carta = (t) => ({ id: idx++, t });
/** Dá cartas a um jogador (e devolve os ids). */
function dar(S, j, ...tipos) { const cs = tipos.map(carta); S.jogadores[j].mao.push(...cs); return cs.map((c) => c.id); }
function topo(S, ...tipos) { S.baralho.unshift(...tipos.map(carta)); }
const conta = (S, j, t) => S.jogadores[j].mao.filter((c) => c.t === t).length;
const total = (S) => S.baralho.length + S.descarte.length + S.explodidas.length + S.jogadores.reduce((s, p) => s + p.mao.length, 0) + (S.espera && S.espera.bomba ? 1 : 0);

// ===================================================================
secao('Sala e preparação');
teste('não começa com 1 jogador', () => { const S = B.novoEstado(); B.entrar(S, 'a', 'A'); igual(B.iniciar(S), false); });
teste('no máximo 5 jogadores, cores diferentes', () => {
  const S = B.novoEstado();
  for (let k = 0; k < 6; k++) B.entrar(S, 'x' + k, 'X');
  igual(S.jogadores.length, 5);
  igual(new Set(S.jogadores.map((p) => p.cor)).size, 5);
});
teste('entrar de novo com o mesmo aparelho não duplica', () => { const S = B.novoEstado(); B.entrar(S, 'a', 'A'); igual(B.entrar(S, 'a', 'Ana'), 0); igual(S.jogadores.length, 1); igual(S.jogadores[0].nome, 'Ana'); });
[2, 3, 4, 5].forEach((n) => teste(`${n} jogadores: 8 cartas cada (1 Desarmar), ${n - 1} bombas no monte`, () => {
  const S = jogo(n);
  S.jogadores.forEach((p) => { igual(p.mao.length, 8); igual(p.mao.filter((c) => c.t === 'desarmar').length, 1); verdade(!p.mao.some((c) => c.t === 'bomba')); });
  igual(S.baralho.filter((c) => c.t === 'bomba').length, n - 1);
  igual(S.baralho.filter((c) => c.t === 'desarmar').length, Math.min(6 - n, 2));
  igual(total(S), 46 + n + Math.min(6 - n, 2) + n - 1);
}));

// ===================================================================
secao('Jogadas');
teste('sozinha, carta de sofá não é jogada', () => { const S = jogo(); const [a] = dar(S, 0, 'pipoca'); igual(B.jogar(S, 0, [a]), false); });
teste('Não fora da janela não é jogada', () => { const S = jogo(); const [a] = dar(S, 0, 'nao'); igual(B.jogar(S, 0, [a]), false); });
teste('só joga na própria vez', () => { const S = jogo(); const [a] = dar(S, 1, 'pular'); igual(B.jogar(S, 1, [a]), false); });
teste('analisar combos', () => {
  igual(B.analisar(['pipoca', 'pipoca']).tipo, 'par');
  igual(B.analisar(['ataque', 'ataque']).tipo, 'par');
  igual(B.analisar(['meia', 'meia', 'meia']).tipo, 'trio');
  igual(B.analisar(['meia', 'pipoca', 'ataque', 'nao', 'controle']).tipo, 'cinco');
  igual(B.analisar(['meia', 'pipoca']), null);
  igual(B.analisar(['meia', 'meia', 'meia', 'meia']), null);
});
teste('Pular: termina a vez sem comprar', () => {
  const S = jogo(); const [a] = dar(S, 0, 'pular'); const monte = S.baralho.length;
  verdade(B.jogar(S, 0, [a])); verdade(S.pilha);
  B.resolver(S); igual(S.vez, 1); igual(S.baralho.length, monte);
});
teste('enquanto a janela está aberta ninguém compra nem joga', () => {
  const S = jogo(); const [a, b] = dar(S, 0, 'pular', 'pular');
  B.jogar(S, 0, [a]); igual(B.comprar(S, 0), null); igual(B.jogar(S, 0, [b]), false);
});
teste('Ataque: o próximo joga 2 vezes', () => {
  const S = jogo(); const [a] = dar(S, 0, 'ataque');
  B.jogar(S, 0, [a]); B.resolver(S); igual(S.vez, 1); igual(S.turnos, 2);
  B.comprar(S, 1); igual(S.vez, 1); igual(S.turnos, 1);
  B.comprar(S, 1); igual(S.vez, 2);
});
teste('Ataque em cima de Ataque acumula (2 restantes + 2 = 4)', () => {
  const S = jogo(); const [a] = dar(S, 0, 'ataque'); const [b] = dar(S, 1, 'ataque');
  B.jogar(S, 0, [a]); B.resolver(S); B.jogar(S, 1, [b]); B.resolver(S);
  igual(S.vez, 2); igual(S.turnos, 4);
});
teste('Ataque na última vez que faltava: próximo joga 2', () => {
  const S = jogo(); const [a] = dar(S, 0, 'ataque'); const [b] = dar(S, 1, 'ataque');
  B.jogar(S, 0, [a]); B.resolver(S); topo(S, 'pipoca'); B.comprar(S, 1); B.jogar(S, 1, [b]); B.resolver(S);
  igual(S.vez, 2); igual(S.turnos, 2);
});
teste('Pular atacado encerra só uma vez', () => {
  const S = jogo(); const [a] = dar(S, 0, 'ataque'); const [b] = dar(S, 1, 'pular');
  B.jogar(S, 0, [a]); B.resolver(S); B.jogar(S, 1, [b]); B.resolver(S); igual(S.vez, 1); igual(S.turnos, 1);
});
teste('Espiar o futuro mostra as 3 do topo só para quem jogou', () => {
  const S = jogo(); const [a] = dar(S, 0, 'futuro'); topo(S, 'ataque', 'meia', 'nao');
  B.jogar(S, 0, [a]); B.resolver(S);
  igual(B.visaoDe(S, 0).visao.cartas, ['ataque', 'meia', 'nao']);
  igual(B.visaoDe(S, 1).visao, null);
  igual(S.vez, 0);
});
teste('Embaralhar apaga o que foi espiado', () => {
  const S = jogo(); const [a, b] = dar(S, 0, 'futuro', 'embaralhar');
  B.jogar(S, 0, [a]); B.resolver(S); B.jogar(S, 0, [b]); B.resolver(S, semente(9));
  igual(B.visaoDe(S, 0).visao, null);
});
teste('Favor: o alvo escolhe a carta', () => {
  const S = jogo(); const [a] = dar(S, 0, 'favor'); const [x] = dar(S, 1, 'ursinho');
  igual(B.jogar(S, 0, [a], {}), false, 'sem alvo');
  verdade(B.jogar(S, 0, [a], { alvo: 1 }));
  B.resolver(S); igual(S.espera.tipo, 'favor'); igual(S.espera.j, 1);
  igual(B.comprar(S, 0), null, 'espera o favor');
  igual(B.dar(S, 2, x), false, 'outro não pode dar');
  verdade(B.dar(S, 1, x)); igual(conta(S, 0, 'ursinho') >= 1, true); igual(S.espera, null);
});
teste('Favor não pode mirar em si mesmo nem em quem explodiu', () => {
  const S = jogo(); const [a] = dar(S, 0, 'favor'); S.jogadores[2].vivo = false;
  igual(B.jogar(S, 0, [a], { alvo: 0 }), false); igual(B.jogar(S, 0, [a], { alvo: 2 }), false);
});
teste('Par rouba uma carta aleatória e avisa os dois', () => {
  const S = jogo(); const ids = dar(S, 0, 'pipoca', 'pipoca'); const antes = S.jogadores[1].mao.length;
  B.jogar(S, 0, ids, { alvo: 1 }); B.resolver(S, semente(3));
  igual(S.jogadores[1].mao.length, antes - 1);
  verdade(B.visaoDe(S, 0).privado.texto.includes('roubou'));
  verdade(B.visaoDe(S, 1).privado.texto.includes('roubou'));
});
teste('Trio: pega a carta pedida se o alvo tiver', () => {
  const S = jogo(); const ids = dar(S, 0, 'meia', 'meia', 'meia'); dar(S, 1, 'desarmar');
  B.jogar(S, 0, ids, { alvo: 1, nome: 'desarmar' }); B.resolver(S);
  igual(conta(S, 0, 'desarmar'), 2); igual(conta(S, 1, 'desarmar'), 1);
});
teste('Trio: não pode pedir Bomba', () => { const S = jogo(); const ids = dar(S, 0, 'meia', 'meia', 'meia'); igual(B.jogar(S, 0, ids, { alvo: 1, nome: 'bomba' }), false); });
teste('5 diferentes: pega a carta que quiser do descarte', () => {
  const S = jogo(); const [p] = dar(S, 0, 'pular'); B.jogar(S, 0, [p]); B.resolver(S); S.vez = 0;
  const ids = dar(S, 0, 'meia', 'pipoca', 'chinelo', 'controle', 'ursinho');
  B.jogar(S, 0, ids); B.resolver(S); igual(S.espera.tipo, 'descarte');
  const antes = conta(S, 0, 'pular');
  verdade(B.pegarDescarte(S, 0, 'pular')); igual(conta(S, 0, 'pular'), antes + 1);
});

// ===================================================================
secao('Não!');
teste('um Não cancela a jogada', () => {
  const S = jogo(); const [a] = dar(S, 0, 'ataque'); dar(S, 1, 'nao');
  B.jogar(S, 0, [a]); verdade(B.negar(S, 1)); B.resolver(S);
  igual(S.vez, 0); igual(S.turnos, 1);
});
teste('Não do Não: a jogada volta a valer', () => {
  const S = jogo(); const [a] = dar(S, 0, 'ataque'); dar(S, 1, 'nao'); dar(S, 0, 'nao');
  B.jogar(S, 0, [a]); B.negar(S, 1); verdade(B.negar(S, 0)); B.resolver(S);
  igual(S.vez, 1); igual(S.turnos, 2);
});
teste('três Nãos: cancelada de novo', () => {
  const S = jogo(); const [a] = dar(S, 0, 'pular'); dar(S, 1, 'nao'); dar(S, 2, 'nao'); dar(S, 0, 'nao');
  B.jogar(S, 0, [a]); B.negar(S, 1); B.negar(S, 0); B.negar(S, 2); B.resolver(S); igual(S.vez, 0);
});
teste('não dá para negar o próprio último Não (evita toque duplo)', () => {
  const S = jogo(); const [a] = dar(S, 0, 'pular'); dar(S, 1, 'nao', 'nao');
  B.jogar(S, 0, [a]); B.negar(S, 1); igual(B.negar(S, 1), false); igual(conta(S, 1, 'nao') >= 1, true);
});
teste('quem não tem Não não nega', () => {
  const S = jogo(); S.jogadores[2].mao = S.jogadores[2].mao.filter((c) => c.t !== 'nao');
  const [a] = dar(S, 0, 'pular'); B.jogar(S, 0, [a]); igual(B.negar(S, 2), false);
});
teste('quem explodiu não nega', () => {
  const S = jogo(); dar(S, 2, 'nao'); S.jogadores[2].vivo = false;
  const [a] = dar(S, 0, 'pular'); B.jogar(S, 0, [a]); igual(B.negar(S, 2), false);
});
teste('Não vai para o descarte', () => {
  const S = jogo(); const [a] = dar(S, 0, 'pular'); dar(S, 1, 'nao');
  B.jogar(S, 0, [a]); B.negar(S, 1); igual(S.descarte.slice(-2).map((c) => c.t), ['pular', 'nao']);
});

// ===================================================================
secao('Bomba');
teste('comprar carta comum termina a vez e avisa só quem comprou', () => {
  const S = jogo(); topo(S, 'ursinho'); igual(B.comprar(S, 0), 'ursinho'); igual(S.vez, 1);
  verdade(B.visaoDe(S, 0).privado.texto.includes('Ursinho')); igual(B.visaoDe(S, 1).privado, null);
});
teste('bomba com Desarmar: escolhe onde esconder', () => {
  const S = jogo(); topo(S, 'bomba'); const n = S.baralho.length;
  igual(B.comprar(S, 0), 'bomba'); igual(S.espera.tipo, 'esconder'); igual(conta(S, 0, 'desarmar'), 0);
  igual(S.vez, 0);
  verdade(B.esconder(S, 0, 0)); igual(S.baralho[0].t, 'bomba'); igual(S.baralho.length, n); igual(S.vez, 1);
});
teste('esconder no fundo', () => {
  const S = jogo(); topo(S, 'bomba'); B.comprar(S, 0); B.esconder(S, 0, 999); igual(S.baralho[S.baralho.length - 1].t, 'bomba');
});
teste('bomba sem Desarmar: explode e passa a vez', () => {
  const S = jogo(); S.jogadores[0].mao = S.jogadores[0].mao.filter((c) => c.t !== 'desarmar'); topo(S, 'bomba');
  B.comprar(S, 0); igual(S.jogadores[0].vivo, false); igual(S.vez, 1); igual(S.fase, 'jogo');
});
teste('quem explodiu é pulado nas vezes', () => {
  const S = jogo(); S.jogadores[1].vivo = false; topo(S, 'meia'); B.comprar(S, 0); igual(S.vez, 2);
});
teste('último vivo vence', () => {
  const S = jogo(2); S.jogadores[0].mao = []; topo(S, 'bomba'); B.comprar(S, 0);
  igual(S.fase, 'fim'); igual(S.vencedor, 1);
});
teste('explodir atacado zera as vezes extras', () => {
  const S = jogo(); const [a] = dar(S, 0, 'ataque'); B.jogar(S, 0, [a]); B.resolver(S);
  S.jogadores[1].mao = []; topo(S, 'bomba'); B.comprar(S, 1); igual(S.vez, 2); igual(S.turnos, 1);
});

// ===================================================================
secao('Privacidade');
teste('celular não recebe mão dos outros nem o monte', () => {
  const S = jogo(); const V = B.visaoDe(S, 1);
  igual(typeof V.monte, 'number'); verdade(!JSON.stringify(V.jogadores).includes('"mao"'));
  igual(V.mao.length, S.jogadores[1].mao.length);
  verdade(!('id' in V.jogadores[0]), 'sem id do aparelho');
});
teste('TV (sem jogador) não vê mão nenhuma', () => { const S = jogo(); igual(B.visaoDe(S, null).mao, []); });
teste('esconder a bomba não revela a posição para os outros', () => {
  const S = jogo(); topo(S, 'bomba'); B.comprar(S, 0); B.esconder(S, 0, 2);
  verdade(!B.visaoDe(S, 1).msg.includes('3')); verdade(!JSON.stringify(B.visaoDe(S, 1)).includes('posição'));
});

// ===================================================================
secao('Tempo esgotado');
teste('na vez: compra', () => { const S = jogo(); topo(S, 'meia'); verdade(B.automatico(S)); igual(S.vez, 1); });
teste('no favor: dá uma carta', () => {
  const S = jogo(); const [a] = dar(S, 0, 'favor'); B.jogar(S, 0, [a], { alvo: 1 }); B.resolver(S);
  const n = S.jogadores[1].mao.length; verdade(B.automatico(S)); igual(S.jogadores[1].mao.length, n - 1);
});
teste('com bomba: esconde em lugar aleatório', () => { const S = jogo(); topo(S, 'bomba'); B.comprar(S, 0); verdade(B.automatico(S)); igual(S.espera, null); });
teste('com a janela do Não aberta não faz nada', () => { const S = jogo(); const [a] = dar(S, 0, 'pular'); B.jogar(S, 0, [a]); igual(B.automatico(S), false); });

// ===================================================================
secao('Partidas inteiras (jogadas aleatórias)');
teste('300 partidas terminam com 1 vencedor e nenhuma carta some', () => {
  for (let s = 1; s <= 300; s++) {
    const r = semente(s * 7);
    const n = 2 + (s % 4);
    const S = B.novoEstado();
    for (let k = 0; k < n; k++) B.entrar(S, 'p' + k, 'P' + k);
    B.iniciar(S, r);
    const tot = total(S);
    let passos = 0;
    while (S.fase === 'jogo' && passos++ < 5000) {
      if (S.pilha) {
        // às vezes alguém nega
        const quem = B.vivos(S).find((j) => B.podeNegar(S, j) && r() < 0.3);
        if (quem != null) B.negar(S, quem); else B.resolver(S, r);
      } else if (S.espera) B.automatico(S, r);
      else {
        const j = S.vez, p = S.jogadores[j];
        const acoes = p.mao.filter((c) => B.CARTAS[c.t].acao);
        if (acoes.length && r() < 0.5) {
          const c = acoes[Math.floor(r() * acoes.length)];
          const alvos = B.alvosValidos(S, j);
          if (c.t === 'favor' && !alvos.length) B.comprar(S, j);
          else B.jogar(S, j, [c.id], { alvo: alvos[0] });
        } else {
          // tenta um par
          const par = p.mao.find((c, k) => B.CARTAS[c.t].sofa && p.mao.findIndex((d, x) => x !== k && d.t === c.t) >= 0);
          const alvos = B.alvosValidos(S, j);
          if (par && alvos.length && r() < 0.3) {
            const outro = p.mao.find((d) => d !== par && d.t === par.t);
            B.jogar(S, j, [par.id, outro.id], { alvo: alvos[Math.floor(r() * alvos.length)] });
          } else B.comprar(S, j);
        }
      }
      if (total(S) !== tot) throw new Error('cartas sumiram na semente ' + s);
    }
    if (S.fase !== 'fim') throw new Error('não terminou na semente ' + s);
    igual(B.vivos(S).length, 1, 'semente ' + s);
  }
});

console.log(`\n${ok} passaram, ${falhas} falharam`);
if (falhas) process.exit(1);
