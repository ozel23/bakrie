import {
  type ReactNode,
  type ReactElement,
  cloneElement,
  isValidElement,
  useId,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Inbox,
  Search,
  X,
} from 'lucide-react';
import { useWorkspace } from '../lib/workspace';
import { labels, number } from '../lib/types';
export function Badge({ value, children }: { value: string; children?: ReactNode }) {
  return (
    <span className={`badge badge-${value}`}>
      <i />
      {children ?? labels[value] ?? value}
    </span>
  );
}
export function Button({
  children,
  kind = '',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: string }) {
  return (
    <button {...props} className={`button ${kind} ${className}`}>
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  children,
  hint,
  className = '',
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{
          id?: string;
          'aria-labelledby'?: string;
          'aria-describedby'?: string;
          'aria-invalid'?: boolean;
        }>,
        {
          id,
          'aria-labelledby': `${id}-label`,
          'aria-describedby':
            [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined,
          'aria-invalid': !!error,
        },
      )
    : children;
  return (
    <label htmlFor={id} className={`field ${className}`}>
      <span id={`${id}-label`}>{label}</span>
      {control}
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
      {hint && (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      )}
    </label>
  );
}
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-wrap">
      <select {...props}>{children}</select>
      <ChevronDown size={14} />
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={17} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button aria-label="Hapus pencarian" onClick={() => onChange('')}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = 'Belum ada data',
  text = 'Data yang sesuai filter akan tampil di sini.',
  action,
  icon,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div>{icon ?? <Inbox size={26} />}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const e = error as Error & {
    errors?: Record<string, string>;
    requestId?: string;
    status?: number;
  };
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={19} />
      <div>
        <strong>{e.message ?? String(error)}</strong>
        {e.errors && Object.values(e.errors).map((m, i) => <p key={i}>{m}</p>)}
        {e.requestId && (
          <small className="error-reference">
            Referensi bantuan: <code>{e.requestId}</code>
          </small>
        )}
        {(e.status === 401 || e.status === 419) && (
          <a className="error-recovery" href="/login">
            Masuk kembali
          </a>
        )}
        {onRetry && (
          <button type="button" className="error-recovery" onClick={onRetry}>
            Coba lagi
          </button>
        )}
      </div>
    </div>
  );
}
export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
  footer,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current;
    const first = dialog?.querySelector<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
    );
    if (first) {
      first.focus();
    } else {
      dialog?.focus();
    }
    const key = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && dialog) {
        const els = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
          ),
        );
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup dialog">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
export function DataTable<T>({
  rows,
  columns,
  keyOf,
  emptyTitle,
  emptyText,
  onRow,
  initialPageSize = 8,
  resource,
}: {
  rows: T[];
  columns: { label: ReactNode; render: (row: T, index: number) => ReactNode; className?: string }[];
  keyOf: (row: T) => string;
  emptyTitle?: string;
  emptyText?: string;
  onRow?: (row: T) => void;
  initialPageSize?: number;
  resource?: string;
}) {
  const workspace = useWorkspace();
  const pagination = resource ? workspace?.data.pagination?.[resource] : undefined;
  const missingPagination = !!resource && !pagination;
  const [page, setLocalPage] = useState(1);
  const [localSize, setSize] = useState(initialPageSize);
  const size = pagination?.per_page ?? localSize;
  const count = pagination?.total ?? rows.length;
  const max = pagination?.last_page ?? Math.max(1, Math.ceil(count / size));
  const current = pagination?.current_page ?? Math.min(page, max);
  const start = pagination ? (pagination.from ?? 1) - 1 : (current - 1) * size;
  const shown = resource ? rows : rows.slice(start, start + size);
  const setPage = (value: number) =>
    pagination && resource
      ? workspace.filter({ [`${resource}_page`]: value })
      : setLocalPage(value);

  return (
    <>
      <div className="table-overflow">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} className={c.className}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr
                key={keyOf(row)}
                tabIndex={onRow ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onRow && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRow(row);
                  }
                }}
                onClick={() => onRow?.(row)}
                className={onRow ? 'clickable' : ''}
              >
                {columns.map((c, j) => (
                  <td key={j} className={c.className}>
                    {c.render(row, start + i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty
            title={missingPagination ? 'Data belum dapat ditampilkan' : emptyTitle}
            text={
              missingPagination
                ? 'Informasi daftar belum lengkap. Silakan muat ulang halaman.'
                : emptyText
            }
          />
        )}
      </div>
      {count > 0 && (
        <div className="table-footer">
          {missingPagination ? (
            <span>{number(rows.length)} baris dimuat · total belum tersedia</span>
          ) : (
            <span>
              Menampilkan{' '}
              <strong>
                {start + 1}–{Math.min(start + shown.length, count)}
              </strong>{' '}
              dari {number(count)} data
            </span>
          )}
          {!missingPagination && (
            <div>
              <Select
                aria-label="Jumlah baris"
                value={size}
                onChange={(e) => {
                  if (pagination && resource) {
                    workspace.filter({
                      [`${resource}_per_page`]: Number(e.target.value),
                      [`${resource}_page`]: 1,
                    });
                  } else {
                    setSize(Number(e.target.value));
                    setPage(1);
                  }
                }}
              >
                <option value={8}>8 / halaman</option>
                <option value={15}>15 / halaman</option>
                <option value={30}>30 / halaman</option>
              </Select>
              <button
                className="icon-button"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
                aria-label="Halaman sebelumnya"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="page-number">{current}</span>
              <button
                className="icon-button"
                disabled={current === max}
                onClick={() => setPage(current + 1)}
                aria-label="Halaman berikutnya"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
export function ServerPager({ resource }: { resource: string }) {
  const { data, filter } = useWorkspace();
  const page = data.pagination?.[resource];
  if (!page || page.total === 0) return null;
  return (
    <div className="table-footer server-pager">
      <span>
        Menampilkan {page.from}–{page.to} dari {number(page.total)} data
      </span>
      <div>
        <button
          className="icon-button"
          aria-label={`Halaman ${resource} sebelumnya`}
          disabled={page.current_page <= 1}
          onClick={() => filter({ [`${resource}_page`]: page.current_page - 1 })}
        >
          <ArrowLeft size={16} />
        </button>
        <span>
          {page.current_page} / {page.last_page}
        </span>
        <button
          className="icon-button"
          aria-label={`Halaman ${resource} berikutnya`}
          disabled={page.current_page >= page.last_page}
          onClick={() => filter({ [`${resource}_page`]: page.current_page + 1 })}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function CheckItem({
  children,
  checked,
  onChange,
}: {
  children: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check-label">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
export function SuccessIcon() {
  return (
    <span className="success-icon">
      <Check size={18} />
    </span>
  );
}
