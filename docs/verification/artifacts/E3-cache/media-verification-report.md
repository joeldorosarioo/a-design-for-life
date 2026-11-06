# Observação de bytes da geração pública

Fatia local de E3.2. O planejador, o transporte e os marcadores dos handlers foram implementados e verificados em unidade. A chamada do planejador no caminho de confirmação ainda está aberta.

## Contratos exercitados

- `planPublicMediaObservations(root, subject)` usa a lista aprovada do assunto e a proveniência de rotas removidas. Ele classifica ambos com a primeira manifestação pública encontrada na raiz inteira, como a entrega existente. Um proprietário remanescente mantém a exigência de bytes válidos. A última retirada exige 404 sem corpo em GET, HEAD e GET com Range, sem faixa de bytes nem cache reutilizável.
- Para originais e derivados, a prova compara MIME, quantidade de bytes e SHA-256 da manifestação. O alvo do otimizador é somente `/_next/image` com o original codificado de um UUID, largura 64 e qualidade 75. A resposta positiva precisa ter corpo HTTP completo, MIME de imagem compatível com a assinatura e o marcador da geração. O teste não equivale a recodificar o conteúdo e comparar o hash com o original.
- A verificação mantém uma única conexão por GET/HEAD e um único prazo total de até cinco segundos por plano. São até 64 observações, 2 MiB por resposta textual, até 16 MiB por alvo de mídia positiva e até 10 MB no planejador do otimizador. O original/derivado usa seu próprio tamanho esperado como limite. Um 404 de mídia tolera zero bytes. Planos inválidos ou grandes demais falham sem enviar o primeiro pedido, sem amostragem silenciosa. Esses valores delimitam a prova local e não aprovam os limites operacionais de A3.
- A geração vem da mesma raiz usada pelo resolvedor de mídia e pelo guard externo do otimizador. O transporte de bytes e a assinatura interna existentes conservam sua forma. Um marcador de resposta interna não substitui o marcador da raiz. O contrato `resolveMediaAccess` mantém o resultado exato para os consumidores atuais. A prévia continua sem marcador. IDs desconhecidos e privados recebem a mesma negação vazia sob a mesma raiz.

## Recibos

| Recibo | Resultado |
| --- | --- |
| `media-verification-planner-transport-red.log` | 6 falhas esperadas e saída 1. Faltavam os alvos, o caminho canônico, o limite próprio do original e o limite zero das negações. |
| `media-verification-planner-transport-green.log` | 46 aprovados, saída 0. |
| `media-verification-generation-assertion-red.log` | 4 falhas de asserção do marcador ausente e saída 1, após corrigir a preparação do fixture de requisição local. |
| `media-verification-generation-green.log` | 6 arquivos, 101 aprovados, saída 0. |
| `media-verification-final-static.log` | TypeScript com entradas restritas, Prettier, ESLint e `git diff --check`, todos com saída 0. |
| `media-verification-architecture.log` | 34 aprovados, saída 0. |

Os nove caminhos com SHA-256 estão em `media-verification-final-sha256.txt`. O fixture da primeira tentativa de RED de marcador usou um spy incompatível com o namespace ESM do Payload. Esse erro de preparação foi descartado como prova comportamental. Os testes de negação usaram a preparação de requisição local do Payload com um adaptador de leitura controlado, arquivos temporários e o projeto unitário, sem PostgreSQL, servidor Next ou chamadas externas.

## Próxima prova integrada

- Anexar `planPublicMediaObservations(root, subjectKey)` à lista final de `planPublicationObservations` depois de conferir operação e revisão. Um Map com chave só pelo caminho descartaria as variantes GET, HEAD e Range. Usar o mesmo transporte e prazo global.
- Proteger a ativação para assuntos de mídia já promovidos e pendentes antes da proveniência. A ausência de `mediaObservation` nessa entrada precisa manter a confirmação pendente. Ao substituir um predecessor sem ACK e sem proveniência histórica, recusar a composição observada ou conservar uma marca explícita de evidência incompleta. Inventariar apenas sua mídia corrente perderia as remoções anteriores. A raiz histórica já reconhecida como pública pode continuar sendo lida e servir de base para a primeira promoção com o novo contexto.
- Prova Native isolada com o coordenador real e uma fronteira de observação local controlada. Partir de referência pública, substituir ou retirar sob falha de observação, conferir a lista gravada no arquivo e a operação pendente. Criar nova intenção para o mesmo assunto e exercer o estado `superseded` do predecessor ainda selecionado, depois confirmar que sua lista é preservada. Verificar que as demais linhas públicas ficam intactas. A prova unitária atual não executa a consulta `OR` do adaptador real.
- Prova Next isolada. Usar dois proprietários PT/EN para a mesma imagem e aquecer o alvo canônico do otimizador. Retirar o primeiro proprietário e observar bytes dos três tipos. Retirar o último e controlar uma resposta incorreta de mídia depois de retransmitir as páginas e DTOs corretos ao Next primário. A confirmação SQL fica pendente com a raiz já promovida. Reiniciar o servidor de confirmação com sua própria origem, manter build e raiz e observar a mesma operação concluir depois das negações vazias. O processo secundário também usa sua origem interna para a chamada interna do otimizador, então o listener de teste deve retransmitir ao primário, evitando recursão.
