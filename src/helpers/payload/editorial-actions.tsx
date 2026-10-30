'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  ConfirmationModal,
  PopupList,
  toast,
  useDocumentInfo,
  useForm,
  useModal,
} from '@payloadcms/ui';
import { useEditorialLeaseLifecycle } from './editorial-fields';
async function errorMessage(response: Response) {
  try {
    const json = await response.json();
    return json.errors?.[0]?.message ?? 'Operation failed.';
  } catch {
    return 'Operation failed.';
  }
}
export function EditorialDeleteAction() {
  const { id, collectionSlug, hasDeletePermission } = useDocumentInfo();
  const { getData, setModified } = useForm();
  const { openModal } = useModal();
  const router = useRouter();
  const [observed, setObserved] = useState({ revision: '', token: '' });
  const modal = `editorial-delete-${id}`;
  if (!id || !hasDeletePermission) return null;
  return (
    <>
      <PopupList.Button
        id="editorial-delete"
        onClick={() => {
          const data = getData();
          setObserved({ revision: data.editorialRevision, token: data.leaseToken });
          openModal(modal);
        }}
      >
        Delete
      </PopupList.Button>
      <ConfirmationModal
        modalSlug={modal}
        heading="Delete document"
        body="Delete this document permanently?"
        onConfirm={async () => {
          try {
            const response = await fetch(`/api/${collectionSlug}/${id}`, {
              method: 'DELETE',
              headers: {
                'x-editorial-revision': observed.revision,
                'x-editorial-lease': observed.token,
              },
            });
            if (!response.ok) {
              toast.error(await errorMessage(response));
              return;
            }
            setModified(false);
            router.push(`/admin/collections/${collectionSlug}`);
          } catch {
            toast.error('Operation failed.');
          }
        }}
      />
    </>
  );
}
export function EditorialUnpublishAction() {
  const { id, collectionSlug, hasPublishedDoc, hasPublishPermission, setHasPublishedDoc, setData } =
    useDocumentInfo();
  const { getData, setModified, reset } = useForm();
  const { openModal } = useModal();
  const router = useRouter();
  const [observed, setObserved] = useState({ revision: '', token: '' });
  const modal = `editorial-unpublish-${id}`;
  if (!id || !hasPublishedDoc || !hasPublishPermission) return null;
  return (
    <>
      <PopupList.Button
        id="editorial-unpublish"
        onClick={() => {
          const data = getData();
          setObserved({ revision: data.editorialRevision, token: data.leaseToken });
          openModal(modal);
        }}
      >
        Unpublish
      </PopupList.Button>
      <ConfirmationModal
        modalSlug={modal}
        heading="Unpublish document"
        body="Withdraw this case in this language?"
        onConfirm={async () => {
          try {
            const response = await fetch(`/api/${collectionSlug}/${id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'x-editorial-revision': observed.revision,
                'x-editorial-lease': observed.token,
              },
              body: JSON.stringify({ _status: 'draft' }),
            });
            if (!response.ok) {
              toast.error(await errorMessage(response));
              return;
            }
            const json = await response.json();
            if (json.publicationReceipt?.state === 'update-pending') {
              toast.warning(
                json.message ?? 'Alterações salvas. Atualização pública pendente; tente novamente.',
              );
            } else if (json.publicationReceipt?.state === 'superseded') {
              toast.info(
                json.message ?? 'Esta tentativa foi substituída por uma atualização mais recente.',
              );
            }
            await reset(json.doc);
            setData(json.doc);
            setHasPublishedDoc(false);
            setModified(false);
            router.refresh();
          } catch {
            toast.error('Operation failed.');
          }
        }}
      />
    </>
  );
}
export function NoUnpublishAction() {
  return null;
}
export function EditorialRestoreAction({
  collection,
  id,
  version,
  revision,
  token,
  editable,
}: {
  collection: string;
  id: string;
  version: string;
  revision: string;
  token: string;
  editable: boolean;
}) {
  const [observed] = useState(() => ({ revision, token }));
  const { openModal } = useModal();
  const router = useRouter();
  const modal = `editorial-restore-${version}`;
  useEditorialLeaseLifecycle(collection, id, observed.token);
  return (
    <span data-editorial-version-action="true">
      <Button disabled={!editable} onClick={() => openModal(modal)}>
        Restore as draft
      </Button>
      <ConfirmationModal
        modalSlug={modal}
        heading="Restore as draft"
        body="Restore this version as a new draft? The published document stays unchanged."
        onConfirm={async () => {
          try {
            const response = await fetch(`/api/${collection}/versions/${version}`, {
              method: 'POST',
              headers: {
                'x-editorial-revision': observed.revision,
                'x-editorial-lease': observed.token,
              },
            });
            if (!response.ok) {
              toast.error(await errorMessage(response));
              return;
            }
            router.push(`/admin/collections/${collection}/${id}`);
            router.refresh();
          } catch {
            toast.error('Operation failed.');
          }
        }}
      />
    </span>
  );
}
