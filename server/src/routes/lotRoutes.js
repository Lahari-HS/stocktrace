import express from 'express';
import { createRestockLot, updateLotDate } from '../controllers/lotController.js';

const router = express.Router();

router.post('/restock', createRestockLot);
router.patch('/:id/date', updateLotDate);

export default router;
