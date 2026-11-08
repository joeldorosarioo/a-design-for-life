# Editing the portfolio

Sign in at `/admin`. The dashboard supports Portuguese and English and defaults to Portuguese when no supported preference is available. Change the interface language under **Payload Settings → Language**. Use the document's language field to choose which public edition you are editing.

## Where to edit

- **Navegação** controls header and footer copy, links and action labels. Contact details and the résumé come from the published **Perfil profissional** for that language.
- **Perfil profissional** controls Home and About copy, images, email, LinkedIn and the résumé PDF. Set alt text, decorative status and captions on each image use in its language.
- **Projetos** holds shared project details. **Conteúdo dos projetos** holds each translation's slug, copy, images and search and sharing metadata.
- **Mídias** holds files and their internal names. A file becomes available to visitors through a confirmed public reference.

Save a draft and use the signed-in preview to review it. After publishing, check the confirmation and verify the public page in the edited language. While an update is pending, the previous confirmed version remains available when one exists. Restoring an earlier version creates a draft for review.

## Your CMS account

Under **Minha conta**, set **Nome de exibição** and **Foto de perfil da conta**. The photo accepts JPEG, PNG, WebP or AVIF up to 10 MB. The dashboard loads it through a private authenticated route and falls back to initials or an icon when the image is unavailable. Edit **Perfil profissional** separately to change the public name or portrait.

The account fields were added to staging through a one-time migration that preserved the existing account and sessions. See the [migration record](../verification/artifacts/E3-operations/cms-editorial-staging-upgrade-001.json).

## Release status

A4 approved the staging candidate. Launch is deferred. Replace the temporary blank PT and EN résumé PDFs and verify the localized contacts before release. See [A4](../verification/A4.md) and the [release runbook](lancamento.md).
