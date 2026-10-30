# Modelo editorial — snapshot E1.3 para revisão

Estado em 30/10/2026: implementação local do E1.3 preparada para revisão do coordenador. Etapa 1 em 25% (2/8); E1.3 e A1 ainda não declaradas concluídas. Base de retomada: develop em 3debe06; núcleo já registrado em 90e5602, afd4743 e 56cd2e8. Commits em inglês, Conventional Commits e unidades funcionais coerentes.

| Collection            | Responsabilidade                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cases                 | Identidade UUID compartilhada, internalTitle, sortOrder e featured; sem texto/status das traduções                                                        |
| case-content          | case + locale pt/en; drafts/versões por documento; eyebrow/title/summary/introduction/slug/cover, role/scope/contextNote, sections e seo                  |
| site-navigation       | Dois documentos estruturais: rótulos fixos de header/footer, controles e mensagens globais; sem contatos/PDF duplicados                                   |
| professional-profiles | Identificação, Home, projetos da Home, listagem, Sobre/Trajetória, Abordagem, página Sobre de arranjos fixos, contatos, currículo e SEO                   |
| case-routes           | Registro único locale/slug/case/content/everPublished/state; modelo e índice disponíveis; ciclo de reservas/resolução é E1.5                              |
| media                 | Dependência privada de schema para relações de imagem/PDF; criação, alteração, exclusão e processamento bloqueados até E1.6, inclusive com overrideAccess |

O nome físico de professional-profiles é profiles para respeitar os limites de nomes do PostgreSQL. As imagens guardam alt/decorative/caption no uso editorial; não há alt obrigatório em PT compartilhado com EN. Não houve importação de arquivos profissionais ou publicação.

Os únicos blocos são text, image e image-pair. O terceiro admite presentation pair/comparison e rótulos antes/depois. As chaves UUID readingKey de seções/blocos são preenchidas pelo servidor, preservadas por identidade da linha em renomeação/reordenação, e não podem ser trocadas ou repetidas dentro do documento. Uma tradução pode copiar explicitamente as chaves correspondentes. case e locale são obrigatórios mesmo em drafts e imutáveis no servidor. Os estruturais não podem ser excluídos nem mudar de idioma.

## Índices e migrações

| Tabela/índice                  | Regra                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| site_navigation e profiles     | UNIQUE(locale) na tabela principal, versões sem unicidade editorial                          |
| case_content / case_locale_idx | UNIQUE(case_id, locale); índice version_case_version_locale_idx não único em _case_content_v |
| case_routes / locale_slug_idx  | UNIQUE(locale, slug)                                                                         |

As corridas são inserções simultâneas pela Local API real, com editor nativo e overrideAccess:false; não existe SQL paralelo de negócio. O afterError traduz somente o envelope nativo esperado de case_content/case_id, locale/valueMustBeUnique para HTTP409 translation-conflict. Outros erros não recebem essa tradução.

Migrações nativas desta tarefa: 20261030_020021_editorial_models, 20261030_020521_structural_uniqueness, 20261030_024431_case_locale_uniqueness, 20261030_024640_route_locale_slug_uniqueness e 20261030_030036_global_editorial_copy. A última acrescenta identificação editorial do case e textos de controles/mensagens, projetos/listagem e SEO da listagem. Os snapshots JSON foram formatados integralmente, comparando o JSON parseado completo antes/depois. O DDL permaneceu intacto; somente bindings payload/req não usados foram removidos dos parâmetros gerados. Tipos Payload e import map foram gerados pelo CLI instalado.

## Entradas e DTOs

Cada feature possui contracts Zod e mapeadores em server/map-*.ts. Tipos públicos derivam dos schemas; tipos persistidos derivam das collections Payload. beforeOperation valida e aplica o dado parseado/normalizado; validação de identidade apenas verifica o documento mesclado, sem descartar campos dele. Helpers contêm só infraestrutura de validação, sem importar features; a composição respeita E1.2.

Lexical admite parágrafos, quebra suave nativa, listas ordenadas/não ordenadas inclusive aninhadas, links, bold e italic. A fronteira valida a árvore recebida pela API e rejeita HTML, scripts, estilos/alinhamentos livres, headings livres, embeds, vídeos, carrosséis e quarto bloco. As provas usam comando/nós Lexical instalados, não apenas JSON escrito à mão.

O drawer nativo de LinkFeature oferece destinos fechados: páginas home/cases/about, case por UUID compartilhado, currículo do idioma, contato contextual e URL externa HTTP(S)/mailto sem credenciais. Campos condicionais mostram apenas a alternativa ativa. Valores inativos da serialização nativa são descartados; nunca determinam o destino. O LinkFeature reaplica url vazia por default, mas a URL antiga não persiste após external→page, e o DTO remove o campo vazio. O consumidor real fieldSchemasToFormState + reduceFieldsToValues grava os sete destinos e faz reload de edição. Destino/recurso ainda vazio é permitido no draft; destino fora do enum, UUID inválido ou protocolo perigoso ativo são rejeitados. E1.4 deve exigir completude do destino ativo antes de publicar.

mapCaseDetail usa o título traduzido, deriva contents/âncoras de readingKey e preserva os três blocos; não expõe internalTitle, IDs administrativos, status ou timestamps. mapImageUse expõe identidade da mídia e metadados do uso, sem filename/original/metadata privados; dimensões, variantes e entrega são E1.6. mapNavigation conserva a ordem e finalidade fixa dos quatro itens, compõe contatos/currículo do ProfileDTO do mesmo idioma, e usa /pt/sobre e /en/about (sem alias /pt/about). Todos os mapeadores de documentos publicados retornam undefined para draft.

ProfileDTO é deliberadamente mínimo no E1.3: identificação, textos principais da Home, listagem, contatos, resumeId e textos SEO. O modelo persistido já inclui homeProjects, homeAbout/trajectory, approach/methods, about, retratos/fotografias e imagem SEO. Os DTOs completos desses grupos e a resolução/entrega da mídia serão adicionados junto dos consumidores públicos posteriores; não há vazamento automático do documento do CMS.

## Provisionamento explícito

A composição config/provision-structural-documents.ts chama ensureNavigationDrafts e ensureProfileDrafts pelas entradas públicas server.ts. Cada operação filha recebe o mesmo req da unidade. Sem transação externa, a composição abre/fecha sua própria transação; conflito UNIQUE locale esperado causa rollback e retry com nova request/transação (máximo quatro tentativas). Uma transação já recebida pertence ao caller, sem commit/rollback oculto pela composição.

Ordem operacional local: configurar o ambiente local do projeto, usar Node24.22.2/pnpm12.10.1, executar pnpm migrate e depois pnpm provision:structural. O segundo é payload run src/config/provision-structural-documents.cli.ts, explícito e somente APP_ENV local/test nesta etapa. Usa getPayload com disableOnInit:true e finally destroy. Não migra, não faz schema push, não roda em onInit/build/start e não publica conteúdo. O mecanismo custom bin da versão instalada captura erros e termina com zero; payload run foi escolhido para propagar falha com saída não zero.

Sem conta humana inicial, o CLI usa req.context.trustedStructuralProvisioning, capacidade interna que só abre criação/leitura dos dois grupos estruturais para localizar/criar os drafts ausentes. HTTP não define req.context. O caminho não abre update/delete/readVersions, cases, media ou users, não cria editor fictício e não abre signup. Testes com editor continuam usando usuário real e overrideAccess:false; testes próprios cobrem o caminho sem usuário, repetição e escopo restrito. O CLI real foi executado duas vezes no banco isolado, mantendo IDs/updatedAt/status e quantidade, sem criar contas.

## Limites preservados

E1.4 completa publicação/restore/revisões/leases e completude editorial; E1.5 completa slugs/reservas/resolução; E1.6 implementa upload/variantes/privacidade; E1.7 conclui contas/prévias/recuperação. Media read=false protege a API normal; overrideAccess pode ler metadata internamente, mas não libera gravação/processamento/entrega. A decisão pendente sobre imagens animadas não impôs restrição adicional. Riscos herdados de E1.1 e BLOCK-GITHUB-BRANCH-PROTECTION seguem registrados. Evidências e comandos em docs/verification/E1.3.md.
