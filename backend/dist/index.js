"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const sale_routes_1 = __importDefault(require("./routes/sale.routes"));
const register_routes_1 = __importDefault(require("./routes/register.routes"));
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const auth_middleware_1 = require("./middlewares/auth.middleware");
const prisma_1 = __importDefault(require("./utils/prisma"));
exports.prisma = prisma_1.default;
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middlewares
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/products', auth_middleware_1.authMiddleware, product_routes_1.default);
app.use('/api/sales', auth_middleware_1.authMiddleware, sale_routes_1.default);
app.use('/api/registers', auth_middleware_1.authMiddleware, register_routes_1.default);
app.use('/api/customers', auth_middleware_1.authMiddleware, customer_routes_1.default);
app.use('/api/categories', auth_middleware_1.authMiddleware, category_routes_1.default);
app.use('/api/notifications', auth_middleware_1.authMiddleware, notification_routes_1.default);
app.use('/api/payments', payment_routes_1.default); // Route-level protection inside payment.routes.ts to keep webhook public
app.use('/api/admin', auth_middleware_1.authMiddleware, admin_routes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'POS System API is running' });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
