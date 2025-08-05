import { Request, Response } from 'express';
import db from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface Equipo extends RowDataPacket {
    id: number;
    tipo: string;
    marca: string;
    modelo: string;
    procesador: string;
    grafica: string;
    ram: string;
    almacenamiento: string;
    placaMadre: string;
    oficina: string;
    vlan: string;
    ip: string;
    mac: string;
    numeroSerie: string;
    usuario: string;
}

class EquipoController {
    // Crear un equipo
    static async crearEquipo(req: Request, res: Response): Promise<Response> {
        const {
            tipo,
            marca,
            modelo,
            procesador,
            grafica,
            ram,
            almacenamiento,
            placaMadre,
            oficina,
            vlan,
            ip,
            mac,
            numeroSerie,
            usuario
        } = req.body;

        if (!tipo || !marca || !modelo || !procesador || !ram || !almacenamiento || !oficina || !ip || !mac) {
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

        const query = `
            INSERT INTO equipos 
            (tipo, marca, modelo, procesador, grafica, ram, almacenamiento, placaMadre, oficina, vlan, ip, mac, numeroSerie, usuario) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [
                tipo, marca, modelo, procesador, grafica, ram, almacenamiento, placaMadre, oficina, vlan, ip, mac, numeroSerie, usuario
            ]);
            return res.status(201).json({
                message: 'Equipo creado correctamente',
                id: result.insertId
            });
        } catch (err: any) {
            console.error('Error al agregar el equipo:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe un equipo con esa IP o MAC' });
            }
            return res.status(500).json({ error: 'Error al crear el equipo' });
        }
    }

    // Obtener todos los equipos
    static async obtenerEquipos(req: Request, res: Response): Promise<Response> {
        const query = 'SELECT * FROM equipos ORDER BY id DESC';

        try {
            const [rows] = await db.promise().query<Equipo[]>(query);
            return res.status(200).json({
                message: 'Equipos obtenidos correctamente',
                data: rows
            });
        } catch (err) {
            console.error('Error al obtener los equipos:', err);
            return res.status(500).json({ error: 'Error al obtener los equipos' });
        }
    }

    // Obtener equipo por ID
    static async obtenerEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const query = 'SELECT * FROM equipos WHERE id = ?';

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

    // Actualizar equipo
    static async actualizarEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;
        const {
            tipo,
            marca,
            modelo,
            procesador,
            grafica,
            ram,
            almacenamiento,
            placaMadre,
            oficina,
            vlan,
            ip,
            mac,
            numeroSerie,
            usuario
        } = req.body;

        if (isNaN(Number(id))) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        if (!tipo || !marca || !modelo || !procesador || !ram || !almacenamiento || !oficina || !ip || !mac) {
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

        const query = `
            UPDATE equipos SET 
                tipo = ?, marca = ?, modelo = ?, procesador = ?, grafica = ?, ram = ?, almacenamiento = ?, placaMadre = ?, 
                oficina = ?, vlan = ?, ip = ?, mac = ?, numeroSerie = ?, usuario = ? 
            WHERE id = ?
        `;

        try {
            const [result] = await db.promise().query<ResultSetHeader>(query, [
                tipo, marca, modelo, procesador, grafica, ram, almacenamiento, placaMadre, oficina, vlan, ip, mac, numeroSerie, usuario, id
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Equipo no encontrado' });
            }

            return res.status(200).json({ message: 'Equipo actualizado correctamente' });
        } catch (err: any) {
            console.error('Error al actualizar el equipo:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe un equipo con esa IP o MAC' });
            }
            return res.status(500).json({ error: 'Error al actualizar el equipo' });
        }
    }

    // Eliminar equipo
    static async eliminarEquipo(req: Request, res: Response): Promise<Response> {
        const { id } = req.params;

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

    // Buscar equipos
    static async buscarEquipos(req: Request, res: Response): Promise<Response> {
        const { tipo, marca, modelo, oficina, ip, mac, usuario } = req.query;
        let query = 'SELECT * FROM equipos WHERE 1=1';
        const params: any[] = [];

        if (tipo) {
            query += ' AND tipo = ?';
            params.push(tipo);
        }
        if (marca) {
            query += ' AND marca LIKE ?';
            params.push(`%${marca}%`);
        }
        if (modelo) {
            query += ' AND modelo LIKE ?';
            params.push(`%${modelo}%`);
        }
        if (oficina) {
            query += ' AND oficina LIKE ?';
            params.push(`%${oficina}%`);
        }
        if (ip) {
            query += ' AND ip LIKE ?';
            params.push(`%${ip}%`);
        }
        if (mac) {
            query += ' AND mac LIKE ?';
            params.push(`%${mac}%`);
        }
        if (usuario) {
            query += ' AND usuario LIKE ?';
            params.push(`%${usuario}%`);
        }

        try {
            const [rows] = await db.promise().query<Equipo[]>(query, params);
            return res.status(200).json({ data: rows, total: rows.length });
        } catch (err) {
            console.error('Error al buscar equipos:', err);
            return res.status(500).json({ error: 'Error al buscar equipos' });
        }
    }

    // Exportar equipos (para frontend y Excel)
    static async exportarEquipos(req: Request, res: Response): Promise<Response> {
        const query = `
            SELECT id, tipo, marca, modelo, procesador, grafica, ram, almacenamiento, placaMadre, oficina, vlan, ip, mac, numeroSerie, usuario
            FROM equipos
            ORDER BY id DESC
        `;

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
}

export default EquipoController;