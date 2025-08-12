import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface Impresora extends RowDataPacket {
    id: number;
    modelo: string;
    ip: string;
    mac: string;
    oficina: string;
    codigoPatrimonial: string;
    usuarioId?: number;
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
        const { modelo, ip, mac, oficina, codigoPatrimonial, usuarioId } = req.body;

        if (!modelo || !ip || !mac || !oficina || !codigoPatrimonial) {
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

        const query = `
            INSERT INTO impresoras 
            (modelo, ip, mac, oficina, codigoPatrimonial, usuarioId) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [
                modelo, ip, mac, oficina, codigoPatrimonial, usuarioId || null
            ]);
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
        const { modelo, ip, mac, oficina, codigoPatrimonial, usuarioId } = req.body;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        if (!modelo || !ip || !mac || !oficina || !codigoPatrimonial) {
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

        const query = `
            UPDATE impresoras SET 
                modelo = ?, ip = ?, mac = ?, oficina = ?, 
                codigoPatrimonial = ?, usuarioId = ?
            WHERE id = ?
        `;

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [
                modelo, ip, mac, oficina, codigoPatrimonial, usuarioId || null, id
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }

            return res.status(200).json({ message: 'Impresora actualizada correctamente' });
        } catch (err: any) {
            console.error('Error al actualizar la impresora:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe una impresora con esa IP o MAC' });
            }
            return res.status(500).json({ error: 'Error al actualizar la impresora' });
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
                i.id, i.modelo, i.ip, i.mac, i.oficina, i.codigoPatrimonial,
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
}

export default ImpresoraController;