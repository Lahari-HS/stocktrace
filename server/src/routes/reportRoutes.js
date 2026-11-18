import express from 'express';
import {
  getDashboardSummary,
  getReports,
  exportReportsCSV,
} from '../controllers/reportController.js';

const router = express.Router();

router.get('/dashboard', getDashboardSummary);
router.get('/summary', getReports);
router.get('/export-csv', exportReportsCSV);

export default router;
