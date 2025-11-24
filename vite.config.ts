import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // esbuild 최적화 옵션 (프로덕션 빌드에서 console.log 제거)
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    // 청크 크기 경고 제한 증가 (큰 의존성 대응)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 청크 분할 전략
        manualChunks: {
          // React 관련 라이브러리 분리
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 아이콘 라이브러리 분리
          'icons': ['lucide-react'],
          // 지도 관련 라이브러리 분리
          'maps': ['react-simple-maps', 'd3-geo', 'topojson-client'],
        },
      },
    },
    // 소스맵 생성 (프로덕션에서 제거 가능)
    sourcemap: false,
    // CSS 코드 분할
    cssCodeSplit: true,
    // 압축 최적화 (esbuild가 더 빠름)
    minify: 'esbuild',
  },
  // 개발 서버 최적화
  server: {
    // 브라우저 자동 열기 비활성화
    open: false,
    // HMR 최적화
    hmr: {
      overlay: true,
    },
  },
})
