import { Router } from 'express';
import { getAdminDashboard, updatePlanPrices } from '../controllers/admin.controller';

const router = Router();

router.get('/dashboard', getAdminDashboard);
router.post('/prices', updatePlanPrices);

export default router;
