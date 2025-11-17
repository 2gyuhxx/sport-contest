import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import { createHmac, createHash } from 'crypto'
import { URL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * NHN Cloud Object Storage에서 모델 파일 다운로드
 */
export async function downloadModelFromCloud(): Promise<void> {
  const modelPath = path.join(__dirname, '../../models/spam_model_ver1.pth')
  const modelsDir = path.dirname(modelPath)

  // 모델 파일이 이미 존재하면 다운로드 스킵
  if (existsSync(modelPath)) {
    console.log('[모델 다운로드] 모델 파일이 이미 존재합니다.')
    return
  }
  
  console.log('[모델 다운로드] 시작...')

  // 환경 변수 확인 (공백 제거)
  const accessKey = process.env.NHN_CLOUD_ACCESS_KEY?.trim()
  const secretKey = process.env.NHN_CLOUD_SECRET_KEY?.trim()
  const endpoint = process.env.NHN_CLOUD_ENDPOINT // 예: https://kr1-api-objectstorage.nhncloudservice.com
  const bucketName = process.env.NHN_CLOUD_BUCKET_NAME
  const objectKey = process.env.NHN_CLOUD_MODEL_KEY || 'spam_model_ver1.pth'


  if (!endpoint || !bucketName) {
    console.warn('[모델 다운로드] NHN Cloud Object Storage 설정이 없습니다. 환경 변수를 확인해주세요.')
    console.warn('[모델 다운로드] 필요한 환경 변수: NHN_CLOUD_ENDPOINT, NHN_CLOUD_BUCKET_NAME')
    console.warn('[모델 다운로드] 모델 파일이 없으면 스팸 체크 기능이 작동하지 않을 수 있습니다.')
    // 환경 변수가 없어도 에러를 던지지 않고 조용히 실패 (개발 환경에서 모델이 이미 있을 수 있음)
    return
  }

  if (!accessKey || !secretKey) {
    console.warn('[모델 다운로드] NHN Cloud Object Storage 인증 정보가 없습니다.')
    console.warn('[모델 다운로드] .env 파일에 NHN_CLOUD_ACCESS_KEY와 NHN_CLOUD_SECRET_KEY를 추가해주세요.')
    console.warn('[모델 다운로드] 모델 파일이 없으면 스팸 체크 기능이 작동하지 않을 수 있습니다.')
    return
  }

  try {

    // models 디렉토리 생성 (없으면)
    if (!existsSync(modelsDir)) {
      await mkdir(modelsDir, { recursive: true })
    }

    // 엔드포인트에서 리전 추출 (kr1-api-object-storage -> kr1)
    const regionMatch = endpoint.match(/^https?:\/\/(kr\d+)-api-object-storage/)
    const region = regionMatch ? regionMatch[1] : 'kr1'
    
    // URL 구성 (path-style)
    const url = new URL(`${endpoint}/${bucketName}/${objectKey}`)
    
    // 현재 시간 생성 (AWS Signature v4 형식: YYYYMMDDTHHmmssZ)
    const now = new Date()
    const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const dateStamp = amzDate.substring(0, 8)
    
    // 페이로드 해시 계산 (GET 요청은 빈 페이로드)
    const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // 빈 문자열의 SHA256
    
    // 필수 헤더 포함
    const headers: Record<string, string> = {
      'Host': url.hostname,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash, // NHN Cloud가 요구하는 헤더
    }
    
    // Canonical Request 생성
    const canonicalUri = url.pathname
    const canonicalQuerystring = ''
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}\n`)
      .join('')
    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';')
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')
    
    // String to Sign 생성
    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
    const canonicalRequestHash = createHash('sha256').update(canonicalRequest).digest('hex')
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join('\n')
    
    // 서명 생성 (HMAC은 바이너리 키를 사용)
    const kDate = createHmac('sha256', `AWS4${secretKey!}`).update(dateStamp).digest()
    const kRegion = createHmac('sha256', kDate).update(region).digest()
    const kService = createHmac('sha256', kRegion).update('s3').digest()
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest()
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')
    
    // Authorization 헤더 생성
    const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    headers['Authorization'] = authorization
    
    // HTTPS 요청
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      let responseReceived = false
      
      const req = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'GET',
        headers: headers,
      }, (res) => {
        responseReceived = true
        
        if (res.statusCode !== 200) {
          let errorBody = ''
          res.on('data', (chunk) => { errorBody += chunk.toString() })
          res.on('end', () => {
            reject(new Error(`HTTP ${res.statusCode}: ${errorBody || res.statusMessage}`))
          })
          return
        }
        
        let totalBytes = 0
        let lastLoggedMB = 0
        res.on('data', (chunk) => {
          chunks.push(chunk)
          totalBytes += chunk.length
          const currentMB = Math.floor(totalBytes / (1024 * 1024))
          // 50MB마다 한 번만 로그 출력
          if (currentMB >= lastLoggedMB + 50) {
            console.log(`[모델 다운로드] 진행 중: ${currentMB} MB`)
            lastLoggedMB = currentMB
          }
        })
        res.on('end', () => {
          const finalBuffer = Buffer.concat(chunks)
          const finalMB = (finalBuffer.length / 1024 / 1024).toFixed(2)
          console.log(`[모델 다운로드] ✅ 완료: ${finalMB} MB`)
          resolve(finalBuffer)
        })
      })
      
      req.on('error', (error) => {
        reject(error)
      })
      
      req.setTimeout(60000, () => {
        if (!responseReceived) {
          req.destroy()
          reject(new Error('요청 타임아웃'))
        }
      })
      
      req.end()
    })

    await writeFile(modelPath, buffer)
  } catch (error) {
    console.error('[모델 다운로드] ❌ 실패:', error instanceof Error ? error.message : String(error))
    return
  }
}

