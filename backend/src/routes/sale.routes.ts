import { Router } from 'express';
import { createSale, getSales, getSaleStatus } from '../controllers/sale.controller';

const router = Router();

router.get('/', getSales);
router.post('/', createSale);
router.get('/status/:id', getSaleStatus);

export default router;
