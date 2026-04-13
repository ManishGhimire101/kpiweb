const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const allowedCategories = new Set(['home', 'about', 'notices', 'staff', 'gallary']);
const uploadRoot = path.join(__dirname, '../../public/uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.params.category;

    if (!allowedCategories.has(category)) {
      return cb(new Error('Invalid category'));
    }

    const dir = path.join(uploadRoot, category);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, '-').toLowerCase();
    cb(null, `${name}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

router.get('/upload/:category', async (req, res) => {
  try {
    const { category } = req.params;

    if (!allowedCategories.has(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    const items = await prisma.upload.findMany({
      where: { category },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch uploads', error: error.message });
  }
});

router.get('/upload', async (req, res) => {
  try {
    const items = await prisma.upload.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch uploads', error: error.message });
  }
});

router.post('/upload/:category', upload.single('image'), async (req, res) => {
  try {
    const { category } = req.params;
    const { title, details } = req.body;

    if (!allowedCategories.has(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const imageUrl = `/uploads/${category}/${req.file.filename}`;

    const item = await prisma.upload.create({
      data: {
        category,
        title: title || null,
        details: details || null,
        imageUrl
      }
    });

    res.status(201).json({ message: 'Image uploaded', item });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

module.exports = router;