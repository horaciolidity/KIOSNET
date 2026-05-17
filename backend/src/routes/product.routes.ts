import { Router } from 'express';
import { getProducts, createProduct, updateStock, updateProduct, deleteProduct } from '../controllers/product.controller';

const router = Router();

router.get('/', getProducts);
router.post('/', createProduct);
router.patch('/:id/stock', updateStock);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
