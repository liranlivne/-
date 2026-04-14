'use client';

import { useState } from 'react';

interface Props {
  open: boolean;
  categories: string[];
  onClose: () => void;
  onSave: (categories: string[]) => Promise<void>;
}

export function CategoryManager({ open, categories, onClose, onSave }: Props) {
  const [list, setList] = useState<string[]>(categories);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset when opened
  useState(() => setList(categories));

  if (!open) return null;

  const add = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      alert('הקטגוריה כבר קיימת');
      return;
    }
    setList([...list, trimmed]);
    setNewName('');
  };

  const remove = (i: number) => {
    if (!confirm(`למחוק את הקטגוריה "${list[i]}"?`)) return;
    setList(list.filter((_, idx) => idx !== i));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const copy = [...list];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setList(copy);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(list);
      onClose();
    } catch (err) {
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#2D3A8C] text-white px-4 py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="font-bold text-lg">ניהול קטגוריות</h2>
          <button onClick={onClose} className="text-xl leading-none hover:opacity-75">×</button>
        </div>

        <div className="p-4">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="קטגוריה חדשה"
              className="flex-1 px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded"
              disabled={saving}
            />
            <button
              onClick={add}
              disabled={saving}
              className="px-3 py-2 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] disabled:opacity-50"
            >
              + הוסף
            </button>
          </div>

          <div className="border dark:border-slate-700 rounded divide-y dark:divide-slate-700">
            {list.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">אין קטגוריות</div>
            )}
            {list.map((c, i) => (
              <div key={c} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                <span className="flex-1">{c}</span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || saving}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 px-1"
                  title="הזז למעלה"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, +1)}
                  disabled={i === list.length - 1 || saving}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 px-1"
                  title="הזז למטה"
                >
                  ↓
                </button>
                <button
                  onClick={() => remove(i)}
                  disabled={saving}
                  className="text-red-600 hover:text-red-800 disabled:opacity-30 px-1"
                  title="מחק"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t dark:border-slate-700 p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  );
}
