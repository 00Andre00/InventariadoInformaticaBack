import { Router } from 'express';
import { login, verifyToken } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import asyncHandler from '../middleware/asyncHandler';

const router = Router();

// Ruta pública para login
router.post('/login', asyncHandler(login));

// Ruta para verificar token (requiere autenticación)
router.get('/verify', authenticateToken, asyncHandler(verifyToken));

export default router;