import axios from 'axios'
import fs from 'fs'

const IDENTITY_URL = 'https://api-identity-infrastructure.nhncloudservice.com/v2.0/tokens'
const OBJECT_STORAGE_BASE_URL = 'https://kr1-api-object-storage.nhncloudservice.com/v1/AUTH_691dba506e2740d8bcfca8bca5f8ecc9/sport-contest/photo/'


/**
 * NHN Cloud Object Storage 인증 토큰 발급
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const tenantId = process.env.OBJECT_STORAGE_TENANT_ID
    const username = process.env.OBJECT_STORAGE_USERNAME
    const password = process.env.OBJECT_STORAGE_PASSWORD

    if (!tenantId) {
      console.error('OBJECT_STORAGE_TENANT_ID가 설정되지 않았습니다.')
      return null
    }
    if (!username) {
      console.error('OBJECT_STORAGE_USERNAME이 설정되지 않았습니다.')
      return null
    }
    if (!password) {
      console.error('OBJECT_STORAGE_PASSWORD이 설정되지 않았습니다.')
      return null
    }

    const requestBody = {
      auth: {
        tenantId: tenantId,
        passwordCredentials: {
          username: username,
          password: password,
        },
      },
    }

    console.log('[Object Storage] 토큰 발급 요청:')
    console.log(`  URL: ${IDENTITY_URL}`)
    console.log(`  Tenant ID: ${tenantId}`)
    console.log(`  Username: ${username}`)
    console.log(`  Password: ${password ? '***' : '(없음)'}`)

    const response = await axios.post(IDENTITY_URL, requestBody, {
      headers: { 'Content-Type': 'application/json' },
    })

    console.log('[Object Storage] 응답 상태:', response.status)
    console.log('[Object Storage] 응답 헤더:', JSON.stringify(response.headers, null, 2))

    const tokenId = response.data?.access?.token?.id
    if (tokenId) {
      console.log('[Object Storage] 인증 토큰 발급 성공')
      return tokenId
    } else {
      console.error('[Object Storage] 토큰 ID를 찾을 수 없습니다.')
      console.error('응답 데이터:', JSON.stringify(response.data, null, 2))
      console.error('응답 데이터 구조:', {
        hasAccess: !!response.data?.access,
        hasToken: !!response.data?.access?.token,
        hasId: !!response.data?.access?.token?.id,
      })
    }
  } catch (authError: any) {
    console.error('[Object Storage] 인증 토큰 발급 실패:', authError.message)
    if (authError.response) {
      console.error('인증 응답 상태:', authError.response.status)
      console.error('인증 응답 헤더:', JSON.stringify(authError.response.headers, null, 2))
      console.error('인증 응답 데이터:', JSON.stringify(authError.response.data, null, 2))
    } else if (authError.request) {
      console.error('요청은 전송되었지만 응답을 받지 못했습니다.')
      console.error('요청 정보:', authError.request)
    } else {
      console.error('요청 설정 중 오류:', authError.message)
    }
  }
  return null
}

/**
 * 파일을 NHN Cloud Object Storage에 업로드
 */
export async function uploadToObjectStorage(filePath: string, fileName: string): Promise<string> {
  try {
    // 파일 읽기
    const fileContent = fs.readFileSync(filePath)
    
    // 인증 토큰 발급
    const authToken = await getAuthToken()
    if (!authToken) {
      throw new Error('인증 토큰 발급에 실패했습니다. .env 파일의 OBJECT_STORAGE_TENANT_ID, OBJECT_STORAGE_USERNAME, OBJECT_STORAGE_PASSWORD를 확인해주세요.')
    }

    // 파일 업로드 URL
    const uploadUrl = `${OBJECT_STORAGE_BASE_URL}${fileName}`

    console.log('[Object Storage] 파일 업로드 시작:', { fileName, uploadUrl })

    // 파일 업로드
    const response = await axios.put(uploadUrl, fileContent, {
      headers: {
        'X-Auth-Token': authToken,
        'Content-Type': 'application/octet-stream',
      },
    })

    console.log('[Object Storage] 파일 업로드 완료:', response.status)

    // 업로드된 파일 URL 반환
    return uploadUrl
  } catch (error: any) {
    console.error('[Object Storage] 파일 업로드 실패:', error.message)
    if (error.response) {
      console.error('업로드 응답 상태:', error.response.status)
      console.error('업로드 응답 데이터:', JSON.stringify(error.response.data, null, 2))
    }
    throw new Error(`파일 업로드 실패: ${error.message}`)
  }
}

