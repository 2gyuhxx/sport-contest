import { Router } from 'express'
import { SportCategoryModel } from '../models/SportCategory.js'

const router = Router()

/**
 * 모든 대분류 카테고리 가져오기
 */
router.get('/sport-categories', async (req, res) => {
  try {
    const categories = await SportCategoryModel.findAllCategories()
    res.json({ categories })
  } catch (error: any) {
    console.error('대분류 카테고리 조회 오류:', error)
    res.status(500).json({ error: '대분류 카테고리 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 특정 대분류의 소분류 카테고리 가져오기
 */
router.get('/sport-categories/:categoryId/sub-categories', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10)
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: '유효하지 않은 카테고리 ID입니다' })
    }

    const subCategories = await SportCategoryModel.findSubCategoriesByCategoryId(categoryId)
    res.json({ subCategories })
  } catch (error: any) {
    console.error('소분류 카테고리 조회 오류:', error)
    res.status(500).json({ error: '소분류 카테고리 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 모든 소분류 카테고리 가져오기
 */
router.get('/sub-sport-categories', async (req, res) => {
  try {
    const subCategories = await SportCategoryModel.findAllSubCategories()
    res.json({ subCategories })
  } catch (error: any) {
    console.error('모든 소분류 카테고리 조회 오류:', error)
    res.status(500).json({ error: '소분류 카테고리 조회 중 오류가 발생했습니다' })
  }
})

export default router

