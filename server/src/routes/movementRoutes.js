import express from 'express';
import {
  getMovements,
  createTransfer,
  createAdjustment,
} from '../controllers/movementController.js';

const router = express.Router();

router.get('/', getMovements);
router.post('/transfer', createTransfer);
router.post('/adjustment', createAdjustment);

export default router;
