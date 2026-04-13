const express = require('express');
const router = express.Router();
const PrismaClient = require('@prisma/client').PrismaClient;
const prisma = new PrismaClient();

//get programs with cources
router.get('/',async (req,res) =>{
    try{
        const programs = await prisma.program.findMany({
            orderBy: {createdAt:'asc'},
            include : {
                courses:{orderBy:{createdAt:'asc'}}
            }
        });
    res.json(programs);
    }catch{
    res.status(500).json({message:'failed to fetch programs'});
    }
});
// CREATE program
router.post('/', async (req, res) => {
  try {
    const { name, details } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const created = await prisma.program.create({
      data: { name, details: details || null }
    });
    res.status(201).json(created);
  } catch {
    res.status(500).json({ message: 'Failed to create program' });
  }
});
// CREATE course under a program
router.post('/:programId/courses', async (req, res) => {
  try {
    const programId = Number(req.params.programId);
    const { title, details, isFree } = req.body;

    if (!title) return res.status(400).json({ message: 'title is required' });

    const created = await prisma.course.create({
      data: {
        title,
        details: details || null,
        isFree: Boolean(isFree),
        programId
      }
    });

    res.status(201).json(created);
  } catch {
    res.status(500).json({ message: 'Failed to create course' });
  }
});

module.exports = router;
