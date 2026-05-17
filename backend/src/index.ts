import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import saleRoutes from './routes/sale.routes';
import registerRoutes from './routes/register.routes';
import customerRoutes from './routes/customer.routes';
import categoryRoutes from './routes/category.routes';
import notificationRoutes from './routes/notification.routes';
import paymentRoutes from './routes/payment.routes';
import { authMiddleware } from './middlewares/auth.middleware';
import prisma from './utils/prisma';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/sales', authMiddleware, saleRoutes);
app.use('/api/registers', authMiddleware, registerRoutes);
app.use('/api/customers', authMiddleware, customerRoutes);
app.use('/api/categories', authMiddleware, categoryRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/payments', paymentRoutes); // Route-level protection inside payment.routes.ts to keep webhook public

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'POS System API is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { prisma };
