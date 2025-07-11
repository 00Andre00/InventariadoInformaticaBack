import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface Impresora extends RowDataPacket {
    id: number;
    nombre: string;
    tipo: string;
    ip: string;
    piso: string;
    oficina: string;
    recurso: string;
    modeloRecurso: string;
}

class ImpresoraController {
    // Crear una impresora
    static async crearImpresora(req: Request, res: Response): Promise<Response> {
        const { nombre, tipo, ip, piso, oficina, recurso, modeloRecurso } = req.body;

        if (!nombre || !tipo || !ip || !piso || !oficina || !recurso || !modeloRecurso) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        const query = 'INSERT INTO impresoras (nombre, tipo, ip, piso, oficina, recurso, modeloRecurso) VALUES (?, ?, ?, ?, ?, ?, ?)';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [nombre, tipo, ip, piso, oficina, recurso, modeloRecurso]);
            return res.status(201).json({ message: 'Impresora creada correctamente', id: result.insertId });
        } catch (err: any) {
            console.error('Error al agregar la impresora:', err);
            return res.status(500).json({ error: 'Error al crear la impresora' });
        }
    }

  // Obtener todas las impresoras
    static async obtenerImpresoras(req: Request, res: Response): Promise<Response> {
        // Asegúrate de incluir el campo numeroSerie en el SELECT
        const query = 'SELECT id, nombre, tipo, ip, piso, oficina, recurso, modeloRecurso, numeroSerie FROM impresoras ORDER BY nombre';

        try {
            const [rows] = await db.promise().query<Impresora[]>(query);
            return res.status(200).json({ message: 'Impresoras obtenidas correctamente', data: rows });
        } catch (err) {
            console.error('Error al obtener las impresoras:', err);
            return res.status(500).json({ error: 'Error al obtener las impresoras' });
        }
    }

    // Obtener una impresora por ID
    static async obtenerImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = 'SELECT id, nombre, tipo, ip, piso, oficina, recurso, modeloRecurso FROM impresoras WHERE id = ?';

        try {
            const [rows] = await db.promise().query<Impresora[]>(query, [id]);
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }
            return res.status(200).json({ message: 'Impresora obtenida correctamente', data: rows[0] });
        } catch (err) {
            console.error('Error al obtener la impresora:', err);
            return res.status(500).json({ error: 'Error al obtener la impresora' });
        }
    }

    // Actualizar una impresora
    static async actualizarImpresora(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { nombre, tipo, ip, piso, oficina, recurso, modeloRecurso } = req.body;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        if (!nombre || !tipo || !ip || !piso || !oficina || !recurso || !modeloRecurso) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        const query = 'UPDATE impresoras SET nombre = ?, tipo = ?, ip = ?, piso = ?, oficina = ?, recurso = ?, modeloRecurso = ? WHERE id = ?';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [nombre, tipo, ip, piso, oficina, recurso, modeloRecurso, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Impresora no encontrada' });
            }

            return res.status(200).json({ message: 'Impresora actualizada correctamente' });
        } catch (err: any) {
            console.error('Error al actualizar la impresora:', err);
            return res.status(500).json({ error: 'Error al actualizar la impresora' });
        }
    }

    // Eliminar una impresora
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
}

export default ImpresoraController;
