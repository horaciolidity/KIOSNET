import { Router } from 'express';
import { getAdminDashboard, updatePlanPrices, toggleTenantStatus } from '../controllers/admin.controller';

const router = Router();

router.get('/dashboard', getAdminDashboard);
router.post('/prices', updatePlanPrices);
router.post('/tenants/:id/toggle-status', toggleTenantStatus);
router.post('/tenant/:id/toggle-status', toggleTenantStatus); // Alias: singular tenant path support
router.put('/tenants/:id/toggle-status', toggleTenantStatus); // Allow alternate HTTP method if needed

export default router;
