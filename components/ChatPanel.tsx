'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ChatMessage {
  rowNumber: number;
  timestamp: string;
  author: string;
  text: string;
}

const AUTHOR_KEY = 'tzrim-chat-author';
const POLL_MS = 15_000;

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState<number>(0);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [namePromptValue, setNamePromptValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selectMode = selectedIds.size > 0;

  // Filter messages by search query (matches text OR author OR date)
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const q = searchQuery.toLowerCase();
        if (m.text.toLowerCase().includes(q)) return true;
        if (m.author.toLowerCase().includes(q)) return true;
        // Date search: user might type "15/4" or "אפריל"
        try {
          const d = new Date(m.timestamp);
          const dateStr = d.toLocaleDateString('he-IL');
          if (dateStr.includes(q)) return true;
        } catch {}
        return false;
      })
    : messages;

  // Load author from localStorage on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(AUTHOR_KEY) : '';
    if (saved) setAuthor(saved);
  }, []);

  // Load chat messages
  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
    } catch {
      // silent - chat is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    loadMessages();
    const id = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(id);
  }, [loadMessages]);

  // Scroll to bottom when messages update AND panel is open
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Track unread count
  useEffect(() => {
    if (open) {
      setLastSeenCount(messages.length);
    }
  }, [open, messages.length]);

  const unreadCount = Math.max(0, messages.length - lastSeenCount);

  const requestAuthorName = () => {
    setNamePromptValue(author || '');
    setShowNamePrompt(true);
  };

  const saveAuthorName = () => {
    const name = namePromptValue.trim();
    if (!name) return;
    localStorage.setItem(AUTHOR_KEY, name);
    setAuthor(name);
    setShowNamePrompt(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!author) {
      requestAuthorName();
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, text }),
      });
      if (!res.ok) throw new Error('send failed');
      setInput('');
      await loadMessages();
    } catch (err) {
      alert('שגיאה בשליחה: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (rowNumber: number) => {
    if (!confirm('למחוק את ההודעה?')) return;
    try {
      const res = await fetch(`/api/chat/${rowNumber}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      await loadMessages();
    } catch (err) {
      alert('שגיאה במחיקה: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const toggleSelection = (rowNumber: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`למחוק ${selectedIds.size} הודעות?`)) return;

    setBulkDeleting(true);
    try {
      // Sort descending so deleting rows doesn't shift row numbers for subsequent deletes
      const rows = Array.from(selectedIds).sort((a, b) => b - a);
      for (const row of rows) {
        try {
          const res = await fetch(`/api/chat/${row}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`delete ${row} failed`);
        } catch (err) {
          console.error(err);
        }
      }
      setSelectedIds(new Set());
      await loadMessages();
    } finally {
      setBulkDeleting(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      if (sameDay) {
        return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 bg-[#2D3A8C] text-white w-14 h-14 rounded-full shadow-lg hover:bg-[#1f2a6b] flex items-center justify-center transition"
        title="צ'אט פנימי"
      >
        <span className="text-2xl">💬</span>
        {unreadCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 bg-[#F0A500] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat drawer */}
      {open && (
        <div className="fixed bottom-20 right-4 z-40 w-[280px] max-w-[calc(100vw-2rem)] h-[420px] max-h-[calc(100vh-7rem)] bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-2xl flex flex-col">
          <div className="bg-[#2D3A8C] text-white px-3 py-2 rounded-t-lg flex items-center justify-between">
            <div className="font-bold">צ'אט פנימי</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen((s) => !s)}
                className="text-sm hover:bg-white/10 rounded px-1.5"
                title="חיפוש"
              >
                🔍
              </button>
              {author ? (
                <button
                  onClick={requestAuthorName}
                  className="text-xs text-blue-200 hover:text-white underline"
                  title="שנה שם"
                >
                  {author}
                </button>
              ) : (
                <button
                  onClick={requestAuthorName}
                  className="text-xs bg-[#F0A500] text-white px-2 py-0.5 rounded"
                >
                  קבע שם
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-xl leading-none hover:opacity-75">
                ×
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="border-b dark:border-slate-700 p-2 bg-white dark:bg-slate-800 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש הודעה / שם / תאריך..."
                autoFocus
                className="flex-1 px-2 py-1 text-sm border dark:border-slate-600 dark:bg-slate-700 rounded"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-red-600 hover:underline"
                >
                  נקה
                </button>
              )}
            </div>
          )}

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#F5F6FA] dark:bg-slate-900 text-sm"
          >
            {loading && messages.length === 0 && (
              <div className="text-center text-slate-400 text-xs py-8">טוען...</div>
            )}
            {!loading && messages.length === 0 && (
              <div className="text-center text-slate-400 text-xs py-8">
                אין הודעות עדיין.
                <br />
                כתבו את ההודעה הראשונה למטה.
              </div>
            )}
            {searchQuery && filteredMessages.length === 0 && messages.length > 0 && (
              <div className="text-center text-slate-400 text-xs py-8">
                לא נמצאו תוצאות עבור "{searchQuery}"
              </div>
            )}
            {searchQuery && filteredMessages.length > 0 && (
              <div className="text-center text-xs text-slate-500 dark:text-slate-400 pb-2 border-b dark:border-slate-700">
                {filteredMessages.length} תוצאות
              </div>
            )}
            {filteredMessages.map((m) => {
              const isMe = !!(author && m.author === author);
              const isSelected = selectedIds.has(m.rowNumber);
              return (
                <div
                  key={m.rowNumber}
                  className={`max-w-[85%] ${isMe ? 'ms-auto' : 'me-auto'}`}
                >
                  <div
                    onClick={() => toggleSelection(m.rowNumber)}
                    className={`px-3 py-2 rounded-lg transition cursor-pointer ${
                      isSelected ? 'ring-2 ring-[#F0A500]' : ''
                    } ${
                      isMe
                        ? 'bg-[#2D3A8C] text-white'
                        : 'bg-white dark:bg-slate-700 dark:text-slate-100 border dark:border-slate-600'
                    }`}
                  >
                    {!isMe && (
                      <div className="text-xs font-bold mb-1 text-[#2D3A8C] dark:text-[#F0A500]">
                        {m.author}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    <div
                      className={`text-[10px] mt-1 ${
                        isMe ? 'text-blue-200' : 'text-slate-400 dark:text-slate-400'
                      }`}
                    >
                      {formatTime(m.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectMode && (
            <div className="border-t dark:border-slate-700 p-2 bg-amber-50 dark:bg-amber-900/30 flex items-center justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-200">
                {selectedIds.size > 0
                  ? `נבחרו ${selectedIds.size} הודעות`
                  : 'לחץ על הודעה כדי לבחור'}
              </span>
              <button
                onClick={bulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-xs"
              >
                {bulkDeleting ? 'מוחק...' : `🗑 מחק ${selectedIds.size || ''}`}
              </button>
            </div>
          )}

          <div className="border-t dark:border-slate-700 p-2 flex gap-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={author ? 'כתוב הודעה...' : 'לחץ "קבע שם" כדי להתחיל'}
              disabled={sending || !author}
              rows={2}
              className="flex-1 px-2 py-1 border dark:border-slate-600 dark:bg-slate-700 rounded resize-none text-sm"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim() || !author}
              className="px-3 bg-[#2D3A8C] text-white rounded hover:bg-[#1f2a6b] disabled:opacity-50 text-sm"
            >
              {sending ? '...' : 'שלח'}
            </button>
          </div>
        </div>
      )}

      {/* Name prompt modal */}
      {showNamePrompt && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNamePrompt(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-2">מי אתה?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              השם הזה יוצג לצד ההודעות שלך. נשמר במחשב הזה בלבד.
            </p>
            <input
              type="text"
              value={namePromptValue}
              onChange={(e) => setNamePromptValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveAuthorName()}
              placeholder="לדוגמה: יוסי"
              autoFocus
              className="w-full px-3 py-2 border dark:border-slate-600 dark:bg-slate-700 rounded mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNamePrompt(false)}
                className="px-3 py-2 border dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                ביטול
              </button>
              <button
                onClick={saveAuthorName}
                disabled={!namePromptValue.trim()}
                className="px-3 py-2 bg-[#2D3A8C] text-white rounded disabled:opacity-50"
              >
                שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
