import { Router } from 'express';
import { getAdminDashboard, updatePlanPrices, toggleTenantStatus } from '../controllers/admin.controller';

const router = Router();

router.get('/dashboard', getAdminDashboard);
router.post('/prices', updatePlanPrices);
router.post('/tenants/:id/toggle-status', toggleTenantStatus);

export default router;
