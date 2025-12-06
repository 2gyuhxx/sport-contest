# 📸 마크다운 이미지 삽입 가이드

## 기본 문법

```markdown
![대체 텍스트](이미지 경로)
```

- `![대체 텍스트]`: 이미지가 로드되지 않을 때 표시될 텍스트
- `(이미지 경로)`: 이미지 파일의 경로 또는 URL

## 경로 지정 방법

### 1. 상대 경로 (로컬 및 GitHub 모두 지원)

```markdown
<!-- 현재 파일과 같은 디렉터리의 이미지 -->
![로고](./logo.png)

<!-- 하위 폴더의 이미지 -->
![로고](./public/images/logo.png)

<!-- 상위 폴더의 이미지 -->
![로고](../images/logo.png)
```

### 2. 절대 경로 (프로젝트 루트 기준)

```markdown
<!-- 프로젝트 루트 기준 -->
![로고](/public/images/logo.png)
```

### 3. GitHub Raw URL (GitHub에서만 작동)

```markdown
![로고](https://raw.githubusercontent.com/사용자명/저장소명/브랜치명/public/images/logo.png)
```

**예시:**
```markdown
![로고](https://raw.githubusercontent.com/username/sport-contest/main/public/images/logo.png)
```

### 4. 외부 URL

```markdown
![이미지](https://example.com/image.png)
```

## 고급 사용법

### 이미지 크기 조절 (HTML 태그 사용)

```markdown
<img src="./public/images/logo.png" alt="로고" width="200" height="100">
```

### 이미지에 링크 추가

```markdown
[![로고](./public/images/logo.png)](https://example.com)
```

### 이미지 정렬 (HTML 태그 사용)

```markdown
<!-- 왼쪽 정렬 -->
<img src="./public/images/logo.png" alt="로고" align="left">

<!-- 가운데 정렬 -->
<div align="center">
  <img src="./public/images/logo.png" alt="로고">
</div>

<!-- 오른쪽 정렬 -->
<img src="./public/images/logo.png" alt="로고" align="right">
```

## 현재 프로젝트 구조

```
sport-contest/
├── README.md
└── public/
    └── images/
        ├── logo.png
        ├── main_logo.png
        └── top_tab_logo.png
```

## README.md에서 이미지 사용 예시

```markdown
## 프로젝트 로고

![메인 로고](./public/images/main_logo.png)

## 화면 캡처

### 홈 화면
![홈 화면](./screenshots/home.png)

### 지도 검색
![지도 검색](./screenshots/map.png)
```

## 주의사항

1. **경로 구분자**: Windows에서는 `\`, Mac/Linux에서는 `/`를 사용하지만, 마크다운에서는 항상 `/`를 사용합니다.

2. **대소문자 구분**: GitHub는 대소문자를 구분하므로 파일명을 정확히 입력해야 합니다.

3. **파일 확장자**: 이미지 파일 확장자(.png, .jpg, .gif 등)를 정확히 입력해야 합니다.

4. **GitHub에서 보기**: GitHub에 푸시한 후 README.md에서 이미지가 제대로 표시되는지 확인하세요.

5. **로컬에서 보기**: 일부 마크다운 뷰어에서는 상대 경로가 제대로 작동하지 않을 수 있습니다.

## 문제 해결

### 이미지가 표시되지 않을 때

1. **경로 확인**: 파일 경로가 올바른지 확인
2. **파일 존재 확인**: 이미지 파일이 실제로 존재하는지 확인
3. **GitHub에 푸시**: 로컬에서만 보이지 않으면 GitHub에 푸시 후 확인
4. **대소문자 확인**: 파일명의 대소문자가 정확한지 확인

### GitHub에서 이미지가 안 보일 때

- GitHub Raw URL을 사용하거나
- 이미지를 `docs/images/` 폴더에 저장하고 상대 경로로 참조
