# Objectif : Signaler le remplacement du transport par archives par des versions npm publiques.
<# .SYNOPSIS Ancien point d'entrée conservé pour fournir une instruction de migration explicite. #>
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments)][object[]]$LegacyArguments)
$utf8=[Text.UTF8Encoding]::new($false)
[Console]::InputEncoding=$utf8
[Console]::OutputEncoding=$utf8
$OutputEncoding=$utf8
throw 'Les archives locales entre workspaces ont été retirées. Utilisez les versions npm des dépendances, puis pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts. Voir RELEASE.md.'