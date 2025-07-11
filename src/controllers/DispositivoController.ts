import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface Dispositivo extends RowDataPacket {
    id: number;
    nombre: string;
    tipo: string;
    piso: string;
    oficina: string;
    cantidad: number; // Cambié 'unidades' por 'cantidad'
    numeroSerie: string;
}

class DispositivoController {
    // Crear un dispositivo
    static async crearDispositivo(req: Request, res: Response): Promise<Response> {
        const { nombre, tipo, piso, oficina, cantidad, numeroSerie } = req.body;

        if (!nombre || !tipo || !piso || !oficina || cantidad === undefined || !numeroSerie) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        const query = 'INSERT INTO dispositivos (nombre, tipo, piso, oficina, cantidad, numeroSerie) VALUES (?, ?, ?, ?, ?, ?)';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [nombre, tipo, piso, oficina, cantidad, numeroSerie]);
            return res.status(201).json({ message: 'Dispositivo creado correctamente', id: result.insertId });
        } catch (err: any) {
            console.error('Error al agregar el dispositivo:', err);
            return res.status(500).json({ error: 'Error al crear el dispositivo' });
        }
    }

    // Obtener todos los dispositivos
    static async obtenerDispositivos(req: Request, res: Response): Promise<Response> {
        const query = 'SELECT id, nombre, tipo, piso, oficina, cantidad, numeroSerie FROM dispositivos ORDER BY nombre';

        try {
            const [rows] = await db.promise().query<Dispositivo[]>(query);
            return res.status(200).json({ message: 'Dispositivos obtenidos correctamente', data: rows });
        } catch (err) {
            console.error('Error al obtener los dispositivos:', err);
            return res.status(500).json({ error: 'Error al obtener los dispositivos' });
        }
    }

    // Obtener un dispositivo por ID
    static async obtenerDispositivo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = 'SELECT id, nombre, tipo, piso, oficina, cantidad, numeroSerie FROM dispositivos WHERE id = ?';

        try {
            const [rows] = await db.promise().query<Dispositivo[]>(query, [id]);
            if (rows.length === 0) {
                return res.status(404).json({ message: 'Dispositivo no encontrado' });
            }
            return res.status(200).json({ message: 'Dispositivo obtenido correctamente', data: rows[0] });
        } catch (err) {
            console.error('Error al obtener el dispositivo:', err);
            return res.status(500).json({ error: 'Error al obtener el dispositivo' });
        }
    }

    // Actualizar un dispositivo
    static async actualizarDispositivo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const { nombre, tipo, piso, oficina, cantidad, numeroSerie } = req.body;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        if (!nombre || !tipo || !piso || !oficina || cantidad === undefined || !numeroSerie) {
            return res.status(400).json({ message: 'Todos los campos son requeridos.' });
        }

        const query = 'UPDATE dispositivos SET nombre = ?, tipo = ?, piso = ?, oficina = ?, cantidad = ?, numeroSerie = ? WHERE id = ?';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [nombre, tipo, piso, oficina, cantidad, numeroSerie, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Dispositivo no encontrado' });
            }

            return res.status(200).json({ message: 'Dispositivo actualizado correctamente' });
        } catch (err: any) {
            console.error('Error al actualizar el dispositivo:', err);
            return res.status(500).json({ error: 'Error al actualizar el dispositivo' });
        }
    }

    // Eliminar un dispositivo
    static async eliminarDispositivo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = 'DELETE FROM dispositivos WHERE id = ?';

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Dispositivo no encontrado' });
            }

            return res.status(200).json({ message: 'Dispositivo eliminado correctamente' });
        } catch (err) {
            console.error('Error al eliminar el dispositivo:', err);
            return res.status(500).json({ error: 'Error al eliminar el dispositivo' });
        }
    }
}

export default DispositivoController;
