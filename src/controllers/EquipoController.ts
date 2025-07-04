import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface Equipo extends RowDataPacket {
    id: number;
    nombre: string;
    tipo: string;
    ip: string;
    piso: string;
    oficina: string;
    usuario: string;
}

class EquipoController {
    // Crear un equipo
    static async crearEquipo(req: Request, res: Response): Promise<Response> {
        const { nombre, tipo, ip, piso, oficina, usuario } = req.body;

        // Validar los campos requeridos
        if (!nombre || !tipo || !ip || !piso || !oficina || !usuario) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        // Validar formato de IP (básico)
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({ message: 'Formato de IP inválido.' });
        }

        const query = 'INSERT INTO equipos (nombre, tipo, ip, piso, oficina, usuario) VALUES (?, ?, ?, ?, ?, ?)';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [nombre, tipo, ip, piso, oficina, usuario]);
            return res.status(201).json({ 
                message: 'Equipo creado correctamente', 
                id: result.insertId 
            });
        } catch (err: any) {
            console.error('Error al agregar el equipo:', err);
            
            // Manejar errores específicos de MySQL
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe un equipo con esa IP o nombre' });
            }
            
            return res.status(500).json({ error: 'Error al crear el equipo' });
        }
    }

    // Obtener todos los equipos
    static async obtenerEquipos(req: Request, res: Response): Promise<Response> {
        const query = 'SELECT id, nombre, tipo, ip, piso, oficina, usuario FROM equipos ORDER BY nombre';

        try {
            const [rows] = await db.promise().query<Equipo[]>(query);
            
            if (rows.length === 0) {
                return res.status(200).json({ message: 'No hay equipos registrados', data: [] });
            }

            return res.status(200).json({ message: 'Equipos obtenidos correctamente', data: rows });
        } catch (err) {
            console.error('Error al obtener los equipos:', err);
            return res.status(500).json({ error: 'Error al obtener los equipos' });
        }
    }

    // Obtener un equipo por ID
    static async obtenerEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        
        // Validar que el ID sea un número
        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = 'SELECT id, nombre, tipo, ip, piso, oficina, usuario FROM equipos WHERE id = ?';

        try {
            const [rows] = await db.promise().query<Equipo[]>(query, [id]);
            
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Equipo no encontrado' });
            }

            return res.status(200).json({ message: 'Equipo obtenido correctamente', data: rows[0] });
        } catch (err) {
            console.error('Error al obtener el equipo:', err);
            return res.status(500).json({ error: 'Error al obtener el equipo' });
        }
    }

    // Actualizar un equipo
    static async actualizarEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { nombre, tipo, ip, piso, oficina, usuario } = req.body;

        // Validar que el ID sea un número
        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        // Validar los campos requeridos
        if (!nombre || !tipo || !ip || !piso || !oficina || !usuario) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        // Validar formato de IP (básico)
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({ message: 'Formato de IP inválido.' });
        }

        const query = 'UPDATE equipos SET nombre = ?, tipo = ?, ip = ?, piso = ?, oficina = ?, usuario = ? WHERE id = ?';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [nombre, tipo, ip, piso, oficina, usuario, id]);
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Equipo no encontrado' });
            }

            return res.status(200).json({ message: 'Equipo actualizado correctamente' });
        } catch (err: any) {
            console.error('Error al actualizar el equipo:', err);
            
            // Manejar errores específicos de MySQL
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe un equipo con esa IP o nombre' });
            }
            
            return res.status(500).json({ error: 'Error al actualizar el equipo' });
        }
    }

    // Eliminar un equipo
    static async eliminarEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        
        // Validar que el ID sea un número
        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = 'DELETE FROM equipos WHERE id = ?';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [id]);
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Equipo no encontrado' });
            }

            return res.status(200).json({ message: 'Equipo eliminado correctamente' });
        } catch (err) {
            console.error('Error al eliminar el equipo:', err);
            return res.status(500).json({ error: 'Error al eliminar el equipo' });
        }
    }

    // Exportar equipos a Excel
    static async exportarEquipos(req: Request, res: Response): Promise<Response> {
        const query = 'SELECT id, nombre, tipo, ip, piso, oficina, usuario FROM equipos ORDER BY nombre';

        try {
            const [rows] = await db.promise().query<Equipo[]>(query);
            return res.status(200).json({ 
                message: 'Equipos exportados correctamente', 
                data: rows,
                total: rows.length
            });
        } catch (err) {
            console.error('Error al exportar los equipos:', err);
            return res.status(500).json({ error: 'Error al exportar los equipos' });
        }
    }

    // Buscar equipos por filtros
    static async buscarEquipos(req: Request, res: Response): Promise<Response> {
        const { nombre, tipo, piso, oficina, usuario } = req.query;
        let query = 'SELECT id, nombre, tipo, ip, piso, oficina, usuario FROM equipos WHERE 1=1';
        const params: any[] = [];

        if (nombre) {
            query += ' AND nombre LIKE ?';
            params.push(`%${nombre}%`);
        }

        if (tipo) {
            query += ' AND tipo = ?';
            params.push(tipo);
        }

        if (piso) {
            query += ' AND piso = ?';
            params.push(piso);
        }

        if (oficina) {
            query += ' AND oficina LIKE ?';
            params.push(`%${oficina}%`);
        }

        if (usuario) {
            query += ' AND usuario LIKE ?';
            params.push(`%${usuario}%`);
        }

        query += ' ORDER BY nombre';

        try {
            const [rows] = await db.promise().query<Equipo[]>(query, params);
            return res.status(200).json({ 
                message: 'Búsqueda completada', 
                data: rows,
                total: rows.length
            });
        } catch (err) {
            console.error('Error al buscar equipos:', err);
            return res.status(500).json({ error: 'Error al buscar equipos' });
        }
    }
}

export default EquipoController;