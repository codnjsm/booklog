import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 프론트 로직만 본다. tests/ 아래 에뮬레이터 테스트는 Firestore 에뮬레이터가 필요해서
    // 실행 환경이 다르고, 지금처럼 `npm run test:rules`가 node --test로 따로 돌린다.
    include: ['src/**/*.test.ts'],
  },
})
