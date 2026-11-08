# Acesso editorial

O acesso usa exclusivamente autenticação, hash de senha, sessões, cookies e recuperação nativos do Payload 3.92.1. Não existe cadastro público nem divisão de permissões entre as duas pessoas editoras.

## Contas individuais

A primeira conta deve ser provisionada por código de servidor executado em implantação controlada, com `context: { trustedAccountProvisioning: true }`. Essa capacidade não é aceita de corpo, query ou headers HTTP. O guard também protege o bootstrap nativo `first-register`, que ignora o access control internamente. O provisionamento inicial real e os dois e-mails responsáveis são entradas de E3.1; testes locais usam exclusivamente identidades sintéticas `example.invalid` no PostgreSQL isolado.

Depois de autenticar, uma pessoa editora pode criar a segunda conta em **Users** no painel nativo. Cada conta deve pertencer a uma pessoa, com senha própria; ambas têm as mesmas permissões editoriais. Criação anônima, leitura/alteração anônima e exclusão de usuários são recusadas no servidor. Não reutilizar a senha de fixture e não incluir credenciais em argumentos de comandos, logs, capturas ou repositório.

## Sessão e prévia

O painel permanece em `/admin`. Cookies nativos são HttpOnly, SameSite=Lax e Secure quando a origem configurada usa HTTPS; a sessão dura duas horas. JWTs não são incluídos nos corpos de login/reset. A configuração de CORS/CSRF admite somente `SITE_ORIGIN`. Clientes HTTP que usam o cookie também precisam enviar essa Origin ou os metadados de navegação reconhecidos pelo Payload; a ausência desses headers não é uma forma de contornar o controle.

A ação **Preview** dos documentos `case-content`, `site-navigation` e `professional-profiles` usa `/preview?collection=...&id=...&locale=...`. A entrada autentica a sessão nativa, valida a collection fechada, UUID e idioma, consulta o draft com `overrideAccess: false` e redireciona 307 para uma URL canônica privada da mesma rota, com `view=1`. O destino é construído no servidor a partir de `SITE_ORIGIN`, sem depender de Host, Forwarded ou do hostname interno usado pelo Next. A visualização repete autorização e consulta; copiar sua URL não concede acesso.

`returnTo` é opcional e serve somente para um link Voltar. Aceita caminho interno de idioma PT/EN, rejeitando origem externa, caminho relativo de protocolo, controles, barras invertidas ou codificação ambígua antes da consulta ao draft. Ele nunca escolhe o destino do redirect. A resposta é HTML mínimo de contrato, sem habilitar draftMode na rota pública; a apresentação completa pertence à etapa 2. Entrada, redirect e visualização usam no-store/noindex, sem cache público. O acesso a arquivos privados continua sob o guard de mídia de E1.6; o preview não produz URLs públicas para esses arquivos.

## Recuperação nativa local

Em `/admin/forgot`, informar o e-mail cadastrado. O Payload gera e envia o link nativo `/admin/reset/...`; a pessoa abre o link e escolhe/confirma a nova senha no formulário nativo. O token expira após uma hora; tokens inválidos, expirados e reutilizados são recusados. A redefinição revoga sessões anteriores e preserva a lógica nativa de hash, validação, login e cookie.

A caracterização real da versão instalada permitiu duas redefinições concorrentes antes da proteção. O hook técnico `password-reset-guard.ts` faz uma atualização atômica sem alteração do token, pelo adapter oficial, dentro da transação nativa já aberta. Isso segura a linha correspondente até o reset nativo consumir a expiração e terminar. Não abre transação autocommit separada: ausência de transação é recusada. Erros seguem o rollback nativo, e somente uma redefinição concorrente pode concluir; a senha vencedora e a impossibilidade de reuso são verificadas contra PostgreSQL real.

Em APP_ENV local/test, o adapter grava somente uma caixa privada ignorada em `.work/editorial-mail/<hash-do-banco>/`, sem transporte externo nem endpoint para ler mensagens. Arquivos são criados exclusivos, com permissões restritas onde o sistema operacional as aplica. Uma trava exclusiva de arquivo serializa escritores de processos diferentes, com espera limitada a dois segundos; se o processo morrer segurando a trava, parar os processos locais e remover a caixa privada antes de retomar. Não há roubo automático de trava ativa. Cada captura tem no máximo 64 KiB; ficam até 32 mensagens por caixa, com expurgo de mensagens de mais de 15 minutos na próxima entrega. A retenção é preguiçosa: parar o processo não apaga arquivos automaticamente. Ao encerrar uma sessão local, remover a caixa privada correspondente; as fixtures removem seus próprios e-mails capturados em finally/afterAll. No Windows, o diretório deve permanecer sob a pasta privada da conta local, respeitando suas ACLs.

Links, tokens, corpos de e-mail, JWTs e senhas não são anexados a evidências ou relatórios. A jornada sensível de browser roda num subprocesso sem instrumentação do test runner, sem trace, vídeo, screenshot ou snapshot; só emite PASS ou o nome seguro do estágio que falhou. A caixa atravessa os processos de teste e Next sem um inbox público. A leitura é feita somente por suporte de fixture local.

Em staging/production, o envio fica indisponível até configurar o provedor e as credenciais em E3.1; não há fallback para console nem envio real nesta etapa. Uma falha de entrega tem erro operacional genérico no servidor e a mesma resposta pública de solicitação desconhecida, sem revelar se existe uma conta. Isso não implica igualdade de tempo, que não foi medida.

## Tentativas repetidas e headers

O Payload aplica bloqueio nativo após cinco falhas de login, por dez minutos, e cooldown atômico de 15 segundos por conta para pedidos de recuperação. Erros públicos de login inválido e conta bloqueada têm a mesma resposta. Essa normalização fica restrita à autenticação e não oculta falhas editoriais.

A fachada REST limita POSTs nos caminhos nativos `users/login`, `users/forgot-password` e `users/reset-password`, incluindo as variantes de maiúsculas aceitas pelo Payload e corpos malformados: 60 requisições por minuto para cada endpoint, seguidas de 429 genérico com Retry-After. São três buckets fixos em memória do processo; não guardam e-mail, IP, senha ou token, não confiam em x-forwarded-for/x-real-ip e não contam novamente operações Local API. Todos os clientes locais compartilham o bucket, portanto um cliente pode consumir a capacidade dos outros. Reiniciar o processo reinicia o limite. É uma proteção local, sem garantia distribuída: E3.1 deve definir ingress confiável e estado compartilhado antes de múltiplas instâncias.

POSTs sensíveis com Origin diferente da origem configurada, ou Sec-Fetch-Site cross-site, são recusados sem cookie. Corpos de autenticação e erros usam no-store; preview e painel não devem ser indexados. O painel acrescenta nosniff, no-referrer e X-Frame-Options DENY; seus recursos e formulários reais são testados. Não foi aplicada uma CSP genérica que bloquearia os scripts/estilos nativos. A prévia mínima aplica CSP própria, sem scripts ou recursos externos.

## Verificação local

Usar Node 24.22.2/pnpm 12.10.1 e o lifecycle de teste do projeto. As suites criam/removem apenas `postgres-test` em 55433, com banco `adfl_test_*`; não usar PostgreSQL 5432 ou dados locais 55432.

- `pnpm test:integration -- src/helpers/payload/password-reset.integration.test.ts src/helpers/payload/preview-session.integration.test.ts`
- `pnpm test:e2e src/helpers/payload/password-reset.e2e.test.ts src/helpers/payload/preview.e2e.test.ts --reporter=list`
- `pnpm verify`

O aceite de E1.7 permanece pendente do gate e revisão independentes do coordenador. A etapa 1 não autoriza implantação, início da etapa 2 nem envio real de e-mail.
