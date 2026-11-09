import { useId, type ReactNode } from 'react';

export function OptionTiles({ label, value, options, onChange, disabled, scroll }: {
  label: string;
  value: string;
  options: { value: string | number; label: string; detail?: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  scroll?: boolean;
}) {
  const name = useId();
  return <fieldset className="option-tiles" disabled={disabled}>
    <legend>{label}</legend>
    <div className={`option-tile-grid${scroll ? ' option-tile-grid-scroll' : ''}`}>
      {options.map(option => <label className="option-tile" key={option.value}>
        <input type="radio" name={name} checked={String(option.value) === value} onChange={() => onChange(String(option.value))}/>
        {option.icon}
        <span className="option-tile-copy"><span>{option.label}</span>{option.detail && <small>{option.detail}</small>}</span>
      </label>)}
    </div>
  </fieldset>;
}
