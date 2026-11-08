# E2.1 — evidências da baseline parcial

Estes arquivos comprovam a fundação de código verificada em30/10/2026. Não concluem E2.1, a exportação dos originais ou a comparação integral de telas. A etapa2 permanece0%.

- `source-snapshot.json`: SHA256 de314 fontes/configurações congeladas durante o repeat verify e o smoke. Inclui o core E2.4 concorrente, que não é parte do commit E2.1. Capturado após os gates; somente documentação/evidências foram finalizadas depois.
- `evidence-manifest.json`: caminho/hash original e exportado, tamanho e transformação. Os logs brutos completos em `.work/E2.1` são privados/ignorados e não foram reescritos para esconder as tentativas falhas.
- `red-presets.txt`, `red-behaviors-assertions.txt`, `green-behaviors.txt`: RED por asserção e GREEN de11 testes. A tentativa anterior com campos ausentes não é usada como prova de RED completo.
- `verify-first.txt`, `verify-repeat.txt`: exportações completas com normalização ANSI e remoção de dados sensíveis. Primeira execução535PASS/1timeout/1skip; repetição sem mudanças536PASS/1skip e build, exit0.
- `native-smoke-first.txt`, `native-smoke-repeat.txt`: primeira seleção regex sem testes e repetição correta2/2, sem alterar fontes.
- `frozen-rejection.txt`, `frozen-install-final.txt`, `install-eligible.txt`: recusa da versão recente e instalação elegível sem exceções na política pnpm.
- `browser-results.json`, `ssr.html.txt`, `specimen-390.png`, `specimen-1440.png`: CSS real, foco, SSR/hidratação e redução em seis cenários. As capturas são de uma fixture técnica privada, não de páginasFigma implementadas.
- `bundle-bytes.json`, `bundle-imports.json`, `barrel-bundle-bytes.json`: medições reais por arquivo e import graph. Gzip usa node:zlib; somas por arquivo não são métricas de transferência HTTP comprimida ou bundleNext.
- `next-client-imports.json`: procura literal dos módulos novos nos manifests cliente do buildNext; não é uma medição de páginas públicas integradas.
- `button-reference.json`, `reference-assets.json`, `reference-summary.md.txt`: referência recebida da pesquisaUI/contexto oficial anterior. O manifesto de assets remove os campos sourceUrl temporários; não incorpora arquivos ao produto nem comprova todos os originais.
- `contrast.json`: cálculo da luminância sRGB para os usos de cores implementados.

## Reprodução da fixture

Copiar `specimen.tsx.txt`, `baseline.tsx.txt` e `inspect.tsx.txt` para `.work/E2.1/`, removendo apenas o sufixo `.txt`. Executar na raiz com o Node24 portátil no PATH:

```powershell
pnpm install --frozen-lockfile
pnpm exec tsx .work/E2.1/inspect.tsx
node .work/E2.1/measure-barrel.mjs
```

Para a comparação, copiar também `measure-barrel.mjs.txt` para o nome indicado. É necessário o Chromium de teste já instalado em `.work/playwright-browsers`. A fixture serve somente127.0.0.1:3102 e encerra browser/servidor no final; não precisa de banco, `.env` nem rota pública. Os fontes são preservados como texto para não entrar no typecheck do produto. O ensaio original da guardaWindows e o filtro inválido do primeiro smoke são falhas de preparação, separadas de falhas do produto.

## Sanitização

Exports de log removem ANSI e substituem e-mails, credenciais de URI PostgreSQL, campos JSON de senha/token/cookie/authorization/hash/salt e parâmetros sensíveis de URL. As mensagens e stacks das falhas são preservadas; não há supressão de warnings. Os originais completos continuam privados com hashes rastreáveis. `reference-assets.json` remove somente os URLs temporários, mantendo nó, arquivo, bytes, SHA256, dimensões, proporção e finalidade. `bundle-imports.json` reduz o metafile aos imports, bytes e módulos com contribuição real. Cópias exatas são identificadas como tal no manifesto.

## Limites atuais

O loader83bytes não adiou domAnimation do shared inicial no bundler desta fixture. A comparação tem baselineReactDOM+Button e um consumidorMotion adicional; não isola custo puro da biblioteca nem mede o Nextfinal. O skip é específico de Linux no Windows e aparece nos dois gates. A CI do futurocommit fará as25 jornadas de baseline antes de promoção. Os originais ausentes e a aceitação visual continuam no gate coordenado, sem checkbox de conclusão.


## Fronteira após a janela de verificação

Depois da liberação da janela, seis arquivos fora da unidade E2.1 foram alterados por trabalho concorrente: schemas/entrada/mapa de Perfil profissional e testing/fixtures/content.ts. O gate536/79 aplica-se ao snapshot e não cobre essas alterações posteriores. A checagem final de hashes terminou exit1 justamente por esse drift; os28 exports existentes estavam íntegros e não havia candidatos de campos sensíveis. A pedido do coordenador, depois disso foi alterado somente um comentário em Button: Secondary é a única variante necessária nesta fundação, não a única variante conhecida. Nenhuma mudança de runtime E2.1 ocorreu após os gates. post-verify-changes.json registra paths e SHA256 antigo/atual; o snapshot original não foi sobrescrito.


Na captura final de post-verify-changes, o trabalho concorrente já havia avançado para 9 arquivos externos, além do comentário de Button. A referência a seis arquivos descreve a primeira auditoria. A lista completa e os hashes atuais estão no JSON, sem atribuir o gate anterior a esse trabalho posterior.
