import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 단일 텍스트에 대한 스팸 체크 (Python 프로세스 실행) - 타임아웃 포함
 */
async function checkSingleText(text: string, timeout: number = 600000): Promise<number> {
  return new Promise((resolve, reject) => {
    let isResolved = false
    let timeoutId: NodeJS.Timeout

    const safeResolve = (value: number) => {
      if (!isResolved) {
        isResolved = true
        if (timeoutId) clearTimeout(timeoutId)
        resolve(value)
      }
    }

    const safeReject = (error: Error) => {
      if (!isResolved) {
        isResolved = true
        if (timeoutId) clearTimeout(timeoutId)
        reject(error)
      }
    }

    try {
      const scriptPath = path.join(__dirname, '../../scripts/spam_check_single.py')
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      
      const pythonProcess = spawn(pythonCmd, ['-u', scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      })

      // 타임아웃 설정
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          console.error(`[스팸 체크] 타임아웃 (${timeout}ms 초과)`)
          pythonProcess.kill('SIGTERM')
          safeReject(new Error(`스팸 체크 타임아웃 (${timeout}ms 초과)`))
        }
      }, timeout)

      let stdout = ''
      let stderr = ''

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        console.log('[스팸 체크 stdout]:', output.trim())
      })

      pythonProcess.stderr.on('data', (data) => {
        const errorData = data.toString()
        stderr += errorData
        
        // JSON 형식의 info 메시지 파싱 및 표시
        const lines = errorData.split('\n').filter(line => line.trim())
        for (const line of lines) {
          try {
            // JSON 형식인지 확인
            if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
              const jsonData = JSON.parse(line.trim())
              if (jsonData.info) {
                // info 메시지는 일반 로그로 출력
                console.log(`[스팸 모델] ${jsonData.info}`)
              } else if (jsonData.error) {
                // error 메시지는 에러 로그로 출력
                console.error(`[스팸 모델] ${jsonData.error}`)
              } else if (jsonData.warning) {
                // warning 메시지는 경고 로그로 출력
                console.warn(`[스팸 모델] ${jsonData.warning}`)
              }
            } else {
              // JSON 형식이 아니고 경고 메시지가 아니면 출력
              if (!line.includes('Some weights') && !line.includes('You should probably TRAIN') && line.trim()) {
                console.log(`[스팸 모델] ${line.trim()}`)
              }
            }
          } catch (e) {
            // JSON 파싱 실패 시 일반 메시지로 출력 (경고 메시지 제외)
            if (!line.includes('Some weights') && !line.includes('You should probably TRAIN') && line.trim()) {
              console.log(`[스팸 모델] ${line.trim()}`)
            }
          }
        }
      })

      // 텍스트 정규화 및 전송
      const textToSend = (text && typeof text === 'string') ? text.trim() : ''
      console.log('[스팸 체크] Python 프로세스에 텍스트 전송:', textToSend.substring(0, 100))
      pythonProcess.stdin.write(textToSend, 'utf8')
      pythonProcess.stdin.end()

      pythonProcess.on('close', (code) => {
        if (isResolved) return

        console.log('[스팸 체크] Python 프로세스 종료, 코드:', code)

        // stderr에서 JSON 에러 찾기
        const jsonErrorMatch = stderr.match(/\{"error":\s*"[^"]+"\}/g)
        if (jsonErrorMatch) {
          try {
            const lastErrorJson = jsonErrorMatch[jsonErrorMatch.length - 1]
            const errorData = JSON.parse(lastErrorJson)
            safeReject(new Error(`스팸 체크 오류: ${errorData.error}`))
            return
          } catch (e) {
            // JSON 파싱 실패 시 계속 진행
          }
        }

        if (code !== 0) {
          safeReject(new Error(`스팸 체크 스크립트 오류 (코드 ${code})`))
          return
        }

        if (!stdout.trim()) {
          safeReject(new Error('스팸 체크 결과가 비어있습니다'))
          return
        }

        try {
          console.log('[스팸 체크] stdout 파싱 시도:', stdout.trim())
          const result = JSON.parse(stdout.trim())
          if (result.error) {
            safeReject(new Error(`스팸 체크 오류: ${result.error}`))
            return
          }
          // result는 0 (정상) 또는 1 (스팸)
          console.log('[스팸 체크] 파싱 결과:', result)
          safeResolve(result.result === 1 ? 1 : 0)
        } catch (parseError) {
          safeReject(new Error(`스팸 체크 결과 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}`))
        }
      })

      pythonProcess.on('error', (error) => {
        safeReject(new Error(`스팸 체크 프로세스 실행 실패: ${error.message}`))
      })
    } catch (error) {
      safeReject(new Error(`스팸 체크 초기화 실패: ${error instanceof Error ? error.message : String(error)}`))
    }
  })
}

/**
 * 스팸 필터링 함수
 * title과 description을 각각 별도로 체크
 * title이 스팸이면 즉시 스팸으로 판정 (description 체크 생략)
 * @param title 행사 제목
 * @param description 행사 설명
 * @returns true면 스팸, false면 정상
 */
export async function checkSpam(title: string, description: string): Promise<boolean> {
  try {
    // title 먼저 체크
    const titleResult = await checkSingleText(title || '')
    console.log(`[스팸 체크] title 판정: ${titleResult === 1 ? '스팸' : '정상'} - "${title?.substring(0, 50)}${title && title.length > 50 ? '...' : ''}"`)
    
    // title이 스팸이면 즉시 스팸으로 판정 (description 체크 생략)
    if (titleResult === 1) {
      console.log(`[스팸 체크] 최종 판정: 스팸 (title에서 스팸 판정, description 체크 생략)`)
      return true
    }
    
    // title이 정상이면 description 체크
    const descriptionResult = await checkSingleText(description || '')
    console.log(`[스팸 체크] description 판정: ${descriptionResult === 1 ? '스팸' : '정상'} - "${description?.substring(0, 50)}${description && description.length > 50 ? '...' : ''}"`)
    
    // 둘 다 0이면 정상(스팸 아님), 그 외에는 스팸
    const isSpam = descriptionResult === 1
    console.log(`[스팸 체크] 최종 판정: ${isSpam ? '스팸' : '정상'}`)
    return isSpam
  } catch (error) {
    console.error('[스팸 체크] 오류:', error)
    throw error
  }
}

