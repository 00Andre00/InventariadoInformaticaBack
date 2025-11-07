import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { HistorialHelper } from '../utils/historialHelper';

interface Impresora extends RowDataPacket {
    id: number;
    modelo: string;
    ip: string;
    mac: string;
    oficina: string;
    codigoPatrimonial: string;
    estado: string;
    usuarioId?: number;
    estado_especial?: string;
}

interface Usuario extends RowDataPacket {
    id: number;
    dni: string;
    nombres: string;
    apellidos: string;
    oficina: string;
    tipoContrato: string;
}

class ImpresoraController {
    // Crear una impresora
    static async crearImpresora(req: Request, res: Response): Promise<Response> {
        const { modelo, ip, mac, oficina, codigoPatrimonial, estado, usuarioId } = req.body;

        if (!modelo || !ip || !mac || !oficina || !codigoPatrimonial || !estado) {
            return res.status(400).json({ message: 'Faltan campos requeridos.' });
        }

        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({ message: 'Formato de IP inválido.' });
        }

        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(mac)) {
            return res.status(400).json({ message: 'Formato de MAC inválido.' });
        }

        // Verificar si el usuario existe si se proporciona usuarioId
        if (usuarioId) {
            try {
                const [usuario] = await db.promise().query<Usuario[]>(
                    'SELECT id FROM usuarios WHERE id = ?', 
                    [usuarioId]
                );
                if (usuario.length === 0) {
                    return res.status(400).json({ message: 'El usuario especificado no existe' });
                }
            } catch (err) {
                console.error('Error al verificar usuario:', err);
                return res.status(500).json({ error: 'Error al verificar usuario' });
            }
        }

        // Determinar estado_especial basado en si tiene usuario asignado
        const estadoEspecial = usuarioId ? 'asignado' : 'disponible';

        const query = `
            INSERT INTO impresoras 
            (modelo, ip, mac, oficina, codigoPatrimonial, estado, usuarioId, estado_especial) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [
                modelo, ip, mac, oficina, codigoPatrimonial, estado, usuarioId || null, estadoEspecial
            ]);

            // Registrar en historial si se asignó a un usuario
            if (usuarioId) {
                const detalles = {
                    prev: {
                        usuarioId: null,
                        estado_especial: 'disponible',
                        estado: estado
                    },
                    next: {
                        usuarioId: usuarioId,
                        estado_especial: 'asignado',
                        estado: estado
                    },
                    nota: `Creada y asignada a usuario ${usuarioId}`
                };

                await HistorialHelper.registrarCambio(
                    'impresora',
                    result.insertId,
                    'asignacion',
                    detalles,
                    1 // Usuario sistema por defecto
                );
            }

            return res.status(201).json({ 
                message: 'Impresora creada correctamente', 
                id: result.insertId 
            });
        } catch (err: any) {
            console.error('Error al agregar la impresora:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe una impresora con esa IP o MAC' });
            }
            return res.status(500).json({ error: 'Error al crear la impresora' });
        }
    }

    // Obtener todas las impresoras con información de usuario
    static async obtenerImpresoras(req: Request, res: Response): Promise<Response> {
        const query = `
            SELECT i.*, 
                   u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
            FROM impresoras i
            LEFT JOIN usuarios u ON i.usuarioId = u.id
            ORDER BY i.modelo
        `;

        try {
            const [rows] = await db.promise().query<(Impresora & Usuario)[]>(query);
            
            const impresoras = rows.map(impresora => ({
                ...impresora,
                usuario: impresora.usuario_id ? {
                    id: impresora.usuario_id,
                    dni: impresora.dni,
                    nombres: impresora.nombres,
                    apellidos: impresora.apellidos,
                    tipoContrato: impresora.tipoContrato
                } : null
            }));

            return res.status(200).json({
                message: 'Impresoras obtenidas correctamente',
                data: impresoras
            });
        } catch (err) {
            console.error('Error al obtener las impresoras:', err);
            return res.status(500).json({ error: 'Error al obtener las impresoras' });
        }
    }

    // Obtener impresora por ID con información de usuario
    static async obtenerImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = `
            SELECT i.*, 
                   u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
            FROM impresoras i
            LEFT JOIN usuarios u ON i.usuarioId = u.id
            WHERE i.id = ?
        `;

        try {
            const [rows] = await db.promise().query<(Impresora & Usuario)[]>(query, [id]);

            if (rows.length === 0) {
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }

            const impresora = {
                ...rows[0],
                usuario: rows[0].usuario_id ? {
                    id: rows[0].usuario_id,
                    dni: rows[0].dni,
                    nombres: rows[0].nombres,
                    apellidos: rows[0].apellidos,
                    tipoContrato: rows[0].tipoContrato
                } : null
            };

            return res.status(200).json({ 
                message: 'Impresora obtenida correctamente', 
                data: impresora 
            });
        } catch (err) {
            console.error('Error al obtener la impresora:', err);
            return res.status(500).json({ error: 'Error al obtener la impresora' });
        }
    }

    // Actualizar impresora (incluyendo relación con usuario)
    static async actualizarImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { modelo, ip, mac, oficina, codigoPatrimonial, estado, usuarioId } = req.body;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        if (!modelo || !ip || !mac || !oficina || !codigoPatrimonial || !estado) {
            return res.status(400).json({ message: 'Faltan campos requeridos.' });
        }

        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({ message: 'Formato de IP inválido.' });
        }

        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(mac)) {
            return res.status(400).json({ message: 'Formato de MAC inválido.' });
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
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }

            const impresoraPrev = impresoraAnterior[0];

            // Verificar si el usuario existe si se proporciona usuarioId
            if (usuarioId) {
                const [usuario] = await conn.query<Usuario[]>(
                    'SELECT id FROM usuarios WHERE id = ?', 
                    [usuarioId]
                );
                if (usuario.length === 0) {
                    await conn.rollback();
                    return res.status(400).json({ message: 'El usuario especificado no existe' });
                }
            }

            // Determinar estado_especial basado en si tiene usuario asignado
            const estadoEspecial = usuarioId ? 'asignado' : 'disponible';

            // 2. Actualizar impresora (AGREGAR estado_especial)
            const query = `
                UPDATE impresoras SET 
                    modelo = ?, ip = ?, mac = ?, oficina = ?, 
                    codigoPatrimonial = ?, estado = ?, usuarioId = ?, estado_especial = ?
                WHERE id = ?
            `;

            const [result] = await conn.query<ResultSetHeader>(query, [
                modelo, ip, mac, oficina, codigoPatrimonial, estado, usuarioId || null, estadoEspecial, id
            ]);

            if (result.affectedRows === 0) {
                await conn.rollback();
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }

// 3. Registrar en historial si hay cambios importantes
const cambios: string[] = [];

// Verificar cambios en asignación/desasignación
if (impresoraPrev.usuarioId !== (usuarioId || null)) {
    if (usuarioId) {
        cambios.push('asignacion');
    } else {
        cambios.push('desasignacion');
    }
}

if (impresoraPrev.oficina !== oficina) {
    cambios.push('traslado');
}

if (impresoraPrev.ip !== ip || impresoraPrev.mac !== mac) {
    cambios.push('actualizacion_red');
}

if (impresoraPrev.estado !== estado) {
    cambios.push('cambio_estado');
}

// ✅ CORREGIDO: Registrar solo UN registro de historial con todos los cambios
if (cambios.length > 0) {
    let accionPrincipal = 'actualizacion';
    let nota = 'Actualización desde panel';
    
    // Determinar la acción principal (prioridad: asignación > otros cambios)
    if (cambios.includes('asignacion') || cambios.includes('desasignacion')) {
        accionPrincipal = cambios.includes('asignacion') ? 'asignacion' : 'desasignacion';
        nota = `Reasignación - ${accionPrincipal}`;
    } else if (cambios.includes('traslado')) {
        accionPrincipal = 'traslado';
        nota = `Traslado de oficina desde ${impresoraPrev.oficina} a ${oficina}`;
    }

    const detallesHistorial = {
        prev: {
            usuarioId: impresoraPrev.usuarioId,
            oficina: impresoraPrev.oficina,
            ip: impresoraPrev.ip,
            mac: impresoraPrev.mac,
            estado: impresoraPrev.estado,
            estado_especial: impresoraPrev.estado_especial
        },
        next: {
            usuarioId: usuarioId || null,
            oficina: oficina,
            ip: ip,
            mac: mac,
            estado: estado,
            estado_especial: estadoEspecial
        },
        nota: nota,
        cambios_realizados: cambios // ✅ Incluir lista de cambios en los detalles
    };

    await HistorialHelper.registrarCambio(
        'impresora',
        parseInt(id),
        accionPrincipal,
        detallesHistorial,
        usuarioSistemaId
    );
}

            await conn.commit();

            return res.status(200).json({ message: 'Impresora actualizada correctamente' });
        } catch (err: any) {
            await conn.rollback();
            console.error('Error al actualizar la impresora:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe una impresora con esa IP o MAC' });
            }
            return res.status(500).json({ error: 'Error al actualizar la impresora' });
        } finally {
            conn.release();
        }
    }

    // Eliminar impresora
    static async eliminarImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = 'DELETE FROM impresoras WHERE id = ?';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }

            return res.status(200).json({ message: 'Impresora eliminada correctamente' });
        } catch (err) {
            console.error('Error al eliminar la impresora:', err);
            return res.status(500).json({ error: 'Error al eliminar la impresora' });
        }
    }

    // Buscar impresoras (con filtro por usuario)
    static async buscarImpresoras(req: Request, res: Response): Promise<Response> {
        const { 
            modelo, 
            ip, 
            mac, 
            oficina,
            estado,
            usuarioId
        } = req.query;
        
        let query = `
            SELECT i.*, 
                   u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
            FROM impresoras i
            LEFT JOIN usuarios u ON i.usuarioId = u.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (modelo) {
            query += ' AND i.modelo LIKE ?';
            params.push(`%${modelo}%`);
        }
        if (ip) {
            query += ' AND i.ip LIKE ?';
            params.push(`%${ip}%`);
        }
        if (mac) {
            query += ' AND i.mac LIKE ?';
            params.push(`%${mac}%`);
        }
        if (oficina) {
            query += ' AND i.oficina LIKE ?';
            params.push(`%${oficina}%`);
        }
        if (estado) {
            query += ' AND i.estado = ?';
            params.push(estado);
        }
        if (usuarioId) {
            query += ' AND i.usuarioId = ?';
            params.push(usuarioId);
        }

        try {
            const [rows] = await db.promise().query<(Impresora & Usuario)[]>(query, params);
            
            const impresoras = rows.map(impresora => ({
                ...impresora,
                usuario: impresora.usuario_id ? {
                    id: impresora.usuario_id,
                    dni: impresora.dni,
                    nombres: impresora.nombres,
                    apellidos: impresora.apellidos,
                    tipoContrato: impresora.tipoContrato
                } : null
            }));

            return res.status(200).json({ 
                data: impresoras, 
                total: impresoras.length 
            });
        } catch (err) {
            console.error('Error al buscar impresoras:', err);
            return res.status(500).json({ error: 'Error al buscar impresoras' });
        }
    }

    // Exportar impresoras (incluyendo datos de usuario)
    static async exportarImpresoras(req: Request, res: Response): Promise<Response> {
        const query = `
            SELECT 
                i.id, i.modelo, i.ip, i.mac, i.oficina, i.codigoPatrimonial, i.estado,
                u.dni, CONCAT(u.nombres, ' ', u.apellidos) as usuario,
                u.tipoContrato
            FROM impresoras i
            LEFT JOIN usuarios u ON i.usuarioId = u.id
            ORDER BY i.modelo
        `;

        try {
            const [rows] = await db.promise().query<Impresora[]>(query);
            return res.status(200).json({
                message: 'Impresoras exportadas correctamente',
                data: rows,
                total: rows.length
            });
        } catch (err) {
            console.error('Error al exportar las impresoras:', err);
            return res.status(500).json({ error: 'Error al exportar las impresoras' });
        }
    }

    // Obtener impresoras por usuario
static async obtenerImpresorasPorUsuario(req: Request, res: Response): Promise<Response> {
    const { usuarioId } = req.params;

    if (isNaN(Number(usuarioId))) {
        return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    const query = `
        SELECT i.*, 
               u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
        FROM impresoras i
        LEFT JOIN usuarios u ON i.usuarioId = u.id
        WHERE i.usuarioId = ? AND i.estado_especial = 'asignado'
        ORDER BY i.id DESC
    `;

    try {
        const [rows] = await db.promise().query<(Impresora & Usuario)[]>(query, [usuarioId]);

        const impresoras = rows.map((impresora) => ({
            ...impresora,
            usuario: impresora.usuario_id
                ? {
                    id: impresora.usuario_id,
                    dni: impresora.dni,
                    nombres: impresora.nombres,
                    apellidos: impresora.apellidos,
                    tipoContrato: impresora.tipoContrato,
                }
                : null,
        }));

        return res.status(200).json({
            message: "Impresoras del usuario obtenidas correctamente",
            data: impresoras,
        });
    } catch (err) {
        console.error("Error al obtener impresoras del usuario:", err);
        return res.status(500).json({ error: "Error al obtener las impresoras del usuario" });
    }
}

static async transferenciaEnBloque(req: Request, res: Response): Promise<Response> {
    const { usuarioOrigenId, usuarioDestinoId, impresoraIds } = req.body;
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);

    if (!usuarioOrigenId || !usuarioDestinoId || !impresoraIds || !Array.isArray(impresoraIds)) {
        return res.status(400).json({ 
            error: 'Datos inválidos para transferencia en bloque' 
        });
    }

    if (usuarioOrigenId === usuarioDestinoId) {
        return res.status(400).json({ 
            error: 'El usuario origen y destino no pueden ser el mismo' 
        });
    }

    const conn = await db.promise().getConnection();

    try {
        await conn.beginTransaction();

        // 1. Verificar que el usuario destino existe
        const [usuarioDestino] = await conn.query<RowDataPacket[]>(
            'SELECT id, nombres, apellidos, oficina FROM usuarios WHERE id = ?',
            [usuarioDestinoId]
        );

        if (usuarioDestino.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Usuario destino no encontrado' });
        }

        const usuarioDestinoData = usuarioDestino[0];

        // 2. Verificar que las impresoras existen y pertenecen al usuario origen
        // ✅ CORREGIDO: Usar parámetros directamente en el array
        const [impresoras] = await conn.query<RowDataPacket[]>(
            `SELECT id, modelo, codigoPatrimonial, oficina, usuarioId 
             FROM impresoras 
             WHERE id IN (?) AND usuarioId = ? AND estado_especial = 'asignado'`,
            [impresoraIds, usuarioOrigenId] // ✅ Pasar el array directamente
        );

        if (impresoras.length !== impresoraIds.length) {
            await conn.rollback();
            return res.status(400).json({ 
                error: 'Algunas impresoras no existen o no pertenecen al usuario origen' 
            });
        }

        // 3. Actualizar cada impresora
        for (const impresora of impresoras) {
            const query = `
                UPDATE impresoras 
                SET usuarioId = ?, oficina = ?, estado_especial = 'asignado'
                WHERE id = ?
            `;

            await conn.query(query, [
                usuarioDestinoId,
                usuarioDestinoData.oficina,
                impresora.id
            ]);

            // 4. Registrar en historial para cada impresora
            const detallesHistorial = {
                prev: {
                    usuarioId: usuarioOrigenId,
                    oficina: impresora.oficina,
                    estado_especial: 'asignado'
                },
                next: {
                    usuarioId: usuarioDestinoId,
                    oficina: usuarioDestinoData.oficina,
                    estado_especial: 'asignado'
                },
                nota: `Transferencia masiva desde usuario ${usuarioOrigenId} a ${usuarioDestinoData.nombres} ${usuarioDestinoData.apellidos}`,
                cambios_realizados: ['reasignacion', 'traslado']
            };

            await HistorialHelper.registrarCambio(
                'impresora',
                impresora.id,
                'reasignacion',
                detallesHistorial,
                usuarioSistemaId
            );
        }

        await conn.commit();

        return res.status(200).json({
            message: `Transferencia completada: ${impresoras.length} impresora(s) transferidas exitosamente`,
            impresorasTransferidas: impresoras.length
        });

    } catch (err: any) {
        await conn.rollback();
        console.error('Error en transferencia en bloque de impresoras:', err);
        return res.status(500).json({ 
            error: 'Error al realizar la transferencia en bloque de impresoras' 
        });
    } finally {
        conn.release();
    }
}

}

export default ImpresoraController;