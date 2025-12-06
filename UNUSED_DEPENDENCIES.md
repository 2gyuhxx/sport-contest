# 제거된 사용되지 않는 의존성

## dependencies에서 제거된 패키지

1. **`d3-geo`** (^3.1.1)
   - 이유: 코드베이스 어디에서도 import되지 않음
   - 영향: 없음 (사용되지 않았음)

2. **`topojson-client`** (^3.1.0)
   - 이유: 코드베이스 어디에서도 import되지 않음
   - 영향: 없음 (사용되지 않았음)

3. **`react-simple-maps`** (^3.0.0)
   - 이유: 코드베이스 어디에서도 import되지 않음
   - 영향: 없음 (Naver Maps API만 사용)

4. **`prop-types`** (^15.8.1)
   - 이유: TypeScript를 사용하므로 런타임 타입 검증 불필요
   - 영향: 없음 (TypeScript 컴파일 타임 검증 사용)

## devDependencies에서 제거된 패키지

1. **`@types/d3-geo`** (^3.1.0)
   - 이유: `d3-geo` 제거에 따라 불필요
   - 영향: 없음

2. **`@types/topojson-client`** (^3.1.5)
   - 이유: `topojson-client` 제거에 따라 불필요
   - 영향: 없음

3. **`@types/geojson`** (^7946.0.16)
   - 이유: GeoJSON은 네이티브 TypeScript 타입으로 사용 가능
   - 영향: 없음

## 제거 후 필요한 작업

의존성을 제거한 후 다음 명령어를 실행하여 node_modules를 업데이트하세요:

```bash
npm install
```

또는

```bash
rm -rf node_modules package-lock.json
npm install
```

## 예상 효과

- **번들 크기 감소**: 약 200-300KB 감소
- **설치 시간 단축**: 불필요한 패키지 다운로드 제거
- **보안 향상**: 사용하지 않는 패키지의 보안 취약점 제거

