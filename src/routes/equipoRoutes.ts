import { Router } from 'express';
import EquipoController from '../controllers/EquipoController';
import ImpresoraController from '../controllers/ImpresoraController';  // Importar ImpresoraController
import DispositivoController from '../controllers/DispositivoController';  // Importar DispositivoController
import asyncHandler from '../middleware/asyncHandler'; // Importa el middleware

const router = Router();

// Rutas para equipos
router.post('/equipos', asyncHandler(EquipoController.crearEquipo));  
router.get('/equipos', asyncHandler(EquipoController.obtenerEquipos));  
router.get('/equipos/:id', asyncHandler(EquipoController.obtenerEquipo));  
router.put('/equipos/:id', asyncHandler(EquipoController.actualizarEquipo));  
router.delete('/equipos/:id', asyncHandler(EquipoController.eliminarEquipo));  
router.get('/exportar-equipos', asyncHandler(EquipoController.exportarEquipos));  

// Rutas para impresoras
router.post('/impresoras', asyncHandler(ImpresoraController.crearImpresora));
router.get('/impresoras', asyncHandler(ImpresoraController.obtenerImpresoras));
router.get('/impresoras/:id', asyncHandler(ImpresoraController.obtenerImpresora));
router.put('/impresoras/:id', asyncHandler(ImpresoraController.actualizarImpresora));
router.delete('/impresoras/:id', asyncHandler(ImpresoraController.eliminarImpresora));

// Rutas para dispositivos
router.post('/dispositivos', asyncHandler(DispositivoController.crearDispositivo));
router.get('/dispositivos', asyncHandler(DispositivoController.obtenerDispositivos));
router.get('/dispositivos/:id', asyncHandler(DispositivoController.obtenerDispositivo));
router.put('/dispositivos/:id', asyncHandler(DispositivoController.actualizarDispositivo));
router.delete('/dispositivos/:id', asyncHandler(DispositivoController.eliminarDispositivo));

export default router;