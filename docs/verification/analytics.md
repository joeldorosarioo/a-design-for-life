# E3.3 — preparação local de Analytics

Em 03/11/2026, existe uma feature independente com política, contratos, sessão por documento, adaptador de comandos gtag injetado e componentes React. **E3.3 permanece aberta.** A composição condicional foi ligada às respostas públicas verificadas e aos links aprovados. O aplicativo mantém o carregamento do SDK desativado (`loadScript=null`). A verificação focada não fecha nenhuma das cinco caixas do plano. Faltam a inspeção do SDK, a comparação de custo de JavaScript, a prova no navegador com Next real e os relatórios.

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

**Fatos documentados em 03/11/2026:** analytics_storage=denied impede cookies de analytics, mas permite pings sem cookies. Estes podem incluir dados técnicos e sinais do navegador; não equivalem à ausência de transmissão. [Google — Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode?hl=en).

O Google informa que, sem tráfego consentido suficiente para modelar, eventos de usuários que negam consentimento não são relatados. Requisitos publicados incluem 1.000 eventos denied/dia por pelo menos sete dias e 1.000 usuários granted/dia em pelo menos sete dos últimos 28 dias, além de implementação avançada e critérios internos; atingi-los não garante elegibilidade. Sem identificador persistente, pageviews não permitem observar quantos usuários distintos os geraram. [Google — modelagem comportamental](https://support.google.com/analytics/answer/11161109?hl=en).

**Inferência para este portfólio:** uma propriedade alimentada exclusivamente por esta política permanentemente denied não produz, por esse tráfego, a base granted exigida. Portanto, não se pode prometer que relatórios de visitas por página/idioma ou cliques estarão disponíveis, nem que aumentar só o volume denied resolva. Nenhum desses relatórios foi demonstrado; não há evidência de usuários/sessões confiáveis. O transporte sintético não autoriza dizer “GA4 validado”.

Antes de qualquer ativação faltam: propriedade/stream reais e seus ajustes verificados; contrato de wire/storage do SDK real inteiramente interceptado, sem transmissão sintética; relatórios efetivamente disponíveis para os quatro eventos e idioma sob a política fechada, com a identidade de relatório/eligibilidade registradas; e eventual evidência pública autorizada que a demonstração exigir. Se a evidência depender de tráfego de produção pública posterior ao lançamento, existe conflito de sequência com A3/A4: apresentar a condição exata e seu impacto antes da ativação. Não criar banner, promover consentimento, introduzir IDs ou trocar de fornecedor para contornar o bloqueio.

## Evidência local e limites

Node24.22.2 fixado; pnpm12.10.1 preservado; Vitest5.0.5. Os logs reais RED/GREEN e o tsconfig exclusivo da feature estão em [artifacts/E3-analytics](artifacts/E3-analytics/). Snapshot anterior à revisão P2: cinco arquivos/95 testes, sem falhas, preservado nos artefatos originais. A correção P2 remove a reserva não aprovada de palavras em slugs de cases; sua nova evidência fica nos artefatos p2-*. Verificação atual da correção: cinco arquivos/119 testes, sem falhas, além de tipagem/lint/formatação focados com saída 0. Há RED separados para contratos/política, sessão, React, comandos gtag e falha de inicialização denied. Testes React usam os componentes reais; o dublê fica apenas no transporte externo, com dados sintéticos. O teste de armazenamento protege somente o código preparado; não certifica o comportamento de um SDK que não foi carregado.

A composição atual exige resposta pública verificada com status 200 e configuração explícita antes da fronteira cliente. A sessão fica no Document e os links públicos aprovados carregam apenas a finalidade fixa. Os testes substituem somente a execução externa do script. A execução comum usa `loadScript=null` e não inicia o SDK, mesmo com o DTO de produção pública habilitado. A inspeção interceptada do SDK real precisa resolver a coleta automática antes de qualquer ativação.

As provas em `artifacts/E3-analytics/composition-*` registram RED/GREEN de fronteira do servidor, documento, React, navegação nativa e composição da resposta. O último conjunto focado somou 181/181 testes em 13 arquivos, com tipagem, lint e formatação do escopo com saída 0. A auditoria integral de páginas e estados no navegador, os cookies/storage/wire do SDK, o custo de JavaScript e os relatórios permanecem sem prova.
