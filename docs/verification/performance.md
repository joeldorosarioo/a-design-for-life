# Diagnóstico inicial de desempenho — candidata008 atual

Diagnóstico atual concluído: **18 medições Lighthouse e 20 observações de recursos**, executadas na prévia privada local da candidata008. Não é aceite público P12 nem dado de campo. O relatório007 anterior está preservado em history/performance-candidate007-complete.md; nenhum número007 foi renomeado como008.

## Compilação e condições

BuildID **XCwWNaSVVZ2kr6jeLy4Aa**; fonte **500 arquivos**, SHA-256 **f49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784**; fixture privada V5 restaurada após gates003. BUILD_ID/hash e digest coincidem antes/depois de cada uma das18 medições LH,20 observações de recursos e agregados. Este revisor releu as18 linhas completas e recalculou independentemente medianas/mínimos/máximos de LCP,CLS,TBT,FCP e Speed Index: todos coincidem com o sumário salvo.

Protocolo congelado SHA-256 **0750991d17e2d1d8f871adade90376f65d029a4aab2bc2f26eb04a718e082b45**, inalterado: Home PT/listagem PT/Case02 EN; desktop1440×900 e móvel390×844,DPR2;3 repetições LH por cenário. Loopback e CPU sem throttling; aplicação aquecida pela pré-condição autenticada; perfil novo e cache do navegador limpo a cada medição LH. As mídias são originais privadas autenticadas; a otimização pública Next.Image não é exercitada pela prévia.

Ferramentas: Lighthouse13.6.0,Chrome156.0.8078.80,Node 24.22.2; Windows10.0.26300,x64; CPUAMD Ryzen 5 5600X 6-Core Processor,12 processadores lógicos; RAM total reportada17077932032 bytes (15.91 GiB). Estado térmico/carga externa não registrado. APP_ENV=test; nenhum Analytics ativado.

## Mediana [mínimo; máximo]

LCP/TBT em milissegundos;CLS sem unidade. Cada linha contém3 medições atuais completas.

| Página/perfil         | LCP ms                  | CLS               | TBT ms            |
| --------------------- | ----------------------- | ----------------- | ----------------- |
| Home PT — desktop     | 211,38 [206,81; 222,06] | 0,00 [0,00; 0,00] | 0,00 [0,00; 0,00] |
| Home PT — móvel       | 213,03 [209,26; 220,59] | 0,00 [0,00; 0,00] | 0,00 [0,00; 0,00] |
| Listagem PT — desktop | 194,09 [193,86; 224,21] | 0,00 [0,00; 0,00] | 0,00 [0,00; 0,00] |
| Listagem PT — móvel   | 212,80 [186,93; 212,96] | 0,00 [0,00; 0,00] | 0,00 [0,00; 0,00] |
| Case02 EN — desktop   | 193,76 [191,53; 196,16] | 0,00 [0,00; 0,00] | 0,00 [0,00; 0,00] |
| Case02 EN — móvel     | 186,61 [182,53; 198,62] | 0,00 [0,00; 0,00] | 0,00 [0,00; 0,00] |

Lighthouse atual: exit0,2026-11-03T14:28:48.2014051Z→2026-11-03T14:33:26.1198103Z; source audit-results/a2-resumed-visual-v9/lighthouse-summary-v7.json, SHA-256 **7d1af287d1b02e29f303e5334f1a31cf28705aa085f4c5dad6d858ffd1edb7eb**. O sufixo V7 identifica a versão inalterada do tool; V9 identifica esta nova rodada de evidência.

## Recursos e menu

Recursos atuais: exit0,2026-11-03T14:28:24.6880431Z→2026-11-03T14:28:47.8472598Z. São20 observações: Home PT/EN,listagem PT/EN,Case02 EN×desktop/móvel×reduce/no-preference. SHA-256 de resource-observations-v7.json: **f3f25834e0eb1335ea9cbd4ac9c387620577d1c9b2efebff05e269ac25f9f466**.

- Em cada observação,8 entradas ResourceTiming com initiatorType script somam187156 bytes codificados (**182.8 KiB**),621242 decodificados e189556 de transferência. É **subtotal de scripts externos**, sem JavaScript inline/RSC no HTML nem pré-carregamentos classificados link; não é o peso total de JS. Foram9 pedidos de rede script: escopo diferente das entradas ResourceTiming.
- HTML de navegação:6247–10368 bytes codificados, sem separar conteúdo/marcação/JS inline. O grupo ResourceTiming link pode conter preload de imagens e não deve ser chamado integralmente de CSS.
- 0 pedidos de fonte; pilhas do sistema/Georgia aprovadas. 4–5 pedidos de imagem por navegação, incluindo pré-carregamentos. Entradas img não representam necessariamente todos os bytes de imagem; originais privados não comprovam o comportamento público otimizado.
- **0 pedidos a terceiros**. Cookies Native somente RAM/DPAPI; nenhum cookie de Analytics/GA/produção ativado ou exportado.
- Nas10 observações móveis, abertura de menu levou **29.80–35.74 ms de tempo de parede**, incluindo transporte/espera Playwright. 0 pedidos e0 bytes codificados adicionais após networkidle. **Não é INP**, medição humana ou custo causal de Motion. Não há menu móvel para medir no desktop.

A política continua a registrada pelo código/tool: MotionProvider sem consumidor do portfólio, Sheet/Button estáticos. As preferências foram exercitadas, mas zero bytes adicionais de menu não demonstra custo causal zero de Motion. O provider/toast de continuidade pública não é montado na prévia privada e seu custo não foi medido. A inspeção estática anterior de manifests007 é histórica; não a reapresentamos como inspeção dos manifests008.

## Falhas e limites

Esta rodada008 contém somente as18 medições completas exit0. As duas tentativas auxiliares LH falhas no007 (kill():void e cleanup EBUSY), seus logs/linhas/perfis e o007 completo permanecem históricos; nenhuma linha deles entrou no agregado008. ToolV7 foi reutilizado sem alteração de condições, guards, cleanup/retry ou limites. Os teardowns/gates/restauração e incidentes de preparação são evidências separadas.

LCP/CLS/TBT neste laboratório privado sem throttling não aprovam metas públicas P12,p75/INP de campo,rede móvel real ou o case público mais pesado. TBT não substitui INP; não há gate de100 pontos Lighthouse. Resultados PT/EN públicos completos e produção permanecem etapas posteriores. Não foram exportados rawLHR,HTML Lighthouse,traces,HAR,NetLog,headers,credenciais ou authstate. CI/SHA final e aprovação A2 são requisitos separados; etapa3/produção não iniciadas.

## Registro de entrega

O primeiro snapshot revisado do pacote V1 é `A2-review-c9be4dc-v2`, com QA real aprovada. A entrega final será gerada em `outputs/A2` após os documentos B e seu CI; `outputs/A2-entrega.json` registrará SHA/prova exata externamente. O diagnóstico008 acima permanece o mesmo; a correção do visualizador do pacote não altera métricas, código ou protocolo do portfólio. Leitor formal continua interrompido e não há aprovação P12/WCAG/etapa 3.

## Laboratório local de 05/11/2026 com Lorem Ipsum

O protocolo foi fixado em `ops/performance/profiles.json` antes das medições, SHA-256 `245647c292ffed8f667eba825731f66dbabc1f539dfde2f2ed83afb45fa0b25c`. Foram concluídas 48 medições. O conjunto final contém 36 medições e 12 cenários, com três execuções por combinação de Home/listagem/case, PT/EN e celular/desktop. A seleção final usa o Case02, cujo conjunto de recursos entregou 1.276 bytes codificados adicionais por idioma em 1440 × 900 DPR 1. As 12 medições anteriores do Case01 foram preservadas e substituídas apenas no agregado de cenário.

Lighthouse 13.6.0 usou DevTools throttling. Celular 390 × 844 DPR 3, CPU 4×, latência 150 ms, download 1.600 Kbit/s e upload 750 Kbit/s. Desktop 1440 × 900 DPR 1, CPU 1×, latência 40 ms, download 10.000 Kbit/s e upload 5.000 Kbit/s. Os valores de latência foram aplicados diretamente a requestLatencyMs. Cada medição abriu perfil novo, com cache do navegador frio e servidor previamente aquecido.

| Página   | Perfil  | LCP ms mediana [mín.; máx.] | CLS mediana | TBT ms mediana [mín.; máx.] |
| -------- | ------- | --------------------------- | ----------- | --------------------------- |
| home-pt  | mobile  | 1800.00 [1760.55; 1808.24]  | 0.0000      | 145.38 [133.86; 174.03]     |
| home-pt  | desktop | 601.26 [270.51; 688.80]     | 0.0000      | 0.00 [0.00; 0.00]           |
| home-en  | mobile  | 1819.24 [1797.42; 1831.26]  | 0.0000      | 163.67 [162.96; 189.84]     |
| home-en  | desktop | 613.89 [595.22; 638.00]     | 0.0000      | 0.00 [0.00; 0.00]           |
| cases-pt | mobile  | 1422.12 [1406.44; 1429.92]  | 0.0000      | 135.59 [128.13; 163.53]     |
| cases-pt | desktop | 604.77 [560.93; 613.45]     | 0.0000      | 0.00 [0.00; 0.00]           |
| cases-en | mobile  | 1441.61 [1412.45; 1540.74]  | 0.0000      | 133.94 [116.53; 145.81]     |
| cases-en | desktop | 576.26 [568.69; 584.23]     | 0.0000      | 0.00 [0.00; 0.00]           |
| case-pt  | mobile  | 906.65 [877.55; 932.19]     | 0.0000      | 142.77 [130.10; 145.57]     |
| case-pt  | desktop | 504.75 [479.96; 542.33]     | 0.0000      | 0.00 [0.00; 0.00]           |
| case-en  | mobile  | 882.88 [876.78; 888.76]     | 0.0000      | 103.70 [103.11; 116.32]     |
| case-en  | desktop | 524.22 [505.82; 563.18]     | 0.0000      | 0.00 [0.00; 0.00]           |

As 12 medianas atendem aos limites registrados de LCP ≤ 2.500 ms, CLS ≤ 0,1 e TBT ≤ 200 ms no celular/150 ms no desktop. São observações de conteúdo temporário em laboratório local. Dados de campo e INP continuam indisponíveis para localhost.

O executor de ferramenta encerrou o primeiro processo com código 143 após 33 resultados salvos, sem erro de Lighthouse no log. Somente as três medições faltantes foram concluídas em seguida sob os mesmos perfis. O hash da raiz pública após as medições coincidiu com o recibo independente de backup anterior à janela. Uma alteração posterior somente de metadados foi verificada em separado por 10 URLs e manteve os textos visíveis. [Recibo com todas as medições](artifacts/E4-local-audit/local-placeholder-audit-2026-11-05.json)

O executor reutilizável exige Node 24.22.2 e as ferramentas já instaladas no projeto. O arquivo de configuração contém a origem local, o tipo de conteúdo, a imagem e o contêiner atuais, além de oito rotas PT/EN para Home, Sobre, listagem e case. A configuração local final está em `.work/local-audits/2026-11-05-final-config.json`. Use um diretório de saída novo em cada execução. O comando sem `--run` valida os alvos e o protocolo antes de abrir qualquer navegador.

```powershell
node ops/performance/run-local-audit.mjs --config .work/local-audits/2026-11-05-final-config.json --output .work/local-audits/nova-rodada
node ops/performance/run-local-audit.mjs --config .work/local-audits/2026-11-05-final-config.json --output .work/local-audits/nova-rodada --run
```
