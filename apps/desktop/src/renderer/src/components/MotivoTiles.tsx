import { Input } from './AdminUI';
import { OptionTiles } from './OptionTiles';

export function MotivoTiles({ label = 'Motivo', options, value, onChange, custom, setCustom }: {
  label?: string; options: string[]; value: string; onChange: (value: string) => void;
  custom: boolean; setCustom: (value: boolean) => void;
}) {
  return <>
    <OptionTiles label={label} value={custom ? '__personalizado' : value}
      options={[...options.map(v => ({ value: v, label: v })), { value: '__personalizado', label: 'Descrever motivo' }]}
      onChange={v => { const personalizado = v === '__personalizado'; setCustom(personalizado); onChange(personalizado ? '' : v); }}/>
    {custom && <Input label="Descreva o motivo" value={value} maxLength={300} onChange={e => onChange(e.target.value)}/>}
  </>;
}
