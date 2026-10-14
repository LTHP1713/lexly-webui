import { useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/lib/format';
import localStyles from './FileDropzone.module.css';
import styles from './ui.module.css';

/**
 * A drop area that is also a button (UI spec F2.6): Enter, Space or a click opens the file
 * picker, and a file can be dropped on it. Once a file is chosen it shows the name and size with
 * **Remove**. The caller checks the file (`onFile`) and passes any problem back as `error`, which
 * is linked to the control with `aria-describedby`.
 */
export function FileDropzone({
  id,
  label,
  prompt,
  hint,
  accept,
  file,
  error,
  disabled = false,
  onFile,
  onRemove,
}: {
  id: string;
  /** The field's visible label. */
  label: string;
  /** The text inside the drop area. */
  prompt: string;
  hint?: string;
  accept: string;
  file: File | null;
  error?: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  }

  return (
    <div className={styles.field}>
      <span id={`${id}-label`} className={styles.label}>
        {label}
      </span>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {file ? (
        <div className={localStyles.chosen}>
          <span>
            <span className={localStyles.fileName}>{file.name}</span>{' '}
            <span className={localStyles.fileSize}>({formatBytes(file.size)})</span>
          </span>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          id={id}
          type="button"
          className={`${localStyles.zone} ${dragging ? localStyles.dragging : ''} ${error ? localStyles.invalid : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={disabled}
          aria-labelledby={`${id}-label ${id}-prompt`}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        >
          <span id={`${id}-prompt`} className={localStyles.zoneTitle}>
            {prompt}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.visuallyHidden}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          if (chosen) onFile(chosen);
        }}
      />
      {error && (
        <span id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
