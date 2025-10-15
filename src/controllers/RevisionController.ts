import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface EquipoRevision extends RowDataPacket {
    id: number;
    tipo: string;
    marca: string;
    modelo: string;
    codigoPatrimonial: string;
    estado_especial: string;
    usuario_anterior?: string;
}

interface ImpresoraRevision extends RowDataPacket {
    id: number;
    modelo: string;
    codigoPatrimonial: string;
    estado_especial: string;
    usuario_anterior?: string;
}

interface HistorialCambio extends RowDataPacket {
    id: number;
    createdAt: Date;
    accion: string;
    detalles: string;
}

export class RevisionController {
    // Enviar equipo a revisión - CORREGIDO
    static async enviarARevision(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const usuarioSistemaId = (req as any).user.id;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            // Obtener el equipo y su usuario actual
            const [equipo] = await db.promise().query<RowDataPacket[]>(
                `SELECT e.*, u.nombres, u.apellidos 
                 FROM equipos e 
                 LEFT JOIN usuarios u ON e.usuarioId = u.id 
                 WHERE e.id = ?`,
                [id]
            );

            if (equipo.length === 0) {
                return res.status(404).json({ message: 'Equipo no encontrado' });
            }

            const equipoData = equipo[0];
            
            // Guardar el usuario anterior ANTES de cambiar la asignación
            const usuarioAnterior = (equipoData.nombres && equipoData.apellidos) ? 
                `${equipoData.nombres} ${equipoData.apellidos}` : 'Sin asignar';

            // Obtener el ID del usuario empleado especial de informática (DNI: 00000001)
            const [usuarioInformatica] = await db.promise().query<RowDataPacket[]>(
                'SELECT id FROM usuarios WHERE dni = "00000001" LIMIT 1'
            );

            if (usuarioInformatica.length === 0) {
                return res.status(404).json({ message: 'No se encontró el encargado de informática en la base de datos' });
            }

            const informaticaId = usuarioInformatica[0].id;

            // Actualizar equipo a estado revisión y asignar al encargado de informática
            await db.promise().query(
                `UPDATE equipos 
                 SET estado_especial = 'revision', 
                     usuarioId = ?,
                     historial_duenos = CONCAT(IFNULL(historial_duenos, ''), 
                         '| Revisión: ${new Date().toLocaleString('es-PE')} - Usuario anterior: ${usuarioAnterior}')
                 WHERE id = ?`,
                [informaticaId, id]
            );

            // Registrar en historial de cambios
            await db.promise().query(
                `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['equipo', id, 'enviado_a_revision', `Enviado a revisión. Usuario anterior: ${usuarioAnterior}`, usuarioSistemaId]
            );

            return res.status(200).json({ 
                message: 'Equipo enviado a revisión correctamente',
                usuarioAnterior: usuarioAnterior
            });
        } catch (err) {
            console.error('Error al enviar equipo a revisión:', err);
            return res.status(500).json({ error: 'Error al enviar equipo a revisión' });
        }
    }

    // Enviar impresora a revisión - CORREGIDO
    static async enviarImpresoraARevision(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const usuarioSistemaId = (req as any).user.id;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            // Obtener la impresora y su usuario actual
            const [impresora] = await db.promise().query<RowDataPacket[]>(
                `SELECT i.*, u.nombres, u.apellidos 
                 FROM impresoras i 
                 LEFT JOIN usuarios u ON i.usuarioId = u.id 
                 WHERE i.id = ?`,
                [id]
            );

            if (impresora.length === 0) {
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }

            const impresoraData = impresora[0];
            
            // Guardar el usuario anterior ANTES de cambiar la asignación
            const usuarioAnterior = (impresoraData.nombres && impresoraData.apellidos) ? 
                `${impresoraData.nombres} ${impresoraData.apellidos}` : 'Sin asignar';

            // Obtener el ID del usuario empleado especial de informática
            const [usuarioInformatica] = await db.promise().query<RowDataPacket[]>(
                'SELECT id FROM usuarios WHERE dni = "00000001" LIMIT 1'
            );

            if (usuarioInformatica.length === 0) {
                return res.status(404).json({ message: 'No se encontró el encargado de informática' });
            }

            const informaticaId = usuarioInformatica[0].id;

            // Actualizar impresora a estado revisión
            await db.promise().query(
                `UPDATE impresoras 
                 SET estado_especial = 'revision', 
                     usuarioId = ?,
                     historial_duenos = CONCAT(IFNULL(historial_duenos, ''), 
                         '| Revisión: ${new Date().toLocaleString('es-PE')} - Usuario anterior: ${usuarioAnterior}')
                 WHERE id = ?`,
                [informaticaId, id]
            );

            // Registrar en historial
            await db.promise().query(
                `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['impresora', id, 'enviado_a_revision', `Enviado a revisión. Usuario anterior: ${usuarioAnterior}`, usuarioSistemaId]
            );

            return res.status(200).json({ 
                message: 'Impresora enviada a revisión correctamente',
                usuarioAnterior: usuarioAnterior
            });
        } catch (err) {
            console.error('Error al enviar impresora a revisión:', err);
            return res.status(500).json({ error: 'Error al enviar impresora a revisión' });
        }
    }

    // Obtener equipos en revisión - CORREGIDO
    static async obtenerEquiposRevision(req: Request, res: Response): Promise<Response> {
        try {
            const [rows] = await db.promise().query<EquipoRevision[]>(
                `SELECT e.*, 
                        (SELECT CONCAT(u2.nombres, ' ', u2.apellidos) 
                         FROM historial_cambios hc 
                         LEFT JOIN usuarios u2 ON hc.detalles LIKE CONCAT('%Usuario anterior: ', u2.nombres, ' ', u2.apellidos, '%')
                         WHERE hc.activo_id = e.id AND hc.tipo_activo = 'equipo' AND hc.accion = 'enviado_a_revision'
                         ORDER BY hc.createdAt DESC LIMIT 1) as usuario_anterior
                 FROM equipos e
                 WHERE e.estado_especial = 'revision'
                 ORDER BY e.id DESC`
            );

            return res.status(200).json({
                message: 'Equipos en revisión obtenidos correctamente',
                data: rows
            });
        } catch (err) {
            console.error('Error al obtener equipos en revisión:', err);
            return res.status(500).json({ error: 'Error al obtener equipos en revisión' });
        }
    }

    // Obtener impresoras en revisión - CORREGIDO
    static async obtenerImpresorasRevision(req: Request, res: Response): Promise<Response> {
        try {
            const [rows] = await db.promise().query<ImpresoraRevision[]>(
                `SELECT i.*, 
                        (SELECT CONCAT(u2.nombres, ' ', u2.apellidos) 
                         FROM historial_cambios hc 
                         LEFT JOIN usuarios u2 ON hc.detalles LIKE CONCAT('%Usuario anterior: ', u2.nombres, ' ', u2.apellidos, '%')
                         WHERE hc.activo_id = i.id AND hc.tipo_activo = 'impresora' AND hc.accion = 'enviado_a_revision'
                         ORDER BY hc.createdAt DESC LIMIT 1) as usuario_anterior
                 FROM impresoras i
                 WHERE i.estado_especial = 'revision'
                 ORDER BY i.id DESC`
            );

            return res.status(200).json({
                message: 'Impresoras en revisión obtenidas correctamente',
                data: rows
            });
        } catch (err) {
            console.error('Error al obtener impresoras en revisión:', err);
            return res.status(500).json({ error: 'Error al obtener impresoras en revisión' });
        }
    }

    // Reparar equipo (cambiar a disponible) - CORREGIDO
    static async repararEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const usuarioSistemaId = (req as any).user.id;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            // Obtener el ID del usuario empleado especial de informática
            const [usuarioInformatica] = await db.promise().query<RowDataPacket[]>(
                'SELECT id FROM usuarios WHERE dni = "00000001" LIMIT 1'
            );

            if (usuarioInformatica.length === 0) {
                return res.status(404).json({ message: 'No se encontró el jefe de informática' });
            }

            const informaticaId = usuarioInformatica[0].id;

            await db.promise().query(
                `UPDATE equipos 
                 SET estado_especial = 'disponible',
                     estado = 'bueno',
                     usuarioId = ?,
                     historial_duenos = CONCAT(IFNULL(historial_duenos, ''), 
                         '| Disponible: ${new Date().toLocaleString('es-PE')} - Asignado a Informática')
                 WHERE id = ?`,
                [informaticaId, id]
            );

            // Registrar en historial
            await db.promise().query(
                `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['equipo', id, 'reparado', 'Equipo reparado y marcado como disponible (asignado a Informática)', usuarioSistemaId]
            );

            return res.status(200).json({ message: 'Equipo marcado como reparado y disponible' });
        } catch (err) {
            console.error('Error al reparar equipo:', err);
            return res.status(500).json({ error: 'Error al reparar equipo' });
        }
    }

    // Reparar impresora (cambiar a disponible) - CORREGIDO
    static async repararImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const usuarioSistemaId = (req as any).user.id;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            // Obtener el ID del usuario empleado especial de informática
            const [usuarioInformatica] = await db.promise().query<RowDataPacket[]>(
                'SELECT id FROM usuarios WHERE dni = "00000001" LIMIT 1'
            );

            if (usuarioInformatica.length === 0) {
                return res.status(404).json({ message: 'No se encontró el jefe de informática' });
            }

            const informaticaId = usuarioInformatica[0].id;

            await db.promise().query(
                `UPDATE impresoras 
                 SET estado_especial = 'disponible',
                     estado = 'bueno',
                     usuarioId = ?,
                     historial_duenos = CONCAT(IFNULL(historial_duenos, ''), 
                         '| Disponible: ${new Date().toLocaleString('es-PE')} - Asignado a Informática')
                 WHERE id = ?`,
                [informaticaId, id]
            );

            // Registrar en historial
            await db.promise().query(
                `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['impresora', id, 'reparada', 'Impresora reparada y marcada como disponible (asignada a Informática)', usuarioSistemaId]
            );

            return res.status(200).json({ message: 'Impresora marcada como reparada y disponible' });
        } catch (err) {
            console.error('Error al reparar impresora:', err);
            return res.status(500).json({ error: 'Error al reparar impresora' });
        }
    }

    // Dar de baja equipo - MEJORADO usando historial_cambios
    static async darDeBaja(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const usuarioSistemaId = (req as any).user.id;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            // Obtener ID del usuario empleado especial de patrimonio (DNI: 00000002)
            const [usuarioPatrimonio] = await db.promise().query<RowDataPacket[]>(
                'SELECT id FROM usuarios WHERE dni = "00000002" LIMIT 1'
            );

            if (usuarioPatrimonio.length === 0) {
                return res.status(404).json({ message: 'No se encontró el jefe de patrimonio en la base de datos' });
            }

            const patrimonioId = usuarioPatrimonio[0].id;

            await db.promise().query(
                `UPDATE equipos 
                 SET estado_especial = 'baja',
                     usuarioId = ?,
                     historial_duenos = CONCAT(IFNULL(historial_duenos, ''), 
                         '| Baja: ${new Date().toLocaleString('es-PE')} - Asignado a Patrimonio')
                 WHERE id = ?`,
                [patrimonioId, id]
            );

            // Registrar en historial_cambios - aquí está la fecha REAL
            await db.promise().query(
                `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['equipo', id, 'dado_de_baja', 'Equipo dado de baja y asignado a patrimonio', usuarioSistemaId]
            );

            return res.status(200).json({ 
                message: 'Equipo dado de baja correctamente',
                fechaBaja: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error al dar de baja equipo:', err);
            return res.status(500).json({ error: 'Error al dar de baja equipo' });
        }
    }

    // Dar de baja impresora - MEJORADO usando historial_cambios
    static async darDeBajaImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const usuarioSistemaId = (req as any).user.id;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            // Obtener ID del usuario empleado especial de patrimonio (DNI: 00000002)
            const [usuarioPatrimonio] = await db.promise().query<RowDataPacket[]>(
                'SELECT id FROM usuarios WHERE dni = "00000002" LIMIT 1'
            );

            if (usuarioPatrimonio.length === 0) {
                return res.status(404).json({ message: 'No se encontró el jefe de patrimonio en la base de datos' });
            }

            const patrimonioId = usuarioPatrimonio[0].id;

            await db.promise().query(
                `UPDATE impresoras 
                 SET estado_especial = 'baja',
                     usuarioId = ?,
                     historial_duenos = CONCAT(IFNULL(historial_duenos, ''), 
                         '| Baja: ${new Date().toLocaleString('es-PE')} - Asignado a Patrimonio')
                 WHERE id = ?`,
                [patrimonioId, id]
            );

            // Registrar en historial_cambios - aquí está la fecha REAL
            await db.promise().query(
                `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['impresora', id, 'dada_de_baja', 'Impresora dada de baja y asignada a patrimonio', usuarioSistemaId]
            );

            return res.status(200).json({ 
                message: 'Impresora dada de baja correctamente',
                fechaBaja: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error al dar de baja impresora:', err);
            return res.status(500).json({ error: 'Error al dar de baja impresora' });
        }
    }

    // Obtener equipos disponibles
    static async obtenerEquiposDisponibles(req: Request, res: Response): Promise<Response> {
        try {
            const [rows] = await db.promise().query<EquipoRevision[]>(
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
            const [rows] = await db.promise().query<ImpresoraRevision[]>(
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

    // Obtener fecha de baja desde historial_cambios - MEJORADO
    static async obtenerFechaBaja(req: Request, res: Response): Promise<Response> {
        const { tipo, id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            const [historial] = await db.promise().query<HistorialCambio[]>(
                `SELECT createdAt, accion, detalles 
                 FROM historial_cambios 
                 WHERE tipo_activo = ? AND activo_id = ? AND accion IN ('dado_de_baja', 'dada_de_baja')
                 ORDER BY createdAt DESC 
                 LIMIT 1`,
                [tipo, id]
            );

            if (historial.length === 0) {
                return res.status(200).json({
                    message: 'No se encontró registro de baja',
                    fechaBaja: null,
                    tieneBaja: false
                });
            }

            const registroBaja = historial[0];
            const fechaBaja = registroBaja.createdAt;

            return res.status(200).json({
                message: 'Fecha de baja obtenida correctamente',
                fechaBaja: fechaBaja,
                fechaBajaLegible: new Date(fechaBaja).toLocaleString('es-PE'),
                tieneBaja: true,
                detalles: registroBaja.detalles
            });
        } catch (err) {
            console.error('Error al obtener fecha de baja:', err);
            return res.status(500).json({ error: 'Error al obtener fecha de baja' });
        }
    }

    // Obtener historial completo de un equipo/impresora
    static async obtenerHistorialCompleto(req: Request, res: Response): Promise<Response> {
        const { tipo, id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        try {
            const [historial] = await db.promise().query<HistorialCambio[]>(
                `SELECT hc.*, us.nombre as usuario_sistema_nombre
                 FROM historial_cambios hc
                 LEFT JOIN usuarios_sistema us ON hc.usuario_sistema_id = us.id
                 WHERE hc.tipo_activo = ? AND hc.activo_id = ?
                 ORDER BY hc.createdAt DESC`,
                [tipo, id]
            );

            return res.status(200).json({
                message: 'Historial obtenido correctamente',
                data: historial
            });
        } catch (err) {
            console.error('Error al obtener historial:', err);
            return res.status(500).json({ error: 'Error al obtener historial' });
        }
    }
    
}