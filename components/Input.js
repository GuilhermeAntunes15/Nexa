export default function Input({ id, label, hint, className="", ...props }) {
  return (
    <div className="input-group">
      {label && <label htmlFor={id} className="input-label">{label}</label>}
      <input id={id} className={`nexa-input ${className}`.trim()} {...props}/>
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}
