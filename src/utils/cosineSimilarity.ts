/**
 * 두 벡터 간의 코사인 유사도 계산
 * @param vecA 벡터 A
 * @param vecB 벡터 B
 * @returns 코사인 유사도 (0 ~ 1)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('벡터의 길이가 같아야 합니다')
  }

  // 내적 (dot product)
  let dotProduct = 0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
  }

  // 벡터 A의 크기
  let magnitudeA = 0
  for (let i = 0; i < vecA.length; i++) {
    magnitudeA += vecA[i] * vecA[i]
  }
  magnitudeA = Math.sqrt(magnitudeA)

  // 벡터 B의 크기
  let magnitudeB = 0
  for (let i = 0; i < vecB.length; i++) {
    magnitudeB += vecB[i] * vecB[i]
  }
  magnitudeB = Math.sqrt(magnitudeB)

  // 코사인 유사도 = 내적 / (크기A * 크기B)
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  return dotProduct / (magnitudeA * magnitudeB)
}

/**
 * 사용자 간 코사인 유사도를 기반으로 가장 유사한 사용자 찾기
 * @param targetUserId 대상 사용자 ID
 * @param matrix 사용자-종목 선호도 행렬
 * @param users 사용자 ID 목록
 * @param sports 종목 목록
 * @param topN 상위 N명의 유사 사용자 반환
 * @returns 유사한 사용자 ID와 유사도 배열
 */
export function findSimilarUsers(
  targetUserId: number,
  matrix: { [userId: string]: { [sport: string]: number } },
  users: number[],
  sports: string[],
  topN: number = 5
): Array<{ userId: number; similarity: number }> {
  const targetVector = sports.map(sport => matrix[targetUserId]?.[sport] || 0)
  
  const similarities = users
    .filter(userId => userId !== targetUserId) // 자기 자신 제외
    .map(userId => {
      const userVector = sports.map(sport => matrix[userId]?.[sport] || 0)
      const similarity = cosineSimilarity(targetVector, userVector)
      return { userId, similarity }
    })
    .filter(item => item.similarity > 0) // 유사도가 0보다 큰 사용자만
    .sort((a, b) => b.similarity - a.similarity) // 유사도 높은 순 정렬
    .slice(0, topN) // 상위 N명

  return similarities
}

/**
 * 유사한 사용자들이 찜한 종목 추천
 * @param similarUsers 유사한 사용자 목록
 * @param matrix 사용자-종목 선호도 행렬
 * @param sports 종목 목록
 * @param myFavoriteSports 내가 이미 찜한 종목 (제외용)
 * @returns 추천 종목과 점수 배열
 */
export function recommendSportsFromSimilarUsers(
  similarUsers: Array<{ userId: number; similarity: number }>,
  matrix: { [userId: string]: { [sport: string]: number } },
  sports: string[],
  myFavoriteSports: string[]
): Array<{ sport: string; score: number }> {
  const sportScores: { [sport: string]: number } = {}

  // 유사한 사용자들이 찜한 종목에 가중치 부여
  similarUsers.forEach(({ userId, similarity }) => {
    sports.forEach(sport => {
      const count = matrix[userId]?.[sport] || 0
      if (count > 0 && !myFavoriteSports.includes(sport)) {
        sportScores[sport] = (sportScores[sport] || 0) + count * similarity
      }
    })
  })

  // 점수 높은 순으로 정렬
  return Object.entries(sportScores)
    .map(([sport, score]) => ({ sport, score }))
    .sort((a, b) => b.score - a.score)
}

