import { Router } from 'express';
import EquipoController from '../controllers/EquipoController';
import ImpresoraController from '../controllers/ImpresoraController';
import UsuarioController from '../controllers/UsuarioController';
import asyncHandler from '../middleware/asyncHandler';
import { authenticateToken, requireAdmin } from '../middleware/auth';  // Nuevas importaciones

const router = Router();

// Aplicar autenticación a todas las rutas de este router
router.use(authenticateToken);

// Rutas para equipos
router.post('/equipos', requireAdmin, asyncHandler(EquipoController.crearEquipo));
router.get('/equipos', asyncHandler(EquipoController.obtenerEquipos));
router.get('/equipos/:id', asyncHandler(EquipoController.obtenerEquipo));
router.put('/equipos/:id', requireAdmin, asyncHandler(EquipoController.actualizarEquipo));
router.delete('/equipos/:id', requireAdmin, asyncHandler(EquipoController.eliminarEquipo));
router.get('/buscar-equipos', asyncHandler(EquipoController.buscarEquipos));
router.get('/exportar-equipos', asyncHandler(EquipoController.exportarEquipos));


// Rutas para impresoras
router.post('/impresoras', requireAdmin, asyncHandler(ImpresoraController.crearImpresora));
router.get('/impresoras', asyncHandler(ImpresoraController.obtenerImpresoras));
router.get('/impresoras/:id', asyncHandler(ImpresoraController.obtenerImpresora));
router.put('/impresoras/:id', requireAdmin, asyncHandler(ImpresoraController.actualizarImpresora));
router.delete('/impresoras/:id', requireAdmin, asyncHandler(ImpresoraController.eliminarImpresora));
router.get('/buscar-impresoras', asyncHandler(ImpresoraController.buscarImpresoras));
router.get('/exportar-impresoras', asyncHandler(ImpresoraController.exportarImpresoras));

// Rutas para usuarios
router.post('/usuarios', requireAdmin, asyncHandler(UsuarioController.crearUsuario));
router.get('/usuarios', asyncHandler(UsuarioController.obtenerUsuarios));
router.get('/usuarios/:id', asyncHandler(UsuarioController.obtenerUsuario));
router.get('/usuarios/dni/:dni', asyncHandler(UsuarioController.obtenerUsuarioPorDNI));
router.put('/usuarios/:id', requireAdmin, asyncHandler(UsuarioController.actualizarUsuario));
router.delete('/usuarios/:id', requireAdmin, asyncHandler(UsuarioController.eliminarUsuario));
router.get('/buscar-usuarios', asyncHandler(UsuarioController.buscarUsuarios));
router.get('/exportar-usuarios', asyncHandler(UsuarioController.exportarUsuarios));
router.get('/usuarios/:id/equipos', asyncHandler(UsuarioController.obtenerEquiposUsuario));
router.get('/usuarios/:id/impresoras', asyncHandler(UsuarioController.obtenerImpresorasUsuario));

// ✅ NUEVAS RUTAS PARA TRANSFERENCIA EN BLOQUE - DENTRO DEL CONTEXTO DE EQUIPOS
router.get('/equipos/usuario/:usuarioId', asyncHandler(EquipoController.obtenerEquiposPorUsuario));
router.post('/equipos/transferencia-bloque', requireAdmin, asyncHandler(EquipoController.transferenciaEnBloque));

// ✅ NUEVAS RUTAS PARA TRANSFERENCIA EN BLOQUE DE IMPRESORAS
router.get('/impresoras/usuario/:usuarioId', asyncHandler(ImpresoraController.obtenerImpresorasPorUsuario));
router.post('/impresoras/transferencia-bloque', requireAdmin, asyncHandler(ImpresoraController.transferenciaEnBloque));


export default router;