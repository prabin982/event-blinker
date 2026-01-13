const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const authMiddleware = require("../middleware/auth")

const router = express.Router()

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
    filename: (req, file, cb) => {
      // Generate unique filename with timestamp
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      const ext = path.extname(file.originalname)
      // Check if it's a license photo
      const prefix = file.fieldname === "license_photo" ? "license" : "event"
      cb(null, `${prefix}-${uniqueSuffix}${ext}`)
    },
})

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (extname && mimetype) {
    cb(null, true)
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"), false)
  }
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
})

// Upload image endpoint (requires auth)
router.post("/image", authMiddleware, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" })
    }

    // Return the full URL to access the uploaded file
    const baseUrl = `${req.protocol}://${req.get("host")}`
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`
    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
    })
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({ error: error.message || "Failed to upload image" })
  }
})

// Upload license photo endpoint (requires auth)
router.post("/license", authMiddleware, upload.single("license_photo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No license photo provided" })
    }

    // Return the full URL to access the uploaded file
    const baseUrl = `${req.protocol}://${req.get("host")}`
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`
    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
    })
  } catch (error) {
    console.error("License upload error:", error)
    res.status(500).json({ error: error.message || "Failed to upload license photo" })
  }
})

module.exports = router
