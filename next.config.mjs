import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Configurações de Acesso e Rede Local
  allowedDevOrigins: ['192.168.0.10', '192.168.0.246'],
  
  // 2. Monitoramento e Logs
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // 3. Otimização de Imagens (Supabase)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },

  // 4. Recursos Experimentais e Segurança de Server Actions
  experimental: {
    serverActions: {
      allowedOrigins: ['192.168.0.10:3000', 'localhost:3000'],
    },
  },
};

// 5. Configuração do Plugin PWA
const withPWA = withPWAInit({
  dest: "public",
  register: true,             // Adicionado do seu primeiro bloco
  skipWaiting: true,          // Adicionado do seu primeiro bloco
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

// Exportação final unificada
export default withPWA(nextConfig);