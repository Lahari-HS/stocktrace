import express from 'express';
import {
  getSystemStock,
  previewCount,
  postCount,
  getCounts,
  getCountById,
} from '../controllers/countController.js';

const router = express.Router();

router.get('/system-stock', getSystemStock);
router.post('/preview', previewCount);
router.post('/post', postCount);
router.get('/', getCounts);
router.get('/:id', getCountById);

export default router;
