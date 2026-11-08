'use client';

import { useAuth } from '@payloadcms/ui';
import Image from 'next/image';
import { useState } from 'react';

type EditorialAccount = {
  name?: string | null;
  email?: string | null;
  avatar?: string | { id?: string | null } | null;
};

function privateAvatarSource(avatar: EditorialAccount['avatar']) {
  const id = typeof avatar === 'string' ? avatar : avatar?.id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))
    return undefined;
  return `/preview-media/${id}/original`;
}

export function EditorialUserAvatar() {
  const { user } = useAuth<EditorialAccount>();
  const [failedSource, setFailedSource] = useState<string>();
  const source = privateAvatarSource(user?.avatar);
  const name = user?.name?.trim();
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => Array.from(part)[0])
        .join('')
        .toLocaleUpperCase('pt-BR')
    : Array.from(user?.email?.trim() ?? '')[0]?.toLocaleUpperCase('pt-BR');

  return (
    <span
      aria-hidden="true"
      className="tw:inline-flex tw:size-[32px] tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-full tw:bg-[var(--theme-elevation-150)] tw:text-[12px] tw:font-semibold tw:text-[color:var(--theme-text)]"
    >
      {source && source !== failedSource ? (
        <Image
          src={source}
          alt=""
          width={32}
          height={32}
          unoptimized
          onError={() => setFailedSource(source)}
          className="tw:size-[32px] tw:object-cover"
        />
      ) : initials ? (
        initials
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" focusable="false">
          <circle cx="12" cy="8" r="3.5" fill="currentColor" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2H5Z" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
