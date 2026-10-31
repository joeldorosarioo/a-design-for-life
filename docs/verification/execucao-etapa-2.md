# Execução autorizada — etapa 2

**Etapa 2: 80,0% do checklist (24/30 itens); 3/6 tarefas inteiramente encerradas. A2 pendente.**

Indicador atual e evidências: [progresso-etapa-2.md](progresso-etapa-2.md). As porcentagens16,7% nos registros anteriores identificam a métrica histórica por tarefas fechadas; não são o indicador principal atual.

A1 aprovada explicitamente em 30/10/2026. Autorizadas somente E2.1–E2.6 na raiz E:\a-design-for-life, branch develop. Commits em inglês, Conventional Commits, por mudança coerente. Estimativa inicial: **18–28 horas de trabalho**, incluindo implementação, testes, comparação com o Figma e correções; atualizar diante de bloqueio concreto.

## Acompanhamento

- [x] E2.1 Tokens, primitivas e fundação de movimento — código, originais e evidências conferidos.
- [ ] E2.2 Header, footer, Home e Sobre.
- [ ] E2.3 Listagem, detalhe e apresentações editoriais.
- [x] E2.4 Resolução inicial e cookie funcional de idioma.
- [x] E2.5 Troca de idioma preservando a leitura.
- [ ] E2.6 SEO, acessibilidade, responsividade e aceite visual.
- [ ] Pacote A2 verificado e entregue.
- [ ] A2 aprovada pelo usuário — não iniciar etapa 3 antes disso.

## Contratos e limites preservados

Referências originais em docs/specs permanecem imutáveis. Modelos/DTOs, privacidade e geração pública confirmada de A1 continuam obrigatórios. Testes adjacentes, helpers/stylesheets e fronteiras por feature; TDD comportamental real. Conteúdo Figma/modelo permanece privado ou em ambiente isolado de teste, sem inventar resultados profissionais. Analytics somente na produção pública futura; integrações finais, infraestrutura e lançamento pertencem às etapas 3/4.

## Ambiente e verificações

Base 4f72388, limpa ao iniciar; Node portátil 24.22.2, pnpm 12.10.1, Next 16.4.3, Payload 3.92.1 e React 19.3.1. PostgreSQL dos testes próprios na porta 55433; preservar 5432 de outro projeto e 55432. Nenhum novo teste, build ou aceite é declarado neste registro inicial. Cada tarefa acrescentará evidências RED/GREEN, comandos, ambiente, exits e limitações.

## Referência visual e materiais

Figma PXUcVZFdLuOzHQZkD5PU4b, página 123:179. MCP Starter atingiu limite; inspeção pela interface normal autenticada e materiais oficiais prévios em pesquisa. O levantamento observou os 16 frames principais e as duas variantes do segundo case EN. Capturas vistas inline não são representadas como arquivos arquivados.

Cinco ativos exatos retornados pelo contexto oficial anterior e seus hashes ficam em work/stage2-reference, sem comprovação de serem uploads brutos originais. Retrato, fotos Sobre e outros materiais ainda indisponíveis serão nomeados antes de implementação afetada. Não contratar upgrade/serviço nem contornar quota. Tokens documentados, política de movimento e core puro de idioma seguem independentes. A preparação do core E2.4 não conclui sua integração HTTP/E2E e não altera a contagem de tarefas.

## Coordenação inicial

E2.1 é o único dono de instalação, lockfile, DB de teste, build, Next e gates globais. Pesquisa Figma usa somente o workspace do chat. O core de idioma usa arquivos disjuntos e testes unitários focados; integrações com páginas e cookie manual serão verificadas no momento de E2.4/E2.5. Aprovação/ledger, reviews e remoto continuam com o coordenador.

## Coleta visual alternativa autorizada

Em30/10/2026 o usuário autorizou explicitamente seguir pelo editor normal do mesmo Figma com evidências, após get_design_context e download_assets serem recusados pela quota Starter. Isso substitui a exigência da skill figma-design-to-code de implementar exclusivamente a partir de respostas get_design_context para os nós ainda sem contexto. Fonte visual, medidas, estilos, proveniência dos ativos e comparação de frames continuam obrigatórios; screenshots de páginas nunca viram assets do código. Sem upgrade, nova conta ou API interna.

Pré-requisitos E2.2 de contratos/links e core E2.4 têm testes focados e revisão; ambos permanecem parciais. A fundação E2.1 teve verify/smoke aprovados para seu snapshot; o estado combinado posterior exige gate atual.

## Gate integral do preparo combinado

Em30/10/2026, pnpm verify terminou exit0: **584 testes aprovados,1 skip específico do Windows,81 arquivos**, tipagem, lint sem erros (4warnings herdados), formato e buildNext16.4.3 aprovados. PostgreSQL real isolado55433/tmpfs removido pelo runner; PostgreSQL5432 de outro projeto preservado. Primeiro gate interrompeu antes dos testes/build por formatação de E2.1.md; a tentativa falha foi preservada, o documento formatado e o comando integral repetido. Não se conta essa falha de formato como RED comportamental.

[Fontes cobertas](artifacts/E2-preparation/source-snapshot.json), [logs e revisões](artifacts/E2-preparation/evidence-manifest.json). O snapshot identifica o estado combinado, sem atribuir essa cobertura a modificações posteriores. Warnings pg/client.query e mensagens esperadas dos testes de COMMIT/autorização permanecem no log. O checkCI exato e25jornadasE2E continuam necessários antes da promoção remota. Nenhuma tarefa E2 está concluída por esse gate isolado.

## Fechamento E2.1

Em 30/10/2026 a E2.1 foi concluída com o código da fundação verificado, cinco originais canônicos e cinco vetores conferidos, proveniência e slots documentados. Verificação focada atual: 11/11 testes; fixture SSR/hidratação/redução: seis cenários. O CI do código preparado 84ce799e51dd6af905c53f1861398990956e9021 aprovou 585 testes sem skips e 25 jornadas E2E em Ubuntu 24.04, run41106018907/job124235943055; promoção normal protegida para develop concluída. Essa cobertura não é atribuída a alterações posteriores em andamento.

Última orientação do usuário: uma única versão original por imagem, dimensões/recorte por CSS e otimização via next/image. Nove cópias processadas/duplicadas/extrações não canônicas foram removidas da pesquisa; o arquivo.fig original e os cinco originais escolhidos foram preservados. Capturas de página são evidência, uma por frame. A configuração segura do otimizador e as páginas continuam em implementação E2.2/E2.3; A2 não está concluída.

## Destino contextual indisponível

Em30/10/2026 o usuário decidiu que um link editorial para case sem publicação no idioma atual mantém seu texto, sem link clicável. A resolução usa exclusivamente a geração confirmada; não expõe URL de rascunho nem troca automaticamente o destino. Essa regra é separada da troca manual de idioma, que mantém listagem do idioma de destino mais aviso quando a tradução do case não está publicada.

## Gate do preparo de interface e transporte

Em30/10/2026 o estado combinado identificado em [source-snapshot.json](artifacts/E2-ui-transport-preparation/source-snapshot.json) passou `pnpm verify` (exit0): **729 testes aprovados,2 skips de plataforma Windows,95 arquivos**, tipagem, formato e buildNext16.4.3; lint sem erros e4warnings herdados. PostgreSQL17.11 real isolado/tmpfs55433 removido pelo runner; serviços de outro projeto preservados. Os2skips são regras de sistema POSIX/Linux, não falhas ocultas.

O log de `pnpm test:e2e` registra **33 jornadas aprovadas** e limpeza do banco próprio. O retorno final do PTY foi truncado/encerrado antes de preservar seu exit; esse campo permanece desconhecido no manifesto, sem inventar exit0. O CI do candidato imutável deverá registrar o resultado de processo. O build ainda não contém Home/Sobre/listagem públicas integradas e não comprova a aceitação visual dessas páginas.

Foram preservadas as duas tentativas anteriores: a primeira encerrou em4erros de tipagem de testes; a segunda teve728aprovados/1falha/2skips porque o teste tentou ler uma collection técnica pela LocalAPI que corretamente nega esse acesso. Corrigiu-se a tipagem do adapter Native existente, mantendo permissões; regressão focada real2/2 e repetição integral passaram. Instalação/tipagem/permissão inesperada não são RED comportamental de uma funcionalidade. [Logs completos, hashes e limites](artifacts/E2-ui-transport-preparation/evidence-manifest.json).

Os screenshots legados A1 regravados automaticamente pelas jornadas foram preservados como novas evidências separadas e os12originais A1 foram restaurados byte a byte do commit-base. O pacote A1 aprovado permanece imutável. Esse gate não conclui E2.2/E2.4, nem substitui o próximo gate após a integração das rotas.

## Trecho sem equivalente durante a troca de idioma

Em 30/10/2026 o usuário aprovou explicitamente: quando a página de destino existe, mas o trecho atual não tem equivalente, navegar para a seção correspondente mais próxima que contenha esse trecho; se não houver, ir ao topo. Mostrar aviso no idioma de destino. A correspondência usa somente a cadeia explícita de ancestrais com identidade de leitura, nunca título, índice, posição de um irmão ou porcentagem da página. Ao usar um ancestral, posicionar o início dessa seção na linha de leitura; o deslocamento de um filho ausente não representa uma posição equivalente no ancestral.

A regra é independente do case inteiro sem tradução publicada, que continua levando à listagem do idioma escolhido, no topo, com aviso. O texto do aviso de ajuste é uma mensagem técnica editável da Navegação. Chaves estáveis nas linhas do Perfil precisam ser geradas/preservadas e validadas no servidor, mantendo a edição independente PT/EN e sem reescrever snapshots antigos.

## Header visível durante a leitura

Em 30/10/2026 o usuário aprovou explicitamente manter o header visível no topo durante a rolagem, em desktop e celular. A decisão resolve o acesso ao seletor de idioma sem retornar ao início e perder a posição antes do clique. Preservar geometria e conteúdo inicial do Figma; adaptar os offsets de âncoras, contato e sumário à altura real do header para não encobrir destinos. Essa alteração de comportamento foi apresentada e aprovada; não é inferida da captura estática.

## Primeiras provas HTTP das páginas integradas

O aplicativo usa SSR nas páginas localizadas: layout force-dynamic, corpo e metadados consomem um memo React.cache por requisição e o pin imutável da geração escolhida pelo Proxy. Não usa SSG/ISR nessas quatro páginas; cache de imagens e snapshots de publicação têm responsabilidades próprias.

Em 30/10/2026, produção local Next16.4.3/Node24.22.2/PG17.11 tmpfs55433: `pnpm test:e2e public-pages.e2e.test.ts` exit0, seis jornadas aprovadas. Provam SSR sem JavaScript das quatro páginas PT/EN, navegação/currículo/contato, contagem e ordem observáveis, exclusão de tradução privada e teclado/Escape/foco do menu mobile. O suporte remove somente seus quatro documentos estruturais após conferir os IDs, preservando todos os cases e os serviços alheios. Comparação visual e aceite E2.2/E2.3 continuam abertos.

`pnpm test:e2e src/config/public-image.e2e.test.ts`: RED real exit1, esperado200/recebido404 com o otimizador global desativado. Depois da ativação protegida do Next.Image, GREEN exit0, uma jornada: WebP real a partir de um único original, MISS/HIT, HEAD sem corpo, private/no-store, retirada confirmada negando bytes mesmo no cache e rejeição de destinos externos/privados/inválidos. O build compilou as quatro rotas SSR e o Proxy. Não equivale a homologação de CDN, capacidade de memória ou operação final da etapa3.

## Acompanhamento refinado após a observação do usuário

O usuário apontou que16,7% permaneceu estático apesar dos avanços. O acompanhamento passa a usar16/30itens verificados (53,3%), com1/6tarefas encerradas informado separadamente. O escopo, os critérios finais, as evidências exigidas e a parada A2 permanecem os mesmos. Estimativa de trabalho restante informada ao usuário:12–18horas. Os registros históricos e logs não foram reescritos para sugerir progresso ou sucesso anterior.

## Pausa solicitada após o item dos cards

O usuário aprovou os campos opcionais/editáveis cardTitle/cardEyebrow e reforçou a edição editorial via CMS. Implementados com fallback do detalhe, migração aditiva e projeção confirmada/legada validada. RED/GREEN e38unit+6Native,tipos/lint/formato0; commitc3b4860. Verificação final do coordenador:44unit+2CSS,exit0. Nenhum fullverify/HTTP/build novo foi atribuído a esse commit. A pedido explícito, execução pausada após esse item; não iniciar outro trabalho nesta sessão. [Retomada e serviços/checkpoint](retomada-etapa-2.md).
