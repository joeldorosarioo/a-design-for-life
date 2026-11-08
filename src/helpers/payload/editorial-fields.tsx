'use client';
import { useEffect } from 'react';
import { useDocumentInfo, useField } from '@payloadcms/ui';
import type { TextFieldClientComponent } from 'payload';
export function useEditorialLeaseLifecycle(
  collection: string | undefined,
  id: string | number | undefined,
  token: string | undefined,
) {
  useEffect(() => {
    if (!collection || !id || !token) return;
    const url = `/api/${collection}/${id}/editorial-lease`;
    let previous = Date.now();
    const renew = () => {
      if (Date.now() - previous < 10_000) return;
      previous = Date.now();
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew', token }),
      }).catch(() => {});
    };
    const release = () => {
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release', token }),
        keepalive: true,
      }).catch(() => {});
    };
    document.addEventListener('pointerdown', renew);
    document.addEventListener('keydown', renew);
    window.addEventListener('pagehide', release);
    return () => {
      document.removeEventListener('pointerdown', renew);
      document.removeEventListener('keydown', renew);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [collection, id, token]);
}
export const EditorialRevisionField: TextFieldClientComponent = ({ path }) => {
  const { value } = useField<string>({ path });
  return (
    <input
      type="hidden"
      name={path}
      value={value ?? ''}
      readOnly
      data-editorial-revision={value ?? ''}
    />
  );
};
export const EditorialLeaseField: TextFieldClientComponent = ({ path }) => {
  const { value } = useField<string>({ path });
  const { collectionSlug, id } = useDocumentInfo();
  useEditorialLeaseLifecycle(collectionSlug, id, value);
  return (
    <input
      type="hidden"
      name={path}
      value={value ?? ''}
      readOnly
      data-editorial-lease={value ?? ''}
    />
  );
};
