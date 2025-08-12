import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface Usuario extends RowDataPacket {
    id: number;
    dni: string;
    nombres: string;
    apellidos: string;
    oficina: string;
    tipoContrato: string;
    createdAt: string;
}

class UsuarioController {
    // Crear un nuevo usuario
    static async crearUsuario(req: Request, res: Response): Promise<Response> {
        const { dni, nombres, apellidos, oficina, tipoContrato } = req.body;

        if (!dni || !nombres || !apellidos || !oficina || !tipoContrato) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        // Validar formato de DNI (8 dígitos numéricos)
        const dniRegex = /^\d{8}$/;
        if (!dniRegex.test(dni)) {
            return res.status(400).json({ message: 'El DNI debe tener 8 dígitos numéricos.' });
        }

        const query = `
            INSERT INTO usuarios 
            (dni, nombres, apellidos, oficina, tipoContrato)
            VALUES (?, ?, ?, ?, ?)
        `;

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [
                dni, nombres, apellidos, oficina, tipoContrato
            ]);
            return res.status(201).json({
                message: 'Usuario creado correctamente',
                id: result.insertId
            });
        } catch (err: any) {
            console.error('Error al crear usuario:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe un usuario con ese DNI' });
            }
            return res.status(500).json({ error: 'Error al crear el usuario' });
        }
    }

    // Obtener todos los usuarios
    static async obtenerUsuarios(req: Request, res: Response): Promise<Response> {
        const query = 'SELECT * FROM usuarios ORDER BY apellidos, nombres';

        try {
            const [rows] = await db.promise().query<Usuario[]>(query);
            return res.status(200).json({
                message: 'Usuarios obtenidos correctamente',
                data: rows
            });
        } catch (err) {
            console.error('Error al obtener usuarios:', err);
            return res.status(500).json({ error: 'Error al obtener los usuarios' });
        }
    }

    // Obtener usuario por ID
    static async obtenerUsuario(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = 'SELECT * FROM usuarios WHERE id = ?';

        try {
            const [rows] = await db.promise().query<Usuario[]>(query, [id]);

            if (rows.length === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            return res.status(200).json({ 
                message: 'Usuario obtenido correctamente', 
                data: rows[0] 
            });
        } catch (err) {
            console.error('Error al obtener el usuario:', err);
            return res.status(500).json({ error: 'Error al obtener el usuario' });
        }
    }

    // Obtener usuario por DNI
    static async obtenerUsuarioPorDNI(req: Request, res: Response): Promise<Response> {
        const { dni } = req.params;

        if (!dni) {
            return res.status(400).json({ message: 'DNI requerido' });
        }

        const query = 'SELECT * FROM usuarios WHERE dni = ?';

        try {
            const [rows] = await db.promise().query<Usuario[]>(query, [dni]);

            if (rows.length === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            return res.status(200).json({ 
                message: 'Usuario obtenido correctamente', 
                data: rows[0] 
            });
        } catch (err) {
            console.error('Error al obtener el usuario:', err);
            return res.status(500).json({ error: 'Error al obtener el usuario' });
        }
    }

    // Actualizar usuario
    static async actualizarUsuario(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { dni, nombres, apellidos, oficina, tipoContrato } = req.body;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        if (!dni || !nombres || !apellidos || !oficina || !tipoContrato) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        // Validar formato de DNI
        const dniRegex = /^\d{8}$/;
        if (!dniRegex.test(dni)) {
            return res.status(400).json({ message: 'El DNI debe tener 8 dígitos numéricos.' });
        }

        const query = `
            UPDATE usuarios SET 
                dni = ?, nombres = ?, apellidos = ?, oficina = ?, tipoContrato = ?
            WHERE id = ?
        `;

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [
                dni, nombres, apellidos, oficina, tipoContrato, id
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            return res.status(200).json({ message: 'Usuario actualizado correctamente' });
        } catch (err: any) {
            console.error('Error al actualizar usuario:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe un usuario con ese DNI' });
            }
            return res.status(500).json({ error: 'Error al actualizar el usuario' });
        }
    }

    // Eliminar usuario
    static async eliminarUsuario(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        // Primero verificamos si el usuario tiene equipos o impresoras asignados
        try {
            const [equipos] = await db.promise().query<RowDataPacket[]>(
                'SELECT id FROM equipos WHERE usuarioId = ? LIMIT 1', 
                [id]
            );
            
            const [impresoras] = await db.promise().query<RowDataPacket[]>(
                'SELECT id FROM impresoras WHERE usuarioId = ? LIMIT 1', 
                [id]
            );

            if (equipos.length > 0 || impresoras.length > 0) {
                return res.status(400).json({ 
                    error: 'No se puede eliminar el usuario porque tiene equipos o impresoras asignados' 
                });
            }

            const query = 'DELETE FROM usuarios WHERE id = ?';
            const [result] = await db.promise().query<ResultSetHeader>(query, [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            return res.status(200).json({ message: 'Usuario eliminado correctamente' });
        } catch (err) {
            console.error('Error al eliminar usuario:', err);
            return res.status(500).json({ error: 'Error al eliminar el usuario' });
        }
    }

    // Buscar usuarios
    static async buscarUsuarios(req: Request, res: Response): Promise<Response> {
        const { dni, nombres, apellidos, oficina } = req.query;
        let query = 'SELECT * FROM usuarios WHERE 1=1';
        const params: any[] = [];

        if (dni) {
            query += ' AND dni LIKE ?';
            params.push(`%${dni}%`);
        }
        if (nombres) {
            query += ' AND nombres LIKE ?';
            params.push(`%${nombres}%`);
        }
        if (apellidos) {
            query += ' AND apellidos LIKE ?';
            params.push(`%${apellidos}%`);
        }
        if (oficina) {
            query += ' AND oficina LIKE ?';
            params.push(`%${oficina}%`);
        }

        query += ' ORDER BY apellidos, nombres';

        try {
            const [rows] = await db.promise().query<Usuario[]>(query, params);
            return res.status(200).json({ 
                data: rows, 
                total: rows.length 
            });
        } catch (err) {
            console.error('Error al buscar usuarios:', err);
            return res.status(500).json({ error: 'Error al buscar usuarios' });
        }
    }

    // Exportar usuarios (para frontend y Excel)
    static async exportarUsuarios(req: Request, res: Response): Promise<Response> {
        const query = `
            SELECT 
                id, dni, nombres, apellidos, oficina, tipoContrato,
                DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as fechaRegistro
            FROM usuarios
            ORDER BY apellidos, nombres
        `;

        try {
            const [rows] = await db.promise().query<Usuario[]>(query);
            return res.status(200).json({
                message: 'Usuarios exportados correctamente',
                data: rows,
                total: rows.length
            });
        } catch (err) {
            console.error('Error al exportar usuarios:', err);
            return res.status(500).json({ error: 'Error al exportar usuarios' });
        }
    }

    // Obtener equipos asignados a un usuario
    static async obtenerEquiposUsuario(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = `
            SELECT 
                e.id, e.tipo, e.marca, e.modelo, e.ip, e.codigoPatrimonial, e.estado
            FROM equipos e
            WHERE e.usuarioId = ?
            ORDER BY e.tipo, e.marca
        `;

        try {
            const [rows] = await db.promise().query<RowDataPacket[]>(query, [id]);
            return res.status(200).json({ 
                message: 'Equipos del usuario obtenidos correctamente',
                data: rows,
                total: rows.length
            });
        } catch (err) {
            console.error('Error al obtener equipos del usuario:', err);
            return res.status(500).json({ error: 'Error al obtener equipos del usuario' });
        }
    }

    // Obtener impresoras asignadas a un usuario
    static async obtenerImpresorasUsuario(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = `
            SELECT 
                i.id, i.modelo, i.ip, i.codigoPatrimonial
            FROM impresoras i
            WHERE i.usuarioId = ?
            ORDER BY i.modelo
        `;

        try {
            const [rows] = await db.promise().query<RowDataPacket[]>(query, [id]);
            return res.status(200).json({ 
                message: 'Impresoras del usuario obtenidas correctamente',
                data: rows,
                total: rows.length
            });
        } catch (err) {
            console.error('Error al obtener impresoras del usuario:', err);
            return res.status(500).json({ error: 'Error al obtener impresoras del usuario' });
        }
    }
}

export default UsuarioController;