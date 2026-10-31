# E2.3 — estados editoriais públicos

Os estados404/410/503 dos detalhes agora recebem marca, navegação, mensagens e contatos da mesma raiz pública capturada para a resposta. O status continua autoritativo. Sem Perfil/Navegação confirmados e válidos, permanece o fallback técnico A1. A ausência de estrutura não autoriza consultar o corpo editorial corrente nem escolher outra geração.

O HTML negativo é renderizado e escapado no servidor, sem scripts, Flight, caminho visitado, slug privado ou assinatura interna. Essa apresentação preserva a igualdade observável entre um endereço desconhecido e uma reserva privada. O CSS público é compilado dos tokens canônicos antes de `dev`, `build` e do build independente do setup Playwright; o arquivo gerado não é um novo ativo editorial.

## Evidência atual

Ambiente: Windows/PowerShell, Node24.22.2, pnpm12.10.1, Next16.4.3, Payload3.92.1, PostgreSQL17.11 real em tmpfs/loopback55433 e Chromium do Playwright. Conteúdo publicado é exclusivamente sintético no banco isolado de teste. Nenhum serviço externo, homologação ou produção foi utilizado.

- `pnpm test:e2e negative-cases.e2e.test.ts`: exit0, **5/5**,30,5s, BuildID `xAv0xWu583U-tm8mDJkdf`.
- Antes da composição, o mesmo HTTP test teve RED real: recebeu o título técnico A1 onde exigia a mensagem editorial publicada. Build, banco e fixture já tinham funcionado; não foi falha de importação/instalação.
- Provas:404 desconhecido/privado indistinguíveis em PT/EN; GET/HEAD, condicionais e RSC; ausência de título/slug privado e headers internos; retirada PT410 preservando detalhe EN200; intenção pública Native sem cobertura confirmada503 com Retry-After60; nenhum fallback para o corpo Native.
- CSS200 e sem diretivas de compilação; header sticky e contato focado visível abaixo dele em1440/390px, também com texto200%; currículo PDF200 em seu destino real de teste.
- Unidade/FS da composição, Proxy, seletor e renderer:107/107 no lote focado. Emissão de CSS:2/2. As verificações focadas de tipos, lint e formato passaram. Esses resultados não substituem o gate agregado final.
- Teardown: container próprio removido; nenhum listener3100/55433. O banco visual criado depois dessa prova pertence a outra execução e não altera essa evidência histórica.

[Manifesto, logs sanitizados e495 hashes de fontes](artifacts/E2-negative-editorial/evidence-manifest.json). Os originais privados permanecem em `.work`; hashes anteriores/posteriores à sanitização distinguem as cópias. A captura é imutável e não recebe cobertura de mudanças futuras.

## Falhas e limites

A primeira instalação usou por engano Node24.21.0 e foi recusada pelo engineStrict, sem alterar package/lock. A repetição utilizou24.22.2; essa recusa não é RED comportamental. Uma fixture unitária de503 baseada em corrupção de summary acionou uma incompatibilidade de logger/AsyncLocalStorage no runner; a fixture passou a representar a cobertura de ordem ausente. O cenário503 exigido também foi provado por Native/PostgreSQL e HTTP reais.

Os estados negativos usam quatro links visíveis que podem quebrar linha no celular; não montam o diálogo mobile nem o provider público de leitura. A conferência visual e a inspeção manual de acessibilidade continuam abertas. A2 ainda exige gate integral atual, regressão do browser A1, LinuxCI, comparação dos18frames e diagnóstico inicial de desempenho. Etapa3 não está autorizada.
