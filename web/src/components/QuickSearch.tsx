import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';

export interface QuickSearchItem {
  path: string;
  label: string;
}

/** Ctrl/Cmd+K quick-nav: jump straight to any page you have access to by name. */
export default function QuickSearch({ items }: { items: QuickSearchItem[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const q = query.trim().toLowerCase();
  const matches = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => setHighlight(0), [query]);

  function go(path: string) {
    nav(path);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  return (
    <div className="qsearch" ref={boxRef}>
      <span className="qsearch-ic"><Icon name="search" size={16} /></span>
      <input
        ref={inputRef}
        value={query}
        placeholder="Search anything..."
        onFocus={() => setOpen(true)}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, matches.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && matches[highlight]) go(matches[highlight].path);
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
        }}
      />
      {!query && <span className="kbd">Ctrl+K</span>}
      {open && (
        <div className="qsearch-drop">
          {matches.length === 0 && <div className="none">No matching pages.</div>}
          {matches.map((m, i) => (
            <a
              key={m.path}
              className={i === highlight ? 'hi' : ''}
              onMouseEnter={() => setHighlight(i)}
              onClick={(e) => {
                e.preventDefault();
                go(m.path);
              }}
              href={m.path}
            >
              {m.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
