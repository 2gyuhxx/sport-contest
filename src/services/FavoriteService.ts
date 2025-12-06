import apiRequest from '../config/api'
import type { Favorite } from '../types/favorites'

interface FavoriteResponse {
  success: boolean
  message?: string
  isFavorite?: boolean
  count?: number
  favorites?: Favorite[]
}

export const FavoriteService = {
  /**
   * 찜 추가
   */
  async addFavorite(eventId: number): Promise<FavoriteResponse> {
    try {
      const response = await apiRequest<FavoriteResponse>('/favorites', {
        method: 'POST',
        body: JSON.stringify({ eventId }),
      })
      return response
    } catch (error) {
      console.error('찜 추가 오류:', error)
      throw error
    }
  },

  /**
   * 찜 삭제
   */
  async removeFavorite(eventId: number): Promise<FavoriteResponse> {
    try {
      const response = await apiRequest<FavoriteResponse>(`/favorites/${eventId}`, {
        method: 'DELETE',
      })
      return response
    } catch (error) {
      console.error('찜 삭제 오류:', error)
      throw error
    }
  },

  /**
   * 찜 토글 (추가/삭제)
   */
  async toggleFavorite(eventId: number, isCurrentlyFavorite: boolean): Promise<FavoriteResponse> {
    if (isCurrentlyFavorite) {
      return this.removeFavorite(eventId)
    } else {
      return this.addFavorite(eventId)
    }
  },

  /**
   * 찜 여부 확인
   */
  async checkFavorite(eventId: number): Promise<boolean> {
    try {
      const response = await apiRequest<FavoriteResponse>(`/favorites/check/${eventId}`)
      return response.isFavorite ?? false
    } catch (error) {
      console.error('찜 여부 확인 오류:', error)
      return false
    }
  },

  /**
   * 내 찜 목록 조회
   */
  async getMyFavorites(): Promise<Favorite[]> {
    try {
      const response = await apiRequest<FavoriteResponse>('/favorites')
      return response.favorites || []
    } catch (error) {
      console.error('내 찜 목록 조회 오류:', error)
      throw error
    }
  },

  /**
   * 행사의 찜 개수 조회
   */
  async getFavoriteCount(eventId: number): Promise<number> {
    try {
      const response = await apiRequest<FavoriteResponse>(`/favorites/count/${eventId}`)
      return response.count ?? 0
    } catch (error) {
      console.error('찜 개수 조회 오류:', error)
      return 0
    }
  },

  /**
   * 사용자-종목 선호도 행렬 조회 (코사인 유사도 계산용)
   */
  async getUserSportMatrix(): Promise<{
    matrix: { [userId: string]: { [sport: string]: number } }
    users: number[]
    sports: string[]
  }> {
    try {
      const response = await apiRequest<{
        success: boolean
        matrix: { [userId: string]: { [sport: string]: number } }
        users: number[]
        sports: string[]
      }>('/favorites/matrix')
      return {
        matrix: response.matrix,
        users: response.users,
        sports: response.sports,
      }
    } catch (error) {
      console.error('사용자-종목 행렬 조회 오류:', error)
      throw error
    }
  },
}

