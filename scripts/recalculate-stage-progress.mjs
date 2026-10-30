import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const root = new URL('../', import.meta.url);
const jsonFile = new URL('docs/verification/progresso-etapa-2.json', root);
const mdFile = new URL('docs/verification/progresso-etapa-2.md', root);
const ledgerFile = new URL('docs/verification/execucao-etapa-2.md', root);
const plan = await readFile(
  new URL('docs/specs/2026-10-29-portfolio-plano-implementacao.md', root),
  'utf8',
);
const headings = [...plan.matchAll(/^### (E\d\.\d+) [^\r\n]+/gm)];
const tasks = headings
  .filter((m) => m[1].startsWith('E2.'))
  .map((m) => {
    const end = headings.find((next) => next.index > m.index)?.index ?? plan.length;
    const count = [...plan.slice(m.index, end).matchAll(/^- \[ \] /gm)].length;
    return { id: m[1], items: Array.from({ length: count }, (_, i) => `${m[1]}.${i + 1}`) };
  });
const data = JSON.parse(await readFile(jsonFile, 'utf8'));
const ids = tasks.flatMap((task) => task.items);
if (
  data.stage !== 2 ||
  ids.length !== 30 ||
  new Set(data.criteria.map((c) => c.id)).size !== ids.length ||
  data.criteria.length !== ids.length ||
  ids.some((id) => !data.criteria.some((c) => c.id === id)) ||
  data.criteria.some((c) => typeof c.done !== 'boolean' || (c.done && !c.evidence?.trim()))
)
  throw new Error(
    'Every original checklist item and its completed evidence must be accounted for.',
  );
const done = (id) => data.criteria.find((c) => c.id === id).done;
const completedItems = data.criteria.filter((c) => c.done).length;
const closedTasks = tasks.filter((t) => t.items.every(done)).map((t) => t.id);
const counts = {
  completedItems,
  totalItems: ids.length,
  percentage: Math.round((completedItems / ids.length) * 1000) / 10,
  closedTasks,
  totalTasks: tasks.length,
};
if (process.argv.includes('--check')) {
  if (
    Object.entries(counts).some(
      ([key, value]) => JSON.stringify(data[key]) !== JSON.stringify(value),
    )
  )
    throw new Error('Stored progress is stale; recalculate before reporting.');
} else {
  Object.assign(data, counts, { recalculatedAt: new Date().toISOString() });
  const percent = counts.percentage.toFixed(1).replace('.', ',');
  let md = `# Progresso verificável — etapa 2\n\n**${percent}%: ${completedItems}/${ids.length} itens; ${closedTasks.length}/${tasks.length} tarefas inteiramente encerradas. A2 pendente.**\n\n`;
  md +=
    'Antes de cada atualização, revisar novas evidências e itens afetados, atualizar os estados e executar `node scripts/recalculate-stage-progress.mjs`. O comando recalcula as contagens e deriva as tarefas fechadas; não decide sozinho se um critério foi atendido. `--check` confere sem escrever.\n\n';
  md +=
    'A métrica conta as trinta caixas do plano original, cinco por tarefa, com peso igual e sem crédito parcial. Mede entregas, não esforço, horas ou percentual de testes. A caixa de preparação do primeiro RED pode estar concluída com a implementação ainda aberta nas seguintes (E2.5.1). Evidência invalidada por mudança torna o item pendente novamente. Os originais e logs históricos permanecem imutáveis.\n\n| Tarefa | Itens | Estado |\n| --- | --- | --- |\n';
  for (const t of tasks)
    md += `| ${t.id} | ${t.items.filter(done).length}/${t.items.length} | ${closedTasks.includes(t.id) ? 'Encerrada' : 'Em andamento'} |\n`;
  md += '\n## Checklist e evidências\n\n';
  for (const c of data.criteria)
    md += `- [${c.done ? 'x' : ' '}] **${c.id}** ${c.summary}. Evidência/pendência: ${c.evidence}\n`;
  md +=
    '\n## Gates e limites\n\n' +
    (data.notes ?? []).join('\n\n') +
    `\n\nEstimativa: ${data.remainingEstimate}\n\nA2 pendente; etapa3 depende da aprovação explícita do usuário.\n`;
  async function save(file, text) {
    const filepath = fileURLToPath(file);
    await writeFile(file, await format(text, { ...(await resolveConfig(filepath)), filepath }));
  }
  await save(jsonFile, JSON.stringify(data));
  await save(mdFile, md);
  const ledger = (await readFile(ledgerFile, 'utf8')).replace(
    /^\*\*Etapa 2:.*\*\*$/m,
    `**Etapa 2: ${percent}% do checklist (${completedItems}/${ids.length} itens); ${closedTasks.length}/${tasks.length} tarefas inteiramente encerradas. A2 pendente.**`,
  );
  await save(ledgerFile, ledger);
}
console.log(JSON.stringify({ ...counts, recalculatedAt: data.recalculatedAt ?? data.updatedAt }));
