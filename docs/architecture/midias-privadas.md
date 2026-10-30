# Mídias privadas e referências editoriais

Escopo: E1.6 da etapa1. A coordenação da atualização pública pertence à E1.8; R2, imagem de execução, limpeza operacional e backup real permanecem na etapa3. Esta implementação usa bytes físicos privados locais, sem serviço externo de imagens.

## Entrada e processamento

O upload usa a collection, formulário e transporte nativos do Payload. `beforeOperation` exige editor autenticado e transação também com Local API privilegiada, antes de decoder, parser ou armazenamento. Criação exige arquivo real; duplicação, URL remota, crop/reprocessamento e campos técnicos enviados pelo cliente não contornam o pipeline. Arquivos são imutáveis por MediaID: trocar bytes exige novo recurso. O campo de identificação interna continua editável.

`preflightUpload` é triagem síncrona e retorna candidato. A validação completa é `Promise<UploadResult<ValidatedUpload>>`: decode integral e parser de PDF são assíncronos. O ajuste materializa a garantia planejada; assinatura/MIME/nome não são tratados como validação suficiente. Os limites são decimais: imagens até10.000.000 bytes e PDF até5.000.000 bytes. Multipart também tem limite nativo de arquivo10.000.000 bytes. Os bytes efetivos prevalecem sobre `file.size` declarado.

A [política autorizada](../decisions/2026-10-30-media-policy.md) aceita quatro formatos estáticos e WebP animado; rejeita SVG, APNG, AVIF animado e PDF com senha de abertura. PDFs sem senha de abertura, inclusive com restrições criptográficas de edição/impressão, passam pela validação normal.

Sharp decodifica todos os frames aceitos. O processamento preserva proporção/orientação e produz larguras únicas úteis342/640/960/1280/2560, limitadas à origem. WebP conserva quadros distintos, delays e repetição; a transformação por frame trata orientações EXIF quando necessárias. As dimensões persistidas são por frame. O Sharp automático do Payload fica ausente para evitar recodificação fora da capacidade da feature; a aplicação continua processando com Sharp.

Um gate compartilhado por processo permite um trabalho ativo e um em espera; excesso recebe503 recuperável. O `finally` abrange validação, derivados e escrita dos objetos, inclusive falhas. Não há fila externa nem fila infinita de buffers. Isso não limita RSS de uma imagem nem coordena processos distintos. Defaults de segurança do decoder foram conservados: `failOn:warning`, limite268.402.689 pixels e5 canais, `unlimited:false`; não são uma nova promessa de capacidade ou autorização para remover essas proteções. Nenhum limite próprio adicional de pixels, dimensões, frames ou páginas foi introduzido.

PDF.js6.4.299 examina todas as páginas/listas de operadores em worker Node dedicado, sem viewer ou avaliação de ações. QPDF12.4.2 verifica também estrutura/streams em subprocesso, pois PDF.js recuperava um Flate corrompido. Cancelamento encerra os consumidores; temporários privados são liberados. Sintaxe limpa, warning, inválido, senha necessária e indisponibilidade são resultados distintos. Warning inconclusivo não vira integridade limpa nem proibição permanente de todo PDF recuperável. Não se certifica conformidade ISO integral ou ausência de malware.

O worker resolve o pacote PDF.js e seus recursos dentro do Node nativo, evitando IDs numéricos do Turbopack usados como caminhos. Next declara os recursos de tracing de PDF.js/canvas. O consumidor comprovado é `next build` + `next start`; uma imagem standalone/container não foi homologada aqui. QPDF é instalado explicitamente por checksum, sem download no build/runtime.

## Objetos e configuração

O adaptador em `helpers/storage` grava objetos exclusivos sob chaves opacas, captura os bytes e verifica tamanho/SHA256 ao ler. Ele não decide publicação. A feature persiste manifesto completo e referências técnicas; essas capacidades/campos são protegidos por WeakMap e hooks de servidor, e não aparecem no DTO editorial.

A composição rejeita o root efetivamente resolvido dentro de `public` ou `.next/static`, inclusive overrides e escapes do caminho padrão por bucket. Roots privados externos continuam permitidos. Em testes, override de armazenamento precisa corresponder ao namespace isolado de bucket/banco em `.work/private-media`. As provas nunca apontam ao PostgreSQL de outro projeto nem a produção.

Objetos podem existir privadamente antes do commit de banco; filesystem/R2 e PostgreSQL não são uma transação distribuída. Falha de terceiro derivado não persiste uma Media parcial nem concede acesso. Órfãos privados são preservados para reconciliação operacional; não há limpeza física oportunista que descarte recuperação.

## Entrega e falhas

- `/media/[id]/[variant]`: consulta referências vigentes antes de cada leitura de bytes, inclusive GET/HEAD e condicionais; somente uso confirmado permite entrega pública.
- `/preview-media/[id]/[variant]`: editor autenticado, origem apropriada e `private, no-store`. Falhas iniciais de provider/autenticação/preparação também têm resposta segura.
- `/api/media/file/:filename`: handler nativo sempre devolve Response, inclusive negativa; não alcança fallback de filesystem. GET autenticado usa o mesmo resolvedor. HEAD nativo permanece não suportado:404, sem bytes e sem cache. Não foi ampliado o transporte nativo para mudar essa característica.

As rotas próprias suportam HEAD autorizado200 sem corpo. Condicionais/ranges não pulam a autorização e não produzem304/206 com bytes privados: esta versão responde corpo inteiro200 quando permitido, ou erro seguro. Não há cache compartilhado de bytes. Revogar a última publicação também revoga derivados; outra publicação do mesmo arquivo continua autorizada. Reutilizar um arquivo público em rascunho não o torna secreto.

O otimizador Next fica desativado para essas URLs; a aplicação entrega os derivados processados. As provas reais tentam a URL alternativa do otimizador e os caminhos nativos/privados/públicos sem sessão. Ausência e rascunho não revelam manifesto/chave privada. Falha de storage ou consulta não vira404: devolve503 vazio/seguro e `no-store`; a recuperação volta a entregar bytes idênticos. A prova reverte um objeto próprio e a relação Media somente no banco isolado, com restauração em `finally`.

## Referências, exclusão e recuperação

Cada feature extrai somente seus campos aprovados. A identificação inclui MediaID e tipo esperado; usar o mesmo ID como imagem e currículo valida ambas as exigências. Não há varredura arbitrária de JSON nem collection `media-usages`.

Media registra dono/idioma/revisão e estados draft/pending/confirmed/retained. Alterar rascunho ou outra tradução preserva publicação anterior. Trocar/retirar publicação afeta somente o dono correspondente. Remover uma referência antiga já na lixeira é permitido e a torna retida; adicionar novo uso continua exigindo mídia disponível.

As operações reclamam a mesma linha Media por CAS na transação Payload, com IDs em ordem estável. Publicação e lixeira disputam essa linha; ambas as ordens e rollback têm testes com PostgreSQL real e barreiras determinísticas. Usos confirmados/pendentes impedem exclusão mesmo por chamada local privilegiada. A lixeira preserva bytes e referências recuperáveis; remoção permanente fica bloqueada até o procedimento operacional da etapa3. Isso não substitui os backups de oito semanas ainda por integrar.

Nesta tarefa, a referência confirmada acompanha o snapshot publicado nativo na transação editorial. E1.8 acrescenta o protocolo persistido que distingue intenção salva, atualização pública pendente e revisão efetivamente confirmada, incluindo cache e retry. A prova E1.6 não declara esse protocolo futuro concluído.

## Evidências e limites

[E1.6](../verification/E1.6.md) registra RED/GREEN, consumers, comandos e falhas preservadas. Os testes usam Payload3.92.1/PostgreSQL17.11 reais, Node24.22.2, Next16.4.3 e armazenamento físico isolado. A medição próxima de10MB inclui Native Local create, transação e bytes reais; não é RSS de Next/servidor PostgreSQL nem dimensionamento de VPS. Originais e todas as variantes têm integridade conferida. R2 real, falha de rede desse provedor, backup/restauração e imagem final continuam sem alegação de aprovação na etapa1.
