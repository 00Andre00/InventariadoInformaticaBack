import express from 'express';
import cors from 'cors';
import equipoRoutes from './routes/equipoRoutes';
import authRoutes from './routes/authRoutes';
import sistemaRoutes from './routes/sistemaRoutes'; // Nueva importación

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas protegidas
app.use('/api', equipoRoutes);
app.use('/api/sistema', sistemaRoutes); // Nuevas rutas del sistema

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});