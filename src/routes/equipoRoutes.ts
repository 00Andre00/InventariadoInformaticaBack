import { Router } from 'express';
import EquipoController from '../controllers/EquipoController';
import asyncHandler from '../middleware/asyncHandler'; // Importa el middleware

const router = Router();

// Usar asyncHandler para evitar problemas con las promesas en Express
router.post('/equipo', asyncHandler(EquipoController.crearEquipo));  
router.get('/equipos', asyncHandler(EquipoController.obtenerEquipos));  
router.get('/equipo/:id', asyncHandler(EquipoController.obtenerEquipo));  
router.put('/equipo/:id', asyncHandler(EquipoController.actualizarEquipo));  
router.delete('/equipo/:id', asyncHandler(EquipoController.eliminarEquipo));  
router.get('/exportar-equipos', asyncHandler(EquipoController.exportarEquipos));  

export default router;
