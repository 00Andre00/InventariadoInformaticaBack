import { Router } from 'express';
import { UsuarioSistemaController } from '../controllers/UsuarioSistemaController';
import { RevisionController } from '../controllers/RevisionController';
import { ReporteController } from '../controllers/ReporteController';
import { DisponiblesController } from '../controllers/DisponiblesController';
import asyncHandler from '../middleware/asyncHandler';
import { authenticateToken, requireAdmin, requireInformatica } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Rutas para gestión de usuarios del sistema (solo admin)
router.post('/usuarios-sistema', requireAdmin, asyncHandler(UsuarioSistemaController.crearUsuarioSistema));
router.get('/usuarios-sistema', requireAdmin, asyncHandler(UsuarioSistemaController.obtenerUsuariosSistema));
router.delete('/usuarios-sistema/:id', requireAdmin, asyncHandler(UsuarioSistemaController.eliminarUsuarioSistema));
router.put('/usuarios-sistema/:id/password', requireAdmin, asyncHandler(UsuarioSistemaController.cambiarPasswordUsuario));

// Rutas para equipos en revisión (admin e informática)
router.post('/equipos/:id/revision', requireInformatica, asyncHandler(RevisionController.enviarARevision));
router.get('/equipos-revision', requireInformatica, asyncHandler(RevisionController.obtenerEquiposRevision));
router.put('/equipos/:id/reparar', requireInformatica, asyncHandler(RevisionController.repararEquipo));
router.put('/equipos/:id/baja', requireInformatica, asyncHandler(RevisionController.darDeBajaEquipo));

// Rutas para impresoras en revisión (admin e informática)
router.post('/impresoras/:id/revision', requireInformatica, asyncHandler(RevisionController.enviarImpresoraARevision));
router.get('/impresoras-revision', requireInformatica, asyncHandler(RevisionController.obtenerImpresorasRevision));
router.put('/impresoras/:id/reparar', requireInformatica, asyncHandler(RevisionController.repararImpresora));
router.put('/impresoras/:id/baja', requireInformatica, asyncHandler(RevisionController.darDeBajaImpresora));

// Rutas para equipos disponibles (admin e informática)
router.get('/equipos-disponibles', requireInformatica, asyncHandler(RevisionController.obtenerEquiposDisponibles));
router.get('/impresoras-disponibles', requireInformatica, asyncHandler(RevisionController.obtenerImpresorasDisponibles));

// Rutas para reportes (todos los usuarios autenticados)
router.get('/reportes/usuario/:id', asyncHandler(ReporteController.generarReporteUsuario));

// Reporte equipos
router.get('/reportes/equipo/:id', ReporteController.generarReporteEquipo);

// En tu archivo de rutas (routes/reportes.ts o similar)
router.get('/reportes/cambio/impresora/:id', ReporteController.generarReporteImpresora);

// NUEVA RUTA PARA REPORTE GENERAL ✅
router.get('/reportes/general-equipos', ReporteController.generarReporteGeneralEquipos);

// Cambiar contraseña (usuario autenticado)
router.put('/cambiar-password', authenticateToken, asyncHandler(UsuarioSistemaController.cambiarPassword));

// Devolver equipos a informatica
router.put('/equipos/:id/devolver-informatica', requireAdmin, asyncHandler(RevisionController.enviarARevision));

// Otras rutas
router.get('/fecha-baja/:tipo/:id', authenticateToken, asyncHandler(RevisionController.obtenerFechaBaja));
router.get('/historial/:tipo/:id', authenticateToken, asyncHandler(RevisionController.obtenerHistorialCompleto));

// Rutas para recursos disponibles
router.put('/equipos/:id/asignar', requireInformatica, asyncHandler(DisponiblesController.asignarEquipo));
router.put('/impresoras/:id/asignar', requireInformatica, asyncHandler(DisponiblesController.asignarImpresora));
router.get('/equipos-disponibles', requireInformatica, asyncHandler(DisponiblesController.obtenerEquiposDisponibles));
router.get('/impresoras-disponibles', requireInformatica, asyncHandler(DisponiblesController.obtenerImpresorasDisponibles));

export default router;