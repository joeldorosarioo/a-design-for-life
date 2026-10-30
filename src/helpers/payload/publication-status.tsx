'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  Button,
  useDocumentInfo,
  useForm,
  useFormBackgroundProcessing,
  useFormModified,
  useFormProcessing,
} from '@payloadcms/ui';
import { publicReceiptSchema, type PublicReceipt } from './publication-receipt.schema';

async function readReceipt(url: string): Promise<PublicReceipt | null> {
  const response = await fetch(`${url}/publication-status`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Publication status unavailable.');
  const json = await response.json();
  return json.receipt === null ? null : publicReceiptSchema.parse(json.receipt);
}

export function PublicationStatus() {
  const { id, collectionSlug, data, hasSavePermission, documentIsLocked, isInitializing } =
    useDocumentInfo();
  const { disabled } = useForm();
  const backgroundProcessing = useFormBackgroundProcessing();
  const processing = useFormProcessing();
  const modified = useFormModified();
  const revision = typeof data?.editorialRevision === 'string' ? data.editorialRevision : '';
  const key = `${collectionSlug}/${id}/${revision}`;
  const url =
    id && collectionSlug
      ? `/api/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(String(id))}`
      : null;
  const [status, setStatus] = useState<{ key: string; receipt: PublicReceipt | null } | null>(null);
  const [notice, setNotice] = useState<{ key: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const requests = generation;
    const current = ++requests.current;
    if (url) {
      void readReceipt(url)
        .then((receipt) => {
          if (generation.current === current) setStatus({ key, receipt });
        })
        .catch(() => {
          if (generation.current === current)
            setNotice({
              key,
              message:
                'Não foi possível consultar a atualização pública. Recarregue para consultar novamente.',
            });
        });
    }
    return () => {
      requests.current++;
    };
  }, [key, url]);
  const receipt = status?.key === key ? status.receipt : null;
  const message = notice?.key === key ? notice.message : null;
  const blocked =
    busy ||
    processing ||
    backgroundProcessing ||
    disabled ||
    isInitializing ||
    documentIsLocked ||
    !hasSavePermission;
  async function retry() {
    if (!url || !receipt || blocked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const requests = generation;
    const current = ++requests.current;
    try {
      const response = await fetch(`${url}/publication-retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: receipt.operationId }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error('Publication retry unavailable.');
      const result = publicReceiptSchema.parse(json.value);
      if (generation.current !== current) return;
      setStatus({ key, receipt: result });
      setNotice({
        key,
        message:
          result.state === 'superseded'
            ? 'Esta tentativa foi substituída por uma atualização mais recente.'
            : '',
      });
      const latest = await readReceipt(url);
      if (generation.current === current) setStatus({ key, receipt: latest });
    } catch {
      if (generation.current === current)
        setNotice({
          key,
          message: 'Não foi possível concluir a atualização pública. Tente novamente.',
        });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (!url || (!receipt && !message)) return null;
  return (
    <div role="status" aria-live="polite" data-publication-state={receipt?.state}>
      <Banner type={receipt?.state === 'update-pending' ? 'warning' : 'info'}>
        {receipt?.state === 'update-pending'
          ? 'Alterações salvas. Atualização pública pendente.'
          : receipt?.state === 'public'
            ? 'Última atualização pública confirmada.'
            : receipt?.state === 'superseded'
              ? 'Esta tentativa foi substituída por uma atualização mais recente.'
              : null}
        {receipt && (modified || (revision && receipt.targetRevision !== revision)) ? (
          <p>As alterações atuais são independentes da última atualização pública.</p>
        ) : null}
        {message ? <p>{message}</p> : null}
        {receipt?.state === 'update-pending' ? (
          <Button
            type="button"
            buttonStyle="secondary"
            size="small"
            disabled={blocked}
            onClick={() => void retry()}
          >
            Tentar novamente
          </Button>
        ) : null}
      </Banner>
    </div>
  );
}
