import { Router } from 'express';
import EquipoController from '../controllers/EquipoController';
import ImpresoraController from '../controllers/ImpresoraController';
import UsuarioController from '../controllers/UsuarioController';
import asyncHandler from '../middleware/asyncHandler';

const router = Router();

// Rutas para equipos
router.post('/equipos', asyncHandler(EquipoController.crearEquipo));
router.get('/equipos', asyncHandler(EquipoController.obtenerEquipos));
router.get('/equipos/:id', asyncHandler(EquipoController.obtenerEquipo));
router.put('/equipos/:id', asyncHandler(EquipoController.actualizarEquipo));
router.delete('/equipos/:id', asyncHandler(EquipoController.eliminarEquipo));
router.get('/buscar-equipos', asyncHandler(EquipoController.buscarEquipos));
router.get('/exportar-equipos', asyncHandler(EquipoController.exportarEquipos));

// Rutas para impresoras
router.post('/impresoras', asyncHandler(ImpresoraController.crearImpresora));
router.get('/impresoras', asyncHandler(ImpresoraController.obtenerImpresoras));
router.get('/impresoras/:id', asyncHandler(ImpresoraController.obtenerImpresora));
router.put('/impresoras/:id', asyncHandler(ImpresoraController.actualizarImpresora));
router.delete('/impresoras/:id', asyncHandler(ImpresoraController.eliminarImpresora));
router.get('/buscar-impresoras', asyncHandler(ImpresoraController.buscarImpresoras));
router.get('/exportar-impresoras', asyncHandler(ImpresoraController.exportarImpresoras));

// Rutas para usuarios
router.post('/usuarios', asyncHandler(UsuarioController.crearUsuario));
router.get('/usuarios', asyncHandler(UsuarioController.obtenerUsuarios));
router.get('/usuarios/:id', asyncHandler(UsuarioController.obtenerUsuario));
router.get('/usuarios/dni/:dni', asyncHandler(UsuarioController.obtenerUsuarioPorDNI));
router.put('/usuarios/:id', asyncHandler(UsuarioController.actualizarUsuario));
router.delete('/usuarios/:id', asyncHandler(UsuarioController.eliminarUsuario));
router.get('/buscar-usuarios', asyncHandler(UsuarioController.buscarUsuarios));
router.get('/exportar-usuarios', asyncHandler(UsuarioController.exportarUsuarios));
router.get('/usuarios/:id/equipos', asyncHandler(UsuarioController.obtenerEquiposUsuario));
router.get('/usuarios/:id/impresoras', asyncHandler(UsuarioController.obtenerImpresorasUsuario));

export default router;