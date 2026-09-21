import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // 라이브러리를 앱 코드와 분리해 브라우저 캐시를 살린다. 배포할 때마다 바뀌는 건
        // 앱 코드뿐이라, 재방문자는 용량의 80%를 차지하는 라이브러리를 다시 받지 않는다.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@firebase') || id.includes('node_modules/firebase/')) return 'firebase'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          return 'vendor'
        },
      },
    },
  },
})
