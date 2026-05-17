import { Router } from 'express';
import { getProducts, createProduct, updateStock } from '../controllers/product.controller';

const router = Router();

router.get('/', getProducts);
router.post('/', createProduct);
router.patch('/:id/stock', updateStock);

export default router;
