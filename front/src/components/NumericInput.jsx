import { useState } from 'react';
import { parseNumericDraft } from '../numericDraft';

export function NumericInput({
  value,
  onChange,
  className = '',
  allowDecimal = false,
  emptyAsZero = true,
  disabled,
  readOnly,
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const parsedValue = parseNumericDraft(value, { allowDecimal });
  const n = parsedValue.number;
  const idle =
    emptyAsZero || (value !== '' && value != null)
      ? parsedValue.text || (n === 0 ? '0' : String(n))
      : '';
  const display = focused ? draft : idle;

  function emit(parsed) {
    if (emptyAsZero) onChange(parsed.number);
    else onChange(parsed.text);
  }

  return (
    <input
      className={className}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      disabled={disabled}
      readOnly={readOnly}
      value={display}
      onFocus={() => {
        setFocused(true);
        setDraft(n === 0 && !String(value ?? '').includes('.') ? '' : parsedValue.text);
      }}
      onChange={(e) => {
        const parsed = parseNumericDraft(e.target.value, { allowDecimal });
        setDraft(parsed.text);
        emit(parsed);
      }}
      onBlur={() => {
        const parsed = parseNumericDraft(draft, { allowDecimal });
        setFocused(false);
        setDraft('');
        emit(parsed);
      }}
    />
  );
}
