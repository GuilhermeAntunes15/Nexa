export default function Button({ children, variant="primary", className="", type="submit", ...props }) {
  return <button type={type} className={`btn btn-${variant} ${className}`.trim()} {...props}>{children}</button>;
}
