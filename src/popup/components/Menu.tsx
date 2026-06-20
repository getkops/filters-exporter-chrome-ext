import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from './Icon';

/**
 * Menu.tsx — an icon-button trigger plus a popover, used for the Refresh (↻) and
 * overflow (⋯) menus. Closes on outside click or Escape. `children` is a render
 * prop receiving `close` so items can dismiss the menu after acting (while the
 * include-filters checkbox can stay open).
 */
export function Menu({
  icon,
  label,
  align = 'end',
  children,
}: {
  icon: IconName;
  label: string;
  align?: 'start' | 'end';
  children: (close: () => void) => ComponentChildren;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div class="menu" ref={ref}>
      <button
        type="button"
        class={`icon-btn${open ? ' is-open' : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Icon name={icon} size={16} />
      </button>
      {open && (
        <div class={`menu-pop menu-pop-${align}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      class={`menu-item${danger ? ' danger' : ''}`}
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={15} />
      <span>{label}</span>
    </button>
  );
}
