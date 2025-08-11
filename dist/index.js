"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const equipoRoutes_1 = __importDefault(require("./routes/equipoRoutes")); // Importar las rutas
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)()); // Aplica CORS a todas las rutas
app.use(express_1.default.json()); // Permite manejar JSON en el cuerpo de las solicitudes
// Usar las rutas del equipo, impresoras y dispositivos
app.use('/api', equipoRoutes_1.default); // Ruta base /api para todas las rutas de equipos, impresoras y dispositivos
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
