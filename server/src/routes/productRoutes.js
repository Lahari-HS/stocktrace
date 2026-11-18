import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  getCategories,
} from '../controllers/productController.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);
router.post('/', createProduct);

export default router;
