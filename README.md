# Ludo de Sofá

Ludo para jogar em grupo: o **tabuleiro** fica no computador ou na TV, e cada jogador usa o **próprio celular como controle**. O celular entra lendo um QR code.

## Como jogar

1. No computador/TV, abra o site e clique em **Criar sala**. Aparece um QR code e o número da sala.
2. Cada jogador aponta a câmera do celular para o QR code, abre o link e escolhe uma cor.
3. O celular fica esperando na sala. Com **2 jogadores ou mais**, o botão **Começar partida** é liberado no tabuleiro.
4. Na sua vez, o celular vibra: toque no **dado** (no meio da tela) e depois escolha qual **pino (1 a 4)** vai andar.
5. O tabuleiro mostra tudo: o dado girando, os pinos andando casa por casa e as capturas.

Regras: só sai da base com 6; tirar 6, capturar ou chegar com um pino dá outra jogada; as casas de saída e as estrelas são seguras; para chegar ao centro precisa do número exato.

Se um celular cair (tela bloqueou, saiu do Wi-Fi), é só abrir o link de novo **no mesmo celular**: ele volta para a mesma cor. No tabuleiro, o botão **Mostrar QR code** mostra o QR durante a partida.

## Publicar no GitHub Pages (sem precisar de servidor)

1. Crie um repositório no GitHub, por exemplo `ludo-de-sofa` (público).
2. Envie os arquivos desta pasta para o repositório:
   - pelo site: **Add file → Upload files**, arraste o conteúdo da pasta (o `index.html` tem que ficar na raiz) e clique em **Commit changes**; ou
   - pelo terminal:
     ```bash
     git init
     git add .
     git commit -m "Ludo de Sofá"
     git branch -M main
     git remote add origin https://github.com/SEU_USUARIO/ludo-de-sofa.git
     git push -u origin main
     ```
3. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, escolha **main** e pasta **/ (root)**, e salve.
4. Em 1 ou 2 minutos o jogo fica em `https://SEU_USUARIO.github.io/ludo-de-sofa/`.

## Como funciona a conexão

O GitHub Pages só hospeda arquivos, então a conversa entre a TV e os celulares é feita com **WebRTC** usando a biblioteca [PeerJS](https://peerjs.com):

- O tabuleiro se registra no servidor gratuito do PeerJS com o nome `ludo-de-sofa-v1-<número da sala>`.
- O QR code leva para `index.html?sala=<número>`; o celular procura esse nome e se conecta **direto** ao tabuleiro.
- O tabuleiro é quem manda: ele guarda o estado, aplica as regras e envia o estado para todos. O celular só pede "sentar", "rolar" e "mover" — e o tabuleiro confere se é a vez dele.

Funciona melhor com todo mundo no **mesmo Wi-Fi**. Em 4G costuma funcionar também (o PeerJS usa um servidor de retransmissão gratuito quando a conexão direta falha), mas redes muito fechadas (Wi-Fi de empresa, por exemplo) podem bloquear.

## Estrutura

```
index.html          tela inicial, tabuleiro e controle (a URL decide qual aparece)
css/estilo.css      visual
js/regras.js        regras do Ludo, sem tela nem rede (dá para testar sozinho)
js/comum.js         dado, sons, vibração, ID do aparelho
js/mesa.js          tabuleiro: rede, desenho em SVG e animações
js/controle.js      celular: rede e telas do controle
js/app.js           decide se a página é tabuleiro ou controle
                    (PeerJS 1.5.4 e qrcode-generator 1.4.4 vêm do CDN jsDelivr)
testes/             testes das regras
```

## Testar

**Regras** (precisa do Node.js):
```bash
node testes/regras.test.js
```

**Sem celular:** abra o site com `?teste` no final (ex.: `https://SEU_USUARIO.github.io/ludo-de-sofa/?teste`). Na sala aparece **Adicionar jogador local** em cada cor; aí dá para jogar tudo pelo mouse (botão **Girar dado** e clique no pino do tabuleiro). Dá para misturar jogadores locais com celulares.

**No computador antes de publicar:** rode `python3 -m http.server 8080` na pasta e abra `http://localhost:8080`. Para o celular entrar, use o IP do computador na rede (ex.: `http://192.168.0.10:8080`) em vez de `localhost`, senão o QR code aponta para o próprio celular.

**Servidor PeerJS próprio (opcional):** se o servidor gratuito estiver fora do ar, rode um com `npx peerjs --port 9000` e abra o tabuleiro com `?servidor=IP_DO_COMPUTADOR:9000`. O QR code já leva esse parâmetro para os celulares.
