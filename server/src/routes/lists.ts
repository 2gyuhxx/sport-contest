import express from 'express'
import pool from '../config/database.js'
import { RowDataPacket } from 'mysql2'

const router = express.Router()

/**
 * 스포츠 종목 목록 가져오기
 */
router.get('/sport-categories', async (req, res) => {
  try {
    const [rows] = await pool.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM sport_category ORDER BY name'
    )
    const categories = rows.map(row => row.name)
    res.json({ categories })
  } catch (error: any) {
    console.error('스포츠 종목 조회 오류:', error)
    res.status(500).json({ error: '스포츠 종목 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 광역자치단체(지역) 목록 가져오기
 */
router.get('/regions', async (req, res) => {
  try {
    const [rows] = await pool.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM region_list ORDER BY name'
    )
    const regions = rows.map(row => row.name)
    res.json({ regions })
  } catch (error: any) {
    console.error('지역 목록 조회 오류:', error)
    res.status(500).json({ error: '지역 목록 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 기초자치단체(시군구) 목록 가져오기
 * region_name 쿼리 파라미터로 필터링
 */
router.get('/sub-regions', async (req, res) => {
  try {
    const { region_name } = req.query

    if (!region_name) {
      return res.status(400).json({ error: 'region_name 파라미터가 필요합니다' })
    }

    const [rows] = await pool.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM sub_region_list WHERE region_name = ? ORDER BY name',
      [region_name]
    )
    const subRegions = rows.map(row => row.name)
    res.json({ subRegions })
  } catch (error: any) {
    console.error('시군구 목록 조회 오류:', error)
    res.status(500).json({ error: '시군구 목록 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 스포츠 소분류 목록 가져오기
 * category_name 쿼리 파라미터로 필터링
 */
router.get('/sub-sport-categories', async (req, res) => {
  try {
    const { category_name } = req.query
    if (!category_name) {
      return res.status(400).json({ error: 'category_name 파라미터가 필요합니다' })
    }
    const [rows] = await pool.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM sub_sport_category WHERE category_name = ? ORDER BY name',
      [category_name]
    )
    const subCategories = rows.map(row => row.name)
    res.json({ subCategories })
  } catch (error: any) {
    console.error('스포츠 소분류 조회 오류:', error)
    res.status(500).json({ error: '스포츠 소분류 조회 중 오류가 발생했습니다' })
  }
})

export default router

