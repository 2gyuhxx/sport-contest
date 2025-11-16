# 스팸 필터링 스크립트

## 필수 요구사항

Python 스크립트를 실행하기 위해 다음 패키지가 설치되어 있어야 합니다:

```bash
pip install torch transformers
```

또는 더 많은 패키지가 필요할 수 있습니다:

```bash
pip install torch transformers numpy scikit-learn pandas tqdm
```

## 모델 정보

- **모델**: klue/bert-base
- **모델 타입**: AutoModelForSequenceClassification (2개 클래스)
- **최대 길이**: 128 토큰
- **모델 파일**: `server/models/spam_model_ver1.pth`

## 동작 방식

1. title을 모델에 적용하여 예측 (0 또는 1)
2. description을 모델에 적용하여 예측 (0 또는 1)
3. 둘 다 0이면 정상 (스팸 아님)
4. 그 외에는 스팸으로 분류

## 테스트

스크립트를 직접 테스트하려면:

```bash
# Linux/Mac
echo '{"title": "테스트 제목", "description": "테스트 설명"}' | python3 spam_check.py

# Windows
echo {"title": "테스트 제목", "description": "테스트 설명"} | python spam_check.py
```

## 주의사항

- 모델 파일(`spam_model_ver1.pth`)이 `server/models/` 디렉토리에 있어야 합니다
- 처음 실행 시 `klue/bert-base` 모델을 자동으로 다운로드합니다 (시간이 걸릴 수 있음)
- 모델과 토크나이저는 전역 변수로 캐싱되어 한 번만 로드됩니다

