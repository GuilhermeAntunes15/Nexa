import Link from "next/link";

export default function Brand({ href = "/" }) {
  return (
    <Link href={href} className="brand">
      <span className="brand-mark">N</span>
      <span className="brand-copy">
        <strong>Nexa</strong>
        <span>Mulheres. Apoio. Força. Juntas.</span>
      </span>
    </Link>
  );
}
