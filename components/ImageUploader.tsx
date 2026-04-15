'use client';

import { useRef, useState } from 'react';
import { uploadFileApi } from '@/lib/apiClient';

interface Props {
  value: string | null; // URL of current image (if any)
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/**
 * Small uploader widget for attaching a single image (or PDF) to a transaction.
 * - If no image: shows "Attach file" button.
 * - If image: shows thumbnail + view/remove buttons.
 */
export function ImageUploader({ value, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadFileApi(file);
      onChange(url);
    } catch (err) {
      alert('שגיאה בהעלאה: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = () => {
    if (!confirm('להסיר את הקובץ המצורף?')) return;
    onChange(null);
  };

  const isPdf = value?.toLowerCase().endsWith('.pdf');

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onSelectFile}
        disabled={disabled || uploading}
      />

      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-full px-3 py-2 border border-dashed dark:border-slate-600 rounded text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          {uploading ? '⏳ מעלה...' : '📎 צרף תמונה / PDF (עד 8MB)'}
        </button>
      ) : (
        <div className="border dark:border-slate-600 rounded p-2">
          <div className="flex items-center gap-2">
            {isPdf ? (
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center text-2xl">
                📄
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt="מצורף"
                className="w-16 h-16 object-cover rounded border dark:border-slate-600 cursor-pointer"
                onClick={() => setPreview(true)}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                {isPdf ? 'קובץ PDF' : 'תמונה'} מצורף
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPreview(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  הצג
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:underline"
                >
                  {uploading ? 'מעלה...' : 'החלף'}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="text-xs text-red-600 hover:underline"
                >
                  הסר
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {preview && value && <ImageLightbox url={value} isPdf={!!isPdf} onClose={() => setPreview(false)} />}
    </div>
  );
}

/** Fullscreen image/PDF viewer. */
export function ImageLightbox({
  url,
  isPdf,
  onClose,
}: {
  url: string;
  isPdf: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 left-4 text-white text-3xl hover:opacity-75"
        title="סגור (Esc)"
      >
        ×
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 text-white text-sm hover:underline bg-white/10 px-3 py-1 rounded"
        onClick={(e) => e.stopPropagation()}
      >
        פתח בחלון חדש ↗
      </a>
      {isPdf ? (
        <iframe
          src={url}
          className="w-full h-[90vh] bg-white rounded"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="תמונה מצורפת"
          className="max-w-full max-h-[90vh] object-contain rounded"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
