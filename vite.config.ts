import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // React Fast Refresh 최적화
      babel: {
        plugins: process.env.NODE_ENV === 'production' ? [] : [],
      },
    }),
  ],
  // esbuild 최적화 옵션 (프로덕션 빌드에서 console.log 제거)
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none', // 법적 주석 제거로 번들 크기 감소
  },
  build: {
    // 청크 크기 경고 제한
    chunkSizeWarningLimit: 1000,
    // 타겟 브라우저 (최신 브라우저만 지원하여 번들 크기 감소)
    target: 'es2020',
    rollupOptions: {
      output: {
        // 청크 분할 전략 (더 세밀하게)
        manualChunks: (id) => {
          // node_modules 의존성 분리
          if (id.includes('node_modules')) {
            // React 관련
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor'
            }
            // 아이콘
            if (id.includes('lucide-react')) {
              return 'icons'
            }
            // 지도 라이브러리
            if (id.includes('d3-geo') || id.includes('topojson') || id.includes('react-simple-maps')) {
              return 'maps'
            }
            // 기타 큰 라이브러리는 별도 청크로
            return 'vendor'
          }
          // utils는 별도 청크로
          if (id.includes('/src/utils/')) {
            return 'utils'
          }
        },
        // 파일명 패턴 (캐싱 최적화)
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // 소스맵 비활성화 (프로덕션)
    sourcemap: false,
    // CSS 코드 분할
    cssCodeSplit: true,
    // 압축 최적화
    minify: 'esbuild',
    // 인라인 limit 증가 (작은 에셋을 base64로 인라인)
    assetsInlineLimit: 4096, // 4KB
    // 번들 분석을 위한 옵션
    reportCompressedSize: true,
  },
  // 개발 서버 최적화
  server: {
    open: false,
    hmr: {
      overlay: true,
    },
    // 프리번들링 최적화
    fs: {
      strict: true,
    },
  },
  // 의존성 최적화
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
    ],
    exclude: [],
  },
})
