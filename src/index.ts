import express from 'express';
import cors from 'cors';
import equipoRoutes from './routes/equipoRoutes';
import authRoutes from './routes/authRoutes';  // Nueva importación

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas públicas (sin autenticación)
app.use('/api/auth', authRoutes);  // Rutas de autenticación

// Rutas protegidas (con autenticación)
app.use('/api', equipoRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});