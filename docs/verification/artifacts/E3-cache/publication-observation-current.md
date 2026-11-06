# Observação da revisão pública — verificação local de 04/11/2026

O worker já drena intenções persistidas quando o PostgreSQL volta. O coordenador possui uma observação opcional antes de gravar a confirmação SQL. A implementação em composição fica desativada por padrão e só é habilitável no runner descartável `APP_ENV=test`, PostgreSQL próprio na porta 55434, banco `adfl_test_runner`, namespace `adfl-test-runner` e `INTERNAL_HTTP_ORIGIN` literal de loopback. `configureTestEnvironment()` força a opção para false. O teste integrado precisa habilitá-la explicitamente no processo Next próprio.

O Proxy usa o `X-Portfolio-Generation` da mesma raiz selecionada para resposta direta ou do pin assinado que segue para SSR. A requisição não escolhe a geração. Fallback de caminho malformado, preview, mídia, rotas privadas e resposta sem raiz não recebem o marcador por esse caminho. O agregado anônimo de cases usa os DTOs de cards/destaques já aprovados. Perfil e navegação mantêm os contratos anteriores e vinculam corpo e geração à mesma leitura. Uma ordem compartilhada confirmada sem cases publicados resulta em arrays vazios nos dois idiomas.

O observador usa GET direto com `node:http` e agente descartável, mesmo com `NODE_USE_ENV_PROXY`, sem cookies e sem seguir redirecionamentos. Valida o plano antes da primeira consulta, não lê novamente objetos mutáveis do chamador, limita a leitura, confere status/geração, exige fim do corpo e controla a duração total. O matcher de HTML usa `parse5@8.0.1`, já resolvido pelo lockfile como dependência indireta, declarado como dependência direta no mesmo número de versão. Verifica a marcação renderizada, incluindo cabeçalho, cards e ordem, canônica e alternates. Texto em script, estrutura oculta, página incompleta e templates de erro não atendem à prova. Os redirecionamentos são comparados contra `SITE_ORIGIN`; a conexão permanece na origem interna fixa.

Depois de persistir a raiz sob o escritor existente e antes de gravar `public`, o coordenador mantém o fence e a transação nativa durante o callback. Uma falha deixa a intenção pendente, preserva a raiz durável e permite observar a mesma geração em uma nova tentativa. Não há segunda autoridade de publicação.

| Prova | Resultado | Recibos |
| --- | --- | --- |
| Transporte com servidor HTTP sintético | RED 20 falharam, GREEN 20/20 | `publication-http-verification-{red,green}-001.txt` |
| Marker Proxy e pin real | RED 6 falharam e 79 passaram. GREEN final combinado 105/105. Duas tentativas intermediárias preservadas registraram diferenças do contrato esperado e uma relação de fixture inválida. | `public-generation-marker-red-001.txt`, `public-generation-marker-green-00{1,2,3}.txt` |
| Revisão de proxy ambiente, mutação do plano e prazo | RED 3 falharam e 20 passaram. O processo Node encaminhou a chamada ao proxy de loopback sintético. GREEN combinado 108/108, zero conexões ao proxy no cenário corrigido. | `publication-http-hardening-{red,green}-001.txt` |
| Fronteira nativa da confirmação | RED devolveu `public` após a falta da observação. GREEN 29/29 em três arquivos, PostgreSQL 17.11 isolado. O callback observou o receipt SQL ainda pendente nas duas tentativas e a mesma geração persistida. | `publication-observer-ack-native-{red,green}-001.txt` |
| Projeção do HTML | RED 2 falharam e 10 passaram, GREEN 12/12 | `publication-page-observation-{red,green}-001.txt` |
| Plano de observação | RED 3 falharam, GREEN combinado 38/38 | `portfolio-publication-observation-{red,green}-001.txt` |
| Opt-in isolado | RED 1 falhou, GREEN combinado 77/77 | `publication-observer-config-{red,green}-001.txt` |

Comandos focados com Node 24.22.2 e Vitest 5.0.5:

```powershell
pnpm exec vitest run --project unit src/config/server-env.test.ts testing/setup/test-environment.test.ts src/config/portfolio-publication-observation.test.ts src/config/publication-page-observation.test.ts src/helpers/payload/publication-http-verification.test.ts
pnpm exec vitest run --project integration src/config/publication-updates.integration.test.ts src/config/publication-failure-boundaries.integration.test.ts src/config/publication-command-receipts.integration.test.ts
```

Separadamente, o worker passou 52/52 em seis suítes Native e 1/1 no Next 16.4.3 compilado para produção. O teste observou HTTP 200 na página e em `/health` durante a interrupção do PostgreSQL e o processamento da intenção persistida no mesmo processo após reconexão. Os hashes de `next-env.d.ts` e `tsconfig.json` foram preservados. Ver `publication-worker-report.md` e recibos correspondentes.

Pendências da observação: prova integrada pelo Next com os endpoints montados, retomada do worker após interrupção específica entre raiz e confirmação SQL, observação de revogação de mídias e otimizador com recursos compartilhados, sitemap indexável, limites medidos e validação no ambiente operacional. O limite de 64 observações, 2 MiB por resposta e 5 s no transporte é guarda local. Falta medir seu comportamento em históricos extensos antes de habilitar em ambiente operacional. As caixas E3.2.2–E3.2.5 seguem abertas.
