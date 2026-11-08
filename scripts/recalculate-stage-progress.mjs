import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

let stage = 2;
let check = false;
let stageSpecified = false;
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--check' && !check) check = true;
  else if (args[index] === '--stage' && !stageSpecified && /^[23]$/.test(args[index + 1] ?? '')) {
    stage = Number(args[++index]);
    stageSpecified = true;
  } else
    throw new Error(
      'Invalid arguments. Usage: node scripts/recalculate-stage-progress.mjs [--stage 2|3] [--check]',
    );
}

// CLI paths always belong to the repository containing this script. No input can redirect them.
const root = new URL('../', import.meta.url);
const jsonFile = new URL(`docs/verification/progresso-etapa-${stage}.json`, root);
const mdFile = new URL(`docs/verification/progresso-etapa-${stage}.md`, root);
const ledgerFile = new URL(`docs/verification/execucao-etapa-${stage}.md`, root);
const [plan, input, existingMarkdown, existingLedger] = await Promise.all([
  readFile(new URL('docs/specs/2026-10-29-portfolio-plano-implementacao.md', root), 'utf8'),
  readFile(jsonFile, 'utf8'),
  readFile(mdFile, 'utf8'),
  readFile(ledgerFile, 'utf8'),
]);
const headings = [...plan.matchAll(/^### (E\d+\.\d+) [^\r\n]+/gm)];
const tasks = headings
  .filter((heading) => heading[1].startsWith(`E${stage}.`))
  .map((heading) => {
    const end = headings.find((next) => next.index > heading.index)?.index ?? plan.length;
    const count = [...plan.slice(heading.index, end).matchAll(/^- \[ \] /gm)].length;
    return {
      id: heading[1],
      items: Array.from({ length: count }, (_, index) => `${heading[1]}.${index + 1}`),
    };
  });
if (
  tasks.length !== 6 ||
  tasks.some((task, index) => task.id !== `E${stage}.${index + 1}` || task.items.length !== 5)
)
  throw new Error(
    `Stage ${stage} must account for the original six tasks and thirty checklist items.`,
  );

const data = JSON.parse(input);
const ids = tasks.flatMap((task) => task.items);
if (
  data.stage !== stage ||
  typeof data.approval !== 'string' ||
  !data.approval.trim() ||
  !Array.isArray(data.criteria) ||
  data.criteria.length !== ids.length ||
  new Set(data.criteria.map((criterion) => criterion?.id)).size !== ids.length ||
  ids.some((id) => !data.criteria.some((criterion) => criterion?.id === id)) ||
  data.criteria.some(
    (criterion) =>
      typeof criterion?.done !== 'boolean' ||
      typeof criterion.summary !== 'string' ||
      !criterion.summary.trim() ||
      typeof criterion.evidence !== 'string' ||
      (criterion.done && !criterion.evidence.trim()),
  )
)
  throw new Error(
    'Every original checklist item, completed evidence and independent approval must be accounted for.',
  );

const done = (id) => data.criteria.find((criterion) => criterion.id === id).done;
const completedItems = data.criteria.filter((criterion) => criterion.done).length;
const closedTasks = tasks.filter((task) => task.items.every(done)).map((task) => task.id);
const counts = {
  completedItems,
  totalItems: ids.length,
  percentage: Math.round((completedItems / ids.length) * 1000) / 10,
  closedTasks,
  totalTasks: tasks.length,
};
const ledgerMarker = new RegExp(`^\\*\\*Etapa ${stage}:.*\\*\\*$`, 'gm');
if ([...existingLedger.matchAll(ledgerMarker)].length !== 1)
  throw new Error(`Stage ${stage} ledger must contain exactly one current progress marker.`);

if (check) {
  if (
    Object.entries(counts).some(
      ([key, value]) => JSON.stringify(data[key]) !== JSON.stringify(value),
    )
  )
    throw new Error('Stored progress is stale; recalculate before reporting.');
} else {
  Object.assign(data, counts, { recalculatedAt: new Date().toISOString() });
  const percent = counts.percentage.toFixed(1).replace('.', ',');
  const approval = data.approval.trim();
  // Preserve the existing authorization notice above the generated heading.
  const notice = existingMarkdown.match(/^([\s\S]*?)(?=^# )/m)?.[1] ?? '';
  let md = `${notice}# Progresso verificável — etapa ${stage}\n\n**${percent}%: ${completedItems}/${ids.length} itens; ${closedTasks.length}/${tasks.length} tarefas inteiramente encerradas. Aprovação registrada: ${approval}.**\n\n`;
  const command = `node scripts/recalculate-stage-progress.mjs${stage === 2 ? '' : ' --stage 3'}`;
  md += `Antes de cada atualização, revisar novas evidências e itens afetados, atualizar os estados e executar \`${command}\`. O comando recalcula as contagens e deriva as tarefas fechadas; não decide sozinho se um critério foi atendido. \`--check\` confere sem escrever.\n\n`;
  md +=
    'A métrica conta as trinta caixas do plano original, cinco por tarefa, com peso igual e sem crédito parcial. Mede entregas, não esforço, horas ou percentual de testes. Evidência invalidada por mudança torna o item pendente novamente. Os originais e logs históricos permanecem imutáveis. Aprovação do usuário é independente da contagem.\n\n';
  if (stage === 2)
    md +=
      'A caixa de preparação do primeiro RED pode estar concluída com a implementação ainda aberta nas seguintes (E2.5.1).\n\n';
  md += '| Tarefa | Itens | Estado |\n| --- | --- | --- |\n';
  for (const task of tasks) {
    const completed = task.items.filter(done).length;
    md += `| ${task.id} | ${completed}/${task.items.length} | ${closedTasks.includes(task.id) ? 'Encerrada' : completed === 0 ? 'Pendente' : 'Em andamento'} |\n`;
  }
  md += '\n## Checklist e evidências\n\n';
  for (const criterion of data.criteria)
    md += `- [${criterion.done ? 'x' : ' '}] **${criterion.id}** ${criterion.summary.replace(/\.$/, '')}. Evidência/pendência: ${criterion.evidence}\n`;
  md += `\n## Gates e limites\n\n${(data.notes ?? []).join('\n\n')}\n\nEstimativa: ${data.remainingEstimate}\n\nAprovação registrada: ${approval}.\n`;
  const ledger = existingLedger.replace(
    ledgerMarker,
    () =>
      `**Etapa ${stage}: ${percent}% do checklist (${completedItems}/${ids.length} itens); ${closedTasks.length}/${tasks.length} tarefas inteiramente encerradas. Aprovação registrada: ${approval}.**`,
  );
  // Read, validate and format every output before the first write.
  const outputs = await Promise.all(
    [
      [jsonFile, JSON.stringify(data)],
      [mdFile, md],
      [ledgerFile, ledger],
    ].map(async ([file, text]) => {
      const filepath = fileURLToPath(file);
      return [file, await format(text, { ...(await resolveConfig(filepath)), filepath })];
    }),
  );
  for (const [file, text] of outputs) await writeFile(file, text);
}
console.log(JSON.stringify({ ...counts, recalculatedAt: data.recalculatedAt ?? data.updatedAt }));
