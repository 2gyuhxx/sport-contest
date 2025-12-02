import pool from '../config/database.js'
import type { RowDataPacket } from 'mysql2'

export interface SportCategoryRow extends RowDataPacket {
  id: number
  name: string
  description: string | null
  created_at: Date
}

export interface SubSportCategoryRow extends RowDataPacket {
  id: number
  category_name: string
  name: string
}

export class SportCategoryModel {
  /**
   * 모든 대분류 카테고리 가져오기
   * "기타"를 맨 아래로 정렬
   */
  static async findAllCategories(): Promise<SportCategoryRow[]> {
    const [rows] = await pool.execute<SportCategoryRow[]>(
      `SELECT * FROM sport_category 
       ORDER BY 
         CASE WHEN name = '기타' THEN 1 ELSE 0 END,
         name ASC`
    )
    return rows
  }

  /**
   * 특정 대분류에 속한 소분류 카테고리 가져오기
   */
  static async findSubCategoriesByCategoryId(categoryId: number): Promise<SubSportCategoryRow[]> {
    // 먼저 대분류 이름 조회
    const category = await this.findCategoryById(categoryId)
    if (!category) {
      return []
    }

    // 대분류 이름으로 소분류 조회
    const [rows] = await pool.execute<SubSportCategoryRow[]>(
      'SELECT * FROM sub_sport_category WHERE category_name = ? ORDER BY name ASC',
      [category.name]
    )
    return rows
  }

  /**
   * 모든 소분류 카테고리 가져오기
   */
  static async findAllSubCategories(): Promise<SubSportCategoryRow[]> {
    const [rows] = await pool.execute<SubSportCategoryRow[]>(
      'SELECT * FROM sub_sport_category ORDER BY category_name, name ASC'
    )
    return rows
  }

  /**
   * ID로 대분류 카테고리 찾기
   */
  static async findCategoryById(categoryId: number): Promise<SportCategoryRow | null> {
    const [rows] = await pool.execute<SportCategoryRow[]>(
      'SELECT * FROM sport_category WHERE id = ?',
      [categoryId]
    )
    return rows[0] || null
  }

  /**
   * ID로 소분류 카테고리 찾기
   */
  static async findSubCategoryById(subCategoryId: number): Promise<SubSportCategoryRow | null> {
    const [rows] = await pool.execute<SubSportCategoryRow[]>(
      'SELECT * FROM sub_sport_category WHERE id = ?',
      [subCategoryId]
    )
    return rows[0] || null
  }
}

