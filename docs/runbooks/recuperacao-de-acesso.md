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

## Captura local validada

O ambiente local mantém o transporte de captura privada. Em 05/11/2026, a cópia restaurada do banco do portfólio passou pela solicitação nativa de recuperação, produziu uma mensagem capturada e aceitou a redefinição. A mesma sessão e a senha anteriores foram recusadas, a senha nova autenticou e a reutilização do token recebeu 403. Essa redefinição ocorreu somente na cópia restaurada. Os arquivos de captura do ensaio foram removidos ao encerrar o alvo. [Recibo do fluxo local](../verification/artifacts/E3-backup/local-portfolio-backup-restore-003.json)

Para testar no ambiente de uso diário, solicite a recuperação no painel. As mensagens ficam no volume privado da aplicação. Copie a captura para o diretório ignorado do host e abra o arquivo mais recente para acessar o link local.

```powershell
docker compose -f compose.local.yaml cp portfolio:/app/.work/editorial-mail .work/editorial-mail-captures
```

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

## Configurar Resend, Squarespace e Coolify no staging

Roteiro para o projeto `a-design-for-life`, environment `staging`, no Atlas. Reserve cerca de 10 minutos para preencher os painéis; a confirmação do DNS depende da propagação e pode levar até 72 horas. Fontes consultadas em 05/11/2026.

1. **Resend: adicionar o domínio de envio.** Abra **Domains → Add Domain**, informe `mail.joeldorosarioo.dev` e escolha a região oferecida pelo serviço. Configure somente envio; mantenha recebimento e rastreamento de abertura/clique desativados. Abra os registros gerados pelo Resend. Valores de DKIM, SPF, destinos MX/CNAME e prioridades devem ser copiados dessa tela, sem usar exemplos de outra conta ou região. [Adicionar domínio](https://resend.com/docs/add-a-domain).

2. **Squarespace: cadastrar os registros manualmente.** Abra **Domains → joeldorosarioo.dev → DNS → DNS Settings → Custom Records → Add record**. Para cada registro de envio apresentado pelo Resend, selecione o **Type** correspondente: `TXT`, `MX` ou `CNAME`. No campo **Host/Name**, retire somente o sufixo `.joeldorosarioo.dev` se o nome vier completo. Estes exemplos mostram apenas a conversão de nomes:

   | Nome completo mostrado pelo Resend          | Host/Name no Squarespace |
   | ------------------------------------------- | ------------------------ |
   | `resend._domainkey.mail.joeldorosarioo.dev` | `resend._domainkey.mail` |
   | `send.mail.joeldorosarioo.dev`              | `send.mail`              |

   Se o nome já vier relativo, mantenha-o. Copie o conteúdo de TXT para **Text**, o destino de MX para **Mail Server** e sua prioridade para **Priority**; para CNAME, copie o destino para **Data**. Use **TTL: 30 minutos** e **Save**. Preserve o registro `panel` e os MX existentes do domínio principal. Não altere nameservers nem reinicialize a zona DNS. [Guia Resend para Squarespace](https://resend.com/docs/guides/dns/squarespace), [DNS de e-mail no Squarespace](https://support.squarespace.com/hc/en-us/articles/31120985010957-Add-DNS-records-for-email).

3. **Resend: confirmar a verificação.** Volte à página do domínio e conclua a verificação dos registros. Prossiga quando o estado for **Verified**. Se continuar pendente, compare os nomes e valores com os registros gerados, incluindo o segmento `mail`. O TTL de 30 minutos não garante uma confirmação nesse prazo. [Domínios verificados](https://resend.com/docs/dashboard/domains/introduction).

4. **Resend: criar a chave deste projeto.** Abra **API Keys → Create API Key**. Use **Name:** `a-design-for-life-staging`; **Permission:** `Sending access`; **Domain:** `mail.joeldorosarioo.dev`. Copie a chave quando for exibida e preencha os três campos no `.env` privado do projeto:

   ```dotenv
   RESEND_API_KEY=<chave-real-copiada-do-Resend>
   EDITORIAL_EMAIL_FROM_ADDRESS=portfolio@mail.joeldorosarioo.dev
   EDITORIAL_EMAIL_FROM_NAME="Eliana Portfolio"
   ```

   O marcador entre `< >` deve ser substituído pela chave real. A chave fica somente no arquivo privado e nos segredos do runtime. O remetente dispensa criar uma inbox. [Chaves de API](https://resend.com/docs/dashboard/api-keys/introduction).

5. **Coolify: acrescentar as três variáveis.** Abra o recurso em **a-design-for-life → staging → Environment Variables → Developer view**. Acrescente os três campos ao conteúdo existente, preservando as 21 variáveis já importadas; salvar essa visão sincroniza a lista inteira. Salve e confira em **Normal view** que os três campos usam **Build time: Not available during build** e **Runtime: Available in the container**. [Variáveis no Coolify](https://coolify.io/docs/applications/configuration/environment-variables).

**Neste ponto, salve as configurações. O primeiro Deploy ainda depende do bootstrap controlado do banco, das migrações e do provisionamento editorial revisados.** Este roteiro não executa DNS, criação de chave, envio de e-mail nem implantação.
