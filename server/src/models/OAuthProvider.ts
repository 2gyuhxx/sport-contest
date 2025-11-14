import pool from '../config/database.js'

export interface OAuthProviderRow {
  id: number
  name: string
  display_name: string | null
  is_active: boolean
  created_at: Date
}

export class OAuthProviderModel {
  /**
   * 이름으로 OAuth Provider 찾기
   */
  static async findByName(name: string): Promise<OAuthProviderRow | null> {
    const [rows] = await pool.execute<OAuthProviderRow[]>(
      'SELECT * FROM oauth_providers WHERE name = ? AND is_active = true',
      [name]
    )
    return rows.length > 0 ? rows[0] : null
  }

  /**
   * OAuth Provider 생성 또는 가져오기
   */
  static async findOrCreate(name: string, displayName: string): Promise<OAuthProviderRow> {
    let provider = await this.findByName(name)
    
    if (!provider) {
      const [result] = await pool.execute(
        'INSERT INTO oauth_providers (name, display_name, is_active) VALUES (?, ?, true)',
        [name, displayName]
      )
      const insertResult = result as { insertId: number }
      const [rows] = await pool.execute<OAuthProviderRow[]>(
        'SELECT * FROM oauth_providers WHERE id = ?',
        [insertResult.insertId]
      )
      provider = rows[0]
    }
    
    return provider!
  }
}

