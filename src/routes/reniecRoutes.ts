import { Router } from 'express';
import { ReniecController } from '../controllers/reniecController';
import asyncHandler from '../middleware/asyncHandler';

const router = Router();

// POST /api/reniec/consultar
router.post('/consultar', asyncHandler(ReniecController.consultarDNI));

export default router;