#!/usr/bin/env python3
"""
스팸 필터링 스크립트 (단일 텍스트용)
하나의 텍스트만 받아서 스팸 여부를 판단합니다.
"""
import sys
import json
import os
import torch
import urllib.request
import ssl
import tempfile
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# 설정
MODEL_NAME = "klue/roberta-base"
MAX_LEN = 512

# 클라우드 스토리지 URL
MODEL_TITLE_URL = "https://kr1-api-object-storage.nhncloudservice.com/v1/AUTH_691dba506e2740d8bcfca8bca5f8ecc9/sport-contest/model/spam_model_title.pth"
MODEL_DESCRIBE_URL = "https://kr1-api-object-storage.nhncloudservice.com/v1/AUTH_691dba506e2740d8bcfca8bca5f8ecc9/sport-contest/model/spam_model_describe.pth"

# 로컬 캐시 디렉토리
CACHE_DIR = Path(tempfile.gettempdir()) / 'sport-contest-models'
CACHE_DIR.mkdir(parents=True, exist_ok=True)
MODEL_TITLE_PATH = CACHE_DIR / 'spam_model_title.pth'
MODEL_DESCRIBE_PATH = CACHE_DIR / 'spam_model_describe.pth'

# CPU 모드 강제 (메모리 부족 방지)
device = torch.device("cpu")

# 메모리 최적화 설정
torch.set_num_threads(1)  # 단일 스레드 사용
if hasattr(torch, 'set_num_interop_threads'):
    torch.set_num_interop_threads(1)

# 전역 변수로 모델과 토크나이저 저장 (한 번만 로드)
_model_title = None
_model_describe = None
_tokenizer = None

def download_and_cache_model(model_url, cache_path, model_name):
    """오브젝트 스토리지에서 모델을 다운로드하고 로컬에 캐싱"""
    try:
        # 이미 캐시된 파일이 있으면 그것을 사용
        if cache_path.exists():
            print(json.dumps({'info': f'{model_name} 모델 캐시에서 로딩 중...'}), file=sys.stderr, flush=True)
            loaded_data = torch.load(cache_path, map_location='cpu')
            print(json.dumps({'info': f'{model_name} 모델 캐시 로딩 완료'}), file=sys.stderr, flush=True)
            return loaded_data
        
        # 캐시가 없으면 다운로드
        print(json.dumps({'info': f'{model_name} 모델 다운로드 중... (최초 1회)'}), file=sys.stderr, flush=True)
        
        # SSL 인증서 검증 우회
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        # urlopen으로 다운로드 (context 매개변수 호환성 문제 해결)
        with urllib.request.urlopen(model_url, context=ssl_context) as response:
            # 파일 크기 확인
            file_size = response.headers.get('Content-Length')
            if file_size:
                file_size_mb = int(file_size) / (1024 * 1024)
                print(json.dumps({'info': f'{model_name} 모델 크기: {file_size_mb:.2f} MB'}), file=sys.stderr, flush=True)
            
            # 청크 단위로 다운로드 (진행 상황 표시)
            chunk_size = 8192  # 8KB
            downloaded = 0
            chunks = []
            
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                chunks.append(chunk)
                downloaded += len(chunk)
                
                # 10MB마다 진행 상황 출력
                if downloaded % (10 * 1024 * 1024) < chunk_size:
                    downloaded_mb = downloaded / (1024 * 1024)
                    print(json.dumps({'info': f'{model_name} 다운로드 진행: {downloaded_mb:.2f} MB'}), file=sys.stderr, flush=True)
            
            model_data = b''.join(chunks)
            print(json.dumps({'info': f'{model_name} 다운로드 완료: {downloaded / (1024 * 1024):.2f} MB'}), file=sys.stderr, flush=True)
        
        # 파일로 저장
        print(json.dumps({'info': f'{model_name} 파일 저장 중...'}), file=sys.stderr, flush=True)
        with open(cache_path, 'wb') as f:
            f.write(model_data)
        print(json.dumps({'info': f'{model_name} 파일 저장 완료'}), file=sys.stderr, flush=True)
        
        # 다운로드한 파일 로드
        loaded_data = torch.load(cache_path, map_location='cpu')
        
        print(json.dumps({'info': f'{model_name} 모델 다운로드 및 캐싱 완료'}), file=sys.stderr, flush=True)
        return loaded_data
        
    except Exception as e:
        error_msg = f'{model_name} 모델 로드 오류: {str(e)}'
        print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
        raise Exception(error_msg)

def load_model_and_tokenizer():
    """모델과 토크나이저 로드"""
    global _model_title, _model_describe, _tokenizer
    
    if _model_title is not None and _model_describe is not None and _tokenizer is not None:
        return _model_title, _model_describe, _tokenizer
    
    try:
        
        # 토크나이저 로드
        try:
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        except Exception as tokenizer_error:
            error_msg = f'토크나이저 로드 오류: {str(tokenizer_error)}'
            print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
            sys.exit(1)
        
        # Title 모델 로드 (로컬 캐시 사용)
        try:
            loaded_data = download_and_cache_model(MODEL_TITLE_URL, MODEL_TITLE_PATH, 'Title')
            
            if isinstance(loaded_data, dict):
                # state_dict 방식
                _model_title = AutoModelForSequenceClassification.from_pretrained(
                    MODEL_NAME, 
                    num_labels=2
                )
                _model_title.load_state_dict(loaded_data)
            else:
                # 전체 모델 방식
                _model_title = loaded_data
                
            _model_title.to(device)
            _model_title.eval()
        except Exception as e:
            error_msg = f'Title 모델 로드 오류: {str(e)}'
            print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
            sys.exit(1)
        
        # Describe 모델 로드 (로컬 캐시 사용)
        try:
            loaded_data = download_and_cache_model(MODEL_DESCRIBE_URL, MODEL_DESCRIBE_PATH, 'Describe')
            
            if isinstance(loaded_data, dict):
                # state_dict 방식
                _model_describe = AutoModelForSequenceClassification.from_pretrained(
                    MODEL_NAME, 
                    num_labels=2
                )
                _model_describe.load_state_dict(loaded_data)
            else:
                # 전체 모델 방식
                _model_describe = loaded_data
                
            _model_describe.to(device)
            _model_describe.eval()
        except Exception as e:
            error_msg = f'Describe 모델 로드 오류: {str(e)}'
            print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
            sys.exit(1)
        
        # 메모리 정리
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        
        return _model_title, _model_describe, _tokenizer
    except Exception as e:
        error_msg = f'모델/토크나이저 로드 오류: {str(e)}'
        print(json.dumps({'error': error_msg}), file=sys.stderr, flush=True)
        sys.exit(1)

def predict_text(text, model_type='title'):
    """
    텍스트를 모델에 적용하여 예측
    model_type: 'title' 또는 'describe'
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
        
        print(json.dumps({'debug': f'{model_type} 모델 로드 중...'}), file=sys.stderr, flush=True)
        model_title, model_describe, tokenizer = load_model_and_tokenizer()
        print(json.dumps({'debug': f'{model_type} 모델 로드 완료'}), file=sys.stderr, flush=True)
        
        # 사용할 모델 선택
        model = model_title if model_type == 'title' else model_describe
        
        print(json.dumps({'debug': f'{model_type} 토크나이징 시작...'}), file=sys.stderr, flush=True)
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
            print(json.dumps({'debug': f'{model_type} 토크나이징 완료'}), file=sys.stderr, flush=True)
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
        print(json.dumps({'debug': f'{model_type} 텐서 변환 중...'}), file=sys.stderr, flush=True)
        input_ids = encoding['input_ids'].to(device)
        attention_mask = encoding['attention_mask'].to(device)
        print(json.dumps({'debug': f'{model_type} 텐서 변환 완료'}), file=sys.stderr, flush=True)
        
        # 예측
        print(json.dumps({'debug': f'{model_type} 모델 예측 시작...'}), file=sys.stderr, flush=True)
        with torch.no_grad():
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            logits = outputs.logits
            pred = torch.argmax(logits, dim=1).item()
        print(json.dumps({'debug': f'{model_type} 모델 예측 완료, 결과: {pred}'}), file=sys.stderr, flush=True)
        
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
        # 표준 입력에서 JSON 읽기 (바이너리 모드)
        try:
            input_bytes = sys.stdin.buffer.read()
        except AttributeError:
            input_bytes = sys.stdin.read().encode('utf-8')
        
        # UTF-8 디코딩
        try:
            input_text = input_bytes.decode('utf-8', errors='replace')
        except Exception as decode_error:
            print(json.dumps({'error': f'입력 디코딩 오류: {str(decode_error)}'}), flush=True, file=sys.stderr)
            sys.exit(1)
        
        # JSON 파싱
        try:
            input_data = json.loads(input_text)
            title = input_data.get('title', '').strip()
            description = input_data.get('description', '').strip()
            
            # 디버깅: 입력 데이터 로그
            print(json.dumps({
                'debug': '입력 데이터 수신',
                'title_length': len(title),
                'description_length': len(description),
                'title_preview': title[:50] if title else '(비어있음)',
                'description_preview': description[:50] if description else '(비어있음)'
            }), file=sys.stderr, flush=True)
            
        except json.JSONDecodeError:
            # JSON이 아니면 기존 방식 (단일 텍스트)으로 처리
            text = input_text.strip()
            print(json.dumps({'debug': '단일 텍스트 모드 (JSON 아님)'}), file=sys.stderr, flush=True)
            if not text:
                print(json.dumps({'result': 0}), flush=True)
                return
            pred_result = predict_text(text, 'title')
            print(json.dumps({'debug': f'단일 텍스트 결과: {pred_result}'}), file=sys.stderr, flush=True)
            print(json.dumps({'result': pred_result}), flush=True)
            return
        
        # title 예측
        title_result = 0
        if title:
            try:
                print(json.dumps({'debug': 'Title 모델 예측 시작...'}), file=sys.stderr, flush=True)
                title_result = predict_text(title, 'title')
                print(json.dumps({
                    'debug': 'Title 모델 예측 완료',
                    'result': '스팸' if title_result == 1 else '정상',
                    'title_preview': title[:100]
                }), file=sys.stderr, flush=True)
            except Exception as e:
                print(json.dumps({'error': f'Title 예측 오류: {str(e)}'}), flush=True, file=sys.stderr)
                sys.exit(1)
        else:
            print(json.dumps({'debug': 'Title이 비어있음 - 스킵'}), file=sys.stderr, flush=True)
        
        # title이 스팸이면 즉시 스팸으로 판정
        if title_result == 1:
            print(json.dumps({
                'debug': '최종 판정: 스팸 (Title에서 스팸 판정, Description 체크 생략)'
            }), file=sys.stderr, flush=True)
            print(json.dumps({'result': 1}), flush=True)
            return
        
        # description 예측
        description_result = 0
        if description:
            try:
                print(json.dumps({'debug': 'Description 모델 예측 시작...'}), file=sys.stderr, flush=True)
                description_result = predict_text(description, 'describe')
                print(json.dumps({
                    'debug': 'Description 모델 예측 완료',
                    'result': '스팸' if description_result == 1 else '정상',
                    'description_preview': description[:100]
                }), file=sys.stderr, flush=True)
            except Exception as e:
                print(json.dumps({'error': f'Description 예측 오류: {str(e)}'}), flush=True, file=sys.stderr)
                sys.exit(1)
        else:
            print(json.dumps({'debug': 'Description이 비어있음 - 스킵'}), file=sys.stderr, flush=True)
        
        # 최종 결과 (둘 중 하나라도 스팸이면 스팸)
        final_result = 1 if (title_result == 1 or description_result == 1) else 0
        print(json.dumps({
            'debug': '최종 판정 완료',
            'title_result': '스팸' if title_result == 1 else '정상',
            'description_result': '스팸' if description_result == 1 else '정상',
            'final_result': '스팸' if final_result == 1 else '정상'
        }), file=sys.stderr, flush=True)
        print(json.dumps({'result': final_result}), flush=True)
        
    except Exception as e:
        error_msg = json.dumps({'error': str(e)})
        print(error_msg, flush=True, file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

