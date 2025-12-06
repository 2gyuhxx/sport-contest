# 사용되지 않는 파일 목록

다음 파일들은 현재 코드베이스에서 참조되지 않으며 삭제를 고려할 수 있습니다:

## 컴포넌트

1. **src/components/CategoryFilter/**
   - `CategoryFilter.tsx` - CategoryFilter 컴포넌트 자체는 사용되지 않음
   - `index.ts` - export만 있고 실제로 import되는 곳이 없음
   - 참고: `CategoryFilter` 타입은 `useEventFilters` 훅에서 사용되지만, 컴포넌트는 사용되지 않음

2. **src/components/EventList/**
   - `EventList.tsx` - EventList 컴포넌트가 import/사용되는 곳이 없음
   - `index.ts` - export만 있고 실제로 import되는 곳이 없음
   - 참고: EventListSection 컴포넌트가 대신 사용됨

3. **src/components/EventPin/**
   - `EventPin.tsx` - EventPin 컴포넌트가 import/사용되는 곳이 없음
   - `index.ts` - export만 있고 실제로 import되는 곳이 없음

## 삭제 방법

```bash
# 안전하게 삭제하려면:
rm -rf src/components/CategoryFilter
rm -rf src/components/EventList
rm -rf src/components/EventPin
```

**주의**: 삭제 전에 다음을 확인하세요:
- Git에서 해당 파일들의 최근 변경 이력을 확인
- 향후 사용 계획이 있는지 확인
- 관련 테스트 파일이 있는지 확인

