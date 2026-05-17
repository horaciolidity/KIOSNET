"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sale_controller_1 = require("../controllers/sale.controller");
const router = (0, express_1.Router)();
router.get('/', sale_controller_1.getSales);
router.post('/', sale_controller_1.createSale);
router.get('/status/:id', sale_controller_1.getSaleStatus);
exports.default = router;
