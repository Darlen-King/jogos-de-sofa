/* =====================================================================
   comum.js — utilidades usadas pela mesa (TV) e pelo controle (celular).
   ===================================================================== */
const Comum = (() => {
  // Todo ID de sala no servidor do PeerJS começa com isso, para não colidir com outros apps.
  const PREFIXO = 'ludo-de-sofa-v1-';

  const $ = (id) => document.getElementById(id);

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

  function mostrar(tela) {
    ['inicio', 'mesa', 'controle'].forEach((t) => ($(t).hidden = t !== tela));
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
  /** Um ID fixo por celular, guardado no navegador. Serve para reconectar na mesma cor. */
  function idDoAparelho() {
    let id = null;
    try { id = localStorage.getItem('ludo-id'); } catch (e) { /* navegação privada */ }
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem('ludo-id', id); } catch (e) { /* sem problema */ }
    }
    return id;
  }

  let travaTela = null;
  async function manterAcesa() {
    try { if ('wakeLock' in navigator) travaTela = await navigator.wakeLock.request('screen'); } catch (e) { /* opcional */ }
  }
  document.addEventListener('visibilitychange', () => { if (travaTela && document.visibilityState === 'visible') manterAcesa(); });

  function vibrar(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* opcional */ } }

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
    };
  })();
  // navegadores só liberam som depois de um toque
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, Som.liga, { once: false, passive: true }));

  return { PREFIXO, opcoesPeer, extraLink, $, mostrar, face, rolarDado, idDoAparelho, manterAcesa, vibrar, Som };
})();
