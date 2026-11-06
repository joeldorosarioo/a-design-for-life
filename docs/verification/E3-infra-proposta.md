# Referências de infraestrutura para a Etapa 3

Consulta em 04/11/2026. A arquitetura aprovada usa VPS, Coolify autogerenciado, PostgreSQL e Cloudflare R2. A conta R2 já existe segundo o responsável. Provedor, plano, região da VPS, domínio público e registry continuam em aberto. O subdomínio de envio escolhido é `mail.joeldorosarioo.dev`, com Resend para recuperação nativa de senha. A propriedade GA4 e os acessos operacionais ainda precisam ser identificados. [Registro de decisões](retomada-etapa-3.md)

## VPS e dimensionamento

| Cenário de orçamento                                           | vCPU e RAM     | SSD     | Transferência incluída | Preço-base mensal |
| -------------------------------------------------------------- | -------------- | ------- | ---------------------- | ----------------- |
| DigitalOcean Basic Regular para homologação inicial            | 4 vCPU, 8 GiB  | 160 GiB | 5.000 GiB              | US$ 48            |
| DigitalOcean Basic Regular se os dois ambientes rodarem juntos | 8 vCPU, 16 GiB | 320 GiB | 6.000 GiB              | US$ 96            |

São referências de preço para comparar fornecedores e regiões, antes de impostos, câmbio e opcionais. O catálogo de regiões consultado lista, entre outros, Nova York, Frankfurt e Atlanta. A latência a partir do Brasil ainda precisa ser medida na região candidata. [Preços DigitalOcean](https://www.digitalocean.com/pricing/droplets) · [Regiões DigitalOcean](https://docs.digitalocean.com/platform/regional-availability/)

O cenário inicial de 8 GiB reserva, como hipótese de teste, 2,5 GiB para Next/Payload, 2 GiB para PostgreSQL, 2 GiB para sistema/Coolify/proxy e 1,5 GiB para folga e jobs transitórios. Os builds ficam fora da VPS. Jobs de migração, backup e restauração devem ser medidos separadamente, inclusive pelo espaço de trabalho temporário exigido para dump e restauração. Com homologação e produção ativas na mesma VPS, cada stack precisa de banco, volumes e credenciais próprios. O cenário de 16 GiB é uma hipótese para validar essa coexistência.

A medição Native de E1.6 observou pico de 466.904 KiB, cerca de 456 MiB, no caso de JPEG de 9,88 MB processado em 1.512 ms. O valor é do processo Payload CLI no Windows de desenvolvimento, incluindo fixture e entrada. Falta medir no runtime Linux a concorrência de upload, otimizador, leitura e backup, bem como picos de CPU, RAM, disco, latência e tempo de inicialização. O espaço de disco deve cobrir dados e crescimento do PostgreSQL, volumes da raiz pública e do otimizador, logs rotacionados, imagens de rollback e temporários dos jobs. [Medição Native e condições](E1.6.md#recursos-próximos-ao-limite)

## Serviços e valores

| Serviço                     | Preço publicado e premissa                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coolify autogerenciado      | Software gratuito. A VPS continua por conta do responsável. [Preços Coolify](https://coolify.io/pricing)                                                                                                                                                                                         |
| Cloudflare R2 Standard      | Por mês, 10 GB-mês, 1 milhão de operações A e 10 milhões B incluídos. Valores acima da franquia de US$ 0,015 por GB-mês, US$ 4,50 por milhão A e US$ 0,36 por milhão B. O egress direto do R2 é gratuito. [Preços R2](https://developers.cloudflare.com/r2/pricing/)                             |
| Resend transacional         | Gratuito até 3.000 envios por mês e 100 por dia. Pro a US$ 20/mês por 50.000 envios. A franquia da conta é compartilhada entre projetos. [Preços Resend](https://resend.com/pricing?product=transactional)                                                                                       |
| GHCR como opção de registry | O GitHub informa que armazenamento e transferência de imagens de contêiner estão gratuitos atualmente. A publicação requer namespace e visibilidade aprovados. [Preços GitHub Packages](https://docs.github.com/en/billing/concepts/product-billing/github-packages#free-use-of-github-packages) |
| Domínio público             | A cotação depende do domínio e do TLD escolhidos. O subdomínio de envio depende do DNS de `joeldorosarioo.dev`.                                                                                                                                                                                  |

Com 10 GB de mídia e 30 GB **no total** de backups retidos, a parcela de armazenamento do R2 seria de US$ 0,45 por mês se a franquia estiver disponível, ou US$ 0,60 sem ela. Com operações dentro das franquias, Resend Free, GHCR e Coolify autogerenciado, o primeiro cenário de VPS soma US$ 48,45 por mês nessa hipótese. O uso da conta R2, os impostos, o domínio, a disponibilidade regional e eventuais excedentes ainda precisam ser confirmados. [Tarifa e franquia do R2](https://developers.cloudflare.com/r2/pricing/) · [Preço da VPS](https://www.digitalocean.com/pricing/droplets)

## Dados para a validação externa

- VPS e Coolify. Escolher e aprovar provedor, região, capacidade, custo, origem TLS de homologação e acesso autenticado. A origem pública será definida para a futura produção. O banco de homologação tem credencial própria. [Runbook de homologação](../runbooks/homologacao.md)
- R2. Confirmar franquia/billing da conta, região ou jurisdição dos buckets e nomes dos buckets privados de mídia de homologação, mídia de produção e backup. Usar credencial limitada por bucket e manter o backup separado das credenciais da aplicação. A prova real deve confirmar acesso direto anônimo negado, além de entrega, publicação, retirada e restauração pelos fluxos autorizados. [Runbook de armazenamento](../runbooks/armazenamento.md)
- Resend. Verificar o DNS do subdomínio, confirmar remetente e nome de exibição, configurar a chave de envio do projeto no armazenamento privado de segredos e identificar a conta editorial para a prova. O envio de teste depende de autorização específica. [Runbook de recuperação](../runbooks/recuperacao-de-acesso.md)
- Registry. Confirmar provedor, namespace, visibilidade, autorização de escrita para a candidata e permissão de leitura no Coolify. A identidade a promover é o digest de manifesto consumido na homologação. [Runbook de promoção](../runbooks/build-e-promocao.md)
- Analytics. Confirmar a propriedade e o stream do GA4, além da viabilidade dos relatórios sob a política de medição aprovada. [Registro de Analytics](analytics.md)

O dimensionamento e os valores servem à escolha da infraestrutura. Os acessos reais e as evidências de provedor continuam pendentes na E3.1 e na E3.4.
