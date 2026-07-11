import { InputHTMLAttributes } from 'react';
import { formatVehicleNumber } from '../lib/vehicleFormat';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

/** Plain text input that auto-formats to KL-01-AA-0123 style as the user types. */
export default function VehicleNumberInput({ value, onChange, placeholder = 'e.g. KL-01-AA-0123', ...rest }: Props) {
  return (
    <input
      {...rest}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(formatVehicleNumber(e.target.value))}
    />
  );
}
