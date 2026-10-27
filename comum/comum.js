/* =====================================================================
   comum.js — utilidades de todos os jogos: conexão, dado, sons,
   vibração, ID do aparelho e nome do jogador.
   ===================================================================== */
const Comum = (() => {
  const $ = (id) => document.getElementById(id);

  /** Escapa texto para colocar dentro de innerHTML. */
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // Por padrão usamos o servidor gratuito do PeerJS (0.peerjs.com), que só apresenta
  // os aparelhos um ao outro; depois a conversa vai direto entre eles (WebRTC).
  // Para testes com um servidor próprio: ?servidor=192.168.0.10:9000
  const servidor = new URLSearchParams(location.search).get('servidor');
  function opcoesPeer() {
    if (!servidor || !/^[\w.-]+:\d+$/.test(servidor)) return {};
    const [host, port] = servidor.split(':');
    return { host, port: Number(port), path: '/', secure: false };
  }
  const extraLink = () => (servidor ? '&servidor=' + encodeURIComponent(servidor) : '');

  /** Mostra uma das telas (seções) da página e esconde as outras. */
  function mostrar(tela, todas = ['inicio', 'mesa', 'controle']) {
    todas.forEach((t) => { const e = $(t); if (e) e.hidden = t !== tela; });
  }

  // ---------- dado ----------
  const FACES = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function face(el, n) {
    [...el.children].forEach((p, k) => p.classList.toggle('on', !!n && FACES[n].includes(k)));
  }
  /** Chacoalha o dado por um instante e para no número n. */
  function rolarDado(el, n, aoTerminar) {
    el.classList.add('rolando');
    let t = 0;
    const iv = setInterval(() => {
      face(el, 1 + Math.floor(Math.random() * 6));
      Som.chocalho();
      if (++t > 9) { clearInterval(iv); el.classList.remove('rolando'); face(el, n); if (aoTerminar) aoTerminar(); }
    }, 70);
  }

  // ---------- aparelho ----------
  function lerLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravarLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* navegação privada */ } }

  /** Um ID fixo por celular, guardado no navegador. Serve para reconectar na mesma cor. */
  function idDoAparelho() {
    let id = lerLocal('jogos-id');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); gravarLocal('jogos-id', id); }
    return id;
  }

  /** Limpa o nome digitado: sem símbolos de controle, até 12 letras. */
  function limparNome(n) {
    return String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 12);
  }
  const nomeSalvo = () => lerLocal('jogos-nome') || '';
  const salvarNome = (n) => gravarLocal('jogos-nome', n);

  let travaTela = null;
  async function manterAcesa() {
    try { if ('wakeLock' in navigator) travaTela = await navigator.wakeLock.request('screen'); } catch (e) { /* opcional */ }
  }
  document.addEventListener('visibilitychange', () => { if (travaTela && document.visibilityState === 'visible') manterAcesa(); });

  /** Vibra se o aparelho deixar (iPhone não deixa: aí a tela pisca, veja controle). */
  const podeVibrar = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  function vibrar(ms) { try { if (podeVibrar) navigator.vibrate(ms); } catch (e) { /* opcional */ } }

  // ---------- sons simples (sem arquivos) ----------
  const Som = (() => {
    let ctx = null;
    function liga() { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; } }
    function bip(freq, dur, tipo = 'sine', vol = 0.08) {
      if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = tipo; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
    }
    return {
      liga,
      chocalho: () => bip(180 + Math.random() * 220, 0.04, 'square', 0.03),
      passo: () => bip(660, 0.06, 'triangle', 0.06),
      captura: () => { bip(300, 0.15, 'sawtooth', 0.06); setTimeout(() => bip(180, 0.25, 'sawtooth', 0.06), 120); },
      chegou: () => [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => bip(f, 0.18, 'triangle', 0.08), k * 110)),
      vez: () => { bip(880, 0.08); setTimeout(() => bip(1175, 0.12), 90); },
      tique: () => bip(1320, 0.05, 'square', 0.04),
      poder: () => [392, 523, 784].forEach((f, k) => setTimeout(() => bip(f, 0.16, 'sine', 0.08), k * 80)),
      buraco: () => { for (let k = 0; k < 6; k++) setTimeout(() => bip(300 - k * 40, 0.12, 'sine', 0.07), k * 60); },
    };
  })();
  // navegadores só liberam som depois de um toque
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, Som.liga, { passive: true }));

  return { $, esc, mostrar, opcoesPeer, extraLink, face, rolarDado, idDoAparelho, limparNome, nomeSalvo, salvarNome, manterAcesa, podeVibrar, vibrar, Som };
})();
