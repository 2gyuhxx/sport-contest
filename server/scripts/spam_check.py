#!/usr/bin/env python3
"""
스팸 필터링 스크립트
행사 제목(title)과 설명(description)을 각각 모델에 적용하여 스팸 여부를 판단합니다.
둘 다 0이면 정상, 그 외에는 스팸으로 분류합니다.
"""
import sys
import json
import os
import torch
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# 설정
MODEL_NAME = "klue/bert-base"
MAX_LEN = 128

# 스크립트 파일의 디렉토리를 기준으로 상대 경로 계산
SCRIPT_DIR = Path(__file__).parent.absolute()
MODEL_PATH = SCRIPT_DIR.parent / 'models' / 'spam_model_ver1.pth'

# CPU 모드 강제 (메모리 부족 방지)
device = torch.device("cpu")

# 메모리 최적화 설정
torch.set_num_threads(1)  # 단일 스레드 사용
if hasattr(torch, 'set_num_interop_threads'):
    torch.set_num_interop_threads(1)

# 전역 변수로 모델과 토크나이저 저장 (한 번만 로드)
_model = None
_tokenizer = None

def load_model_and_tokenizer():
    """모델과 토크나이저 로드"""
    global _model, _tokenizer
    
    if _model is not None and _tokenizer is not None:
        return _model, _tokenizer
    
    try:
        # 모델 파일 경로 확인
        if not MODEL_PATH.exists():
            error_msg = f'모델 파일을 찾을 수 없습니다: {MODEL_PATH}'
            print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
            sys.exit(1)
        
        # 토크나이저 로드 (인터넷 연결 오류 처리)
        try:
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        except Exception as tokenizer_error:
            error_msg = f'토크나이저 로드 오류: {str(tokenizer_error)}. 인터넷 연결을 확인하거나 로컬 모델 경로를 사용하세요.'
            print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
            sys.exit(1)
        
        # 모델 로드 시도 - 두 가지 방식 모두 지원
        # 1. state_dict 방식 (torch.save(model.state_dict(), PATH))
        # 2. 전체 모델 방식 (torch.save(model, PATH))
        try:
            # 먼저 state_dict 방식으로 시도
            try:
                # 모델 생성
                _model = AutoModelForSequenceClassification.from_pretrained(
                    MODEL_NAME, 
                    num_labels=2
                )
                
                # state_dict 로드 시도
                loaded_data = torch.load(MODEL_PATH, map_location='cpu')
                
                # loaded_data가 dict인지 확인 (state_dict인 경우)
                if isinstance(loaded_data, dict):
                    # state_dict 방식
                    _model.load_state_dict(loaded_data)
                else:
                    # 전체 모델 방식 - 기존 모델 객체를 버리고 로드한 모델 사용
                    _model = loaded_data
                    
            except Exception as load_error:
                # state_dict 로드 실패 시 전체 모델 방식으로 재시도
                try:
                    # 전체 모델 로드
                    _model = torch.load(MODEL_PATH, map_location='cpu')
                    # 모델이 올바른 타입인지 확인
                    if not isinstance(_model, torch.nn.Module):
                        raise ValueError('로드된 모델이 올바른 PyTorch 모델이 아닙니다.')
                except Exception as full_model_error:
                    error_msg = f'모델 로드 오류 (state_dict 방식: {str(load_error)}, 전체 모델 방식: {str(full_model_error)})'
                    print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
                    sys.exit(1)
                    
        except Exception as model_error:
            error_msg = f'모델 생성/로드 오류: {str(model_error)}. 인터넷 연결을 확인하거나 로컬 모델 경로를 사용하세요.'
            print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
            sys.exit(1)
        
        # 모델 설정
        _model.to(device)
        _model.eval()
        
        # 메모리 정리
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        
        return _model, _tokenizer
    except Exception as e:
        error_msg = f'모델/토크나이저 로드 오류: {str(e)}'
        print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
        sys.exit(1)

def predict_text(text):
    """
    텍스트를 모델에 적용하여 예측
    결과: 0 = 정상, 1 = 스팸
    모델 학습 시 사용한 코드와 정확히 동일한 방식으로 토크나이징
    """
    try:
        # None 체크
        if text is None:
            return 0
        
        # 문자열로 강제 변환
        if not isinstance(text, str):
            text = str(text)
        
        # 공백 제거 및 인코딩 정규화
        text = text.strip()
        
        # 빈 문자열 체크
        if not text:
            return 0
        
        # 바이트 문자열이 아닌지 확인 (bytes -> str 변환)
        if isinstance(text, bytes):
            text = text.decode('utf-8', errors='ignore')
        
        # 최종 타입 확인
        if not isinstance(text, str):
            raise TypeError(f'텍스트는 문자열이어야 합니다. 최종 타입: {type(text)}')
        
        model, tokenizer = load_model_and_tokenizer()
        
        # 토크나이징 - 원래 코드와 동일한 결과를 얻기 위해 tokenizer() 직접 호출
        # encode_plus는 최신 transformers에서 문제가 있을 수 있으므로 직접 호출 방식 사용
        # text는 반드시 순수 Python str 객체여야 함
        encoding = tokenizer(
            text,
            add_special_tokens=True,
            max_length=MAX_LEN,
            padding='max_length',
            truncation=True,
            return_tensors='pt',
            return_attention_mask=True,
        )
        
        # return_tensors='pt'를 사용하면 이미 [1, MAX_LEN] 형태의 텐서
        input_ids = encoding['input_ids'].to(device)
        attention_mask = encoding['attention_mask'].to(device)
        
        # 예측 (모델 학습 시와 동일한 방식)
        with torch.no_grad():
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            logits = outputs.logits
            pred = torch.argmax(logits, dim=1).item()
        
        # 메모리 정리
        del input_ids, attention_mask, outputs, logits
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        
        return pred
    except Exception as e:
        error_msg = f'예측 오류: {str(e)}'
        print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
        raise Exception(error_msg)

def main():
    """메인 함수"""
    try:
        # 표준 입력에서 JSON 데이터 읽기
        input_text = sys.stdin.read()
        if not input_text or not input_text.strip():
            print(json.dumps({'error': '입력 데이터가 없습니다'}), flush=True, file=sys.stderr)
            sys.exit(1)
        
        # JSON 파싱
        try:
            input_data = json.loads(input_text.strip())
        except json.JSONDecodeError as e:
            error_msg = json.dumps({'error': f'잘못된 JSON 형식: {str(e)}'})
            print(error_msg, flush=True, file=sys.stderr)
            sys.exit(1)
        
        # title과 description을 안전하게 추출 및 검증
        title_raw = input_data.get('title')
        description_raw = input_data.get('description')
        
        # None이거나 빈 값 처리 - 반드시 문자열로 변환
        if title_raw is None:
            title = ''
        elif isinstance(title_raw, (list, dict, tuple)):
            # 리스트나 딕셔너리 등이면 문자열로 변환
            title = str(title_raw)
        else:
            title = str(title_raw)
        
        if description_raw is None:
            description = ''
        elif isinstance(description_raw, (list, dict, tuple)):
            # 리스트나 딕셔너리 등이면 문자열로 변환
            description = str(description_raw)
        else:
            description = str(description_raw)
        
        # 공백 제거 및 최종 검증
        title = title.strip() if isinstance(title, str) else str(title).strip()
        description = description.strip() if isinstance(description, str) else str(description).strip()
        
        # 최종 타입 확인 (디버깅)
        if not isinstance(title, str):
            print(json.dumps({'error': f'title이 문자열이 아닙니다: {type(title)}'}), flush=True, file=sys.stderr)
            sys.exit(1)
        if not isinstance(description, str):
            print(json.dumps({'error': f'description이 문자열이 아닙니다: {type(description)}'}), flush=True, file=sys.stderr)
            sys.exit(1)
        
        if not title and not description:
            print(json.dumps({'error': 'title과 description이 필요합니다'}), flush=True, file=sys.stderr)
            sys.exit(1)
        
        # title 예측 (빈 문자열이면 0 반환)
        try:
            if title:
                title_result = predict_text(title)
            else:
                title_result = 0
        except Exception as e:
            print(json.dumps({'error': f'title 예측 오류: {str(e)}'}), flush=True, file=sys.stderr)
            sys.exit(1)
        
        # description 예측 (빈 문자열이면 0 반환)
        try:
            if description:
                description_result = predict_text(description)
            else:
                description_result = 0
        except Exception as e:
            print(json.dumps({'error': f'description 예측 오류: {str(e)}'}), flush=True, file=sys.stderr)
            sys.exit(1)
        
        # 둘 다 0이면 정상(스팸 아님), 그 외에는 스팸
        is_spam = 0 if (title_result == 0 and description_result == 0) else 1
        
        # 결과 출력 (버퍼링 방지를 위해 flush=True)
        result = json.dumps({'is_spam': is_spam})
        print(result, flush=True)
        
    except Exception as e:
        error_msg = json.dumps({'error': str(e)})
        print(error_msg, flush=True, file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

