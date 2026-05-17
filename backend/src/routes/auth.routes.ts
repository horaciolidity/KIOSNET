import { Router } from 'express';
import { login, register, getCurrentUser } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', authMiddleware, getCurrentUser); // Protected endpoint to fetch current profile

export default router;
