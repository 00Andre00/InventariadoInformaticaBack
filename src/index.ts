import express from 'express';
import cors from 'cors';
import equipoRoutes from './routes/equipoRoutes';  // Importar las rutas

const app = express();

// Middleware
app.use(cors());  // Aplica CORS a todas las rutas
app.use(express.json());  // Permite manejar JSON en el cuerpo de las solicitudes

// Usar las rutas del equipo, impresoras y dispositivos
app.use('/api', equipoRoutes);  // Ruta base /api para todas las rutas de equipos, impresoras y dispositivos

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
