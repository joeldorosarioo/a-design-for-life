# E3.3 — contrato e verificação local de Analytics

A feature reúne política, contratos, sessão por documento, adaptador de comandos gtag injetado e componentes React. A composição condicional foi ligada às respostas públicas verificadas e aos links aprovados. O aplicativo mantém o carregamento do SDK desativado (`loadScript=null`). A inspeção interceptada do SDK real e a comparação do custo de JavaScript foram concluídas em 06/11/2026, conforme o recibo mais recente abaixo. **E3.3 permanece aberta** pela revisão dos campos/leituras do SDK, pela inspeção dos controles da propriedade e pelos limites dos relatórios; a medição continua desativada.

## Contratos e política

A entrada pública `@/features/analytics` exporta `canMeasure`, os schemas `publicAnalyticsContextSchema`/`portfolioAnalyticsEventSchema`, `createAnalyticsSession`, `createGtagSession` e seus tipos. `@/features/analytics/ui` exporta `AnalyticsProvider`, `TrackedLink` e `TrackedLinkProps`; o index de contratos não importa React, CSS ou código de servidor.

`canMeasure({ environment, area, preview })` retorna true somente para production/public/false. A sessão exige adicionalmente `publicSiteEnabled === true`, measurementId no formato G-* e uma origem HTTPS sem credenciais, caminho, query ou fragmento. A flag de liberação pública deve continuar false por padrão na configuração de execução; ambiente production isoladamente não libera medição. A feature não lê process.env.

`PortfolioAnalyticsEvent` contém exatamente `{ name, locale, pagePath }`. name admite somente page_view, contact_email_click, contact_linkedin_click e resume_open. locale admite pt/en e deve corresponder ao caminho. Campos extras são rejeitados, inclusive URL/href, label, e-mail, token, conteúdo e identificadores. resume_open registra o acionamento de abertura, sem inferir download/leitura.

Os caminhos admitidos são /pt, /en, /pt/cases, /en/cases, /pt/sobre, /en/about e /{locale}/cases/{slug}, com slug de 1–80 letras minúsculas, dígitos ou hífens. O texto do slug não cria uma reserva adicional: um case público confirmado pode se chamar admin, private ou reset-password. As famílias privadas fora de /{locale}/cases/{slug} continuam excluídas pela estrutura completa da rota. Query, fragmento, percent encoding, backslash, URL externa e rotas privadas não passam. O caminho de cada case público é preservado para distinguir suas visitas. **Validação de formato não comprova publicação:** a composição deve obter locale/caminho canônico exclusivamente de contexto público já confirmado pelo servidor. Nunca derivar esses campos de URL bruta, referrer, título, texto, contato, reset ou rascunho.

## Sessão e composição condicional

`createAnalyticsSession({ runtime, createTransport })` recebe configuração explícita e um único limite de transporte. runtime é `{ environment, area, preview, publicSiteEnabled, measurementId, siteOrigin }`. createTransport recebe somente `{ measurementId, siteOrigin }` validado e fornece `{ send(event): void }`. Criar a sessão não inicializa transporte; o primeiro evento válido permitido o faz. Configuração excluída ou evento inválido nunca invoca a fábrica.

A sessão expõe:

- `track(event): void`: revalida o objeto completo antes do transporte.
- `completeNavigation({ locale, pagePath }): void`: registra uma página efetivamente composta; chamadas consecutivas para a mesma página são deduplicadas. A→B→A conta três. Query/fragmento não representam outra página.
- `trackContact('email' | 'linkedin' | 'resume', context): void`: mapeia um propósito fixo, sem receber href ou rótulo.

A deduplicação é memória transitória do documento; não identifica visitantes. O coordenador deve manter **a mesma sessão por Document** através das remontagens (por exemplo, registro browser-only por Document, criado depois do gate). Não criar nova sessão por página/remontagem ou compartilhar estado de uma sessão entre requisições SSR. Um reload completo cria outro documento e outra sessão. Não há persistência, cookies, localStorage, sessionStorage, User-ID, fingerprint ou identificador alternativo. O cookie funcional de idioma não é consultado.

`<AnalyticsProvider session={sessionOrNull} context={confirmedContext}>` não acrescenta wrapper visual. Seu efeito só completa a navegação após commit React; não registrar tentativas do roteador, preload, páginas suspensas/canceladas, dados provisórios ou prévias. A instância de sessão permanece fora desse provider para preservar a deduplicação quando ele remonta. `TrackedLink` preserva atributos/semântica de uma âncora, conta clique principal/teclado e abertura por botão intermediário, respeita ações impedidas pelo handler e transmite somente propósito/contexto. A composição deve aplicá-lo explicitamente aos links públicos aprovados; links de prévia nunca habilitam sessão.

Se inicialização ou envio falhar, a sessão deixa de enviar pelo restante do documento. Isso evita nova tentativa ambígua e impede que uma ação posterior ultrapasse um comando de consentimento que falhou. A navegação/ação nativa continua funcionando.

## Adaptador gtag e guarda de ativação

`createGtagSession({ runtime, dispatch })` usa os mesmos gates e só chama dispatch no primeiro evento válido permitido. O dispatch é o limite externo capturado em testes; nenhum window/dataLayer/script/recurso Google é criado pela feature.

O primeiro comando é consent/default com analytics_storage, ad_storage, ad_user_data e ad_personalization sempre denied. Seguem defaults para anúncios/sinais desativados, ads_data_redaction=true e url_passthrough=false; a URL é reconstruída de origem validada + caminho público confirmado, referrer/title ficam vazios e language recebe o locale explícito. Depois vêm js, config com send_page_view=false e o evento permitido. Não existe API de consent/update, publicidade, cookies ou identificação. A configuração de contexto sanitizado é reaplicada nas navegações/ações.

O significado desses campos e a precedência de consent/default antes de config/event foram conferidos nas fontes oficiais em 03/11/2026: [guia de consentimento](https://developers.google.com/tag-platform/security/guides/consent?consentmode=advanced), [referência de configuração GA4](https://developers.google.com/analytics/devguides/collection/ga4/reference/config) e [API gtag](https://developers.google.com/tag-platform/gtagjs/reference). ignore_referrer sozinho só afeta atribuição; a proteção de dados também depende do page_referrer vazio explícito.

A configuração Enhanced Measurement precisa ser comprovada na futura propriedade: desligar scroll, busca, outbound clicks, downloads, vídeo/formulários e pageviews de histórico que duplicariam o controle manual. Não foi inventada uma opção de código para substituir esse ajuste. A [documentação oficial](https://support.google.com/analytics/answer/9216061?hl=en) informa que essas opções são configuradas na interface e podem coletar automaticamente URL/texto de links e parâmetros de busca. O Google também documenta [eventos automáticos](https://developers.google.com/analytics/devguides/collection/ga4/events), como first_visit/session_start/user_engagement. Um teste do dispatch não prova a ausência deles nem o conteúdo dos pings do SDK; isso permanece pendência de inspeção de rede interceptada antes da ativação.

## Limitação obrigatória de relatórios — BLOCK-GA4-REPORT-LIMITATION

**Documentação conferida em 04/11/2026.** analytics_storage=denied impede cookies de analytics, mas permite pings sem cookies. Estes podem incluir dados técnicos e sinais do navegador; não equivalem à ausência de transmissão. [Google — Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode?hl=en).

O Google informa que, sem tráfego consentido suficiente para modelar, eventos de usuários que negam consentimento não são relatados. Requisitos publicados incluem 1.000 eventos denied/dia por pelo menos sete dias e 1.000 usuários granted/dia em pelo menos sete dos últimos 28 dias, além de implementação avançada e critérios internos; atingi-los não garante elegibilidade. Sem identificador persistente, pageviews não permitem observar quantos usuários distintos os geraram. [Google — modelagem comportamental](https://support.google.com/analytics/answer/11161109?hl=en).

**Inferência para este portfólio:** uma propriedade alimentada exclusivamente por esta política permanentemente denied não produz, por esse tráfego, a base granted exigida. Portanto, não se pode prometer que relatórios de visitas por página/idioma ou cliques estarão disponíveis, nem que aumentar só o volume denied resolva. Nenhum desses relatórios foi demonstrado; não há evidência de usuários/sessões confiáveis. O transporte sintético não autoriza dizer “GA4 validado”.

Antes de qualquer ativação faltam: propriedade/stream reais e seus ajustes verificados; contrato de wire/storage do SDK real inteiramente interceptado, sem transmissão sintética; relatórios efetivamente disponíveis para os quatro eventos e idioma sob a política fechada, com a identidade de relatório/eligibilidade registradas; e eventual evidência pública autorizada que a demonstração exigir. Se a evidência depender de tráfego de produção pública posterior ao lançamento, existe conflito de sequência com A3/A4: apresentar a condição exata e seu impacto antes da ativação. Não criar banner, promover consentimento, introduzir IDs ou trocar de fornecedor para contornar o bloqueio.

## Evidência local e limites

Node24.22.2 fixado; pnpm12.10.1 preservado; Vitest5.0.5. Os logs reais RED/GREEN e o tsconfig exclusivo da feature estão em [artifacts/E3-analytics](artifacts/E3-analytics/). Snapshot anterior à revisão P2: cinco arquivos/95 testes, sem falhas, preservado nos artefatos originais. A correção P2 remove a reserva não aprovada de palavras em slugs de cases; sua nova evidência fica nos artefatos p2-*. Verificação atual da correção: cinco arquivos/119 testes, sem falhas, além de tipagem/lint/formatação focados com saída 0. Há RED separados para contratos/política, sessão, React, comandos gtag e falha de inicialização denied. Testes React usam os componentes reais; o dublê fica apenas no transporte externo, com dados sintéticos. O teste de armazenamento protege somente o código preparado; não certifica o comportamento de um SDK que não foi carregado.

A composição atual exige resposta pública verificada com status 200 e configuração explícita antes da fronteira cliente. A sessão fica no Document e os links públicos aprovados carregam apenas a finalidade fixa. Os testes substituem somente a execução externa do script. A execução comum usa `loadScript=null` e não inicia o SDK, mesmo com o DTO de produção pública habilitado. A inspeção interceptada do SDK real precisa resolver a coleta automática antes de qualquer ativação.

As provas em `artifacts/E3-analytics/composition-*` registram RED/GREEN de fronteira do servidor, documento, React, navegação nativa e composição da resposta. O último conjunto focado somou 181/181 testes em 13 arquivos, com tipagem, lint e formatação do escopo com saída 0. Os cookies, o storage e os requests do SDK real ainda precisam ser inspecionados, assim como o custo da medição ativada e os relatórios.

## Chromium isolado — 04/11/2026

O teste `src/features/analytics/analytics-events.e2e.test.ts` compila o adaptador real de documento em um harness sintético. O substituto fica no carregador injetado. Ele lê os comandos que o adaptador entregaria ao SDK e os envia a um receptor Playwright em loopback, sem anexar o script do Google. O contexto bloqueia service workers e o teste intercepta todas as requisições.

- Antes da ativação sintética, o navegador não iniciou a sessão com ambiente test/staging, área admin, prévia, liberação pública desligada ou caminho com query.
- A sequência pública EN → PT → EN produziu três visitas. A remontagem consecutiva, o clique cancelado e o link fora do contrato não geraram eventos adicionais. Os acionamentos nativos de e-mail, LinkedIn e currículo produziram um evento de cada.
- O receptor conferiu o comando inicial de armazenamento negado, um único config com pageview automático desligado e a lista completa de eventos, com origem canônica sintética, idioma, título e referrer vazios. Hrefs e parâmetros privados nunca entraram no corpo.
- As requisições não levaram cookies. O teste tornou a propriedade `document.cookie` ilegível e confirmou que o cookie de idioma permaneceu intacto e separado. IndexedDB, localStorage e sessionStorage não receberam entradas. O teste registrou zero requisições externas.

No build real de Next 16.4.3, o Chromium verificou as duas homes, o detalhe publicado, a tradução não publicada (404), a prévia anônima (401), o login do painel e a prévia autenticada do rascunho (200 privado). Todas as páginas ficaram livres de scripts e globais de medição, botões e diálogos de consentimento e requisições externas. O teste da prévia anônima foi corrigido para refletir o 401 já estabelecido no contrato da aplicação.

As duas jornadas Chromium passaram com Node 24.22.2 e Playwright 1.64.1. Passaram também 167 testes unitários focados em 10 arquivos, tipagem, lint e formatação. O recibo registra os comandos de consentimento, configuração e eventos, além de tamanho e armazenamento. [Recibo Chromium](artifacts/E3-analytics/chromium-local-001.json)

O harness minificado com o adaptador e suas dependências mediu 459.473 bytes brutos e 95.688 com gzip. O mesmo harness com montagem vazia mediu 882 bytes brutos e 564 com gzip. Essa comparação mede a fixture isolada, com esbuild, e o recibo separa os bytes de script observados no Next com medição inativa. A comparação do bundle da aplicação após ativação e o custo do SDK real ficam para a prova de ativação.

A captura termina na fronteira do SDK. A inspeção interceptada do SDK real precisa identificar os dados técnicos e eventos enviados, com os controles de medição aprimorada da propriedade verificados e o bloqueio de relatórios registrado acima. [Medição aprimorada](https://support.google.com/analytics/answer/9216061?hl=en) · [Eventos automáticos](https://support.google.com/analytics/answer/9234069?hl=en)

## SDK real interceptado e custo atual — 06/11/2026

O responsável forneceu o fluxo `G-DXFQKDH52Z` e confirmou que a Medição aprimorada está desativada. Esse estado é relato do operador; os controles Google Signals, granularidade de localização/dispositivo e dados fornecidos pelo usuário ainda não foram inspecionados independentemente. Flags `vtp_enable*` do template interno do script não equivalem à auditoria desses controles e não invalidam o relato do responsável.

O script oficial foi obtido por um único GET estático e guardado fora do Git. A captura não executou o SDK nem chamou endpoints de medição. Bytes: **477.089**, SHA-256 `4c1c8a92bfdde6b56befdbf90138fdec498744cc5b2a5d4b4e496b5b669dd7ac`; gzip recomprimido localmente: **163.252 bytes**. A execução ocorreu depois, com os bytes locais íntegros em origem `.invalid`, interceptação de todas as requisições, service workers bloqueados e proxy de loopback que responde erro sem encaminhar conexões. Zero requisições de medição chegaram ao Google.

O RED real observou seis eventos de wire para cinco comandos manuais: três pageviews em vez de dois. O controle com a própria `createGtagSession` e fila gtag padrão reproduziu a emissão inicial adicional; alterar apenas o histórico não a explicou. O SDK identificava o primeiro registro como interno e o seguinte como evento externo. A configuração apenas por stream não foi suficiente com esses bytes. A [documentação oficial de privacidade](https://developers.google.com/tag-platform/security/guides/privacy) também define `gtag('set', { send_page_view: false })` global. Ao preparar esse valor antes de `js/config`, mantendo o `false` por stream, o mesmo SDK passou a produzir exatamente dois pageviews e os três contatos aprovados. Nenhum request/evento foi filtrado para obter o GREEN; os bytes do SDK permaneceram intactos.

O teste de ordem do adaptador primeiro falhou pela ausência desse default global e depois passou. A rodada focada concluiu **180/180 testes em 11 arquivos**, incluindo 13 testes do decodificador de query/batch de coleta. O harness reprodutível confirmou cinco eventos, contexto canônico PT/EN, títulos/referrers vazios e nenhuma sentinela privada transmitida. Não houve novos cookies, writes de cookies, localStorage/sessionStorage ou abertura de IndexedDB; o cookie funcional de idioma ficou igual. O SDK, porém, realizou **sete leituras de `document.cookie`** e enviou resolução/client hints no protocolo. Essas observações não são apresentadas como prova de identificação, mas exigem avaliação antes de aprovar o critério integral de privacidade. O `loadScript=null` padrão continua inalterado, inclusive com ID configurado.

A captura estática autenticada da home `/pt` implantada encontrou **11 assets JavaScript**, **753.055 bytes decodificados** e **233.118 bytes com gzip local**, além dos scripts inline registrados no recibo. Não executou esses scripts nem recebeu script Google. A comparação separa esse orçamento atual, o acréscimo do SDK e o harness isolado de **458.902 bytes /95.452 bytes gzip**. Somar o harness ao bundle Next duplicaria dependências compartilhadas. Esses valores são custo estático, não tempo de carregamento ou medida de produção ativada. Ausência de banner/controles de consentimento permanece comprovada nas jornadas CI existentes e no código que não foi alterado para esse comportamento. [Recibo completo](artifacts/E3-analytics/real-sdk-offline-002.json).

### Reproduzir a inspeção sem enviar eventos

Executar na raiz do projeto, com dependências instaladas e Chromium do Playwright disponível. O primeiro comando baixa somente o código oficial para uma pasta nova; o segundo executa os bytes locais sob interceptação/proxy. Não são necessárias credenciais do CMS ou do Google para o harness.

```powershell
$node = '.\.toolchain\node-v24.22.2-win-x64\node.exe'
& $node src/features/analytics/verification/capture-google-sdk.mjs G-DXFQKDH52Z .work/analytics-sdk-new
& $node --import tsx src/features/analytics/verification/inspect-real-sdk.mjs .work/analytics-sdk-new/sdk-manifest.json .work/analytics-sdk-new/inspection.json
& $node node_modules/vitest/vitest.mjs run --project unit src/features/analytics
```

O script recusa sobrescrever os arquivos de captura/resultado. Para reproduzir os mesmos bytes de 06/11, reutilizar a captura local com o SHA acima; novo download pode trazer uma revisão diferente do fornecedor e deve ser tratado como nova observação. `activationPermitted=false` é deliberado mesmo quando a sequência passa: obter uma sequência correta não aprova os dados adicionais nem os relatórios. E3.3.2/3 e a limitação de relatórios permanecem sujeitos às evidências próprias. O custo JavaScript e a comparação implantada agora têm evidência real para revisão de E3.3.5; nenhum serviço foi contratado ou publicação em produção executada.

## Confirmação dos controles da propriedade — 06/11/2026

O responsável confirmou: “Desativei os três agora”, em resposta à conferência de Google signals, coleta granular de localização/dispositivo e coleta de dados fornecidos pelo usuário. Medição aprimorada OFF já havia sido confirmada. Esse relato resolve a pendência de configuração de E3.3.2, junto aos controles de consentimento denied permanente, publicidade e User-ID já comprovados no código e na inspeção anterior. Não se atribui ao relato o ajuste de um quarto controle de personalização; a proteção de publicidade possui evidência própria na implementação e em NPA=1 do ensaio anterior.

A confirmação foi registrada separadamente e não altera retroativamente o estado da captura histórica do SDK. Não houve consulta independente à conta, novo download/ensaio do SDK, alteração de código ou deploy nesta atualização. E3.3.3 continua pendente pela avaliação das leituras de cookie, necessidade dos campos técnicos e identificadores entre documentos. O loader permanece null, inclusive no staging; relatórios continuam não demonstrados. [Relato do operador](artifacts/E3-analytics/property-controls-operator-confirmation-003.json).
