import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/db'; // Ruta corregida

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura_aqui';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
        nombre: string;
        rol: string;
    };
}

// Middleware para verificar JWT
export const authenticateToken = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
): Promise<void> => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Token de acceso requerido' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        const [users] = await db.promise().query(
            'SELECT id, username, nombre, rol FROM usuarios_sistema WHERE id = ? AND activo = 1',
            [decoded.userId]
        );

        const userArray = users as any[];
        
        if (userArray.length === 0) {
            res.status(401).json({ error: 'Usuario no válido' });
            return;
        }

        req.user = userArray[0];
        next();
    } catch (error) {
        res.status(403).json({ error: 'Token inválido' });
    }
};

// Middleware para verificar rol de administrador
export const requireAdmin = (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
): void => {
    if (req.user?.rol !== 'admin') {
        res.status(403).json({ error: 'Se requieren permisos de administrador' });
        return;
    }
    next();
};