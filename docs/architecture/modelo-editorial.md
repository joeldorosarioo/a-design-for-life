# Modelo editorial — E1.3 em execução

Este registro descreve o primeiro snapshot de configuração. E1.3 ainda não está concluída; contratos/mapeadores, identidade e índices de case/rotas seguem no próximo conjunto. A1 permanece pendente.

| Collection            | Responsabilidade e configuração                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cases                 | Identidade UUID compartilhada, identificação interna, ordem e destaque; sem texto/status de traduções                                                                   |
| case-content          | Referência ao case e locale comum pt/en, drafts/versões por documento; abertura, papel/escopo/contexto, seções e três tipos de bloco                                    |
| site-navigation       | Documentos pt/en separados; somente rótulos/textos de header/footer. Finalidades/ordem e contatos/PDF não são duplicados                                                |
| professional-profiles | Identificação; Home; Sobre/Trajetória; Abordagem; página Sobre com arranjos fixos; contatos; currículo; SEO                                                             |
| case-routes           | Único registro futuro de reservas locale/slug/case/content/everPublished/state; ciclo completo de E1.5 ainda não implementado                                           |
| media                 | Dependência de schema para os campos upload; API normal privada; criação/alteração/exclusão e processamento bloqueados até E1.6, inclusive Local API com overrideAccess |

`professional-profiles` usa nome físico `profiles`: o gerador inicial apontou nomes de índices/FKs acima de63 caracteres. O nome foi encurtado antes de aplicar o schema. O slug público de collection e o grupo administrativo permanecem inalterados.

Imagens guardam alt/decorative/caption no uso editorial. O arquivo compartilhado não tem uma descrição PT obrigatória aplicada a EN. Nenhum arquivo profissional foi importado ou publicado.

Os únicos blocos são text, image e image-pair. Este último possui enum fechado pair/comparison e rótulos de antes/depois; não é construtor de colunas nem quarto bloco. Seções e blocos possuem readingKey; proteção/preenchimento de chaves e validações do contrato serão concluídos no conjunto de contratos.

Lexical está configurado com parágrafo, listas ordenadas/não ordenadas, link, bold e italic, mais toolbar nativa. Não foram habilitados heading livre, alinhamento, estilos, embeds, uploads ou HTML. A validação da árvore enviada por API será entregue no conjunto de contratos, sem afirmar que a toolbar é uma fronteira de segurança.

## Invariantes estruturais já comprovadas

Os dois grupos possuem UNIQUE(locale) na tabela principal e índices não únicos nas versões. Hooks de identidade impedem trocar locale e excluir os documentos, inclusive por chamada local com overrideAccess. As provas ficam junto de cada collection; fixtures limpam somente o banco adfl_test_* e suas versões, nunca usam o provisionador para pré-criar dados no teste do próprio provisionador.

O provisionamento em config compõe ensureNavigationDrafts e ensureProfileDrafts pelos server.ts públicos. A unidade sem transação externa abre/fecha transação própria; chamadas filhas recebem o mesmo req dessa unidade. Uma disputa de UNIQUE locale reverte a unidade e repete com req/transação novos, por no máximo4 tentativas. Não reaproveita sessão abortada nem engole qualquer ValidationError. Quando o caller já possui transação, ele mantém responsabilidade por commit/rollback.

CLI inicial, schemas Zod/mapeadores e índices compostos de cases/rotas ainda estão em execução. Publicação/restore/lease/stale são E1.4; upload real é E1.6. Nenhum destes itens pendentes foi declarado aceito neste snapshot.

A leitura normal da collection media é negada. A Local API com overrideAccess pode ler metadata internamente; esse privilégio não libera criação, alteração, exclusão nem entrega pública de arquivos. A finalidade e o escopo de leituras internas serão documentados com a implementação de E1.6.
