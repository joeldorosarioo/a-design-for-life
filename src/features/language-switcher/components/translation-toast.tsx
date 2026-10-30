'use client';
import styles from '../stylesheets/language-switcher.module.css';
export function TranslationToast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={message ? styles.toast : undefined}
    >
      {message ? <p>{message}</p> : null}
    </div>
  );
}
