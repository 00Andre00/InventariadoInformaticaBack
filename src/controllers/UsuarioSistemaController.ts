import { Request, Response } from 'express';
import db from '../config/db';
import bcrypt from 'bcrypt';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface UsuarioSistema extends RowDataPacket {
    id: number;
    username: string;
    nombre: string;
    rol: string;
    activo: number;
}

export class UsuarioSistemaController {
    // Crear usuario del sistema (solo admin)
    static async crearUsuarioSistema(req: Request, res: Response): Promise<Response> {
        const { username, password, nombre, rol } = req.body;

        if (!username || !password || !nombre || !rol) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }

        // Validar que el rol sea válido - SOLO INFORMATICA
        if (rol !== 'informatica') {
            return res.status(400).json({ message: 'Rol no válido. Solo se permite: informatica' });
        }

        try {
            const passwordHash = await bcrypt.hash(password, 10);
            
            const [result] = await db.promise().query<ResultSetHeader>(
                'INSERT INTO usuarios_sistema (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)',
                [username, passwordHash, nombre, rol]
            );

            return res.status(201).json({
                message: 'Usuario del sistema creado correctamente',
                id: result.insertId
            });
        } catch (err: any) {
            console.error('Error al crear usuario del sistema:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe un usuario con ese username' });
            }
            return res.status(500).json({ error: 'Error al crear usuario del sistema' });
        }
    }

    // Obtener todos los usuarios del sistema (solo admin)
    static async obtenerUsuariosSistema(req: Request, res: Response): Promise<Response> {
        try {
            const [rows] = await db.promise().query<UsuarioSistema[]>(
                'SELECT id, username, nombre, rol, activo, createdAt FROM usuarios_sistema ORDER BY id'
            );

            return res.status(200).json({
                message: 'Usuarios del sistema obtenidos correctamente',
                data: rows
            });
        } catch (err) {
            console.error('Error al obtener usuarios del sistema:', err);
            return res.status(500).json({ error: 'Error al obtener usuarios del sistema' });
        }
    }

    // Eliminar usuario del sistema (solo admin)
    static async eliminarUsuarioSistema(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            const [result] = await db.promise().query<ResultSetHeader>(
                'DELETE FROM usuarios_sistema WHERE id = ? AND rol != "admin"',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado o no se puede eliminar admin' });
            }

            return res.status(200).json({ message: 'Usuario eliminado correctamente' });
        } catch (err) {
            console.error('Error al eliminar usuario del sistema:', err);
            return res.status(500).json({ error: 'Error al eliminar usuario del sistema' });
        }
    }

    // Método para cambiar contraseña del usuario actual
    static async cambiarPassword(req: Request, res: Response): Promise<Response> {
        const usuarioId = (req as any).user.id;
        const { passwordActual, passwordNueva } = req.body;

        if (!passwordActual || !passwordNueva) {
            return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
        }

        try {
            // Obtener usuario actual
            const [usuarios] = await db.promise().query<RowDataPacket[]>(
                'SELECT password_hash FROM usuarios_sistema WHERE id = ?',
                [usuarioId]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            const usuario = usuarios[0];

            // Verificar contraseña actual
            const passwordValida = await bcrypt.compare(passwordActual, usuario.password_hash);
            if (!passwordValida) {
                return res.status(400).json({ error: 'Contraseña actual incorrecta' });
            }

            // Hashear nueva contraseña
            const nuevaPasswordHash = await bcrypt.hash(passwordNueva, 10);

            // Actualizar contraseña
            await db.promise().query(
                'UPDATE usuarios_sistema SET password_hash = ? WHERE id = ?',
                [nuevaPasswordHash, usuarioId]
            );

            return res.status(200).json({ message: 'Contraseña cambiada correctamente' });

        } catch (err) {
            console.error('Error al cambiar contraseña:', err);
            return res.status(500).json({ error: 'Error al cambiar contraseña' });
        }
    }

    // Método para que admin cambie contraseña de otros usuarios
    static async cambiarPasswordUsuario(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { nuevaPassword } = req.body;
        const usuarioSistemaId = (req as any).user.id;

        if (!nuevaPassword) {
            return res.status(400).json({ error: 'Nueva contraseña es requerida' });
        }

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            // Verificar que el usuario que hace la petición es admin
            const [usuarioActual] = await db.promise().query<RowDataPacket[]>(
                'SELECT rol FROM usuarios_sistema WHERE id = ?',
                [usuarioSistemaId]
            );

            if (usuarioActual.length === 0 || usuarioActual[0].rol !== 'admin') {
                return res.status(403).json({ error: 'Solo los administradores pueden cambiar contraseñas de otros usuarios' });
            }

            // Verificar que el usuario objetivo existe
            const [usuarioObjetivo] = await db.promise().query<RowDataPacket[]>(
                'SELECT id, username FROM usuarios_sistema WHERE id = ?',
                [id]
            );

            if (usuarioObjetivo.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // Validar longitud de contraseña
            if (nuevaPassword.length < 6) {
                return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
            }

            // Hashear nueva contraseña
            const nuevaPasswordHash = await bcrypt.hash(nuevaPassword, 10);

            // Actualizar contraseña
            await db.promise().query(
                'UPDATE usuarios_sistema SET password_hash = ? WHERE id = ?',
                [nuevaPasswordHash, id]
            );

            return res.status(200).json({ 
                message: 'Contraseña cambiada correctamente',
                usuario: usuarioObjetivo[0].username
            });

        } catch (err) {
            console.error('Error al cambiar contraseña de usuario:', err);
            return res.status(500).json({ error: 'Error al cambiar contraseña' });
        }
    }
}