import bcrypt from 'bcrypt'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// .env 파일 경로 설정
dotenv.config({ path: join(__dirname, '../.env') })

// 데이터베이스 연결
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sport_contest',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

// 테스트 계정 목록
// manager 값: 0 = 일반 사용자, 1 = 행사 주최자, 2 = 개발자(master)
const testAccounts = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    name: '관리자',
    manager: 2, // master/개발자: 모든 행사 관리 가능
    sports: ['구기·팀', '레저·환경', '무도·격투'],
  },
  {
    email: 'user1@test.com',
    password: 'user123',
    name: '일반사용자1',
    manager: 0, // 일반 사용자: 행사 등록 불가
    sports: ['구기·팀', '라켓·볼'],
  },
  {
    email: 'user2@test.com',
    password: 'user123',
    name: '일반사용자2',
    manager: 0, // 일반 사용자: 행사 등록 불가
    sports: ['레저·환경', '수상·해양'],
  },
  {
    email: 'organizer@test.com',
    password: 'org123',
    name: '행사주최자',
    manager: 1, // 행사 주최자: 자신이 등록한 행사만 관리
    sports: ['체력·기술', '정밀·기술'],
  },
]

async function createOrUpdateAccount(account) {
  const connection = await pool.getConnection()
  
  try {
    await connection.beginTransaction()

    // 기존 사용자 확인
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [account.email]
    )

    let userId

    if (existingUsers.length > 0) {
      // 기존 계정 업데이트
      userId = existingUsers[0].id
      await connection.execute(
        `UPDATE users 
         SET name = ?, manager = ?, is_verified = true, status = 'active',
             sport1 = ?, sport2 = ?, sport3 = ?
         WHERE id = ?`,
        [
          account.name,
          account.manager,
          account.sports[0] || null,
          account.sports[1] || null,
          account.sports[2] || null,
          userId
        ]
      )
      
      // 비밀번호 업데이트
      const passwordHash = await bcrypt.hash(account.password, 10)
      await connection.execute(
        'DELETE FROM user_credentials WHERE user_id = ?',
        [userId]
      )
      await connection.execute(
        'INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)',
        [userId, passwordHash]
      )
    } else {
      // 새 계정 생성
      const [result] = await connection.execute(
        `INSERT INTO users (email, name, manager, status, is_verified, sport1, sport2, sport3) 
         VALUES (?, ?, ?, 'active', true, ?, ?, ?)`,
        [
          account.email,
          account.name,
          account.manager,
          account.sports[0] || null,
          account.sports[1] || null,
          account.sports[2] || null,
        ]
      )

      userId = result.insertId

      // 비밀번호 해시 생성 및 저장
      const passwordHash = await bcrypt.hash(account.password, 10)
      await connection.execute(
        'INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)',
        [userId, passwordHash]
      )
    }

    await connection.commit()
    return { success: true, email: account.email, isNew: existingUsers.length === 0 }
  } catch (error) {
    await connection.rollback()
    return { success: false, email: account.email, error: error.message }
  } finally {
    connection.release()
  }
}

async function createTestAccounts() {
  console.log('🚀 테스트 계정 생성 시작...\n')

  const results = []
  for (const account of testAccounts) {
    const result = await createOrUpdateAccount(account)
    results.push(result)
    
    if (result.success) {
      const action = result.isNew ? '생성' : '업데이트'
      console.log(`✅ ${account.name} (${account.email}) - ${action} 완료`)
    } else {
      console.log(`❌ ${account.email} - 실패: ${result.error}`)
    }
  }

  console.log('\n📋 테스트 계정 목록:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  testAccounts.forEach((account, index) => {
    const result = results[index]
    if (result.success) {
      console.log(`\n${index + 1}. ${account.name}`)
      console.log(`   이메일: ${account.email}`)
      console.log(`   비밀번호: ${account.password}`)
      console.log(`   권한: ${account.manager ? '관리자' : '일반 사용자'}`)
      console.log(`   관심 종목: ${account.sports.join(', ')}`)
    }
  })
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n💡 테스트 페이지: http://wherehani.com/dev/test')
  console.log('💡 이 계정들로 모든 기능을 테스트할 수 있습니다!')
}

createTestAccounts()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 오류 발생:', error)
    process.exit(1)
  })

