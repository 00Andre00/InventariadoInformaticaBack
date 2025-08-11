"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const EquipoController_1 = __importDefault(require("../controllers/EquipoController"));
const ImpresoraController_1 = __importDefault(require("../controllers/ImpresoraController"));
const DispositivoController_1 = __importDefault(require("../controllers/DispositivoController"));
const asyncHandler_1 = __importDefault(require("../middleware/asyncHandler"));
const router = (0, express_1.Router)();
// Rutas para equipos
router.post('/equipos', (0, asyncHandler_1.default)(EquipoController_1.default.crearEquipo));
router.get('/equipos', (0, asyncHandler_1.default)(EquipoController_1.default.obtenerEquipos));
router.get('/equipos/:id', (0, asyncHandler_1.default)(EquipoController_1.default.obtenerEquipo));
router.put('/equipos/:id', (0, asyncHandler_1.default)(EquipoController_1.default.actualizarEquipo));
router.delete('/equipos/:id', (0, asyncHandler_1.default)(EquipoController_1.default.eliminarEquipo));
router.get('/exportar-equipos', (0, asyncHandler_1.default)(EquipoController_1.default.exportarEquipos));
// Rutas para impresoras
router.post('/impresoras', (0, asyncHandler_1.default)(ImpresoraController_1.default.crearImpresora));
router.get('/impresoras', (0, asyncHandler_1.default)(ImpresoraController_1.default.obtenerImpresoras));
router.get('/impresoras/:id', (0, asyncHandler_1.default)(ImpresoraController_1.default.obtenerImpresora));
router.put('/impresoras/:id', (0, asyncHandler_1.default)(ImpresoraController_1.default.actualizarImpresora));
router.delete('/impresoras/:id', (0, asyncHandler_1.default)(ImpresoraController_1.default.eliminarImpresora));
// Rutas para dispositivos
router.post('/dispositivos', (0, asyncHandler_1.default)(DispositivoController_1.default.crearDispositivo));
router.get('/dispositivos', (0, asyncHandler_1.default)(DispositivoController_1.default.obtenerDispositivos));
router.get('/dispositivos/:id', (0, asyncHandler_1.default)(DispositivoController_1.default.obtenerDispositivo));
router.put('/dispositivos/:id', (0, asyncHandler_1.default)(DispositivoController_1.default.actualizarDispositivo));
router.delete('/dispositivos/:id', (0, asyncHandler_1.default)(DispositivoController_1.default.eliminarDispositivo));
exports.default = router;
