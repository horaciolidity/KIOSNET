import { Router } from 'express';
import { openRegister, closeRegister, getMovements, addMovement, getActiveRegister } from '../controllers/register.controller';

const router = Router();

router.post('/open', openRegister);
router.patch('/:id/close', closeRegister);
router.get('/:id/movements', getMovements);
router.post('/movements', addMovement);
router.get('/active/:userId', getActiveRegister);

export default router;
