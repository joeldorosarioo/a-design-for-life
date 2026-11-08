# E2 — preparação de transporte seguro

Etapa2 em16,7%, E2.2/E2.3 abertas. `pinPublicRoot` registra a raiz já capturada e `readPinnedPublicRoot` lê somente o pin e seu digest; nenhuma geração antiga substitui current ilegível. Criação concorrente atômica usa FS real e processos independentes. Retenção sem GC é débito operacional DEBT-RENDER-SNAPSHOT-RETENTION para etapa3.

`handleNextImage` permite somente mídia raster original confirmada, formatos/width/quality fechados e autochamada HMAC para origem HTTP loopback configurada. Toda request externa/interna reautoriza antes de qualquer cache; o wrapper externo preserva private,no-store mesmo quando o otimizador Next sobrescreve headers/cacheia bytes. Ausência de manifesto usa o mesmo classificador A1 de metadados Native que resolveMediaAccess: desconhecido/privado saudável404, perda de cobertura pública503, retirada coberta404 mesmo com ACK SQL antigo; SQL nunca concede bytes. Revisão P2 identificou e corrigiu a classificação inicial404 indevida; RED/GREEN real está no manifesto.

O probe isolado Next16.4.3 prova MISS/HIT WebP e revogação com imagem sintética; não é a integração final do aplicativo, ainda com otimização global desativada. Proxy público, App Pages, metadados, guarda composta e prova HTTP real permanecem em implementação. Não há promessa de503 real para corrupção de pin depois da decisão do Proxy; leitor falha fechado e não relê current. Preview mantém autorização própria e não passa por otimizador anônimo.

## Gate do preparo de interface e transporte

Em30/10/2026 o estado combinado identificado em [source-snapshot.json](artifacts/E2-ui-transport-preparation/source-snapshot.json) passou `pnpm verify` (exit0): **729 testes aprovados,2 skips de plataforma Windows,95 arquivos**, tipagem, formato e buildNext16.4.3; lint sem erros e4warnings herdados. PostgreSQL17.11 real isolado/tmpfs55433 removido pelo runner; serviços de outro projeto preservados. Os2skips são regras de sistema POSIX/Linux, não falhas ocultas.

O log de `pnpm test:e2e` registra **33 jornadas aprovadas** e limpeza do banco próprio. O retorno final do PTY foi truncado/encerrado antes de preservar seu exit; esse campo permanece desconhecido no manifesto, sem inventar exit0. O CI do candidato imutável deverá registrar o resultado de processo. O build ainda não contém Home/Sobre/listagem públicas integradas e não comprova a aceitação visual dessas páginas.

Foram preservadas as duas tentativas anteriores: a primeira encerrou em4erros de tipagem de testes; a segunda teve728aprovados/1falha/2skips porque o teste tentou ler uma collection técnica pela LocalAPI que corretamente nega esse acesso. Corrigiu-se a tipagem do adapter Native existente, mantendo permissões; regressão focada real2/2 e repetição integral passaram. Instalação/tipagem/permissão inesperada não são RED comportamental de uma funcionalidade. [Logs completos, hashes e limites](artifacts/E2-ui-transport-preparation/evidence-manifest.json).

Os screenshots legados A1 regravados automaticamente pelas jornadas foram preservados como novas evidências separadas e os12originais A1 foram restaurados byte a byte do commit-base. O pacote A1 aprovado permanece imutável. Esse gate não conclui E2.2/E2.4, nem substitui o próximo gate após a integração das rotas.
