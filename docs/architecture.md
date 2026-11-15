# Arquitetura

Next.js e Payload rodam na mesma aplicação. O Payload concentra o acesso editorial ao PostgreSQL. As mídias ficam em armazenamento local no desenvolvimento ou no R2; as gerações públicas confirmadas usam armazenamento privado persistente.

## Organização

Há três bancos de aplicação fixos: produção, staging e local. O Compose local mantém apenas PostgreSQL, com o volume externo existente; Next.js roda no host. Desenvolvimento e testes compartilham o banco local em `127.0.0.1:5432/a_design_for_life_rebuild` e usam execução exclusiva. Integração e E2E limpam os dados e aplicam as migrações no mesmo banco, sem criar bancos por rodada. Mídia, e-mail e publicação dos testes ficam em namespaces privados de `.work`, separados dos recursos remotos.

O CI hospedado verifica tipos, lint, formato, unidades, arquitetura, scripts e build sem banco. Integração, E2E e provas de recuperação são executados no banco local antes do aceite da candidata; o resultado do CI sozinho não comprova essas jornadas.

As rotas em `src/app` compõem as features de cases, perfil profissional, navegação, idioma, mídia e Analytics. Cada feature expõe contratos em `index.ts`, apresentação em `ui.ts` e operações de servidor em `server.ts`, conforme sua necessidade. Importações entre features passam por essas entradas.

`src/config` compõe as features e prepara o contexto das requisições. `src/helpers` fornece infraestrutura compartilhada; `src/components/ui` reúne as primitivas visuais. As regras de arquitetura impedem ciclos e acesso ao Payload, banco ou armazenamento a partir do navegador. Os contratos usam Zod nas fronteiras e os modelos persistidos usam os tipos gerados do Payload.

## Conteúdo e edição

`cases` guarda identidade, ordem e destaque compartilhados do projeto. `case-content` guarda uma tradução por projeto e idioma. Navegação e perfil profissional têm publicação independente em português e inglês. O CMS oferece estruturas e variantes fechadas, sem edição livre de estilos.

Salvar, publicar, retirar e restaurar usam operações nativas do Payload, protegidas por revisão e bloqueio temporário de edição. O PostgreSQL garante a unicidade das identidades e rotas. Revisão desatualizada e disputa de slug geram conflito explícito; restaurar uma versão cria um rascunho. Navegação e perfis já publicados são protegidos contra retirada.

A prévia exige autenticação e lê rascunhos e mídias privadas sem cache compartilhado. O painel usa a autenticação e a recuperação de senha do Payload. Veja os [contratos do CMS](specs/2026-10-29-portfolio-cms-contracts.md) e o [guia de edição](runbooks/cms-editorial.md).

## Publicação e leitura

A gravação editorial registra a intenção de publicação na mesma transação. Depois do commit, um coordenador serializado confirma a geração pública completa e reconcilia o recibo. A requisição captura `current.json` uma vez: conteúdo, metadados, histórico de rotas e mídias usam a mesma geração. Snapshots privados preservam essa referência entre as partes da renderização.

Enquanto a atualização está pendente, o visitante continua vendo a última geração confirmada disponível. Se a raiz avançar antes da confirmação no banco, a repetição reconcilia a mesma intenção. Uma tentativa antiga não substitui uma geração mais nova. O armazenamento de publicação precisa persistir entre reinícios e fazer parte do backup.

Cada reserva de rota pertence a um projeto e idioma. Gravações explícitas reservam slugs; endereços públicos antigos redirecionam em um salto para o slug atual. Uma rota retirada responde `410`; uma rota desconhecida ou somente privada responde `404`. A indisponibilidade de uma dependência necessária pode produzir `503`.

## Mídia e privacidade

O servidor valida os bytes do upload e gera as versões responsivas. Aceita JPEG, PNG, WebP e AVIF estáticos até 10.000.000 bytes, além de WebP animado preservando sua animação. Rejeita SVG, PNG animado e AVIF animado. PDFs têm limite de 5.000.000 bytes e precisam abrir sem senha.

Originais e derivados só são públicos quando há referência em uma geração confirmada. A retirada da última referência pública revoga o acesso. Credenciais do R2, diretórios de armazenamento e snapshots de publicação ficam fora dos caminhos públicos; logs ocultam dados sensíveis.

## Interface, idioma e configuração

O Figma define layout, tokens e ativos; Tailwind, CVA, shadcn e Motion implementam a interface. Cada idioma tem conteúdo e URLs canônicas próprios. Na raiz, a escolha manual prevalece sobre a preferência do navegador; o fallback é inglês. URLs com idioma explícito prevalecem sobre essa negociação. A preferência manual usa um cookie funcional de 180 dias, sem renovação nas visitas.

A troca de idioma preserva trecho e posição quando há seção equivalente. Sem tradução do case, leva à listagem de destino no topo e informa o visitante com um aviso acessível. Veja a [spec](specs/2026-10-29-portfolio-spec-v1.md) e o [inventário do Figma](specs/2026-10-29-portfolio-figma-inventory.md).

A configuração é lida no servidor; o navegador recebe apenas os campos públicos permitidos. Analytics fica restrito a respostas públicas válidas de produção, sem medir prévias, navegação editorial ou testes. A política mantém `analytics_storage: denied`, sem cookies analíticos ou identificadores persistentes alternativos.
