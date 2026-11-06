# Painel editorial em português e perfil da conta

Atualização preparada em 06/11/2026 no commit de código `d267aa711f50e3269ffb5c03add08761beb06bdb`. A conta editorial existente foi preservada; banco de staging já está no schema17. A imagem nova está publicada no GHCR privado e ainda precisa ser aplicada pelo operador no Coolify.

## Aplicar a imagem no Coolify

1. Abrir `a-design-for-life → staging → app → General → Build & deploy → Image`.
2. Manter **Image** como `ghcr.io/joeldorosarioo/a-design-for-life` e substituir **Tag** por `sha256-ad66b5c595aa5f36766e14552e83214101688c5d421a01fa16bcba37f36815f4`.
3. Salvar e fazer **Redeploy**, usando **Consistent name (no rolling updates)** e os mesmos volumes, cotas e configuração de execução. Aguardar **Running / Healthy**.
4. Abrir `/admin` com a conta já criada. Em **Payload Settings → Language**, selecionar **Português** se o painel ainda estiver em inglês. A preferência do navegador/conta pode continuar selecionando Inglês; o fallback configurado é Português.
5. Em **Minha conta**, preencher **Nome de exibição** e **Foto de perfil da conta**, salvar e recarregar. A foto aceita JPEG/PNG/WebP/AVIF até10MB; sem foto ou em falha, o painel mostra iniciais/ícone local.

O schema17 já foi aplicado de forma aditiva, após backup PostgreSQL criptografado e restauração isolada. E-mail, hash/salt de senha, IDs, sessões, perfis e navegação foram conferidos antes/depois. Não recriar a conta nem repetir o inicializador schema-only. As variáveis importadas e o .env original permaneceram intactos; o site segue privado e `PUBLIC_SITE_ENABLED=false`.

## Preencher os formulários

Os nomes técnicos de campos/API continuam em inglês. Os rótulos e a ajuda dos formulários são em português, incluindo ao editar um documento cujo conteúdo público é inglês. O campo de idioma do documento escolhe o idioma dos textos do site; a preferência em Payload Settings escolhe o idioma da interface.

- **Navegação:** menu do topo, rodapé, botões e mensagens. A ajuda distingue o texto visível do botão do endereço, e-mail ou arquivo de destino. Contatos e currículo vêm do Perfil profissional.
- **Perfil profissional:** textos e imagens da página inicial e da página Sobre, contatos e currículo. A ajuda indica onde cada texto aparece; imagens explicam descrição acessível, uso decorativo e legenda.
- **Projetos / Conteúdo dos projetos:** identificação compartilhada separada da tradução, endereço na URL, apresentação, seções, imagens e informações para busca/compartilhamento.
- **Mídias:** identificação interna para encontrar arquivos, formatos e limites. A foto da conta usa a mesma biblioteca, com entrega autenticada pela aplicação.

Nome e foto nesta atualização pertencem ao usuário do CMS. O avatar usa uma rota privada da mesma origem e não usa Gravatar, URL arbitrária ou otimizador público. As informações do Perfil profissional continuam sendo o conteúdo público do portfólio.

## Evidências

[Interface e testes](../verification/artifacts/E3-operations/cms-editorial-account-001.json), [imagem e registry privado](../verification/artifacts/E3-operations/cms-editorial-image-001.json) e [backup/restauração e migração reais de staging](../verification/artifacts/E3-operations/cms-editorial-staging-upgrade-001.json). Etapa3:15/30critérios,50%,0/6tarefas integralmente encerradas. A3/A4 e produção permanecem pendentes.
