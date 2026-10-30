# Spec do portfólio profissional de Product Design e UX

Versão 1 — 29 de outubro de 2026

Status: spec consolidada para revisão, com as decisões da entrevista, inventário de referência e contratos do CMS. Não há nova pergunta de produto identificada. As decisões fechadas não devem ser reabertas como se ainda estivessem sem resposta. Exportação de ativos, detalhamento do plano e comprovação por testes pertencem à execução das etapas. Esta versão não autoriza iniciar a implementação.

Documentos complementares que integram esta spec:

- [Inventário do Figma e tokens visuais](2026-10-29-portfolio-inventario-figma.md).
- [Contratos de conteúdo e integração do CMS](2026-10-29-portfolio-contratos-cms.md).

Os complementos detalham a referência e os contratos aprovados; não autorizam ampliar o escopo. A spec principal prevalece em caso de conflito, e instruções posteriores explícitas do usuário continuam tendo precedência.

## 1. Objetivo e autoridade das decisões

Construir um portfólio para uma profissional de Product Design e UX, priorizando contatos de empregadores para emprego fixo. Freelances são uma oportunidade secundária. O site deve apresentar o trabalho de forma convincente e facilitar contato por e-mail e LinkedIn.

O sucesso funcional é permitir que um visitante conheça o perfil, avalie cases, obtenha o currículo e entre em contato, em português ou inglês. Não há meta numérica de conversão aprovada. Um clique em contato não comprova contratação ou proposta recebida.

As regras abaixo distinguem decisões de trabalho técnico restante:

- **Fechado:** decisão aprovada e obrigatória.
- **Decisão em aberto:** escolha de produto, comportamento, custos ou política ainda não aprovada. Exige proposta e resposta do usuário quando necessária para a etapa.
- **Proposta para revisão:** forma concreta sugerida neste documento, ainda sem aprovação específica.
- **Levantamento do agente:** informação a extrair do Figma, da documentação ou do ambiente, sem pedir ao usuário fatos que o agente possa verificar.
- **Detalhamento técnico:** desenho ou configuração a documentar no plano dentro das decisões aprovadas. Não exige uma nova entrevista para cada nome, biblioteca auxiliar, parâmetro ou teste; mudanças nas restrições aprovadas continuam dependendo do usuário.
- **Verificação de implementação:** evidência a produzir ao desenvolver, antes de declarar a etapa pronta. Ausência dessa evidência não reabre uma decisão já aprovada.

Prevalência: instruções posteriores explícitas do usuário, decisões aprovadas nesta spec, referência visual aprovada e instruções auxiliares das skills, respeitando as instruções superiores do ambiente. Contradições devem ser apresentadas ao usuário, sem escolher silenciosamente uma interpretação.

## 2. Escopo do produto

### 2.1 Fechado

- Home, listagem de cases, detalhe de case e Sobre.
- Português e inglês desde a primeira versão.
- Layouts responsivos para celular, tablet e desktop.
- E-mail como ação principal de contato e LinkedIn como alternativa.
- Currículo em PDF por idioma, gerenciado pelo CMS.
- Edição de cases, apresentação profissional, textos globais, header, footer, rótulos e destinos dos botões pelo Payload.
- Ordenação manual dos cases e seleção dos destaques da Home.
- Rascunho, prévia autenticada e publicação por idioma.
- SEO técnico, prévias de compartilhamento e medição de uso.
- Duas contas individuais com as mesmas permissões editoriais, sem cadastro público nem fluxo de aprovação entre pessoas.

O agente não pode acrescentar blog, busca interna, formulário de contato, loja, comentários, cadastro público ou funcionalidades semelhantes sem aprovação. Esses itens não fazem parte do escopo aprovado.

### 2.2 Referência visual e conteúdo

Fonte: [Figma do projeto](https://www.figma.com/design/PXUcVZFdLuOzHQZkD5PU4b/Untitled?node-id=123-179), página **03 · Layout proposto**.

**Fechado:** Figma determina cores, fontes, composição, componentes e formatos editoriais. Mudanças visuais relevantes exigem aprovação. Adaptações responsivas e de acessibilidade são obrigatórias; se implicarem mudança visual relevante, o agente apresenta a solução antes de aplicá-la.

O layout e os materiais do Figma são a referência aprovada. Na revisão do inventário, o usuário esclareceu que os trechos demonstrativos e de preenchimento são apenas modelos: devem permanecer em rascunho até a revisão do conteúdo final. Essa confirmação substitui a interpretação anterior de que todos os textos do Figma estavam prontos para publicação. O agente não pode inventar resultados, métricas, depoimentos ou experiências profissionais.

**Referência consolidada em P01:** o inventário complementar identifica os 18 frames de layout, 14 componentes de referência, estrutura das páginas e tokens documentados de cor, tipografia, espaçamento, raio, grid e breakpoints. O tratamento dos modelos como rascunhos está aprovado. Exportação dos ativos originais, conferência das propriedades internas de cada componente e comparação visual são tarefas da implementação, sem inventar conteúdo ou layout nem repetir escolhas já respondidas.

### 2.3 Inventário da referência em P01

Observações verificadas pelo navegador na página aprovada, sem introduzir novas decisões de produto:

- Frame `Home / Desktop · EN-US · Claro`, node `125:3765`: Navegação, Hero, Projetos, Sobre e trajetória, Abordagem e Footer.
- Hero, node `125:3767`: apresentação com título em tratamentos tipográficos distintos, descrição, botão de projetos e retrato.
- A árvore original de Navegação contém links de Projetos, Sobre e Abordagem, além do seletor de idioma. O item Abordagem foi substituído por Contato por decisão explícita do usuário; aplicar a alteração descrita na seção 3.5.
- Os nomes das camadas podem permanecer em português mesmo quando o texto renderizado está em inglês; não usá-los como transcrição final do conteúdo.

O catálogo completo de referências e tokens documentados está no inventário complementar. Os quatro itens do header e seus destinos estão definidos nas seções 3.5 a 3.7. Não criar página nem link de Abordagem no header; a seção da Home permanece. O botão de projetos usa o contrato de destino interno de projetos; não criar uma rota ou funcionalidade adicional para essa ação.

**Ampliação do inventário durante a revisão de P14/P01:**

| Referência inspecionada | Estrutura observada |
|---|---|
| Sobre / Desktop · EN-US · Claro, node `134:13298` | Navegação, artigo editorial e footer; abertura, introdução com retrato, percurso, imagem de mesa, pausa editorial, abordagem com imagem de arquitetura, seção Em movimento, encerramento e acesso aos cases |
| Case / Desktop · EN-US · Claro, node `125:4693` | Navegação, abertura do case, sumário/artigo e footer; retorno aos projetos, identificação editorial, título, descrição, capa e nota de contexto |
| Artigo do case, pela árvore de camadas | Sumário com referências a contexto, desafio, processo, proposta e aprendizados; papel/escopo, perguntas orientadoras, etapas de processo e composição de comparação antes/depois |
| Metadados do case, node `125:4710` | Grupo Project facts, com campos de papel e escopo |

O inventário complementar também registra a abertura/lista de cases no desktop e mobile, a composição da navegação do artigo no celular, os demais frames e os tokens. O complemento de contratos mapeia esses elementos para campos e apresentação. O sumário deriva da narrativa e a comparação usa uma composição predefinida dos dados permitidos; não criar tipos editoriais adicionais ou um construtor livre para reproduzir esses elementos. Estados funcionais exigidos e estados efetivamente documentados na referência são distinguidos no inventário, sem afirmar que todos foram desenhados.

**Tratamento dos modelos fechado em P01:** marcações de case ilustrativo, instruções de preenchimento e textos como “Sample template” são conteúdo demonstrativo. O usuário confirmou que esses trechos devem ficar em rascunho até a revisão do conteúdo final. Preservar sua utilidade como modelos de estrutura, sem importá-los automaticamente como conteúdo público nem convertê-los em experiências profissionais reais. Cases reais ou conceituais de autoria dela podem ser publicados após revisão e identificação apropriada. Não perguntar novamente se esses exemplos são conteúdo final.

## 3. Idiomas e contratos de navegação

### 3.1 Rotas fechadas

| Página | Português | Inglês |
|---|---|---|
| Home | `/pt` | `/en` |
| Cases | `/pt/cases` | `/en/cases` |
| Detalhe | `/pt/cases/[slug]` | `/en/cases/[slug]` |
| Sobre | `/pt/sobre` | `/en/about` |

Os nomes das pastas internas não determinam as rotas traduzidas. A implementação deve resolver `/pt/sobre` e `/en/about` explicitamente, sem criar URLs alternativas indexáveis por acidente.

### 3.2 Resolução do idioma fechada

1. URLs com idioma explícito sempre prevalecem, mesmo que contrariem cookie ou navegador.
2. Na entrada em `/`, usar a escolha manual anterior salva no cookie funcional.
3. Sem escolha anterior válida, usar a preferência compatível do navegador entre português e inglês.
4. Sem idioma compatível, usar **inglês**.
5. O redirecionamento de `/` é temporário, pois o destino depende do visitante.

A decisão anterior de redirecionar fixamente para português foi substituída. Não implementar essa alternativa.

O cookie funcional armazena somente a preferência `pt` ou `en`, sem identificador de visitante. É separado do Analytics. A finalidade, o conteúdo e a prioridade do cookie estão fechados.

**Duração fechada em P05:** 180 dias a partir da última escolha manual no seletor de idioma. Uma nova escolha manual atualiza a preferência e reinicia o prazo; visitas comuns não renovam o cookie. Se expirar ou for apagado, a entrada em `/` volta a considerar o navegador e, depois, inglês. URLs com idioma explícito continuam prevalecendo.

Nome, atributos seguros e negociação de `Accept-Language` são detalhamento técnico a documentar, respeitando a ordem aprovada e as preferências compatíveis do navegador. Valores inválidos não determinam redirecionamentos arbitrários.

### 3.3 Troca de idioma fechada

- Havendo página equivalente publicada, manter o mesmo trecho de leitura e sua posição na tela, compensando mudanças de altura dos textos. Não basta copiar o deslocamento absoluto em pixels.
- A equivalência de cases é resolvida pela identidade permanente do case, não por tradução do slug, título ou posição na lista.
- Se a versão do case não estiver publicada no idioma escolhido, navegar para a listagem desse idioma, abrir no topo e mostrar toast explicativo no idioma de destino.
- Uma tradução não publicada não aparece na listagem nem nos destaques daquele idioma.
- Toasts e mudanças de contexto precisam ser acessíveis, sem depender apenas de percepção visual.

**Detalhamento técnico e verificação em P04:** definir a correspondência entre seções/blocos, a restauração após imagens/fontes e a interação com o histórico do navegador, e comprovar o comportamento por testes. A preservação do trecho de leitura e o fallback para a listagem no topo com toast já estão fechados. Não perguntar novamente se a troca deve voltar ao início. Se o levantamento revelar trechos sem equivalente e isso exigir mudar o comportamento aprovado, apresentar essa lacuna concreta ao usuário.

### 3.4 Identidade e endereços dos cases

**Fechado:** identidade permanente por case, versões relacionadas por essa identidade, slug por idioma, reserva dos endereços antigos e redirecionamento permanente direto para o endereço atual no respectivo idioma. Mudanças sucessivas não podem gerar cadeias nem ciclos.

**Fechado na revisão de P02:** no máximo um documento editorial por par case/idioma, conforme as restrições da seção 4.1.

**Unicidade fechada na revisão de P03:** dois cases diferentes não podem usar o mesmo slug no mesmo idioma, incluindo slugs de rascunhos e endereços históricos reservados. O mesmo slug pode existir em português e inglês, pois os endereços são separados por `/pt/` e `/en/`.

- Aplicar validação no servidor e restrição de unicidade no banco, inclusive em gravações simultâneas.
- A proteção deve cobrir colisões entre documentos e entre endereços atuais, reservados por rascunhos e históricos. Índices isolados em tabelas diferentes não bastam se permitirem que dois cases disputem o mesmo endereço.
- O histórico de versões do mesmo documento não representa uma segunda reserva de slug para outro case.

**Política de P03 fechada após revisão:**

- O CMS sugere o slug a partir do título, por exemplo `Aplicativo de Finanças` → `aplicativo-de-financas`.
- O formato permite letras minúsculas sem acentos, números e hífens, sem espaços ou símbolos, com limite de 80 caracteres.
- O campo continua editável; alterações posteriores no título não alteram automaticamente o slug.
- Slug válido é obrigatório para publicar. Rascunhos incompletos podem ficar sem slug; a unicidade se aplica aos slugs efetivamente reservados.
- Conflitos exigem mensagem clara e escolha de outro slug, sem acrescentar sufixos silenciosamente nem substituir reservas de outro case.

| Situação | Regra aprovada |
|---|---|
| Trocar um slug de rascunho que nunca foi publicado | Liberar a reserva anterior |
| Preparar um novo slug para um case publicado | Reservar o novo, mantendo o endereço público atual até publicar |
| Publicar a mudança de slug | O antigo redireciona diretamente para o novo e permanece reservado |
| Voltar a um endereço histórico do próprio case | Permitir mediante publicação explícita, reorganizando os redirecionamentos sem ciclos |
| Usar endereço reservado por outro case | Bloquear conforme a unicidade por idioma já aprovada |

Restaurar uma versão anterior respeita essas regras e não altera o endereço público antes da publicação explícita. Uma reserva que já foi pública permanece protegida mesmo quando o conteúdo volta a rascunho. O comportamento de um case retirado de publicação continua sendo indisponível, orientando também a resolução dos seus endereços históricos.

**Detalhamento técnico e verificação restantes:** materializar a normalização e o ciclo de reservas com segurança sob concorrência, incluindo a publicação e a restauração. Palavras reservadas são determinadas por conflitos reais de roteamento e documentadas pelo agente; não pedir ao usuário uma lista arbitrária nem invalidar endereços aprovados silenciosamente. A política está fechada; a implementação ainda deverá comprová-la.

### 3.5 Contato no header

**Fechado na revisão de P01 por instrução explícita do usuário:** remover o link Abordagem do header e substituí-lo por Contato, com rótulo correspondente em inglês. Essa alteração aprovada prevalece sobre o item original no Figma.

- O destino é a lista de contatos no footer da página atual, tanto na Home quanto em Sobre, listagem e detalhe de case.
- Usar a âncora estável `#contact`, com destino presente no footer em ambos os idiomas. Acionar o link não navega para outra página nem altera o idioma.
- O comportamento deve funcionar por teclado e respeitar movimento reduzido; o header não pode encobrir o destino ao chegar à seção.
- A seção Abordagem da Home permanece no escopo. Não criar página de Contato ou formulário como consequência dessa mudança.

### 3.6 Composição do header

**Fechado na revisão de P01:** manter quatro itens no header, nesta ordem: Projetos, Sobre, Currículo e Contato. A existência do botão de projetos na Home não elimina o acesso à listagem pelo header das páginas internas. Adicionar Currículo é uma alteração aprovada da referência visual.

| Item em português | Item em inglês | Destino |
|---|---|---|
| Projetos | Projects | Listagem no idioma atual: `/pt/cases` ou `/en/cases` |
| Sobre | About | Sobre no idioma atual: `/pt/sobre` ou `/en/about` |
| Currículo | Resume | PDF do currículo publicado para o idioma atual, gerenciado no CMS |
| Contato | Contact | `#contact`, na lista de contatos do footer da página atual |

Os rótulos seguem a edição por idioma já aprovada. O menu de celular mantém acesso aos mesmos quatro itens.

**Comportamento do currículo fechado:** abrir o PDF publicado do idioma atual em uma nova aba, com indicação acessível desse comportamento, preservando a aba do portfólio. A medição registra o acionamento para abertura, sem afirmar que houve download concluído ou leitura do arquivo. Não alterar silenciosamente os demais links para abrir novas abas.

### 3.7 Contrato dos links no CMS

**Fechado na revisão de P02:** destinos internos são representados por opções tipadas, sem endereços internos digitados livremente. Os rótulos permanecem editáveis por idioma; a finalidade dos quatro itens do header é fixa.

- Projetos e Sobre: o sistema resolve a rota correspondente no idioma atual.
- Currículo: referencia o PDF publicado no documento de Perfil profissional do idioma atual; não duplicar o arquivo ou seu endereço na configuração de Navegação.
- Contato: referencia a âncora fixa do footer da página atual.
- Destinos externos, como LinkedIn e e-mail, usam campos específicos com validação apropriada.

O contrato distingue os tipos de destino e é validado no servidor. Uma edição de rótulo não altera a finalidade do item nem transforma uma rota interna em um endereço externo arbitrário.

## 4. Modelagem editorial e publicação


### 4.1 Contrato conceitual fechado

| Entidade | Responsabilidade |
|---|---|
| Case | Identidade compartilhada, ordenação e destaque |
| Versão editorial do case | Idioma, título, resumo, slug, capa, papel profissional, blocos e publicação |
| Perfil profissional | Apresentação, Sobre, contatos e currículo por idioma |
| Conteúdo global | Header, footer, navegação e botões editáveis por idioma |
| Mídia | Arquivo, tipo, dimensões quando aplicáveis, descrições e referências de uso |
| Histórico de endereços | Origem e destino de redirecionamentos por idioma |

As decisões estruturais dessa tabela estão fechadas e detalhadas no complemento de contratos do CMS. Ele define collections de referência, campos, responsabilidades, identidade, endereços, mídias e fronteiras de publicação. O plano deve materializar esses contratos para a versão validada do Payload; ajustes de nomes e configurações internas exigem mapeamento explícito, sem reabrir as escolhas editoriais aprovadas.

**Decisão fechada na revisão de P02:** um documento compartilhado representa a identidade do case, sua ordem e destaque. Os conteúdos em português e inglês são documentos editoriais separados, na mesma collection, relacionados ao documento compartilhado e diferenciados por um campo de idioma. Cada documento editorial possui seu próprio rascunho e estado de publicação. Não criar collections separadas por idioma nem depender de status localizado beta para implementar essa independência. As collections de referência estão nomeadas no complemento de contratos.

**Conteúdos globais fechados na revisão de P02:** Navegação e Perfil profissional são grupos editoriais separados, cada um em sua própria collection com documentos por idioma. Navegação reúne header, footer, rótulos e destinos; Perfil profissional reúne apresentação, Sobre, contatos e currículo. Cada grupo/idioma possui rascunho e publicação independentes. Publicar Navegação em português não publica Perfil profissional em português nem Navegação em inglês. A interface administrativa apresenta os grupos como “Navegação” e “Perfil profissional”. Os grupos de campos estão mapeados no complemento de contratos.

**Unicidade e provisionamento fechados na revisão de P02:**

- Cases: no máximo um documento editorial por combinação de identidade do case e idioma. Pode existir apenas uma tradução, sem exigir a criação da outra.
- Navegação: exatamente um documento em português e um em inglês.
- Perfil profissional: exatamente um documento em português e um em inglês.
- Os quatro documentos estruturais de Navegação e Perfil são criados na configuração inicial como rascunhos. Podem ser editados e publicados, mas não excluídos nem ter seu idioma alterado.
- Depois da primeira publicação válida, cada documento de Navegação e Perfil profissional não pode ser retirado de publicação. A restrição vale por grupo e idioma, é aplicada no servidor e preserva a versão pública enquanto novos rascunhos são editados. Novas publicações explícitas e válidas continuam permitidas. A restrição não impede retirar cases de publicação.
- Unicidade e restrições de exclusão/alteração de idioma são aplicadas no servidor, e a unicidade também no banco, inclusive sob operações simultâneas. Ocultar controles do painel não basta.
- O histórico de versões de um documento não conta como documento editorial adicional nem viola a unicidade.

### 4.2 Publicação independente

**Fechado:** publicar, alterar ou retirar uma versão não pode modificar a publicação da outra. Conteúdos globais também têm revisão/publicação por idioma. O banco/modelo deve representar essa independência; não basta ocultar campos na interface.

- Ela salva rascunhos, confere prévia no idioma escolhido e publica diretamente.
- Alterações incompletas dos textos globais não substituem a versão já publicada.
- Um case exige título, resumo, capa, papel profissional e ao menos um bloco de conteúdo no idioma escolhido.
- Imagens informativas exigem texto alternativo; legendas são opcionais. Imagens decorativas precisam de classificação explícita e alternativa vazia apropriada.
- Campos e mensagens do CMS devem informar exatamente o que impede a publicação.
- Retirar um case de publicação apresenta “Case indisponível”, com acesso à listagem e ao contato, no idioma do endereço. A outra versão permanece disponível se publicada.

**Decisões da P02 fechadas; materialização e verificação restantes:** implementar os schemas e operações conforme o inventário e os contratos complementares e comprovar as restrições por testes na versão validada do Payload. A publicação independente, unicidade, provisionamento, proteção dos grupos globais, recuperação e edição concorrente já foram aprovados. O plano detalha as fronteiras entre transação de conteúdo, mídias e atualização do cache, sem presumir uma transação única entre banco e serviços externos. Os testes são critérios de aceite da implementação, não perguntas ainda sem resposta.

#### 4.2.1 Recuperação de versões

**Fechado na revisão de P02:** recuperar uma versão anterior de um documento editorial de case, Navegação ou Perfil profissional deve gerar um rascunho para revisão. A operação não altera a versão pública nem publica automaticamente o conteúdo recuperado.

- A versão atualmente publicada permanece no site até nova publicação explícita.
- O conteúdo recuperado pode ser conferido na prévia autenticada e deve passar pelas validações normais antes de publicar.
- A recuperação afeta somente o documento e idioma escolhidos, preservando identidade e relacionamentos estruturais.
- Não presumir que o botão/API nativo de restauração já cumpre essa política. Verificar e adaptar o fluxo quando necessário, impedindo também a publicação acidental pela chamada direta da API.

#### 4.2.2 Edições simultâneas

**Fechado na revisão de P02:** permitir apenas uma pessoa editando cada documento por vez, com bloqueio temporário e proteção contra sobrescrita por sessões desatualizadas.

- Quem abrir o documento primeiro assume a edição; a outra pessoa pode visualizá-lo em modo de leitura.
- Documentos diferentes podem ser editados simultaneamente, inclusive os documentos PT e EN vinculados ao mesmo case.
- O bloqueio é liberado ao sair da edição ou após inatividade. O prazo e a estratégia de renovação serão documentados na configuração técnica.
- Uma sessão desatualizada não pode sobrescrever alterações mais recentes; deve informar o conflito e exigir atualização antes de nova gravação.
- Aproveitar o bloqueio nativo do Payload, verificando também as operações do servidor. A proteção deve ser aplicada no servidor e testada, incluindo sessões/abas desatualizadas; não basta um aviso ou bloqueio visual no painel.

### 4.3 Blocos dos cases

**Fechado:** blocos predefinidos e reordenáveis, apenas com apresentações aprovadas no Figma:

- Texto formatado com parágrafos, listas, links e destaques.
- Imagem única.
- Duas imagens lado a lado, em sequência vertical no celular, preservando a ordem editorial.

Vídeos, carrosséis e protótipos incorporados ficam fora da primeira versão. Não há construtor livre de páginas.

Contexto, problema, papel profissional, processo, solução e resultados podem orientar a narrativa, mas não autorizam criar seis novos tipos de bloco sem validação do design. O conjunto aprovado de apresentações é o listado acima.

Títulos, header, footer e rótulos de botões usam texto simples. CMS não aceita classes CSS, cores, fontes, espaçamentos ou estilos livres. Opções editoriais são fechadas e tipadas.

## 5. Stack e política de versões

### 5.1 Fechado

- Next.js com TypeScript estrito, React e Payload CMS integrado, painel em `/admin`.
- PostgreSQL; arquivos no Cloudflare R2.
- VPS com Coolify.
- pnpm, ESLint e Prettier.
- Tailwind CSS e Class Variance Authority.
- shadcn/ui no portfólio; componentes e formulários nativos do Payload no painel.
- Motion como padrão de animação.
- Zod para contratos e validação nas fronteiras.
- Vitest, Testing Library e Playwright.
- GitHub e GitHub Actions.
- Docker para empacotamento e promoção entre ambientes.

Iniciar com a versão **estável mais recente do Next.js**, conferida no momento da implementação, com correções de segurança vigentes. Não usar canary, beta ou RC em produção. Validar compatibilidade com Payload, React e Node.js. Se houver conflito, apresentar ao usuário; não escolher uma versão anterior silenciosamente.

Fixar a combinação validada e versionar o lockfile. Conferir avisos de segurança novamente antes de cada implantação em produção. Nova dependência exige necessidade concreta, avaliação de manutenção/impacto e respeito ao escopo. Atualizações principais não entram silenciosamente em outra tarefa.

**Verificação técnica do agente em P11:** conferir e registrar as versões exatas, compatibilidade, avisos de segurança e adaptadores necessários no momento da implementação. A política de versões e a stack já estão fechadas. Não perguntar novamente qual framework usar nem copiar números históricos da entrevista como versões atuais. Somente um conflito com as restrições aprovadas exige nova decisão do usuário.

## 6. Arquitetura por features

### 6.1 Estrutura aprovada

```text
src/
├── app/
│   ├── (portfolio)/
│   │   └── [locale]/
│   │       ├── page.tsx
│   │       ├── page.e2e.test.ts
│   │       ├── cases/
│   │       └── ...                 # Rotas equivalentes de Sobre
│   └── (payload)/                  # Painel e API do Payload
├── features/
│   ├── cases/
│   ├── professional-profile/
│   ├── site-navigation/
│   ├── language-switcher/
│   ├── media-library/
│   └── analytics/
├── components/
│   └── ui/
├── helpers/
│   ├── payload/
│   ├── storage/
│   ├── i18n/
│   ├── logger/
│   └── motion/
│       ├── tokens.ts
│       ├── presets.ts
│       ├── presets.test.ts
│       ├── motion-provider.tsx
│       └── load-features.ts
├── stylesheets/
├── config/
└── payload.config.ts
testing/
├── setup/
└── fixtures/
docs/
├── specs/
├── architecture/
└── decisions/
```

Exemplo de uma feature, criando subdivisões apenas quando necessárias:

```text
features/cases/
├── components/
│   ├── case-card.tsx
│   └── case-card.test.tsx
├── contracts/
│   ├── case.schema.ts
│   └── case.schema.test.ts
├── server/
│   ├── get-published-case.ts
│   └── get-published-case.integration.test.ts
├── content/
│   ├── collections/
│   ├── blocks/
│   └── hooks/
├── index.ts
└── server.ts
```

Não criar pastas vazias por obrigação. Testes vivem junto do item testado. Testes de jornadas pertencem à página ou feature responsável. `testing` contém apenas suporte compartilhado, não uma central de testes.

### 6.2 Limites obrigatórios

- Rotas compõem features e permanecem finas.
- Cada feature expõe contratos compartilháveis por `index.ts` e operações exclusivas do servidor por `server.ts`.
- Outra feature não importa arquivos internos. Dependências circulares são proibidas.
- `helpers` e componentes genéricos não dependem das features.
- Componentes do navegador não importam acesso a dados, credenciais ou módulos exclusivos do servidor.
- `helpers` não é destino para regras de negócio sem dono.
- Abstrações precisam de propósito concreto; evitar camadas que apenas repassam chamadas.
- Nomes expressam responsabilidades; módulos e funções devem ter interfaces pequenas e propósito claro.

Esses limites terão verificações automatizadas no GitHub Actions. Ferramenta e padrões de importação precisam ser escolhidos sem enfraquecer os limites aprovados.

### 6.3 Fluxo de dados e contratos

```text
Rota no servidor
  → interface pública da feature
  → consulta centralizada pelo Payload
  → documento tipado do CMS
  → transformação na feature
  → contrato mínimo do componente
  → renderização
```

Payload é a única camada de acesso ao conteúdo. PostgreSQL e R2 são acessados pelos adaptadores autorizados; não adicionar outro ORM, SQL paralelo ou API duplicada para os mesmos dados.

Tipos gerados do Payload representam persistência. Schemas Zod representam entradas e contratos que exigem validação em execução. Derivar tipos dos schemas quando forem a fonte do contrato. Não duplicar manualmente modelos nem validar repetidamente o mesmo dado sem motivo.

Consultas públicas aplicam explicitamente idioma, publicação e controle de acesso. Prévias autenticadas consultam rascunhos em caminho separado. Configurações que ignorem permissões por padrão precisam de tratamento explícito e teste.

Componentes recebem dados mínimos: um card de case conhece título, resumo, imagem e destino, sem receber documentos completos com rascunhos ou campos administrativos. `any` e desativação de verificações exigem justificativa explícita; não são solução padrão.

### 6.4 Estado

Idioma e case atual ficam na URL. Estados temporários ficam nos componentes responsáveis. Conteúdo é consultado no servidor. A feature de troca de idioma encapsula preservação de leitura. Sem biblioteca global de estado na primeira versão.

## 7. Componentes, estilos e animações

Antes de criar um componente, verificar os existentes no projeto e no shadcn/ui. Reutilizar e adaptar quando houver solução adequada; caso contrário, compor no mesmo padrão de acessibilidade e composição. Figma determina a aparência.

Variantes visuais são fechadas, tipadas e declaradas com CVA fora do JSX. Classes estáticas extensas podem ir para constantes nomeadas. Decompor componentes com responsabilidades distintas em vez de apenas esconder listas enormes de classes. Elementos simples podem manter classes curtas. Não exigir CVA sem variantes.

Tokens do Figma centralizados em `stylesheets`; não espalhar valores arbitrários recorrentes. Recursos do Payload permanecem responsáveis pela interface administrativa.

Motion centraliza durações, curvas, distâncias e presets em `helpers/motion`. Componentes/ features mantêm sua lógica de interação, foco e ciclo de vida. Não animar a mesma propriedade do mesmo elemento simultaneamente com CSS e Motion. Estados estáticos e foco continuam em CSS/Tailwind.

Escopo de movimento: interações discretas em botões, menu e toast. Efeitos de entrada, rolagem e transições elaboradas exigem aprovação. Respeitar movimento reduzido, evitar animação de propriedades que recalculam layout e manter conteúdo legível sem depender do carregamento das animações.

Avaliar `LazyMotion` e componentes `m`, carregando apenas funcionalidades necessárias. Centralização de arquivos não reduz automaticamente o peso do código: medir o build e as interações. Preservar a renderização das páginas no servidor. Exceções de importação necessárias à estratégia de carregamento devem ser registradas quando conflitarem com exemplos das skills.

## 8. Renderização, cache e erros

### 8.1 Renderização fechada

Páginas públicas renderizadas no servidor, com cache e atualização do conteúdo afetado ao publicar, retirar de publicação ou reordenar. Sem reconstrução completa do site para cada alteração editorial. Prévias autenticadas não usam cache público.

Manter páginas públicas já armazenadas em cache durante falhas temporárias de banco/CMS. Uma falha de consulta não equivale a case inexistente. Páginas sem conteúdo em cache apresentam indisponibilidade apropriada quando a origem falhar.

Se o conteúdo for salvo, mas a atualização pública falhar, o CMS informa o resultado parcial e permite nova tentativa segura. Não afirmar que a mudança está pública sem confirmação. A VPS única continua sendo ponto de falha; cache nela não garante disponibilidade se a própria VPS cair.

**Detalhamento técnico e verificação em P07:** documentar a estratégia de cache compatível com a versão do Next.js, invalidação por dependência/idioma, persistência de falhas e tentativas seguras. O requisito de servir cache durante falhas e informar publicação parcial já está fechado. Apresentar o prazo de propagação proposto entre os critérios operacionais da etapa, sem inventar um número aprovado. Não anunciar remoção concluída enquanto conteúdo público permanecer disponível por falha de atualização.

### 8.2 Erros fechados

Falhas esperadas têm resultados tipados e mensagens específicas. Falhas inesperadas são registradas no servidor e produzem mensagens públicas seguras. Não converter falha em sucesso, lista vazia ou ausência de conteúdo silenciosamente.

Contratos devem distinguir, por exemplo: inexistente, não publicado, tradução ausente, entrada inválida, sem autorização e dependência indisponível. Não expor diferenças que revelem conteúdo privado a visitantes sem autorização.

**Detalhamento técnico e verificação em P17:** selecionar os códigos HTTP adequados a inexistência, retirada de publicação e falha temporária, preservando a interface já aprovada, a confidencialidade dos rascunhos e a indexação correta. Os códigos são uma decisão técnica a justificar no plano e verificar nos testes; não reabrir a escolha da página de “Case indisponível”.

## 9. Mídias e segurança

### 9.1 Uploads fechados

| Arquivo | Formatos | Limite por arquivo |
|---|---|---|
| Imagem | JPEG, PNG, WebP e AVIF | 10 MB |
| Currículo | PDF | 5 MB |

**Upload de SVG é proibido permanentemente no CMS**, inclusive em versões futuras. Rejeitar no servidor mesmo que a interface seja contornada. Vetores aprovados incluídos pelo código não são uploads editoriais.

Validar o conteúdo real, além da extensão. Processar imagens na aplicação, sem serviço adicional; gerar versões adequadas, preservar proporções, reservar espaço no layout e carregar imagens fora da área inicial sob demanda. Arquivos e derivados ficam no R2. Verificar memória com arquivo próximo do limite. Em P09, tipos, limites por arquivo, proibição de SVG e local de processamento já estão fechados. Dimensionar derivados e proteções de processamento no plano com base no Figma e nos recursos medidos. Não apresentar esses parâmetros internos como se formatos ou limites aprovados continuassem sem decisão; restrições adicionais que impeçam uploads antes permitidos devem ser explicitadas na revisão da etapa.

Mídias de rascunhos privadas; prévias entregam arquivos mediante autenticação. Apenas mídias aprovadas para publicação terão acesso público. Impedir exclusão de arquivos usados por conteúdo publicado. Retirar conteúdo não apaga cópias já baixadas por visitantes.

**Política de P08 fechada; desenho técnico e verificação necessários:** documentar referências entre mídias e versões/idiomas, promoção pública, revogação de acesso, caches e limpeza de órfãos. Reutilizar uma mídia já pública em um rascunho não pode ser interpretado como garantia de sigilo do arquivo. A publicação de uma versão não pode expor outros arquivos privados. Projetar e testar esses casos antes de liberar uploads e publicação. Não solicitar novamente a aprovação da separação entre mídias privadas e públicas. Retenção e recuperação dos backups seguem a política aprovada em P15, preservando as restrições de exclusão dos arquivos publicados em uso.

### 9.2 Acesso fechado

- Contas criadas por administrador, sem cadastro público.
- Permissões verificadas no servidor em todas as operações.
- Conteúdo público restrito ao publicado; rascunhos e prévias exigem sessão válida.
- Proteção contra tentativas repetidas de login.
- Segredos fornecidos pelo ambiente, fora do repositório, imagem e navegador.
- Validação própria para imagens e PDFs.
- Homologação protegida; `robots.txt` ou `noindex` não substituem autenticação.

**P10 fechada:** contas individuais criadas por administrador, sem cadastro público, controles de acesso e proteção contra tentativas de login permanecem conforme aprovado. A recuperação de senha usa o fluxo nativo do Payload: solicitação pelo e-mail cadastrado e envio de um link temporário para redefinir a senha.

**Detalhamento técnico e verificação restantes:** configurar o envio de e-mail necessário ao fluxo nativo, os tokens temporários, as proteções contra abuso e os testes de recuperação. Sessões, origens confiáveis, cabeçalhos e credenciais mínimas são detalhamento técnico do agente, a justificar e verificar sem enfraquecer os requisitos. Provedor e credenciais de envio serão configurados para a implantação; qualquer contratação paga depende de aprovação. Não criar um sistema paralelo de autenticação ou recuperação.

## 10. SEO, compartilhamento e Analytics

### 10.1 Fechado

Títulos e descrições editáveis por idioma, imagem de compartilhamento, links rastreáveis e sitemap apenas com páginas públicas publicadas. Identificar versões traduzidas disponíveis. Rascunhos, prévias, painel e homologação não devem ser indexados; áreas privadas também exigem controle de acesso.

URLs de idioma explícito permanecem acessíveis independentemente do navegador. A descoberta não depende do redirecionamento de `/`. Canonicals e referências de traduções precisam ser coerentes e não apontar versões independentes para um único idioma como substituto.

Indexação e posicionamento dependem do Google. A entrega comprova configuração e rastreabilidade; não promete inclusão ou posição nos resultados.

### 10.2 Analytics e critérios técnicos

Manter **Google Analytics**, sem cookies de analytics. Não substituir por Plausible ou outro fornecedor. O cookie funcional de idioma é permitido e separado.

**P06 fechada por instrução explícita do usuário:** não apresentar banner, modal ou escolha para aceitar/recusar cookies ou estatísticas. A medição aprovada é automática no site público de produção. A coleta fica restrita ao necessário para a medição definida nesta seção e ao funcionamento da preferência de idioma. Não reintroduzir uma escolha de consentimento com outro nome.

- Manter o armazenamento de analytics desativado (`analytics_storage: denied`), sem promover esse estado para habilitar cookies.
- Não adicionar publicidade, remarketing, User-ID, fingerprinting ou identificadores persistentes alternativos para contornar a ausência de cookies.
- O cookie funcional contém somente `pt` ou `en`, com os 180 dias e a renovação exclusivamente por escolha manual aprovados em P05. Não usá-lo como identificador do visitante ou para cruzar visitas.

Medir somente no site público de produção:

- Visitas às páginas.
- Idioma utilizado.
- Cliques no e-mail.
- Cliques no LinkedIn.
- Acionamentos do currículo para abrir o PDF do idioma atual em nova aba. O evento registra a ação disparada, sem afirmar que o visitante concluiu o download ou leu o arquivo.

Excluir painel, rascunhos, prévias, homologação e testes. Eventos não enviam nomes, e-mails, credenciais ou conteúdo privado do CMS. Evitar captura acidental desses dados em URLs, parâmetros e rótulos.

**Detalhamento técnico e verificação em P06:** implementar a configuração do GA4 compatível com as restrições aprovadas, inicialização por ambiente, eventos e prevenção de duplicação na navegação. Demonstrar ausência de cookies de analytics e de armazenamento alternativo usado para rastreamento, envio somente das métricas aprovadas e exclusão dos ambientes privados/de teste. A decisão de interface e início automático da medição está fechada; não é uma pergunta remanescente.

**Verificação documental realizada na revisão de P06:** o Google informa que `analytics_storage: denied` impede leitura/gravação de cookies de analytics, mas permite o envio de medições sem cookies. A documentação de modelagem descreve requisitos de tráfego com armazenamento autorizado e limitações para relatar eventos sem esse consentimento. Portanto, não presumir que transmitir eventos sem cookies garante os relatórios desejados para este portfólio. Antes da ativação, demonstrar as métricas efetivamente disponíveis sem flexibilizar a proibição de cookies ou introduzir identificadores persistentes para contornar essa restrição. Referências: [Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode) e [modelagem comportamental](https://support.google.com/analytics/answer/11161109?hl=en). Essa verificação é um critério técnico da implementação e não reabre a política de interface definida pelo usuário.

## 11. Qualidade, TDD e aceite

### 11.1 Desenvolvimento fechado

TDD obrigatório para comportamentos e correções: teste falha pelo motivo esperado, implementação mínima, teste passa e refatoração mantendo a verificação. Apresentar evidências por etapa. Evitar testes que apenas repitam código, detalhes internos ou verifiquem bibliotecas externas sem comportamento próprio.

- Vitest: regras e integração.
- Testing Library: comportamento dos componentes.
- Playwright: jornadas completas.
- Testes de arquitetura: limites entre features, servidor/navegador, dependências de helpers/componentes genéricos e ciclos.
- Testes junto do código testado, incluindo integração e jornadas na funcionalidade responsável.

Tipagem, lint, testes aplicáveis e build são obrigatórios antes de considerar uma alteração pronta. GitHub Actions bloqueia integração na branch principal quando verificações falham ou estão pendentes. Não mascarar falhas, desativar checks ou reduzir regras para obter aprovação.

### 11.2 Matriz mínima de comportamentos

| Fluxo | Evidência exigida |
|---|---|
| Publicação por idioma | Publicar/retirar PT não altera EN e vice-versa |
| Rascunhos | Consulta pública e URL direta não expõem conteúdo ou mídias privadas |
| Conteúdo global incompleto | Publicação bloqueada; versão pública anterior permanece |
| Unicidade editorial | Criações simultâneas não geram dois documentos para o mesmo case/idioma ou grupo/idioma |
| Documentos estruturais | Quatro rascunhos iniciais; exclusão e alteração de idioma de Navegação/Perfil bloqueadas no servidor |
| Continuidade dos conteúdos globais | Após a primeira publicação válida, retirar Navegação/Perfil de publicação é bloqueado no servidor; editar rascunhos preserva a versão pública |
| Recuperação de versões | Conteúdo anterior recuperado como rascunho, com identidade preservada; site só muda após publicação explícita e válida |
| Edições simultâneas | Bloqueio por documento respeitado no servidor; documentos distintos editáveis em paralelo; gravações desatualizadas rejeitadas com conflito explícito |
| Recuperação de acesso | Fluxo nativo do Payload envia link temporário ao e-mail cadastrado; redefinição válida funciona e tokens inválidos/expirados são rejeitados sem expor segredos |
| Case incompleto | CMS identifica campos obrigatórios ausentes |
| Troca de idioma | Trecho de leitura preservado com alturas diferentes |
| Tradução ausente | Listagem no topo e toast no idioma de destino |
| Entrada por `/` | Prioridade cookie → navegador → inglês; URL explícita prevalece |
| Duração do idioma | Cookie configurado para 180 dias desde a última escolha manual; visitas não renovam; nova escolha reinicia prazo; expiração/remoção retoma navegador e inglês |
| Analytics automático sem cookies | Nenhum banner/diálogo de aceite ou recusa; medição automática somente em produção pública, sem cookies de analytics, identificadores persistentes alternativos ou coleta além do escopo aprovado |
| Slugs | Unicidade por idioma entre cases, inclusive rascunhos e histórico, protegida no servidor e no banco sob concorrência; endereços antigos reservados, sem ciclos/cadeias e com destino por idioma |
| Formação dos slugs | Sugestão pelo título, formato aprovado e limite de 80 caracteres; editar título não muda slug; conflito não gera sufixo silencioso; rascunho pode ficar sem slug, publicação exige slug válido |
| Ciclo de reservas | Slug nunca publicado pode ser liberado ao trocar; mudança em rascunho preserva URL pública; publicação reserva histórico; retorno ao próprio histórico não gera ciclos; restauração não muda URL pública antes de publicar |
| Retirada de publicação | Estado indisponível apropriado; outra tradução continua pública |
| Falha de infraestrutura | Cache válido preservado; falha não vira inexistência |
| Publicação parcial | CMS informa falha de atualização e permite nova tentativa segura |
| Upload | Formatos/tamanhos validados; SVG rejeitado no servidor |
| Mídias compartilhadas | Sem exposição indevida nem exclusão de arquivo publicado em uso |
| Contatos e currículo | Destinos corretos por idioma e medição conforme contrato aprovado |
| Contato no header | Item Abordagem ausente; Contato leva à lista no footer da página atual, nos dois idiomas e por teclado |
| Header completo | Projetos, Sobre, Currículo e Contato acessíveis em desktop e celular, na ordem aprovada e com destinos do idioma atual |
| Abertura do currículo | PDF publicado do idioma atual abre em nova aba com indicação acessível; portfólio permanece aberto; evento mede o acionamento e não confirma download ou leitura |
| Contratos dos links | Destinos internos tipados e resolvidos por idioma; rótulos editáveis sem alterar a finalidade dos itens do header; currículo referencia o PDF publicado do Perfil |
| Arquitetura | Importações e ciclos indevidos falham no CI |
| Implantação | Mesma imagem entre ambientes, segredos externos, health check verificado |
| Backup e recuperação | Histórico de oito semanas com rotinas semanais e extras antes de migrações; cópias criptografadas no R2 privado e separado; restauração isolada comprovada de banco, traduções e arquivos |

### 11.3 Acessibilidade e visual

WCAG 2.2 nível AA nos fluxos entregues: teclado, foco visível e previsível, contraste, semântica, descrições das imagens, estados e mensagens acessíveis. Responsividade sem rolagem horizontal indevida, incluindo tablet. Respeitar movimento reduzido.

Executar verificações automatizadas e manuais; nenhuma nota isolada comprova conformidade. Comparar visualmente com Figma nas páginas/estados relevantes. Divergências relevantes são corrigidas ou submetidas ao usuário antes de concluir.

### 11.4 Desempenho

Medir Home, listagem e detalhe de case em celular e desktop. Documentar URL, versão, dados usados, dispositivo/viewport, rede, CPU, cache, ferramentas e repetições. Registrar JavaScript enviado, carregamento principal, estabilidade visual e resposta das interações; verificar também o impacto do Motion.

Laboratório não é prova de métricas reais dos visitantes. Lighthouse não é o único critério. Dados de campo ficam para validação posterior ao lançamento.

**Metas de P12 fechadas:**

| Critério de aceite em laboratório | Celular | Desktop |
|---|---|---|
| Conteúdo principal visível — LCP | Até 2,5 segundos | Até 2,5 segundos |
| Estabilidade visual — CLS | Até 0,1 | Até 0,1 |
| Bloqueio durante o carregamento — TBT | Até 200 ms | Até 150 ms |

Antes do lançamento, aplicar essas metas à Home, listagem e detalhe do case representativo mais pesado, em português e inglês e nos dois perfis de dispositivo. Executar pelo menos três medições equivalentes por cenário, usando a mediana para comparação com as metas e registrando também a variação. Documentar previamente as condições de medição; não alterar condições apenas para obter aprovação.

Para a resposta às interações, a referência é INP de até 200 ms, validado com dados reais de campo quando houver amostra suficiente, no percentil 75 e com celular/desktop separados. Exercitar as interações nos testes de laboratório e registrar os resultados como observações de laboratório; TBT e medições pontuais não comprovam aprovação de INP em campo. Ausência de dados de campo no lançamento significa indisponibilidade dessa evidência, não aprovação ou reprovação automática.

Registrar os custos de JavaScript, imagens, Motion e Analytics para explicar os resultados, distinguindo condições de homologação das de produção. Não ativar Analytics em homologação ou introduzir nova coleta de dados de visitantes para medir performance por iniciativa própria. Ferramentas, perfis e protocolo operacional são detalhamento do agente, respeitando os limites numéricos aprovados. Uma nota geral do Lighthouse não substitui os critérios e não existe exigência de 100 pontos ou cobertura de 100%.

Referências das metas: [Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds) e [TBT no Lighthouse](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time).

## 12. Ambientes, implantação e operação

### 12.1 Ambientes fechados

Produção e homologação com banco, bucket de mídias e credenciais próprios. Podem usar a mesma VPS inicialmente se os recursos comportarem. Homologação autenticada, sem indexação e sem Analytics. Testes não acessam recursos de produção.

Uma imagem Docker identificada pelo commit é construída, validada em homologação e promovida para produção **sem reconstrução**. Build em múltiplas etapas, processo sem privilégios administrativos, apenas recursos necessários na imagem final. Segredos externos à imagem.

**Requisito de P13 fechado; desenho técnico necessário:** documentar como configurações específicas do ambiente, inclusive públicas, preservam a promoção da mesma imagem. Verificar valores incorporados no build, endereços absolutos, origem do CMS, imagens e identificação do Analytics. Esse desenho pertence ao plano técnico e seus testes, sem perguntar novamente se a mesma imagem deve ser promovida. Se a estratégia exigir rebuild ou outra mudança no requisito, apresentar o conflito antes de agir.

Registry, domínio, provedor/tamanho da VPS e configuração concreta do Coolify ainda não foram escolhidos. Nenhuma contratação está autorizada por este documento.

**Informação confirmada em P14:** ainda não há domínio escolhido ou registrado. A escolha e o registro ficam para antes do lançamento e não bloqueiam a arquitetura, os modelos do CMS ou o desenvolvimento. Os endereços devem ser configuráveis por ambiente, respeitando a promoção da mesma imagem Docker. Não usar um domínio inventado como endereço público definitivo em metadados, sitemap ou links absolutos.

**VPS confirmada em P14:** ainda não contratada. Provedor, plano e recursos serão propostos no planejamento da implantação, com dimensionamento para aplicação, PostgreSQL, homologação e processamento de imagens, e custos apresentados antes da contratação. A ausência da VPS não reabre a stack nem bloqueia a consolidação da spec. Não contratar infraestrutura por iniciativa do agente.

### 12.2 Migrações e recuperação

Migrações versionadas e testadas em homologação, executadas em etapa controlada, sem disparar a cada inicialização. Backup antes de migrações/atualizações do ambiente. Alterações de banco compatíveis com a versão anterior quando possível. Voltar a imagem não implica reverter dados. Migrações destrutivas exigem aprovação explícita e recuperação documentada.

**Política de P15 fechada:**

- Backups semanais e backups extras antes de migrações, mantendo oito semanas de histórico.
- Destino em bucket privado exclusivo para backups no Cloudflare R2, separado do bucket de mídias e fora da VPS, com credenciais próprias e acesso restrito.
- Cobertura do PostgreSQL completo e das imagens/PDFs necessários para restaurar o conteúdo, incluindo os relacionamentos entre registros e arquivos.
- Backups criptografados, com a chave guardada separadamente.
- Exclusões no site não apagam imediatamente as cópias históricas, que seguem a retenção de oito semanas.
- Recuperação documentada e teste de restauração em ambiente isolado antes do lançamento, verificando conteúdo, traduções e arquivos.

**Detalhamento técnico e verificação restantes:** configurar execução, armazenamento, retenção e recuperação coerente do banco e arquivos; registrar os resultados das rotinas e demonstrar a restauração. Nome do bucket, ferramentas, agendamento e credenciais pertencem à implantação; custos adicionais continuam sujeitos à aprovação. Não perguntar novamente frequência, retenção, destino ou cobertura já aprovados.

### 12.3 Logs e saúde

Logs centralizados em `helpers/logger`, com data, nível, operação, resultado e identificador de correlação. Registrar falhas de publicação, cache, processamento e integrações sem credenciais, tokens ou conteúdo privado. Saída do processo consultável no Coolify; logs de implantação separados dos logs de execução. Configurar rotação e limite de disco.

Health check leve para indicar prontidão da aplicação ao Coolify. Diagnóstico de banco/R2 separado: uma falha transitória dessas dependências não deve derrubar o serviço de páginas em cache por si só. Endpoints públicos não expõem configuração, credenciais ou diagnóstico interno detalhado.

Sem serviço externo de monitoramento e sem notificações externas nesta versão. Logs/health checks não garantem detecção da queda da própria VPS quando ela é o único ponto observado.

**P16 fechada como decisão; detalhamento técnico restante:** selecionar biblioteca e formato dos logs, limites/rotação, intervalos/timeouts e proteção dos diagnósticos no plano operacional. Não perguntar novamente se haverá logs centralizados ou health checks pelo Coolify, nem adicionar monitoramento externo. Verificar os limites da VPS e demonstrar o comportamento durante falhas.

## 13. Skills para o agente

O agente deve localizar e ler as skills instaladas quando o gatilho se aplicar. Nomes não autorizam executar exemplos literalmente nem ampliar escopo. Registrar indisponibilidade ou conflito que afete o trabalho. Caminhos abaixo descrevem esta máquina; confirmar sua existência no ambiente executor.

| Skill | Uso previsto |
|---|---|
| `test-driven-development` | TDD durante implementação de comportamentos e correções |
| `verification-before-completion` | Antes de afirmar que etapa/entrega está pronta |
| `vercel-react-best-practices` | Código e revisão de React/Next.js |
| `accessibility` | Implementação e validação da acessibilidade |
| `systematic-debugging` | Investigar falhas antes de propor correções |
| `figma:figma-design-to-code` | Consulta de contexto e implementação do Figma |
| `seo` | Implementar/verificar rastreabilidade, metadados, idiomas e sitemap |
| `performance` | Medir, localizar gargalos e verificar resultados |
| `web-quality-audit` | Auditoria integrada antes da aprovação final |
| `motion-foundations` | Tokens, SSR, movimento reduzido e padrões fundamentais |
| `motion-patterns` | Interações aprovadas consumindo os tokens fundamentais |

Locais de referência:

- Skills gerais: `C:/Users/joeld/.agents/skills/<nome>/SKILL.md`.
- `verification-before-completion`: `C:/Users/joeld/.agents/skills/verification-before-completion/SKILL.md`.
- `systematic-debugging`: `C:/Users/joeld/.codex/skills/systematic-debugging/SKILL.md`.
- Figma: `C:/Users/joeld/.codex/plugins/cache/openai-curated-remote/figma/17.0.0/skills/figma-design-to-code/SKILL.md`.

A seleção inicial foi apresentada e recebeu complementos do usuário; a base técnica com indicação de skills foi posteriormente aprovada. TDD e verificação antes de concluir foram exigidos explicitamente. Auditorias não geram tarefas recorrentes ou serviços extras sem autorização.

## 14. Etapas e limites de autonomia

Quatro etapas aprovadas, com revisão do usuário antes de avançar:

1. **Estrutura e modelos do CMS:** arquitetura, contratos, controles de acesso e prova da publicação independente por idioma.
2. **Páginas conforme o Figma:** conteúdo, componentes, responsividade, navegação, acessibilidade e evidências visuais.
3. **Integrações e publicação:** R2, Analytics automático sem cookies conforme a política fechada, imagem Docker, homologação, cache, migrações, backup e operação.
4. **Validação final:** jornadas completas, auditorias, segurança, comparação visual e procedimento de implantação.

Integrações mínimas necessárias às etapas anteriores podem ser preparadas antes, sem antecipar a aprovação de sua entrega nem implantar produção. A etapa 3 prepara e valida a publicação; o lançamento público só ocorre após a validação final e aprovação. As etapas precisam de plano próprio após revisão desta spec, sem implementar tudo em paralelo.

O agente pode decidir detalhes internos que não alterem visual, conteúdo, comportamento, escopo ou custos. Lacunas que afetem esses pontos exigem explicação, solução recomendada e resposta do usuário. Trabalho independente pode continuar. Não criar serviços, contratar recursos, redesenhar páginas, relaxar testes, publicar conteúdo inventado ou substituir stack por iniciativa própria.

Cada etapa entrega: alterações, evidências atuais de verificação, divergências, riscos e pendências. Não afirmar sucesso por execução anterior, ausência de mensagem de erro ou mera escrita de código.

## 15. Registro reconciliado das decisões e do trabalho restante

Revisão feita após o usuário apontar que vários itens já haviam sido definidos. A lista original misturava decisões em aberto, detalhamento técnico e evidências que só existirão na implementação. Os IDs foram preservados para rastreabilidade; eles não representam 17 perguntas ainda sem resposta.

Neste registro, **Fechada** significa que a política/requisito já foi aprovada; não significa que foi implementada ou testada. **Referência consolidada** identifica o inventário documentado com suas fontes, sem confundi-lo com exportação de arquivos ou prova visual da implementação. **Implantação** reúne dados a obter no planejamento operacional, sem reabrir escolhas estabelecidas.

| ID | Estado | Já definido | Trabalho ou decisão que realmente resta |
|---|---|---|---|
| P01 | Referência consolidada | Catálogo de frames/componentes e tokens documentados no inventário complementar; campos mapeados nos contratos do CMS; modelos permanecem em rascunho; header e currículo aprovados | Agente exporta/confere originais, propriedades internas e implementação visual na etapa correspondente; sem nova rodada de perguntas sobre decisões aprovadas |
| P02 | Fechada | Case compartilhado e documentos editoriais por idioma; Navegação/Perfil separados; unicidade e proteções; recuperação como rascunho; bloqueio concorrente; links tipados; contratos complementares documentados | Agente: materializar os contratos em schemas para a versão validada do Payload e comprovar as regras em testes. Não pedir novamente aprovação para essas políticas |
| P03 | Fechada | Slugs por idioma e únicos também em rascunhos/histórico; sugestão pelo título, formato e limite de 80 caracteres; regras de liberação, reserva e reutilização do próprio histórico; publicação explícita para mudar URL pública | Agente: implementar e testar normalização, concorrência e ciclo de reservas/redirecionamentos; levantar palavras reservadas por conflitos reais de rotas |
| P04 | Fechada | Preservar trecho de leitura na tradução; case sem tradução leva à listagem no topo com toast no idioma escolhido | Agente: mapear seções/blocos, tratar imagens/fontes e histórico e testar. Só consultar se surgir um caso concreto sem equivalente que exija mudar o comportamento |
| P05 | Fechada | Cookie funcional somente com `pt`/`en`, por 180 dias da última escolha manual, sem renovação nas visitas; URL explícita prevalece; entrada por escolha anterior, navegador e inglês; separado do Analytics | Agente: configurar nome/atributos seguros, negociação e expiração; testar que somente escolhas manuais atualizam a preferência e reiniciam o prazo |
| P06 | Fechada | Google Analytics automático, sem banner ou escolha de aceitar/recusar cookies ou estatísticas; sem cookies de analytics; métricas restritas ao escopo aprovado; somente produção pública; cookie de idioma separado | Agente: configurar e verificar ausência de armazenamento de rastreamento, eventos e relatórios disponíveis; evento de currículo registra o acionamento de abertura em nova aba. Não reabrir a política nem flexibilizar cookies |
| P07 | Fechada | Renderização no servidor e cache; atualização por conteúdo; cache preservado durante falha temporária; CMS informa atualização pública não concluída e oferece tentativa segura | Agente: desenhar invalidação, tratamento de falhas e transições; propor prazo operacional na etapa e comprovar o resultado. Não reabrir a escolha de cache ou disponibilidade |
| P08 | Fechada | Rascunhos e mídias privados; prévias autenticadas; somente mídias aprovadas públicas; impedir exclusão de arquivos publicados em uso | Agente: modelar referências, promoção/revogação e caches; testar compartilhamento entre idiomas. Retenção e recuperação se articulam com P15 |
| P09 | Fechada | JPEG/PNG/WebP/AVIF até 10 MB; PDF até 5 MB; SVG permanentemente proibido; processamento na aplicação e arquivos no R2 | Agente: dimensionar derivados e proteções, verificar memória e conteúdo real dos arquivos. Explicitar restrições adicionais antes de impor mudança ao que foi aprovado |
| P10 | Fechada | Contas individuais sem cadastro público; controles de acesso e proteção de login; recuperação nativa do Payload pelo e-mail cadastrado com link temporário | Agente: configurar envio de e-mail, tokens, sessões e proteções; comprovar recuperação em testes. Provedor/credenciais são configuração de implantação e contratação paga exige aprovação |
| P11 | Fechada | Stack aprovada; Next.js estável mais recente; compatibilidade validada; lockfile; checagem de segurança inicial e antes de produção | Agente: consultar versões e avisos atuais, registrar e testar a combinação. Só consultar o usuário em conflito com as restrições aprovadas |
| P12 | Fechada | Home/listagem/case pesado em PT/EN e celular/desktop; LCP até 2,5 s, CLS até 0,1, TBT até 200 ms no celular e 150 ms no desktop; pelo menos três execuções e mediana/variação; INP de referência até 200 ms em campo quando disponível | Agente: documentar condições, medir e comprovar metas de laboratório; registrar custos de recursos e diferenciar dados de campo, sem reabrir as metas aprovadas |
| P13 | Fechada | Mesma imagem Docker de homologação para produção, sem rebuild; commit identificável; segredos externos; build em etapas e usuário sem privilégios | Agente: documentar configuração por ambiente, inclusive valores públicos, e demonstrar promoção da mesma imagem. Rebuild exige explicitar conflito |
| P14 | Implantação | VPS com Coolify, R2, PostgreSQL, GitHub Actions e homologação isolada; VPS ainda não contratada; domínio ainda não escolhido/registrado | Propor dimensionamento, provedor/plano e custos no planejamento de implantação; definir domínio antes de publicar; configurar destino de imagens e credenciais quando necessários. Não bloqueia a consolidação da spec nem autoriza contratações |
| P15 | Fechada | Backups semanais e pré-migração, histórico de oito semanas, PostgreSQL e arquivos necessários; R2 privado exclusivo fora da VPS, credenciais próprias, criptografia e restauração isolada antes do lançamento | Agente: configurar e verificar as rotinas, retenção e recuperação documentada de conteúdo, traduções e arquivos; não reabrir a política aprovada |
| P16 | Fechada | Logs centralizados em helpers/logger, consulta pelo Coolify, health checks leves e diagnóstico de dependências separado; sem monitoramento externo | Agente: configurar formato, rotação/limites, intervalos e procedimento; demonstrar falhas e prontidão |
| P17 | Fechada | Case retirado mostra indisponível com links; tradução publicada permanece acessível; falha de origem não vira inexistência nem vaza rascunhos | Agente: definir e testar códigos HTTP, redirecionamentos e indexação coerentes com esse comportamento |

### 15.1 Resultado da reconciliação

- **15 itens com decisões fechadas:** P02, P03, P04, P05, P06, P07, P08, P09, P10, P11, P12, P13, P15, P16 e P17. Permanecem entregas técnicas e testes, sem necessidade de repetir a entrevista sobre as mesmas políticas.
- **Nenhum item com decisão de produto identificada em aberto:** o usuário confirmou que os modelos permanecem em rascunho até revisão final; header, currículo e demais políticas estão aprovados.
- **Referência de P01 consolidada:** inventário de frames/componentes/tokens e mapeamento dos contratos documentados. Exportação dos ativos, verificação de propriedades internas e prova visual pertencem às etapas de implementação.
- **1 grupo de dados de implantação:** P14. Solicitar informações e aprovações de custos no momento em que forem necessárias.

### 15.2 Regras para continuar a entrevista

- Antes de perguntar, conferir as decisões da conversa e desta spec. Uma resposta aprovada atualiza o contrato e sai da fila de decisões, ainda que sua implementação não exista.
- Perguntar uma decisão real por vez; não reapresentar uma política fechada para obter outro “sim”.
- Levantar fatos do Figma, documentação e ambiente com as ferramentas disponíveis. A limitação de uma ferramenta não transforma automaticamente o fato em uma decisão do usuário.
- Detalhes internos são documentados no plano e revisados na etapa correspondente. O agente não pode usar essa autonomia para mudar comportamento, conteúdo, visual, escopo, custos ou garantias aprovadas.
- Critérios de teste e auditoria permanecem obrigatórios mesmo quando o requisito está fechado. Falha técnica deve produzir diagnóstico e proposta dentro do contrato, sem enfraquecê-lo silenciosamente.
- Não criar novas funcionalidades, políticas de retenção ou metas numéricas apenas para marcar itens como resolvidos.

## 16. Referências técnicas consultadas

As fontes orientam verificação; não substituem decisões do produto. Reconsultar documentação e avisos vigentes na implementação.

- [Google: sites multilíngues](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites).
- [Google: Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode).
- [ANPD: cookies e proteção de dados](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais).
- [Next.js: política de suporte](https://nextjs.org/support-policy) e [comunicados](https://nextjs.org/blog).
- [Motion: redução do bundle](https://motion.dev/docs/react-reduce-bundle-size) e [desempenho](https://motion.dev/docs/performance).
- [Coolify: operação e logs](https://coolify.io/docs/applications/operations/overview) e [health checks](https://coolify.io/docs/applications/configuration/health-checks).

## 17. Próximo passo

A entrevista de decisões identificadas está encerrada. Esta spec e seus complementos estão consolidados para revisão. O próximo artefato será o plano de implementação com schemas, configurações, etapas e verificações coerentes com os contratos; a elaboração desse plano não é iniciada automaticamente nesta entrega. A política fechada permanece fechada enquanto seus testes ainda estão por executar. Dados e custos de implantação são tratados no momento adequado, sem antecipar contratações. Não iniciar código, infraestrutura ou implantação a partir deste documento sem aprovação posterior do plano e da etapa correspondente.
