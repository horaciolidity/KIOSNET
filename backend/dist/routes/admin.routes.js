"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const router = (0, express_1.Router)();
router.get('/dashboard', admin_controller_1.getAdminDashboard);
router.post('/prices', admin_controller_1.updatePlanPrices);
router.post('/tenants/:id/toggle-status', admin_controller_1.toggleTenantStatus);
router.post('/tenant/:id/toggle-status', admin_controller_1.toggleTenantStatus); // Alias: singular tenant path support
router.put('/tenants/:id/toggle-status', admin_controller_1.toggleTenantStatus); // Allow alternate HTTP method if needed
exports.default = router;
