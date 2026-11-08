# Infraestrutura da Etapa 3: inventário e dimensionamento medidos

Atualizado em 06/11/2026. A VPS Hostinger Atlas já foi contratada pelo responsável e é compartilhada com outros projetos. Este registro substitui as hipóteses de orçamento anteriores pela infraestrutura existente e pelas medições atuais. As propostas de 04/11 permanecem no histórico Git; seus preços e tamanhos não descrevem o contrato atual.

## Ambiente existente

| Recurso              | Estado identificado                                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VPS                  | Atlas, Hostinger, dois núcleos de CPU, 8 GB de memória, 100 GB de disco e 8 TB de transferência segundo o responsável                                                                                     |
| Host medido          | Dois CPUs; 8.326.619.136 bytes de memória total, cerca de 7,75 GiB; filesystem de 102.888.095.744 bytes, cerca de 95,82 GiB                                                                               |
| Sistema e Docker     | Ubuntu 24.04.5 LTS e Docker 29.9.3 observados por SSH; esta leitura não é uma auditoria de atualizações ou vulnerabilidades                                                                               |
| Aplicação de staging | Next/Payload e PostgreSQL 17 no mesmo contêiner, usuário `appuser`; cota efetiva de 1 CPU, 2 GiB de memória e 2 GiB para memória mais swap, sem swap disponível no host                                   |
| Imagem               | Alpine 3.24.3, Node 24.22.2, Sharp 0.35.5/libvips 8.18.7; manifesto privado `sha256:c4d47bc495bc4b00c06420751c2bff4f87b8b6baa58c18e97fdff138d3b88d6a`, revisão `cd74963e3e81860c99735d88133fb37206a00553` |
| Build e registry     | Build no GitHub Actions, fora da Atlas; GHCR privado e promoção pela imagem já homologada                                                                                                                 |
| Staging              | Origem TLS temporária autenticada no Coolify, com `noindex` e Analytics desativado                                                                                                                        |
| Produção             | Adiada; o domínio próprio será escolhido pelo responsável. Nenhum recurso ou lançamento de produção é certificado por esta medição                                                                        |
| R2                   | Buckets privados `eliana-novaes-media` e `eliana-novaes-media-backups`, credenciais separadas e acesso cruzado negado nas provas existentes                                                               |
| E-mail               | Resend, subdomínio `mail.joeldorosarioo.dev`, remetente do projeto e recuperação editorial já configurados                                                                                                |
| GA4                  | Conta Eliana Novaes, propriedade A Design for Life, fluxo `G-DXFQKDH52Z`; controles confirmados pelo responsável e loader da aplicação ainda desativado                                                   |
| Acesso operacional   | Chave SSH do operador v2 carregada no agent do Windows; autenticação não interativa verificada, caminho configurado no `.env` existente                                                                   |

O valor pago foi informado e guardado somente no inventário local ignorado, com acesso exclusivo ao usuário. Não foi divulgado neste documento nem convertido em preço mensal: período da cobrança, renovação, nome comercial do plano e região não foram presumidos. Esses campos não bloquearam a validação técnica da capacidade já disponível. [Confirmação do inventário e R2](artifacts/E3-storage/r2-privacy-atlas-operator-confirmation-005.json) · [Preservação e configuração efetiva](artifacts/E3-operations/atlas-post-verification-preservation-001.json).

## Leitura pública e consumo da aplicação real

Uma janela de 12.059 ms coletou 121 amostras do cgroup da aplicação, a cada 100 ms. Foram feitos 19 GETs autenticados, com concorrência máxima de dois: 13 leituras de páginas e seis de imagens. Todas responderam 200, somando 1.072.371 bytes; latência mediana de 101 ms e máxima de 710 ms nessa observação.

A memória corrente do cgroup passou de 242.720.768 para 292.114.432 bytes. O maior valor amostrado foi 298.885.120 bytes, cerca de 285,04 MiB. O pico acumulado desde a criação desse contêiner era de 343.818.240 bytes, cerca de 327,89 MiB, antes e depois da janela. Esse pico inclui operações históricas e não é atribuído aos GETs nem a um backup específico. A diferença de CPU foi de 1.189.975 microssegundos; não houve novo evento de OOM ou processo morto por falta de memória. A memória disponível do host permaneceu acima de 6.791.536.640 bytes durante essa janela.

`memory.current` inclui cache cobrado ao cgroup. Não equivale ao valor resumido do Docker CLI, que desconta cache inativo, e não é tratado como memória incremental por requisição. [Leituras e métricas reais](artifacts/E3-operations/atlas-public-read-cgroup-001.json).

## Pico de processamento na mesma imagem da Atlas

Os arquivos de validação e processamento e suas dependências locais foram comparados byte a byte com a revisão implantada antes de compilar o pequeno harness. A prova usou os métodos reais `validateUpload` e `processImage`, inclusive decodificação/estatísticas e geração dos cinco derivados WebP. As duas entradas sintéticas preservadas foram transferidas com hashes conferidos, sem conteúdo editorial.

Cada arquivo foi processado em um contêiner novo da mesma imagem por digest, com `appuser` UID/GID 70, 1 CPU, limite de 1 GiB de memória e memória mais swap também de 1 GiB. A rede ficou desativada, todas as capabilities foram removidas, `no-new-privileges` foi aplicado e a raiz permaneceu somente para leitura. Não foram montados dados da aplicação nem fornecidas credenciais de banco ou R2.

| Controle sintético                 | Validação e processamento | Pico RSS do processo             | Pico cobrado ao cgroup                 | CPU do processamento |
| ---------------------------------- | ------------------------- | -------------------------------- | -------------------------------------- | -------------------- |
| JPEG de 9.876.792 bytes, 3600×2700 | 1.822,26 ms               | 220.808 KiB, cerca de 215,63 MiB | 163.917.824 bytes, cerca de 156,32 MiB | 1.750.438 µs         |
| PNG de 353.304 bytes, 4000×3000    | 653,79 ms                 | 156.220 KiB, cerca de 152,56 MiB | 98.656.256 bytes, cerca de 94,09 MiB   | 622.140 µs           |

Os dois controles passaram, com cinco derivados cujos tipos, dimensões, tamanhos e hashes foram conferidos. Não houve OOM ou morte por falta de memória. Durante as amostras das fixtures, o host manteve pelo menos 6.626.668.544 bytes disponíveis, cerca de 6,17 GiB. Os picos de RSS são cumulativos desde cada processo novo, incluindo imports e entrada; os picos do cgroup incluem a fixture e a breve espera de observação posterior ao resultado. As duas contabilidades são diferentes e não são somadas à memória da aplicação como uma medição conjunta.

O código atual limita o processamento a uma operação ativa e uma aguardando; `processImage` configura `sharp.concurrency(1)`. A prova foi serial e curta. Não representa transação Native/Payload, gravação no PostgreSQL, upload ao R2, carga sustentada ou garantia para toda imagem aceita de até 10 MB. [Prova completa de capacidade](artifacts/E3-operations/atlas-capacity-001.json).

## Backup, disco e disposição operacional

O backup completo anterior levou 14.692 ms e a recuperação autorizada levou 46.378 ms em seus ensaios próprios. Não se disparou outro dump, upload de mídia ou backup real para medir capacidade nesta rodada. O pico histórico do contêiner permanece uma observação global, sem atribuição exclusiva ao backup. [Retenção e backup reais](artifacts/E3-backup/staging-retention-operation-001.json) · [Recuperação](artifacts/E3-backup/staging-recovery-copy-001.json).

Após a limpeza, o filesystem tinha 94.885.679.104 bytes livres, cerca de 88,37 GiB. O PostgreSQL, os volumes de publicação/cache, as imagens e os logs existentes cabem nesse estado observado; não foi inventada uma taxa futura de crescimento. Builds continuam fora da VPS. Novas aplicações e uma futura produção exigirão reavaliar a coexistência antes de reservar recursos adicionais.

**Avaliação:** as observações atuais sustentam manter a cota do staging em 1 CPU/2 GiB, com os limites aplicados e margem disponível no host. É dimensionamento do ambiente e dos controles medidos, não promessa de throughput, disponibilidade da VPS única ou capacidade de produção futura.

Os dois contêineres descartáveis, seus dois volumes anônimos e a pasta remota UUID foram removidos. A aplicação manteve o mesmo contêiner, digest e estado Healthy; `/health` respondeu 200 com `ready`. O host tinha oito contêineres em execução antes e depois. Nenhum serviço de outro projeto foi alterado. [Conferência final](artifacts/E3-operations/atlas-post-verification-preservation-001.json).

As definições das métricas e dos limites foram conferidas em fontes primárias: [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html), [limites Docker](https://docs.docker.com/engine/containers/resource_constraints/) e [Node process.resourceUsage](https://nodejs.org/api/process.html#processresourceusage).
