import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'
import { uploadToObjectStorage } from '../utils/objectStorage.js'

const router = express.Router()

// 임시 업로드 디렉토리 생성
const tempUploadDir = path.join(process.cwd(), 'temp-uploads')
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true })
}

// multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

// 파일 필터: 이미지 파일만 허용
const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  const ext = path.extname(file.originalname).toLowerCase()
  if (allowedExtensions.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error(`허용되지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다. (JPG, PNG, GIF, WEBP)`))
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

/**
 * 파일 업로드
 */
router.post('/', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다' })
    }

    const filePath = req.file.path
    let fileName = req.file.filename

    // eventId가 쿼리 파라미터로 전달되면 이미지 이름을 {eventId}{확장자} 형식으로 변경
    const eventId = req.query.eventId ? String(req.query.eventId) : null
    if (eventId) {
      const ext = path.extname(req.file.originalname).toLowerCase()
      fileName = `${eventId}${ext}`
    }

    try {
      console.log('[파일 업로드] Object Storage 업로드 시작:', { fileName, eventId })
      const fileUrl = await uploadToObjectStorage(filePath, fileName)
      console.log('[파일 업로드] Object Storage 업로드 완료, URL:', fileUrl)
      
      // 임시 파일 삭제
      fs.unlinkSync(filePath)
      
      console.log('[파일 업로드] 응답 전송:', { url: fileUrl, fileName })
      res.json({
        url: fileUrl,
        fileName: fileName,
        originalName: req.file.originalname,
      })
    } catch (uploadError: any) {
      // 업로드 실패 시 임시 파일 삭제
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      console.error('[파일 업로드] Object Storage 업로드 실패:', uploadError)
      throw uploadError
    }
  } catch (error: any) {
    console.error('[파일 업로드] 오류:', error)
    res.status(500).json({ 
      error: error.message || '파일 업로드에 실패했습니다' 
    })
  }
})

export default router

