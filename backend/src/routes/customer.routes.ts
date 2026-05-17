import { Router } from 'express';
import { getCustomers, createCustomer, getCustomerBalance } from '../controllers/customer.controller';

const router = Router();

router.get('/', getCustomers);
router.post('/', createCustomer);
router.get('/:id/balance', getCustomerBalance);

export default router;
