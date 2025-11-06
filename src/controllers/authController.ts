import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno');
}

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
            return;
        }

        const [users] = await db.promise().query(
            'SELECT * FROM usuarios_sistema WHERE username = ? AND activo = 1',
            [username]
        );

        const userArray = users as any[];
        
        if (userArray.length === 0) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const user = userArray[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                rol: user.rol 
            },
            JWT_SECRET, // Ahora TypeScript sabe que no es undefined
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol: user.rol
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const verifyToken = (req: Request, res: Response): void => {
    res.json({ valid: true, message: 'Token válido' });
};