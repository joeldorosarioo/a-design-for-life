# E2 — implementação retomada e evidências

Este registro acompanha um commit de implementação e sua verificação. **Não é o pacote final A2 nem aprovação da etapa3.** O escopo permanece E2.1–E2.6; prévia/modelos privados, sem produção, analytics ou serviços contratados.

## Problemas corrigidos e comportamento resultante

O painel Native usava inputs de uma linha para conteúdo com LF autoral comprovado, perdendo a quebra após salvar. Cinco controles existentes passaram a textarea: Perfil `home.titleEmphasis`, `homeAbout.title`, `about.title`; Navegação `footer.title`; Case `sections[].heading`. Foram preservados seus nomes, strings, opcionalidade/validações anteriores e publicação. `home.title` normal permaneceu input, pois a referência não tem LF literal. O gerador oficial confirmou schema físico inalterado para text/textarea; nenhuma migração vazia foi criada.

As apresentações de capa já aprovadas exigiam um enum fechado por case/idioma. `coverPresentation` opcional aceita somente `contained-cherry`/`contained-soft`; ausência/null usa o legado cherry. Não há campos CSS/cor arbitrários ou mudança de projeção dos cards. `controls.backToProjectsLabel` é texto opcional independente de `casesLabel`, com fallback localizado. A publicação exclui somente esse novo opcional, mantendo os campos anteriormente obrigatórios. A migração oficial `20261103_095414_e2_cover_presentation_and_return_copy` adiciona quatro colunas nullable e dois enums, incluindo versões; snapshot/tipos foram gerados oficialmente, sem reescrever migrações antigas.

Os `cardTitle`/`cardEyebrow` aprovados em `c3b4860` mantêm fallback independente para o detalhe. Sua migração foi aplicada à base visual isolada e os textos aprovados incorporados à fixture com validação dos fingerprints anteriores/idempotência. Conteúdo/campos editoriais continuam editáveis, com formatos fechados, sem construtor livre.

As correções de referência abrangem tipografia/gaps, grid e mínimo dos métodos, slots do footer, encerramento/CTA de Sobre, divisórias, comparação móvel, capa clara do segundo case e sumário derivado das seções reais. Títulos têm prioridade sobre eyebrow no sumário, com fallback de vazio; UUIDs/ordem de âncoras permanecem. O retorno footer→top foi verificado sem depender de novo evento do observer. Variantes tipadas/CVA ficam fora do JSX. Header sticky e os três contatos aprovados foram preservados.

Uma única fonte original por imagem continua canônica: dimensões/recortes porCSS, Next.Image público e transporte autenticado privado. Recortes já coincidentes foram preservados. Não foram inventados resultados profissionais, ativos ou traduçãoPT do segundo modelo. Arquitetura por features, schemasZod, mappers, helpers/stylesheets, testes adjacentes e fronteiras servidor/cliente permanecem.

## Regressão real de308 e correção mínima

O gate completo revelou que um308 com `Location` relativo era recusado pelo adapterNext, que constrói NextURL sem base; o servidor acabava retornando500. Dois testes comportamentais novos consumiram a resposta via NextURL real, em GET eHEAD, e reproduziram `TypeError: Invalid URL` no código não corrigido. Não se contou falha de importação comoRED nem se simulou o resolver/NextURL.

A correção é uma linha em `src/proxy.ts`: `new URL(decision.location, env.SITE_ORIGIN).href` no Location. Usa a origem configurada/validada; ignoraHost, x-forwarded-host/proto eForwarded enviados pelo cliente. Preserva308, no-store, corpo vazio GET/HEAD e ausência de token/cookie. **RED2/39skips → GREEN41/41**, lint/formato/diffcheck exit0. Os relógios locais/durações Vitest foram preservados; não foram inventados timestampsISO completos para esses comandos focados.

Prova projetada: `proxy-tdd-recorded-evidence.json` no lote de gates sanitizado. O gate003 posterior também passou as jornadasHTTP que antes falhavam.

## Verificação agregada atual

| Identificação             | Evidência                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fonte                     | 500arquivos; SHA256 `f49bfee19601d9bb2924d606961f520c11e2aa2610b308f23b539bb9c6c2e784`                                   |
| Build visual atual        | Candidata008, `XCwWNaSVVZ2kr6jeLy4Aa`                                                                                    |
| Runtime                   | Node24.22.2 portátil/pnpm12.10.1, Next16.4.3, Payload3.92.1; lockfile preservado                                         |
| `pnpm verify`, final003   | exit0;1164passes,2skipsWindows,144arquivos;2testes adicionais de CSS;14:02:31–14:06:51UTC                                |
| `pnpm test:e2e`, final003 | exit0;113/113;14:06:51–14:09:09UTC                                                                                       |
| Evidência de gates        | 19exports sanitizadosV2 e manifesto vinculados ao Build/fonte acima; revisão independente já registrada pelo coordenador |

Os2skipsWindows continuam exigindo execuçãoLinuxCI; o GREEN local não os converte em testes executados. A pré-condição `READING_E2E_FONT_FILE` foi comprovada localmente com `C:\Windows\Fonts\arial.ttf` (1045956bytes, SHA256 `EDFBD22A3D088FC2F5D7C79B8C9C732DF6DC878A60F0A80BE0F92A3C7A634404`). É fonte técnica do harnessFontFace, sem fonte/ativo novo no produto. A configuração da CI já seleciona uma TrueType instalada com Fontconfig após preparar Chromium e registra seu hash; a execução Linux no SHA exato ainda está pendente. Não há declaração de requiredcheck verde até o recibo do SHAexato. Se a configuração deCI mudar, registrar seu novo snapshot/escopo sem renomear os resultadosf49.

Falhas anteriores permanecem: final001 teve1157passes/5falhas/2skips; final002 verify1162/2skips exit0, mas E2E109passes/4falhas exit1. Duas falhas eram308 reais e duas eram falta de fontfile no harness. As asserções de retorno e precondições compartilhadas de dois testes Native foram corrigidas estritamente; o runnerC removeu INTERNAL_HTTP_ORIGIN herdado. A antiga paridade497/3 entre007/final002 é histórica e não autoriza ignorar a mudança de produção no proxy.

## Native, restauração e privacidade

O restore real pós-gates003 terminou exit0 em14:10:39UTC:10rascunhos,7mídiasNative, Rootnulo,0operações públicas,28objetos e197522caracteres de SQL de dados iguais após normalizar somente chaves aleatóriasrestrict. A sessão foi renovada emDPAPI sem exportar segredo. Next008 iniciou14:12:40, Node24.22.2 e readinessNative200; o binário007 não foi restaurado sobre ele. O backup007 inteiro, seus links/hashes e as tentativas parciais continuam privados/preservados.

GarantiasA1 mantidas: independência PT/EN, reservas de slugs, restauração como rascunho, leases/bloqueios, rejeição de revisão desatualizada e mídia privada. Os testes Native focados usam Payload/PostgreSQL reais, `overrideAccess:false`, versões, confirmação explícita e Root separado; verificam ausência/null, idioma independente, draftsem alterar publicação e rejeição de enum inválido sem avançar revisão. O leitor legado é exercitado através de pin/checksum/contexto assinado real, sem regravar sua projeção ao aplicar fallback. O gate integrado atual confirma a composição, sem substituir as evidênciasRED/GREEN dos snapshots originais.

## Evidência focada preservada para o commit

As39cópias em `artifacts/E2-A2-resumed/scoped/` correspondem a20cover/return e19multiline;82670bytes. Todos os39hashes exportados e os39hashes originais coincidiram na revisão. A varredura de padrões conhecidos de credenciais/JWT/cookie/auth/email/chave privada/DPAPI/valores nomeados não encontrou candidatos residuais. O manifesto lógico novo não copia os caminhos absolutos do manifest privado original.

Os logs continuam históricos:47unit e10Native do cover/retorno; LFRED8 noOQ, GREEN8 noW8, RED2 daênfase com8anteriores passando e GREEN3jornadas/10asserções no003. Esses números não são uma segunda execução do gate008. Os3logs de lint vazios foram preservados; o tamanho0 não é tomado isoladamente como exit0. Erros de preparação ficam separados doRED: GET404 inicial da releitura, imports/paths, ambiente de runner, permissões de symlink e cleanup dos perfis de desempenho.

Nota de integridade de tooling: as cópias C de capture/responsiveV9 alteram nomes/destinos e normalizam CRLF/LF. A reversão das substituições coincide no texto normalizado, **não nos bytes brutos**. Seus SHAs preparados vinculam os bytes reais; os helpers originais não foram alterados. O novo relatório registra essa precisão sem reescrever relatórios/recibos históricos.

## Limites de snapshot e próximos passos

007/V8, seus18PNGs/2vídeos e18LH/20observações de recursos são históricos com Build/digest próprios. V9/008 possui18capturas atuais,982/982checks,81cenários responsivos sem falha,27estados axe sem violação e2demos. Os18LH e20registros de recursos atuais terminaram exit0; seus agregados estão em revisão. A montagem do pacoteA2 e o resultadoCI seguem separados. Este commit de implementação não antecipa esse aceite ou100%.

Leitor formal permanece interrompido por decisão do usuário: o coordenador encerrouNVDA e não o reiniciou. Afirmações locais dos relatos focados sobre não iniciar leitor descrevem apenas aquele escopo; não apagam a interrupção histórica. Auditoria automática, probes de foco/teclado e árvore acessível não comprovam leitor de tela ou conformidadeWCAG. Não há aprovaçãoP12, dado de campo/INP ou produção. Analytics continua desligado.

Ainda dependem de evidência/ação própria: CI noSHAexato comfontprereq, commit/push conforme proteção dedevelop, conclusão dos resultadosV9/008 e revisão/entrega do pacoteA2. Etapa3 aguarda aprovação expressa do usuário. Nenhum serviço5432/55432 foi alterado por esta retomada; os runners usam somente o serviço isolado de testes e o restore guardado correspondente.
