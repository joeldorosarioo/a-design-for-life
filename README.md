# a-design-for-life

Portfólio bilíngue de Product Design e UX. O nome técnico faz referência à música A Design for Life, de Manic Street Preachers; aparência e conteúdo público seguem o Figma e os contratos aprovados.

A execução autorizada abrange somente E1.1–E1.8. A etapa 2 depende de aprovação A1. Esta base contém o painel e API nativos do Payload; as páginas públicas ainda não fazem parte da entrega.

- [Fontes aprovadas](docs/specs/2026-10-29-portfolio-spec-v1.md).
- [Acompanhamento da etapa 1](docs/verification/execucao-etapa-1.md).
- [Versões e compatibilidade](docs/decisions/001-stack-validada.md).
- [Evidências de E1.1](docs/verification/E1.1.md).
- [Preparação e limpeza locais](docs/runbooks/ambiente-local.md).

Requisitos desta combinação: Node 24.22.2, pnpm 12.10.1 e Docker com contêineres Linux. Não apontar testes para produção. Segredos ficam no ambiente; nenhum serviço externo ou implantação pública é criado pelos comandos locais.
