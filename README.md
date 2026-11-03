# a-design-for-life

Portfólio bilíngue de Product Design e UX. O nome técnico faz referência à música A Design for Life, de Manic Street Preachers; aparência e conteúdo público seguem o Figma e os contratos aprovados.

A1 foi aprovada e a retomada de E2.1–E2.6 foi autorizada em 03/11/2026. Esta base contém o CMS Payload e o portfólio bilíngue. A2 aguarda revisão do usuário; a etapa 3 não foi iniciada.

- [Fontes aprovadas](docs/specs/2026-10-29-portfolio-spec-v1.md).
- [Acompanhamento da etapa 1](docs/verification/execucao-etapa-1.md).
- [Versões e compatibilidade](docs/decisions/001-stack-validada.md).
- [Evidências de E1.1](docs/verification/E1.1.md).
- [Preparação e limpeza locais](docs/runbooks/ambiente-local.md).

Requisitos desta combinação: Node 24.22.2, pnpm 12.10.1 e Docker com contêineres Linux. Não apontar testes para produção. Segredos ficam no ambiente; nenhum serviço externo ou implantação pública é criado pelos comandos locais.

## Etapa 2 — portfólio

A implementação de E2.1–E2.6, as decisões preservadas e as evidências estão registradas no [A2](docs/verification/A2.md). O [progresso da etapa 2](docs/verification/progresso-etapa-2.json) mantém os critérios concluídos e as pendências explícitas.

A verificação formal com leitor de tela permanece interrompida a pedido do usuário. O pacote A2 e seus limites devem ser revisados conforme o registro de entrega.

A etapa 3, integrações posteriores e produção aguardam aprovação expressa de A2 pelo usuário.
