import { writeSync } from 'node:fs';
import { runOperationalBackupJob } from './job-runner';

const exit = await runOperationalBackupJob().then(
  (result) => {
    writeSync(1, JSON.stringify(result) + '\n');
    return 0;
  },
  () => {
    writeSync(2, 'Operational backup job failed.\n');
    return 1;
  },
);
// All tools, database operations and output are awaited before ending this CLI.
process.exit(exit);
