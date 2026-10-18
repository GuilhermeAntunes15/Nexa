import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

import PwaRegister from "@/components/PwaRegister";

export const metadata = {
  title: "Nexa — Mulheres. Apoio. Força. Juntas.",
  description: "Conexões reais, atividades, apoio e segurança.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
