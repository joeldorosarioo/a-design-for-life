# Confirmação pública dos bytes de mídia

O plano de observação pública agora inclui os alvos de mídia da raiz selecionada e a proveniência de referências removidas. O recibo usa o mesmo prazo da observação de páginas e DTOs. Uma raiz de case ou perfil promovida e pendente sem proveniência não é confirmada. Uma operação sucessora também fica pendente se o predecessor selecionado não tiver ACK nem a proveniência necessária para recuperar suas remoções. Raízes históricas já reconhecidas continuam legíveis.

## Provas executadas

| Recibo | Resultado |
| --- | --- |
| `media-ack-wiring-red.log` | Saída 1, três falhas esperadas. O loopback conseguia responder 200 pela mídia retirada sem impedir o aceite do plano. As duas condições de ausência de proveniência também eram aceitas. |
| `media-ack-wiring-green.log` | Saída 0, 107 testes em sete arquivos. O plano rejeita a resposta divergente e preserva GET, HEAD e Range para a mesma rota. |
| `media-ack-wiring-static.log` | TypeScript noEmit, lint e formatação dos seis arquivos, e `git diff --check`, todos saída 0. |
| `media-ack-native-001-result.json` | Saída 0, um teste Native selecionado, 16 outros filtrados. O predecessor público foi reconhecido e o token de fixture descartado. O predecessor promovido, depois marcado `superseded`, preservou o primeiro conjunto de remoções no sucessor. A leitura do arquivo retornou seis alvos e a nova tentativa observou a mesma raiz. |
| `media-ack-next-001-result.json` | Next 16.4.3 compilado em 19,3 s. Playwright 1/1, saída 0, 13,141 s no teste e 63,7 s entre início e fim do comando. A checagem imediata do wrapper saiu 2 por entradas transitórias do Windows com PID 0. |
| `media-ack-001-stable-cleanup.json` | Saída 0 na conferência independente. As três portas permitiram vínculo exclusivo e os handles de prova fecharam. O inventário seguinte perdeu as entradas PID 0 e ficou vazio. Sem contêineres, redes, locks ou listeners descartáveis. As portas protegidas permaneceram sem alteração observada. |

Os testes Native e Next preservaram os mesmos 632 arquivos de entrada, digest `8301103718128617d004a2c3ab1f1483456d5e8d880689869be640c30dadcd84`, em HEAD `e430e6e42ebea4f57cfd475840572f59d1f05880`. Os hashes dos arquivos da fatia e de `next-env.d.ts` e `tsconfig.json` estão em `media-ack-wiring-final-source.json`. O gerador e os inventários completos de antes e depois ficam no workspace C do ensaio.

## Resultado observado no Next

- A leitura do otimizador aquecido retornou `HIT`. Após a retirada EN, a concessão PT sustentou 200 com os mesmos hashes em original, `w16` e otimizador.
- Na retirada PT, a 14ª leitura do relay foi o GET canônico do otimizador. O primário real respondeu 404 vazio sob a geração `2532ba22-635c-4373-b09a-5783008cbfb0`. O relay trocou só essa resposta por 200, com os bytes previamente aquecidos e o mesmo marcador. Os históricos e as seis negações de original e derivado passaram antes do alvo adulterado.
- O recibo e a operação SQL ficaram pendentes. O reinício em origem própria conservou a raiz inteira e o BUILD_ID `kpPtP5lkXDf-whvLhKDUC` observado nos cinco filhos. A repetição da operação confirmou com a raiz idêntica. As nove leituras finais de original, derivado e otimizador retornaram 404 vazio em GET, HEAD e Range.
- O relay encaminhou as demais respostas diretamente ao primário 3101, que mantinha origem interna própria. O listener recusava o header de autenticação interna do otimizador, sem entrar no caminho de autochamada do filho 3102.

O ensaio usou os recursos descartáveis exatos registrados nos logs. Ele comprova a observação de mídia com armazenamento local no runner e retry manual após reinício. O teste não executa R2 de homologação, nem força uma queda do processo no intervalo entre o commit do arquivo e o ACK SQL.
