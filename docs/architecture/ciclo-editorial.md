# Ciclo editorial e concorrência

Escopo consolidado de E1.4, com ordem transacional e composição complementadas por E1.5. Etapa 1 em 50% (4/8); E1.5 permanece em revisão/gate independente. A1 e E1.6–E1.8 permanecem pendentes.

## Responsabilidades e transições

As features possuem as validações de publicação e as operações `publishCase`/`restoreCaseDraft`, `publishNavigation`/`restoreNavigationDraft` e `publishProfile`/`restoreProfileDraft`. O helper técnico registra capacidades na composição das collections, sem conhecer seus nomes ou suas regras de conteúdo. `cases` compartilhado usa a mesma proteção de edição, sem ganhar status traduzido nem publicar traduções ao alterar ordem/destaque.

| Ação                                  | Gravação                                                      | Efeito público                                                        |
| ------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Criar rascunho                        | Cabeça inicial e versão draft, com identidade obrigatória     | Nenhum                                                                |
| Salvar draft                          | CAS da cabeça + versão draft na mesma transação               | Publicado anterior permanece                                          |
| Publicar                              | CAS + validação da feature + documento/versão publicados      | Somente grupo/documento/idioma escolhido                              |
| Retirar case                          | CAS + estado draft no documento corrente                      | Só a tradução escolhida deixa de ser pública                          |
| Retirar Navegação/Perfil já publicado | Erro e rollback                                               | Publicado anterior permanece                                          |
| Recuperar versão histórica            | CAS + nova versão draft, com identidade imutável              | Publicado anterior permanece; publicar exige outro ato                |
| Excluir documento permitido           | Revisão + lease + hooks nativos + exclusão na mesma transação | Respeita as restrições da feature; estruturais continuam inexcluíveis |

A validação informa caminhos específicos. Cases exigem título, resumo, papel, slug válido, capa e pelo menos um bloco; os usos de imagens exigem classificação/alternativa adequada, e links tipados exigem completar o destino ativo. Navegação exige os textos fixos de header, footer, controles e mensagens. Perfil exige textos dos grupos fixos, contatos, imagens editoriais, currículo e ao menos um item de trajetória/método. Ênfases opcionais, legendas e SEO com derivação permitida não se tornam campos obrigatórios arbitrários. Validação de bytes e promoção de mídias pertencem às próximas tarefas. As reservas integradas à transação editorial estão descritas em [rotas e reservas](rotas-e-reservas.md), no escopo E1.5 ainda em revisão.

Na atualizacao nativa do Payload 3.92.1, `draft:true` nao garante que a operacao sera privada: um `_status:'published'` explicito faz `isSavingDraft` ser falso e publica. A guarda valida o status efetivo recebido em `beforeChange`, sem usar a query/flag draft como isencao. Na criacao, o proprio Payload normaliza essa combinacao para draft. Os testes caracterizam ambas as entradas e preservam a intencao nativa de publicar dados validos explicitamente, alem de permitir rascunhos incompletos com status draft.

Um bloco de texto publicado exige ao menos uma folha textual significativa, inclusive dentro de paragrafos, listas ou links; raiz com paragrafo vazio ou somente espacos continua permitida em draft. O predicado usa trim somente como teste e nao altera a string armazenada. Artigos compostos por imagens validas nao passam a exigir um bloco de texto.

## Revisão vinculada ao conteúdo

`editorialRevision` na tabela principal é a cabeça autoritativa, inclusive quando o conteúdo novo existe apenas numa versão draft. `contentRevision` é o marcador do conteúdo selecionado, gravado junto de cada documento/versão. A leitura autenticada entrega como revisão observada o marcador desse snapshot, nunca uma cabeça consultada depois de selecionar conteúdo antigo. O marcador interno é removido da resposta. Leituras anônimas removem todos os campos técnicos; DTOs públicos também não os incluem.

O CAS usa exclusivamente `req.payload.db.updateOne({options:{atomic:true},where,data,req})` do adaptador oficial e campos escalares principais. A condição inclui ID, revisão esperada, dono, token e prazo do lease. Depois da aquisição, os dados da operação recebem a revisão nova e seu marcador. Conteúdo, versão, cabeça e espelho de lock participam da mesma transação. Mutações sem `req.transactionID`, inclusive Local API com `disableTransaction:true`, são recusadas. Falhas de validação revertem também a cabeça. UUIDs são opacos: não oferecem ordenação de eventos para a futura coordenação E1.8.

Payload mescla dados persistidos antes de `beforeChange`. Em E1.5, a revisão e o lease observados são validados e o CAS de update ocorre em `beforeOperation`, antes de o native remover o espelho de lock. Uma confirmação privada ligada a collection/id/transação é consumida uma vez em `beforeChange`; leituras não a apagam. A revisão observada no corpo prevalece sobre um header contraditório; o lease usa o header explícito quando presente, ou o corpo do formulário nativo. Delete reivindica a cabeça antes dos hooks da feature. Restore conserva seu caminho protegido e não executa a remoção nativa antecipada do mirror. Essa ordem corrige as duas inversões reais reproduzidas por E1.5, sem retry que esconda conflito. Os comandos de publicação não obtêm um lease novo ao ler o draft: exigem `x-editorial-lease` recebido pelo chamador. As operações de atualização nativas podem transportar os valores no corpo; unpublish/delete/restore usam headers.

## Lease e painel nativo

Prazo: 300 segundos sem renovação. Aquisição, renovação e saída usam o adaptador oficial com owner + token. Uma aba antiga não libera um lease renovado/readquirido. Abrir explicitamente o documento rotaciona o token para que a desmontagem da tela anterior não libere o novo render. A revisão de conteúdo permanece independente. Atividade de ponteiro/teclado renova no máximo a cada dez segundos; uma aba abandonada não mantém um heartbeat eterno. Renovação/foco/reaquisição não mudam a revisão observada pelo formulário.

`payload-locked-documents` é um espelho nativo, nunca a autoridade. A sincronização usa CRUD técnico do adaptador na mesma transação da linha principal. A aplicação envolve `RootPage`, `handleServerFunctions` (`form-state` e `render-document`) e o `buildFormStateHandler` público, com `returnLockStatus:false` ao delegar. A resposta fornece o estado nativo com `lastEditedAt = expiresAt - 300s`, porque o consumidor do Payload acrescenta a duração. O segundo editor recebe a tela nativa em leitura. Após liberação/expiração, atualizar a tela permite adquirir edição, mas revisão antiga continua inválida.

O slot público de ações da versão mantém a comparação nativa. A fachada RootPage captura cedo a revisão e passa um valor de render servidor em searchParams sobrescrito pela aplicação; isso não altera a URL nem aceita a revisão apresentada na query do visitante. O botão de recuperação congela esse snapshot. Save/SaveDraft/Publish continuam nativos; ações pequenas com `Button`, `PopupList.Button` e `ConfirmationModal` nativos transportam revisão/lease para restore/unpublish/delete.

Payload 3.92.1 não oferece slots de substituição para Delete/Restore legados nem para desativar Take Over isoladamente. CSS administrativo restrito pela presença dos campos/ações editoriais suprime `#action-delete`, `.restore-version`, `#document-locked-take-over` e `#take-over`. Os seletores são dependências de versão, verificadas nas jornadas. O servidor continua recusando chamadas sem revisão/lease; CSS não concede segurança. Bulk edit/delete ficam desativados e são rejeitados no servidor. Não há trash novo.

POST/PATCH/DELETE/PUT do lock interno passam pela fachada REST da aplicação e não podem roubar/liberar o lease autoritativo. Operações locais diretas sobre o espelho também não concedem permissão para gravar conteúdo. REST `overrideLock=true` e defaults privilegiados da Local API não ignoram as guardas. Conflitos autenticados retornam `409 locked` ou `409 stale-revision`; ausência de autorização continua erro de permissão. Falhas de publicação nativas preservam a forma de validação por campo do Payload.

## Recuperação e privilégios limitados

O wrapper Local `restoreVersion({draft:true})` desta versão não encaminha draft corretamente. A guarda recusa o caminho inseguro; a fachada `POST /versions/:id` e as operações de feature usam o export público `restoreVersionOperation` com draft verdadeiro desde a entrada. O pai é derivado da versão real. Uma capability Symbol, restrita à chamada de recuperação, permite esse uso; `context.isRestoringVersion` do Payload sozinho não autoriza nada. A publicação posterior executa a validação normal.

O contexto de bootstrap estrutural permanece limitado às duas collections que registram `editorialBootstrap`, sem conta humana fabricada, sem update/publicação, e somente pelo CLI local/teste aprovado. Helpers não importam features nem o config. O acesso ao adaptador para cabeça/lease/espelho é interno, autenticado e limitado às collections que registram a proteção; não existe segundo ORM ou SQL editorial em runtime.

As migrações acrescentam apenas colunas técnicas e fazem backfill técnico dos marcadores de versões preexistentes. A prova de roundtrip mantém título público e draft anterior, distingue seus marcadores e permite nova edição pelo painel/Local API normal depois do backfill.

## Consultas públicas e composição

`getPublishedNavigation(locale)` e `getPublishedProfile(locale)` usam idioma explícito, `_status=published`, `draft:false`, `overrideAccess:false`, `depth:0` e retornam DTOs mínimos. Navegação compõe contatos/currículo do Perfil publicado, conservando a dependência já definida pelo mapper E1.3; publicar Navegação não publica Perfil. As rotas públicas de consulta de cada collection exercitam essas funções sem req autenticado.

A composição `payload.config.ts` instala explicitamente o factory assíncrono em `helpers/payload/runtime.ts`, cujo módulo não importa config/features. Em E1.5, `instrumentation.register` carrega a composição no processo Node antes das entradas públicas. Somente o factory fica em Symbol.for/globalThis, pois os grafos independentes do Turbopack não compartilham uma variável local de módulo; não há conteúdo, usuário ou cache público global. Composição/HMR pode substituir o factory. O primeiro HTTP do processo novo é público e deve resolver o endereço desconhecido como 404 antes de abrir o admin. As rotas REST também compõem o config. Operações que recebem req usam `req.payload` e participam da transação do chamador.

## Limites nomeados

- `PAYLOAD-LEGACY-ACTION-SELECTORS`: seletores administrativos e formato dos pontos de integração precisam de revalidação ao atualizar Payload.
- `LEASE-UNLOAD-BEST-EFFORT`: navegação nativa libera o lease nas jornadas; fechamento/queda de conexão pode abortar o keepalive. A expiração autoritativa em 300s permanece como fallback. Teardown do navegador pode registrar ECONNRESET sem alterar conteúdo.
- `MEDIA-METADATA-FIXTURE-ONLY`: provas E1.4 usam metadados sintéticos pelo adaptador oficial, exclusivamente no banco isolado. Não provam upload, formatos reais, processamento, entrega nem promoção pública. O stub de mídia continua recusando CUD inclusive com override; E1.6/E1.8 devem provar bytes reais.
- `PUBLICATION-COORDINATION-E1.8`: receipts confirmam a gravação editorial local. Invalidação/propagação pública persistente, falhas parciais e retry ainda não estão implementados.
- Reservas de slug E1.5 permanecem em revisão independente; mídia E1.6, contas/prévias E1.7, coordenação E1.8 e A1 não foram declaradas concluídas.
