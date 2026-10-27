/* =====================================================================
   app.js — decide o que esta página é:
   - sem nada no endereço  -> tela grande (cria a sala)
   - com ?sala=1234        -> controle do celular
   ===================================================================== */
(() => {
  const params = new URLSearchParams(location.search);
  const sala = params.get('sala');

  if (typeof Peer === 'undefined') {
    document.body.innerHTML = '<p style="padding:24px">Não consegui carregar a biblioteca de conexão (PeerJS). Verifique a internet e recarregue a página.</p>';
    return;
  }

  if (sala && /^\d{4}$/.test(sala)) {
    Controle.iniciar(sala);
  } else {
    Comum.mostrar('inicio');
    if (location.protocol === 'file:') Comum.$('aviso-local').hidden = false;
    Comum.$('btn-criar').onclick = () => { Comum.Som.liga(); Mesa.abrir(); };
  }
})();
