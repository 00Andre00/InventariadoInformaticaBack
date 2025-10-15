import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export class DisponiblesController {
    // Asignar equipo a usuario
    static async asignarEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { usuarioId } = req.body;
        const usuarioSistemaId = (req as any).user.id;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        if (!usuarioId) {
            return res.status(400).json({ message: 'usuarioId es requerido' });
        }

        try {
            // Verificar que el equipo existe y está disponible
            const [equipo] = await db.promise().query<RowDataPacket[]>(
                'SELECT id, estado_especial FROM equipos WHERE id = ?',
                [id]
            );

            if (equipo.length === 0) {
                return res.status(404).json({ message: 'Equipo no encontrado' });
            }

            if (equipo[0].estado_especial !== 'disponible') {
                return res.status(400).json({ message: 'El equipo no está disponible para asignación' });
            }

            // Verificar que el usuario existe
            const [usuario] = await db.promise().query<RowDataPacket[]>(
                'SELECT id, oficina FROM usuarios WHERE id = ?', 
                [usuarioId]
            );
            
            if (usuario.length === 0) {
                return res.status(400).json({ message: 'El usuario especificado no existe' });
            }

            // Actualizar equipo
            await db.promise().query(
                `UPDATE equipos 
                 SET usuarioId = ?, 
                     estado_especial = 'asignado',
                     oficina = ?
                 WHERE id = ?`,
                [usuarioId, usuario[0].oficina, id]
            );

            // Registrar en historial
            await db.promise().query(
                `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['equipo', id, 'asignado', `Equipo asignado al usuario ID: ${usuarioId}`, usuarioSistemaId]
            );

            return res.status(200).json({ 
                message: 'Equipo asignado correctamente',
                estado_especial: 'asignado'
            });
        } catch (err) {
            console.error('Error al asignar equipo:', err);
            return res.status(500).json({ error: 'Error al asignar equipo' });
        }
    }

    // Asignar impresora a usuario
    static async asignarImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { usuarioId } = req.body;
        const usuarioSistemaId = (req as any).user.id;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        if (!usuarioId) {
            return res.status(400).json({ message: 'usuarioId es requerido' });
        }

        try {
            // Verificar que la impresora existe y está disponible
            const [impresora] = await db.promise().query<RowDataPacket[]>(
                'SELECT id, estado_especial FROM impresoras WHERE id = ?',
                [id]
            );

            if (impresora.length === 0) {
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }

            if (impresora[0].estado_especial !== 'disponible') {
                return res.status(400).json({ message: 'La impresora no está disponible para asignación' });
            }

            // Verificar que el usuario existe
            const [usuario] = await db.promise().query<RowDataPacket[]>(
                'SELECT id, oficina FROM usuarios WHERE id = ?', 
                [usuarioId]
            );
            
            if (usuario.length === 0) {
                return res.status(400).json({ message: 'El usuario especificado no existe' });
            }

            // Actualizar impresora
            await db.promise().query(
                `UPDATE impresoras 
                 SET usuarioId = ?, 
                     estado_especial = 'asignado',
                     oficina = ?
                 WHERE id = ?`,
                [usuarioId, usuario[0].oficina, id]
            );

            // Registrar en historial
            await db.promise().query(
                `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['impresora', id, 'asignada', `Impresora asignada al usuario ID: ${usuarioId}`, usuarioSistemaId]
            );

            return res.status(200).json({ 
                message: 'Impresora asignada correctamente',
                estado_especial: 'asignado'
            });
        } catch (err) {
            console.error('Error al asignar impresora:', err);
            return res.status(500).json({ error: 'Error al asignar impresora' });
        }
    }

    // Obtener equipos disponibles
    static async obtenerEquiposDisponibles(req: Request, res: Response): Promise<Response> {
        try {
            const [rows] = await db.promise().query<RowDataPacket[]>(
                `SELECT * FROM equipos 
                 WHERE estado_especial = 'disponible'
                 ORDER BY id DESC`
            );

            return res.status(200).json({
                message: 'Equipos disponibles obtenidos correctamente',
                data: rows
            });
        } catch (err) {
            console.error('Error al obtener equipos disponibles:', err);
            return res.status(500).json({ error: 'Error al obtener equipos disponibles' });
        }
    }

    // Obtener impresoras disponibles
    static async obtenerImpresorasDisponibles(req: Request, res: Response): Promise<Response> {
        try {
            const [rows] = await db.promise().query<RowDataPacket[]>(
                `SELECT * FROM impresoras 
                 WHERE estado_especial = 'disponible'
                 ORDER BY id DESC`
            );

            return res.status(200).json({
                message: 'Impresoras disponibles obtenidas correctamente',
                data: rows
            });
        } catch (err) {
            console.error('Error al obtener impresoras disponibles:', err);
            return res.status(500).json({ error: 'Error al obtener impresoras disponibles' });
        }
    }
}