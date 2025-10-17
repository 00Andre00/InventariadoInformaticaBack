import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { HistorialHelper } from '../utils/historialHelper';

export class DisponiblesController {
    // Asignar equipo a usuario
    static async asignarEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { usuarioId } = req.body;

        if (!usuarioId) {
            return res.status(400).json({ error: 'ID de usuario requerido' });
        }

        const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
        const conn = await db.promise().getConnection();

        try {
            await conn.beginTransaction();

            // 1. Obtener estado anterior
            const [equipoAnterior] = await conn.query<RowDataPacket[]>(
                'SELECT * FROM equipos WHERE id = ?', 
                [id]
            );

            if (equipoAnterior.length === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Equipo no encontrado' });
            }

            const equipoPrev = equipoAnterior[0];

            // 2. Verificar que el equipo esté disponible (CORREGIDO: estado_especial)
            if (equipoPrev.estado_especial !== 'disponible') {
                await conn.rollback();
                return res.status(400).json({ error: 'El equipo no está disponible para asignación' });
            }

            // 3. Verificar que el usuario existe
            const [usuario] = await conn.query<RowDataPacket[]>(
                'SELECT * FROM usuarios WHERE id = ?', 
                [usuarioId]
            );

            if (usuario.length === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // 4. Actualizar equipo (CORREGIDO: estado_especial)
            const [result] = await conn.query<ResultSetHeader>(
                'UPDATE equipos SET usuarioId = ?, estado_especial = ? WHERE id = ?',
                [usuarioId, 'asignado', id]
            );

            if (result.affectedRows === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Equipo no encontrado' });
            }

            // 5. Registrar en historial (CORREGIDO: estado_especial)
            const detalles = {
                prev: {
                    usuarioId: equipoPrev.usuarioId,
                    estado_especial: equipoPrev.estado_especial,
                    estado: equipoPrev.estado // También registrar el estado físico por si cambia
                },
                next: {
                    usuarioId: usuarioId,
                    estado_especial: 'asignado',
                    estado: equipoPrev.estado // Mantener el mismo estado físico
                },
                nota: `Asignado a ${usuario[0].nombres} ${usuario[0].apellidos}`
            };

            await HistorialHelper.registrarCambio(
                'equipo',
                parseInt(id),
                'asignacion',
                detalles,
                usuarioSistemaId
            );

            await conn.commit();

            return res.status(200).json({ 
                message: 'Equipo asignado correctamente',
                data: {
                    equipoId: id,
                    usuario: usuario[0],
                    estado_especial: 'asignado'
                }
            });
        } catch (err: any) {
            await conn.rollback();
            console.error('Error al asignar equipo:', err);
            return res.status(500).json({ error: 'Error al asignar el equipo' });
        } finally {
            conn.release();
        }
    }

    // Asignar impresora a usuario
    static async asignarImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { usuarioId } = req.body;

        if (!usuarioId) {
            return res.status(400).json({ error: 'ID de usuario requerido' });
        }

        const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
        const conn = await db.promise().getConnection();

        try {
            await conn.beginTransaction();

            // 1. Obtener estado anterior
            const [impresoraAnterior] = await conn.query<RowDataPacket[]>(
                'SELECT * FROM impresoras WHERE id = ?', 
                [id]
            );

            if (impresoraAnterior.length === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Impresora no encontrada' });
            }

            const impresoraPrev = impresoraAnterior[0];

            // 2. Verificar que la impresora esté disponible (CORREGIDO: estado_especial)
            if (impresoraPrev.estado_especial !== 'disponible') {
                await conn.rollback();
                return res.status(400).json({ error: 'La impresora no está disponible para asignación' });
            }

            // 3. Verificar que el usuario existe
            const [usuario] = await conn.query<RowDataPacket[]>(
                'SELECT * FROM usuarios WHERE id = ?', 
                [usuarioId]
            );

            if (usuario.length === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // 4. Actualizar impresora (CORREGIDO: estado_especial)
            const [result] = await conn.query<ResultSetHeader>(
                'UPDATE impresoras SET usuarioId = ?, estado_especial = ? WHERE id = ?',
                [usuarioId, 'asignado', id]
            );

            if (result.affectedRows === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Impresora no encontrada' });
            }

            // 5. Registrar en historial (CORREGIDO: estado_especial)
            const detalles = {
                prev: {
                    usuarioId: impresoraPrev.usuarioId,
                    estado_especial: impresoraPrev.estado_especial,
                    estado: impresoraPrev.estado
                },
                next: {
                    usuarioId: usuarioId,
                    estado_especial: 'asignado',
                    estado: impresoraPrev.estado
                },
                nota: `Asignado a ${usuario[0].nombres} ${usuario[0].apellidos}`
            };

            await HistorialHelper.registrarCambio(
                'impresora',
                parseInt(id),
                'asignacion',
                detalles,
                usuarioSistemaId
            );

            await conn.commit();

            return res.status(200).json({ 
                message: 'Impresora asignada correctamente',
                data: {
                    impresoraId: id,
                    usuario: usuario[0],
                    estado_especial: 'asignado'
                }
            });
        } catch (err: any) {
            await conn.rollback();
            console.error('Error al asignar impresora:', err);
            return res.status(500).json({ error: 'Error al asignar la impresora' });
        } finally {
            conn.release();
        }
    }

    // Obtener equipos disponibles (CORREGIDO: estado_especial)
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

    // Obtener impresoras disponibles (CORREGIDO: estado_especial)
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