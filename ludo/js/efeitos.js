/* =====================================================================
   efeitos.js — coisas que só aparecem na TV:
   - Avisos: aviso rápido no topo ("Azul usou Retroceder", habilidades)
   - Meme: animação + som quando alguém perde um pino (configurável)
   ===================================================================== */
const Avisos = (() => {
  const { $ } = Comum;
  const fila = [];
  let ocupado = false;

  /** Coloca um aviso na fila. icone = caminho de imagem (opcional), cor = cor da borda. */
  function mostrar(txt, icone, cor) {
    fila.push({ txt, icone, cor });
    if (fila.length > 4) fila.splice(0, fila.length - 4); // não acumula atraso
    if (!ocupado) proximo();
  }
  function proximo() {
    const a = fila.shift();
    const el = $('aviso-topo');
    if (!a) { ocupado = false; return; }
    ocupado = true;
    $('aviso-topo-txt').textContent = a.txt;
    const img = $('aviso-topo-img');
    img.hidden = !a.icone;
    if (a.icone) img.src = a.icone;
    el.style.borderColor = a.cor || '';
    el.hidden = false;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); setTimeout(proximo, 280); }, 2100);
  }
  return { mostrar };
})();

const Meme = (() => {
  const { $ } = Comum;
  const INTERVALO = 20000, DURACAO = 4600;
  const ler = (k) => { try { const v = localStorage.getItem(k); return v === null ? true : v === '1'; } catch (e) { return true; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { /* navegação privada */ } };
  const cfg = { memes: ler('ludo-memes'), som: ler('ludo-som') };
  let ultimo = 0, timer = null, vez = 0, blob = null, url = null, audio = null;

  // a animação é baixada uma vez; a cada exibição criamos um blob URL novo para ela começar do início
  function carregar() {
    if (blob) return Promise.resolve(blob);
    return fetch('meme/meme_perdeu_pino.webp').then((r) => r.blob()).then((b) => (blob = b)).catch(() => null);
  }

  /** Mostra o meme com a legenda. forcar = ignora o intervalo de 20 s (botão de teste). */
  async function mostrar(legenda, forcar) {
    if (!cfg.memes) return;
    const agora = Date.now();
    if (!forcar && agora - ultimo < INTERVALO) return;
    ultimo = agora;
    vez++;
    const box = $('meme'), img = $('meme-img'), vid = $('meme-video');
    const cabra = vez % 2 === 0; // alterna entre os dois memes
    if (!cabra) {
      const b = await carregar();
      if (url) URL.revokeObjectURL(url);
      url = b ? URL.createObjectURL(b) : 'meme/meme_perdeu_pino.webp?' + agora;
      img.src = url;
      img.hidden = false; vid.hidden = true; vid.pause();
      if (cfg.som) {
        try { audio = audio || new Audio('meme/meme_perdeu_pino.mp3'); audio.currentTime = 0; audio.volume = 0.9; audio.play().catch(() => {}); } catch (e) { /* sem som */ }
      }
    } else {
      img.hidden = true; vid.hidden = false;
      if (!vid.src) vid.src = 'meme/meme_cabra.mp4';
      vid.muted = !cfg.som; vid.currentTime = 0;
      vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
    }
    $('meme-legenda').textContent = legenda;
    box.hidden = false;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(fechar, DURACAO);
  }
  function fechar() {
    const box = $('meme');
    box.classList.remove('show');
    clearTimeout(timer);
    try { if (audio) audio.pause(); $('meme-video').pause(); } catch (e) { /* ok */ }
    setTimeout(() => { if (!box.classList.contains('show')) box.hidden = true; }, 350);
  }
  $('meme').addEventListener('click', fechar);

  // ---------- configurações ----------
  function pintar() {
    $('chave-memes').setAttribute('aria-checked', String(cfg.memes));
    $('chave-som').setAttribute('aria-checked', String(cfg.som));
  }
  $('chave-memes').onclick = () => { cfg.memes = !cfg.memes; gravar('ludo-memes', cfg.memes); if (!cfg.memes) fechar(); pintar(); };
  $('chave-som').onclick = () => { cfg.som = !cfg.som; gravar('ludo-som', cfg.som); if (!cfg.som) { try { if (audio) audio.pause(); $('meme-video').muted = true; } catch (e) { /* ok */ } } pintar(); };
  const abrir = () => { pintar(); $('config').hidden = false; $('config-fechar').focus(); };
  const fecharConfig = () => ($('config').hidden = true);
  ['btn-config-sala', 'btn-config-jogo'].forEach((id) => { const b = $(id); if (b) b.onclick = abrir; });
  $('config-fechar').onclick = fecharConfig;
  $('config').addEventListener('click', (e) => { if (e.target === $('config')) fecharConfig(); });
  $('config-testar').onclick = () => { fecharConfig(); mostrar('Teste: alguém perdeu o pino!', true); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('config').hidden) fecharConfig(); });

  return { mostrar, fechar, cfg };
})();
