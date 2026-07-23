import { useEffect, useRef, useState } from 'react';
import { formatVehicleNumber } from '../lib/vehicleFormat';
import { Icon } from './Icon';
import type { Vehicle } from '../types';

export interface UsualVehicle {
  id: string;
  vehicleId: string;
  vehicle: { id: string; number: string };
  /** Display text for the usual amount, e.g. "400" or "400 + 150 extra body". */
  usualLabel: string;
  /** Raw quantity to prefill when this entry is picked. */
  quantity: number;
}

interface Props {
  /** This vendor's/customer's registered vehicles — shown first, each with its usual quantity. */
  usualVehicles: UsualVehicle[];
  /** Every other vehicle in the system, as a fallback for a one-off truck. */
  allVehicles: Vehicle[];
  value: string;
  onChange: (vehicleNumber: string) => void;
  /** Fired when one of the registered vehicles is picked, so the caller can prefill quantity. */
  onSelectUsual?: (usual: UsualVehicle) => void;
  /** Label for the grouped section, e.g. "This vendor's usual trucks". */
  groupLabel?: string;
}

/**
 * Searchable vehicle-number field for the purchase/sale form — replaces the native
 * <datalist>, which renders as an unstyled browser popup that overlaps the form and is
 * awkward to click. Same interaction pattern as VendorPicker/CustomerPicker/CategoryPicker.
 */
export default function VehiclePicker({
  usualVehicles,
  allVehicles,
  value,
  onChange,
  onSelectUsual,
  groupLabel = "This party's usual trucks",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const registeredIds = new Set(usualVehicles.map((u) => u.vehicleId));
  const others = allVehicles.filter((v) => !registeredIds.has(v.id));

  const q = query.trim().toLowerCase();
  const filteredUsual = usualVehicles.filter((u) => !q || u.vehicle.number.toLowerCase().includes(q));
  const filteredOthers = others.filter((v) => !q || v.number.toLowerCase().includes(q));
  const exactMatch = [...usualVehicles.map((u) => u.vehicle.number), ...others.map((v) => v.number)]
    .some((n) => n.toLowerCase() === q);

  function selectUsual(u: UsualVehicle) {
    onChange(u.vehicle.number);
    onSelectUsual?.(u);
    setOpen(false);
    setQuery('');
  }

  function selectPlain(number: string) {
    onChange(number);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        value={open ? query : value}
        placeholder="e.g. KL-01-AA-0123"
        style={{ paddingRight: 32 }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          const formatted = formatVehicleNumber(e.target.value);
          setQuery(formatted);
          onChange(formatted);
        }}
      />
      {/* Nothing else hints this field opens a list of registered vehicles on tap —
          this chevron gives it the same "there are options here" cue a <select> has. */}
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <Icon name="chevron-down" size={16} className="muted" />
      </span>
      {open && (
        <div
          className="panel"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 320,
            overflowY: 'auto',
            marginTop: 4,
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          }}
        >
          {filteredUsual.length > 0 && (
            <>
              <div className="muted" style={{ padding: '6px 12px 2px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {groupLabel}
              </div>
              {filteredUsual.map((u) => (
                <div
                  key={u.id}
                  className="picker-row"
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                  onClick={() => selectUsual(u)}
                >
                  <div style={{ fontWeight: 500 }}>{u.vehicle.number}</div>
                  <div className="muted" style={{ fontSize: 12 }}>usually {u.usualLabel}</div>
                </div>
              ))}
            </>
          )}
          {filteredOthers.length > 0 && (
            <>
              <div className="muted" style={{ padding: '6px 12px 2px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Other vehicles
              </div>
              {filteredOthers.map((v) => (
                <div
                  key={v.id}
                  className="picker-row"
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                  onClick={() => selectPlain(v.number)}
                >
                  {v.number}
                </div>
              ))}
            </>
          )}
          {filteredUsual.length === 0 && filteredOthers.length === 0 && (
            <div className="muted" style={{ padding: '8px 12px' }}>No matches.</div>
          )}
          {q && !exactMatch && (
            <div
              onClick={() => selectPlain(query.trim())}
              style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid var(--border)', color: 'var(--accent, #2563eb)', fontWeight: 500 }}
            >
              Use "{query.trim()}" (new vehicle)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
