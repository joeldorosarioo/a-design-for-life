import type { Payload } from 'payload';
import { captureBackupMediaInventory } from '../../src/features/media-library/server/backup-inventory';
import { withNativeBackupSnapshot } from '../../src/helpers/payload/backup-snapshot';
import type { ObjectStorage } from '../../src/helpers/storage/object-storage';
import type { BackupSource } from './run';

export function createNativeBackupSource(options: {
  payload: Payload;
  directory: string;
  storage: ObjectStorage;
  dump: (input: { snapshotId: string; destination: string }) => Promise<void>;
}): BackupSource {
  return {
    storage: options.storage,
    capture: (consume) =>
      withNativeBackupSnapshot(
        {
          payload: options.payload,
          directory: options.directory,
          capture: captureBackupMediaInventory,
        },
        ({ snapshotId, root, captured }) =>
          consume({
            root,
            objects: captured.objects,
            dump: (destination) => options.dump({ snapshotId, destination }),
          }),
      ),
  };
}
