import express from 'express';
import {
  createBill,
  getBills,
  getBillById,
  returnBillItem,
} from '../controllers/billController.js';

const router = express.Router();

router.post('/', createBill);
router.get('/', getBills);
router.get('/:id', getBillById);
router.post('/:id/return', returnBillItem);

export default router;
