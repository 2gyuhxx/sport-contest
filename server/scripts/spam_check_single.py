#!/usr/bin/env python3
"""
스팸 필터링 스크립트 (단일 텍스트용)
하나의 텍스트만 받아서 스팸 여부를 판단합니다.
"""
import sys
import json
import os
import torch
import tempfile
import urllib.request
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# 설정
MODEL_NAME = "klue/bert-base"
MAX_LEN = 128

# 클라우드 스토리지에서 모델 다운로드
MODEL_URL = "https://kr1-api-object-storage.nhncloudservice.com/v1/AUTH_691dba506e2740d8bcfca8bca5f8ecc9/sport-contest/model/spam_model_ver1.pth"

# 임시 디렉토리에 모델 캐싱
TEMP_DIR = Path(tempfile.gettempdir()) / 'sport-contest-models'
TEMP_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = TEMP_DIR / 'spam_model_ver1.pth'

# CPU 모드 강제 (메모리 부족 방지)
device = torch.device("cpu")

# 메모리 최적화 설정
torch.set_num_threads(1)  # 단일 스레드 사용
if hasattr(torch, 'set_num_interop_threads'):
    torch.set_num_interop_threads(1)

# 전역 변수로 모델과 토크나이저 저장 (한 번만 로드)
_model = None
_tokenizer = None

def download_model():
    """클라우드 스토리지에서 모델 다운로드"""
    try:
        if MODEL_PATH.exists():
            return MODEL_PATH
        print(json.dumps({'info': '모델 다운로드 중...'}), file=sys.stderr, flush=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        if not MODEL_PATH.exists():
            raise Exception('모델 다운로드 후 파일이 생성되지 않았습니다')
        print(json.dumps({'info': '모델 다운로드 완료'}), file=sys.stderr, flush=True)
        return MODEL_PATH
    except Exception as e:
        error_msg = f'모델 다운로드 오류: {str(e)}'
        print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
        raise Exception(error_msg)

def load_model_and_tokenizer():
    """모델과 토크나이저 로드"""
    global _model, _tokenizer
    
    if _model is not None and _tokenizer is not None:
        return _model, _tokenizer
    
    try:
        # 모델 다운로드 (캐시되어 있으면 다운로드하지 않음)
        download_model()
        
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
    """
    try:
        # 입력 검증 및 정규화
        if text is None:
            return 0
        
        # 문자열로 변환
        if isinstance(text, bytes):
            text = text.decode('utf-8', errors='replace')
        elif not isinstance(text, str):
            text = str(text)
        
        # 공백 제거 및 빈 문자열 체크
        text = text.strip()
        if not text or not isinstance(text, str):
            return 0
        
        model, tokenizer = load_model_and_tokenizer()
        
        # tokenizer 호출 - 여러 방법 시도 (TextEncodeInput 오류 방지)
        try:
            # 방법 1: 기본 방법
            encoding = tokenizer(
                text,
                add_special_tokens=True,
                max_length=MAX_LEN,
                padding='max_length',
                truncation=True,
                return_tensors='pt',
                return_attention_mask=True,
            )
        except (TypeError, ValueError) as tokenize_error:
            error_msg = str(tokenize_error)
            
            # TextEncodeInput 오류인 경우 대체 방법 시도
            if 'TextEncodeInput' in error_msg or 'must be Union' in error_msg:
                try:
                    # 방법 2: encode_plus 사용
                    encoding = tokenizer.encode_plus(
                        text,
                        add_special_tokens=True,
                        max_length=MAX_LEN,
                        padding='max_length',
                        truncation=True,
                        return_tensors='pt',
                        return_attention_mask=True,
                    )
                except Exception:
                    # 방법 3: encode 후 수동 처리
                    encoded = tokenizer.encode(
                        text,
                        add_special_tokens=True,
                        max_length=MAX_LEN,
                        truncation=True,
                    )
                    pad_token_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0
                    if len(encoded) < MAX_LEN:
                        encoded = encoded + [pad_token_id] * (MAX_LEN - len(encoded))
                    elif len(encoded) > MAX_LEN:
                        encoded = encoded[:MAX_LEN]
                    
                    input_ids = torch.tensor([encoded]).to(device)
                    attention_mask = (input_ids != pad_token_id).long().to(device)
                    encoding = {
                        'input_ids': input_ids,
                        'attention_mask': attention_mask
                    }
            else:
                raise
        
        # return_tensors='pt'를 사용하면 이미 [1, MAX_LEN] 형태의 텐서
        input_ids = encoding['input_ids'].to(device)
        attention_mask = encoding['attention_mask'].to(device)
        
        # 예측
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
        # 표준 입력에서 텍스트 읽기 (바이너리 모드)
        try:
            input_bytes = sys.stdin.buffer.read()
        except AttributeError:
            input_bytes = sys.stdin.read().encode('utf-8')
        
        # UTF-8 디코딩
        try:
            text = input_bytes.decode('utf-8', errors='replace')
        except Exception as decode_error:
            print(json.dumps({'error': f'입력 디코딩 오류: {str(decode_error)}'}), flush=True, file=sys.stderr)
            sys.exit(1)
        
        # 빈 입력 처리
        text = text.strip() if text else ''
        if not text:
            print(json.dumps({'result': 0}), flush=True)
            return
        
        # 예측 수행
        try:
            pred_result = predict_text(text)
        except Exception as e:
            print(json.dumps({'error': f'예측 오류: {str(e)}'}), flush=True, file=sys.stderr)
            sys.exit(1)
        
        # 결과 출력
        print(json.dumps({'result': pred_result}), flush=True)
        
    except Exception as e:
        error_msg = json.dumps({'error': str(e)})
        print(error_msg, flush=True, file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

