export type PeriodView = 'recent' | 'day' | 'month' | 'custom';

export interface PeriodState {
  view: PeriodView;
  day: string;
  month: string;
  customFrom: string;
  customTo: string;
}

function today() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function monthStart(monthStr: string) {
  return `${monthStr}-01`;
}
function monthEnd(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthStr}-${String(last).padStart(2, '0')}`;
}
function currentMonth() {
  return today().slice(0, 7);
}

/** Default: no date filter ("Recent") — lists show their most recent entries, unscoped. */
export function defaultPeriodState(): PeriodState {
  return {
    view: 'recent',
    day: today(),
    month: currentMonth(),
    customFrom: monthStart(currentMonth()),
    customTo: today(),
  };
}

/** Resolve a PeriodState to a concrete {from, to} range. Empty when view is 'recent' (no filter). */
export function periodRange(state: PeriodState): { from?: string; to?: string } {
  if (state.view === 'recent') return {};
  if (state.view === 'day') return { from: state.day, to: state.day };
  if (state.view === 'month') return { from: monthStart(state.month), to: monthEnd(state.month) };
  return { from: state.customFrom, to: state.customTo };
}

/** Short label describing the active period, for headings. */
export function periodLabel(state: PeriodState): string {
  if (state.view === 'recent') return 'Recent';
  if (state.view === 'day') return state.day === today() ? 'Today' : state.day;
  if (state.view === 'month') return state.month;
  return `${state.customFrom} to ${state.customTo}`;
}

export default function PeriodFilter({
  value,
  onChange,
  allowRecent = false,
}: {
  value: PeriodState;
  onChange: (next: PeriodState) => void;
  /** Show a "Recent" tab (no date filter) — for list pages, not analytical reports. */
  allowRecent?: boolean;
}) {
  return (
    <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
      <div className="flex" style={{ gap: 4 }}>
        {allowRecent && (
          <button
            type="button"
            className={`btn sm ${value.view === 'recent' ? '' : 'ghost'}`}
            onClick={() => onChange({ ...value, view: 'recent' })}
          >
            Recent
          </button>
        )}
        <button
          type="button"
          className={`btn sm ${value.view === 'day' ? '' : 'ghost'}`}
          onClick={() => onChange({ ...value, view: 'day' })}
        >
          Daily
        </button>
        <button
          type="button"
          className={`btn sm ${value.view === 'month' ? '' : 'ghost'}`}
          onClick={() => onChange({ ...value, view: 'month' })}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`btn sm ${value.view === 'custom' ? '' : 'ghost'}`}
          onClick={() => onChange({ ...value, view: 'custom' })}
        >
          Custom
        </button>
      </div>

      {value.view === 'day' && (
        <input
          type="date"
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
          style={{ width: 160 }}
        />
      )}
      {value.view === 'month' && (
        <input
          type="month"
          value={value.month}
          onChange={(e) => onChange({ ...value, month: e.target.value })}
          style={{ width: 160 }}
        />
      )}
      {value.view === 'custom' && (
        <>
          <input
            type="date"
            value={value.customFrom}
            onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
            style={{ width: 160 }}
          />
          <span className="muted">to</span>
          <input
            type="date"
            value={value.customTo}
            onChange={(e) => onChange({ ...value, customTo: e.target.value })}
            style={{ width: 160 }}
          />
        </>
      )}
    </div>
  );
}
