# Jogos de Sofá

Jogos para a turma: o jogo aparece na TV ou no computador e cada pessoa joga pelo **próprio celular**, lendo um QR code. Sem instalar nada.

Site: https://darlen-king.github.io/jogos-de-sofa/

## Ludo

1. No computador/TV, abra **Ludo** e clique em **Criar sala**.
2. Escolha o modo (**Clássico** ou **Super**) e o tempo por jogada (15 s, 30 s, 60 s ou sem tempo).
3. Cada jogador lê o QR code, digita o nome e escolhe uma cor. No Super, escolhe também a habilidade de cada pino.
4. Com **2 jogadores ou mais**, clique em **Começar partida**.
5. Na sua vez o celular vibra (no iPhone, a tela pisca e toca um som): toque no dado e escolha o pino. O pino que pode capturar alguém aparece com o selo **Captura!**.
6. Se o tempo acabar, o dado gira sozinho e anda o pino mais à frente. Perto do fim do tempo o celular vibra cada vez mais rápido.

### Regras do Clássico
- Só sai da base com 6. Tirar 6, capturar ou levar um pino ao fim dá outra jogada.
- Casas de saída e estrelas são seguras. Para chegar ao centro precisa do número exato.
- Três 6 seguidos: os dois primeiros valem, o terceiro é anulado e a vez passa.

### Ludo Super
Tudo do Clássico, mais:
- **Bloqueio:** dois pinos da mesma cor na mesma casa não podem ser capturados (o adversário pode passar ou parar ali).
- **Pontos:** +1 por casa nova andada, +10 por captura, +50 por pino que chega. Servem para comprar poderes; quem vence ainda é quem leva os 4 pinos primeiro.
- **Poderes** (1 por turno):

Depois de girar o dado (não custam pontos; 2 usos de cada por partida, mostrados como bolinhas; tocar de novo no poder cancela):

| Poder | O que faz |
|---|---|
| Retroceder | Um pino volta o número que saiu; não passa da casa de saída; pode capturar; 6 joga de novo |
| Proteção máxima | O pino fica imune a captura até a próxima vez do dono; depois você ainda anda normal (bolha azul) |
| Ponto de segurança | O pino anda normal e a casa onde parar vira segura por 2 rodadas do dono (só no caminho principal) |

Antes de girar (o preço dobra a cada uso daquele poder):

| Poder | Preço inicial | O que faz |
|---|---|---|
| Fuga de pino | 10 | Tira um pino da base sem 6; você não gira neste turno |
| Dado super | 15 | O dado cai só em par, ímpar, 1–3 ou 4–6 |
| Buraco negro | 30 | A casa do pino prende quem cair (sai somando 10 no dado); vizinhos andam metade |
| Dado a dedo | 40 | Você escolhe o número; o 6 não dá jogada extra |

- **Habilidades dos pinos** (uma por pino, sem repetir):

| Habilidade | Formato | Efeito |
|---|---|---|
| Normal | círculo | — |
| Corredor | com rastro | +2 em toda jogada |
| Tanque | octógono | anda metade, aguenta 1 captura a cada saída da base |
| Vácuo | redemoinho | até 6 casas atrás de um adversário, anda de graça 1/3 do que ele andar |
| Laço | corda | adversário até 3 casas à frente anda 2 a menos |
| Ligeiro | raio | sai da base com 5 ou 6 |
| Banqueiro | moeda | pontos em dobro andando |
| Vingativo | espinhos | quem o captura perde 20 pontos |
| Blindado | escudo | imune a buraco negro e laço |

Ordem dos ajustes no movimento: Tanque (metade) → Corredor (+2) → Laço (−2) → vizinho de buraco negro (metade) → no mínimo 1 casa.

- **Sinais na TV:** cada pino com habilidade tem um selo no canto (vento, corrente, raio, ½, seta, $, !, escudo). Depois do dado, se a habilidade vai funcionar, o selo pulsa e o destino ganha uma etiqueta ("+2", "metade", "−2 laço"). Quando ela acontece, o pino dá um pulo e aparece um aviso no topo. Pino preso no buraco negro: cadeado e pino apagado. Destino no buraco: vermelho com "buraco!".
- **Meme:** quando alguém perde um pino (captura ou buraco negro), aparece um meme no canto da TV por uns 4 segundos (no máximo 1 a cada 20 s). Botão **Memes e som** na TV liga/desliga, salvo no aparelho.

## Bomba no Sofá
Jogo de cartas de 2 a 5 jogadores, inspirado nos jogos de "batata quente" com bombas, com cartas e desenhos próprios. Cada um vê a própria mão no celular; a TV mostra a mesa.

- Todo mundo começa com 7 cartas + 1 **Desarmar**. O monte tem uma **Bomba** a menos que o número de jogadores.
- Na sua vez, jogue quantas cartas quiser e termine **comprando** uma. Comprou Bomba sem Desarmar? Explodiu. O último que sobrar ganha.
- Cartas: Ataque, Pular, Favor, Embaralhar, Espiar o futuro, Não!, Desarmar e as de sofá (Pipoca, Chinelo, Controle, Meia, Ursinho).
- Combos: 2 iguais (rouba carta aleatória), 3 iguais (pede uma carta pelo nome), 5 diferentes (pega do descarte).
- **Janela do Não!**: cada carta jogada abre uma contagem (3, 5 ou 8 s, escolhida na sala). Quem tem Não vê um botão grande no celular; quem não tem só vê a contagem. Cada Não recomeça a contagem e também pode ser negado.
- Tempo por vez opcional (30/60/90 s): se acabar, o jogo compra por você.
- O celular nunca recebe as mãos dos outros nem a ordem do monte.

## Como funciona
O GitHub Pages só hospeda arquivos. A conversa entre a TV e os celulares usa **WebRTC** com a biblioteca [PeerJS](https://peerjs.com): a TV se registra no servidor gratuito do PeerJS e o celular se conecta direto a ela. A TV é quem manda: guarda o estado, aplica as regras e controla o tempo. O celular só faz pedidos (sentar, girar, mover, usar poder), e a TV confere se pode.

## Estrutura
```
index.html            página inicial com os jogos
comum/base.css        cores, fontes e peças visuais de todos os jogos
comum/comum.js        conexão, dado, sons, vibração, nome e ID do aparelho
ludo/index.html       tabuleiro e controle do Ludo (a URL decide qual aparece)
ludo/css/ludo.css     visual do Ludo
ludo/js/regras.js     regras do Clássico e do Super, sem tela nem rede
ludo/js/pecas.js      desenho dos pinos de cada habilidade
ludo/js/mesa.js       tabuleiro: rede, tempo, desenho e animações
ludo/js/controle.js   celular: rede, vibração, poderes e habilidades
ludo/js/efeitos.js    aviso no topo da TV, meme e o botão Memes e som
ludo/js/app.js        decide se a página é tabuleiro ou controle
ludo/img/             ícones dos poderes de depois do dado
ludo/meme/            animação e som do meme
ludo/testes/          testes das regras
bomba/                mesma organização para o Bomba no Sofá (regras.js, cartas.js, guia.js, mesa.js, controle.js)
```

## Testar
- Regras: `node ludo/testes/regras.test.js` e `node bomba/testes/regras.test.js`
- Várias abas de celular no mesmo navegador (Bomba): acrescente `&eu=2`, `&eu=3`… ao link da sala.
- Sem celular: abra `ludo/?teste`. Aparece **Adicionar jogador local** em cada cor, e dá para jogar pelo mouse.
- No computador: `python3 -m http.server 8080` na pasta. Para o celular entrar, use o IP do computador (ex.: `http://192.168.0.10:8080`).
- Servidor PeerJS próprio (opcional): `npx peerjs --port 9000` e abra o tabuleiro com `?servidor=IP:9000`.

## Ideias para depois
- Emojis de reação (bonequinho rindo ao capturar), mais memes.
