import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as respostas:
 * - a app não pode ser embebida noutros sites (clickjacking);
 * - o browser não adivinha tipos de ficheiro;
 * - o endereço completo não é enviado para sites externos;
 * - câmara, microfone, localização e pagamentos ficam desligados.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Fontes e imagens estáticas: guardadas no browser 30 dias em vez de revalidadas a cada visita.
      { source: "/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] },
      { source: "/:file(umbral-logo-white.png|umbral-icon.png|favicon.svg)", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
