# Recuperação nativa de senha e Resend

Os dois portfólios/CMS usarão e-mail somente para recuperação nativa de senha. Não há atendimento, inbox, cadastro público, autenticação paralela ou novo papel administrativo. Este repositório configura somente A Design for Life; os outros projetos terão suas próprias chaves e configuração.

Uma conta Resend e o subdomínio escolhido `mail.joeldorosarioo.dev` podem atender os projetos com remetentes/chaves separados. Nenhuma inbox precisa ser criada para esses envios. A chave deste projeto deve ter permissão de envio e estar limitada ao domínio escolhido, sem acesso administrativo desnecessário. As quotas da conta continuam compartilhadas.

## Configuração implementada

- `RESEND_API_KEY`: chave exclusiva de envio deste projeto, somente no servidor.
- `EDITORIAL_EMAIL_FROM_ADDRESS`: remetente válido sob `mail.joeldorosarioo.dev`; exemplo ainda não configurado: `a-design-for-life@mail.joeldorosarioo.dev`.
- `EDITORIAL_EMAIL_FROM_NAME`: nome de exibição a confirmar pelos responsáveis.
- `SITE_ORIGIN`: origem configurada do ambiente, usada pelo fluxo nativo; não confiar em Host/Forwarded do visitante para formar destinos.

`APP_ENV=local|test` mantém captura privada temporária mesmo se houver configuração Resend herdada. `staging|production` exige configuração remota completa de R2 e Resend ao inicializar; não há fallback silencioso para console/captura. O transporte usa `@payloadcms/email-resend@3.92.1`, compatível com Payload3.92.1. O remetente configurado é imposto; erros externos são convertidos em falha editorial genérica para impedir exposição de destinatário/link/token pelos logs e preservar a resposta nativa sem enumeração de contas.

Recuperação, tokens temporários, uso único, expiração, proteção contra abuso e sessões permanecem nativos e protegidos pelas garantias A1. A captura local não comprova entrega real. O adaptador oficial não oferece uma opção própria de timeout de envio; não se promete prazo de entrega com este incremento.

## Dados necessários para a prova real

1. Confirmar no Resend que `mail.joeldorosarioo.dev` foi verificado com os registros DNS gerados pelo próprio serviço. Preservar registros do domínio principal e de outros projetos. Não habilitar recebimento/inboxes por causa da recuperação de senha.
2. Informar o remetente e o nome de exibição escolhidos. Preencher a chave de envio no ambiente privado ignorado pelo Git ou, futuramente, nos segredos do Coolify; não enviar a chave no chat/relatórios.
3. Indicar uma conta editorial autorizada e autorizar especificamente uma mensagem real de teste. Até essa autorização, o teste continua em captura local, sem mensagens a terceiros.
4. Desativar rastreamento de abertura/clique no domínio de envio; links de recuperação não são eventos de analytics.

Sem VPS contratada, o desenvolvimento e os testes locais continuam. Homologação protegida, DNS/origens finais e entrega real permanecem pendências explícitas de A3. Nenhuma conta, contratação, DNS, chave, inbox, usuário real ou envio foi criado por este documento.

## Evidências e fontes

RED/GREEN do transporte: `docs/verification/artifacts/E3-email/`. Configuração e recusa do CLI antes da integração: `artifacts/E3-integrations/`. Native focado002:24/24 testes atuais de PDF/upload, senha e CLI, incluindo captura local; não é entrega Resend real. Gate completo001 falhou e foi preservado; seu resultado não é apresentado como GREEN.

- [Payload: adaptadores de e-mail](https://payloadcms.com/docs/email/overview).
- [Resend: domínios verificados](https://resend.com/docs/dashboard/domains/introduction).
- [Resend: chaves de API](https://resend.com/docs/dashboard/api-keys/introduction).

Fontes consultadas em03/11/2026. Política de contratação e produção permanece a aprovada pelo usuário.
