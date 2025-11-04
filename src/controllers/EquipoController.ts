import { Request, Response } from "express";
import db from "../config/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { HistorialHelper } from "../utils/historialHelper";

interface Equipo extends RowDataPacket {
  id: number;
  tipo: string;
  marca: string;
  modelo: string;
  procesador: string;
  ram: string;
  almacenamiento: string;
  oficina: string;
  ip: string;
  mac: string;
  codigoPatrimonial: string;
  so: string;
  officeVersion: string;
  antivirus: string;
  estado: string;
  marcaMonitor: string;
  pulgadasMonitor: string;
  codigoPatrimonialMonitor: string;
  estadoMonitor: string;
  tieneTeclado: number;
  tieneMouse: number;
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

class EquipoController {
  // Crear un equipo
  static async crearEquipo(req: Request, res: Response): Promise<Response> {
    const {
      tipo,
      marca,
      modelo,
      procesador,
      ram,
      almacenamiento,
      oficina,
      ip,
      mac,
      codigoPatrimonial,
      so,
      officeVersion,
      antivirus,
      estado,
      marcaMonitor,
      pulgadasMonitor,
      codigoPatrimonialMonitor,
      estadoMonitor,
      tieneTeclado,
      tieneMouse,
      usuarioId,
    } = req.body;

    if (
      !tipo ||
      !marca ||
      !modelo ||
      !procesador ||
      !ram ||
      !almacenamiento ||
      !oficina ||
      !ip ||
      !mac ||
      !estado ||
      !marcaMonitor ||
      !pulgadasMonitor ||
      !estadoMonitor
    ) {
      return res.status(400).json({ message: "Faltan campos requeridos." });
    }

    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ message: "Formato de IP inválido." });
    }

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(mac)) {
      return res.status(400).json({ message: "Formato de MAC inválido." });
    }

    // Verificar si el usuario existe si se proporciona usuarioId
    if (usuarioId) {
      try {
        const [usuario] = await db
          .promise()
          .query<Usuario[]>("SELECT id FROM usuarios WHERE id = ?", [
            usuarioId,
          ]);
        if (usuario.length === 0) {
          return res
            .status(400)
            .json({ message: "El usuario especificado no existe" });
        }
      } catch (err) {
        console.error("Error al verificar usuario:", err);
        return res.status(500).json({ error: "Error al verificar usuario" });
      }
    }

    // LÓGICA CORREGIDA para estado_especial
    let estadoEspecial = "disponible";
    if (usuarioId) {
      estadoEspecial = "asignado";
    }
    if (estado && estado.toLowerCase() === "revision") {
      estadoEspecial = "revision";
    }

    // ✅ NUEVO: Verificar IP/MAC duplicada en equipos E impresoras
    const [ipExistente] = await db.promise().query<RowDataPacket[]>(
      `SELECT 'equipo' as tipo, id FROM equipos WHERE ip = ? 
     UNION ALL 
     SELECT 'impresora' as tipo, id FROM impresoras WHERE ip = ?`,
      [ip, ip]
    );

    if (ipExistente.length > 0) {
      return res.status(409).json({
        error: `Ya existe un ${ipExistente[0].tipo} con la IP ${ip}`,
      });
    }

    const [macExistente] = await db.promise().query<RowDataPacket[]>(
      `SELECT 'equipo' as tipo, id FROM equipos WHERE mac = ? 
     UNION ALL 
     SELECT 'impresora' as tipo, id FROM impresoras WHERE mac = ?`,
      [mac, mac]
    );

    if (macExistente.length > 0) {
      return res.status(409).json({
        error: `Ya existe un ${macExistente[0].tipo} con la MAC ${mac}`,
      });
    }

    const query = `
    INSERT INTO equipos 
    (tipo, marca, modelo, procesador, ram, almacenamiento, oficina, ip, mac, 
     codigoPatrimonial, so, officeVersion, antivirus, estado, estado_especial,
     marcaMonitor, pulgadasMonitor, codigoPatrimonialMonitor, estadoMonitor,
     tieneTeclado, tieneMouse, usuarioId) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

    try {
      const [result] = await db
        .promise()
        .query<ResultSetHeader>(query, [
          tipo,
          marca,
          modelo,
          procesador,
          ram,
          almacenamiento,
          oficina,
          ip,
          mac,
          codigoPatrimonial,
          so,
          officeVersion,
          antivirus,
          estado,
          estadoEspecial,
          marcaMonitor,
          pulgadasMonitor,
          codigoPatrimonialMonitor || null,
          estadoMonitor,
          tieneTeclado ? 1 : 0,
          tieneMouse ? 1 : 0,
          usuarioId || null,
        ]);

      return res.status(201).json({
        message: "Equipo creado correctamente",
        id: result.insertId,
      });
    } catch (err: any) {
      console.error("Error al agregar el equipo:", err);
      if (err.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ error: "Ya existe un equipo con esa IP o MAC" });
      }
      return res.status(500).json({ error: "Error al crear el equipo" });
    }
  }

  // Obtener todos los equipos con información de usuario
  static async obtenerEquipos(req: Request, res: Response): Promise<Response> {
    const query = `
            SELECT e.*, 
                   u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
            FROM equipos e
            LEFT JOIN usuarios u ON e.usuarioId = u.id
            ORDER BY e.id DESC
        `;

    try {
      const [rows] = await db.promise().query<(Equipo & Usuario)[]>(query);

      const equipos = rows.map((equipo) => ({
        ...equipo,
        tieneTeclado: equipo.tieneTeclado === 1,
        tieneMouse: equipo.tieneMouse === 1,
        usuario: equipo.usuario_id
          ? {
              id: equipo.usuario_id,
              dni: equipo.dni,
              nombres: equipo.nombres,
              apellidos: equipo.apellidos,
              tipoContrato: equipo.tipoContrato,
            }
          : null,
      }));

      return res.status(200).json({
        message: "Equipos obtenidos correctamente",
        data: equipos,
      });
    } catch (err) {
      console.error("Error al obtener los equipos:", err);
      return res.status(500).json({ error: "Error al obtener los equipos" });
    }
  }

  // Obtener equipo por ID con información de usuario
  static async obtenerEquipo(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    if (isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const query = `
            SELECT e.*, 
                   u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
            FROM equipos e
            LEFT JOIN usuarios u ON e.usuarioId = u.id
            WHERE e.id = ?
        `;

    try {
      const [rows] = await db
        .promise()
        .query<(Equipo & Usuario)[]>(query, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ message: "Equipo no encontrado" });
      }

      const equipo = {
        ...rows[0],
        tieneTeclado: rows[0].tieneTeclado === 1,
        tieneMouse: rows[0].tieneMouse === 1,
        usuario: rows[0].usuario_id
          ? {
              id: rows[0].usuario_id,
              dni: rows[0].dni,
              nombres: rows[0].nombres,
              apellidos: rows[0].apellidos,
              tipoContrato: rows[0].tipoContrato,
            }
          : null,
      };

      return res.status(200).json({
        message: "Equipo obtenido correctamente",
        data: equipo,
      });
    } catch (err) {
      console.error("Error al obtener el equipo:", err);
      return res.status(500).json({ error: "Error al obtener el equipo" });
    }
  }

static async actualizarEquipo(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const {
        tipo, marca, modelo, procesador, ram, almacenamiento, oficina,
        ip, mac, codigoPatrimonial, so, officeVersion, antivirus, estado,
        marcaMonitor, pulgadasMonitor, codigoPatrimonialMonitor, estadoMonitor,
        tieneTeclado, tieneMouse, usuarioId
    } = req.body;

    if (isNaN(Number(id))) {
        return res.status(400).json({ message: 'ID inválido' });
    }

    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    const conn = await db.promise().getConnection();

    try {
        await conn.beginTransaction();

        const [equipoAnterior] = await conn.query<RowDataPacket[]>(
            `SELECT * FROM equipos WHERE id = ?`, 
            [id]
        );

        if (equipoAnterior.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Equipo no encontrado' });
        }

        const equipoPrev = equipoAnterior[0];

        if (ip !== equipoPrev.ip) {
            const [ipExistente] = await conn.query<RowDataPacket[]>(
                `SELECT 'equipo' as tipo, id FROM equipos WHERE ip = ? AND id != ?
                 UNION ALL 
                 SELECT 'impresora' as tipo, id FROM impresoras WHERE ip = ?`,
                [ip, id, ip]
            );

            if (ipExistente.length > 0) {
                await conn.rollback();
                return res.status(409).json({ 
                    error: `Ya existe un ${ipExistente[0].tipo} con la IP ${ip}` 
                });
            }
        }

        if (mac !== equipoPrev.mac) {
            const [macExistente] = await conn.query<RowDataPacket[]>(
                `SELECT 'equipo' as tipo, id FROM equipos WHERE mac = ? AND id != ?
                 UNION ALL 
                 SELECT 'impresora' as tipo, id FROM impresoras WHERE mac = ?`,
                [mac, id, mac]
            );

            if (macExistente.length > 0) {
                await conn.rollback();
                return res.status(409).json({ 
                    error: `Ya existe un ${macExistente[0].tipo} con la MAC ${mac}` 
                });
            }
        }

        let estadoEspecial = equipoPrev.estado_especial;
        
        if (estado && estado.toLowerCase() === 'revision') {
            estadoEspecial = 'revision';
        } else if (usuarioId) {
            estadoEspecial = 'asignado';
        } else if (estadoEspecial !== 'baja') {
            estadoEspecial = 'disponible';
        }

        const query = `
            UPDATE equipos SET 
                tipo = ?, marca = ?, modelo = ?, procesador = ?, ram = ?, almacenamiento = ?, 
                oficina = ?, ip = ?, mac = ?, codigoPatrimonial = ?, 
                so = ?, officeVersion = ?, antivirus = ?, estado = ?, estado_especial = ?,
                marcaMonitor = ?, pulgadasMonitor = ?, codigoPatrimonialMonitor = ?, estadoMonitor = ?,
                tieneTeclado = ?, tieneMouse = ?, usuarioId = ?
            WHERE id = ?
        `;

        const [result] = await conn.query<ResultSetHeader>(query, [
            tipo, marca, modelo, procesador, ram, almacenamiento, oficina, ip, mac, 
            codigoPatrimonial, so, officeVersion, antivirus, estado, estadoEspecial,
            marcaMonitor, pulgadasMonitor, codigoPatrimonialMonitor || null, estadoMonitor,
            tieneTeclado ? 1 : 0, tieneMouse ? 1 : 0, usuarioId || null, id
        ]);

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Equipo no encontrado' });
        }

        if (equipoPrev.usuarioId !== (usuarioId || null)) {
            let accion = 'asignacion';
            let nota = '';

            if (equipoPrev.usuarioId && usuarioId) {
                accion = 'reasignacion';
                const [usuarioAnterior] = await conn.query<RowDataPacket[]>(
                    'SELECT nombres, apellidos FROM usuarios WHERE id = ?', 
                    [equipoPrev.usuarioId]
                );
                const [usuarioNuevo] = await conn.query<RowDataPacket[]>(
                    'SELECT nombres, apellidos FROM usuarios WHERE id = ?', 
                    [usuarioId]
                );
                nota = `Reasignado de ${usuarioAnterior[0]?.nombres || 'Usuario anterior'} a ${usuarioNuevo[0]?.nombres || 'Usuario nuevo'}`;
            } else if (usuarioId && !equipoPrev.usuarioId) {
                const [usuarioNuevo] = await conn.query<RowDataPacket[]>(
                    'SELECT nombres, apellidos FROM usuarios WHERE id = ?', 
                    [usuarioId]
                );
                nota = `Asignado a ${usuarioNuevo[0]?.nombres || 'Usuario nuevo'}`;
            } else if (!usuarioId && equipoPrev.usuarioId) {
                accion = 'desasignacion';
                const [usuarioAnterior] = await conn.query<RowDataPacket[]>(
                    'SELECT nombres, apellidos FROM usuarios WHERE id = ?', 
                    [equipoPrev.usuarioId]
                );
                nota = `Desasignado de ${usuarioAnterior[0]?.nombres || 'Usuario anterior'}`;
            }

            const detallesHistorial = {
                prev: {
                    usuarioId: equipoPrev.usuarioId,
                    estado_especial: equipoPrev.estado_especial,
                    estado: equipoPrev.estado
                },
                next: {
                    usuarioId: usuarioId || null,
                    estado_especial: estadoEspecial,
                    estado: estado
                },
                nota: nota
            };

            await HistorialHelper.registrarCambio(
                'equipo',
                parseInt(id),
                accion,
                detallesHistorial,
                usuarioSistemaId
            );
        }

        const cambios: string[] = [];

        if (equipoPrev.oficina !== oficina) {
            cambios.push('traslado');
        }

        if (equipoPrev.ip !== ip || equipoPrev.mac !== mac) {
            cambios.push('actualizacion_red');
        }

        if (equipoPrev.estado !== estado) {
            cambios.push('cambio_estado');
        }

        if (cambios.length > 0 && equipoPrev.usuarioId === (usuarioId || null)) {
            let accionPrincipal = 'actualizacion';
            let nota = 'Actualización desde panel';

            if (cambios.includes('traslado')) {
                accionPrincipal = 'traslado';
                nota = `Traslado de oficina desde ${equipoPrev.oficina} a ${oficina}`;
            }

            const detallesHistorial = {
                prev: {
                    oficina: equipoPrev.oficina,
                    ip: equipoPrev.ip,
                    mac: equipoPrev.mac,
                    estado: equipoPrev.estado,
                    estado_especial: equipoPrev.estado_especial
                },
                next: {
                    oficina: oficina,
                    ip: ip,
                    mac: mac,
                    estado: estado,
                    estado_especial: estadoEspecial
                },
                nota: nota,
                cambios_realizados: cambios
            };

            await HistorialHelper.registrarCambio(
                'equipo',
                parseInt(id),
                accionPrincipal,
                detallesHistorial,
                usuarioSistemaId
            );
        }

        await conn.commit();
        return res.status(200).json({ message: 'Equipo actualizado correctamente' });
    } catch (err: any) {
        await conn.rollback();
        console.error('Error al actualizar el equipo:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe un equipo con esa IP o MAC' });
        }
        return res.status(500).json({ error: 'Error al actualizar el equipo' });
    } finally {
        conn.release();
    }
}

  // Eliminar equipo
  static async eliminarEquipo(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    if (isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const query = "DELETE FROM equipos WHERE id = ?";

    try {
      const [result] = await db.promise().query<ResultSetHeader>(query, [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Equipo no encontrado" });
      }

      return res
        .status(200)
        .json({ message: "Equipo eliminado correctamente" });
    } catch (err) {
      console.error("Error al eliminar el equipo:", err);
      return res.status(500).json({ error: "Error al eliminar el equipo" });
    }
  }

  // Buscar equipos (con filtro por usuario)
  static async buscarEquipos(req: Request, res: Response): Promise<Response> {
    const {
      tipo,
      marca,
      modelo,
      oficina,
      ip,
      mac,
      estado,
      marcaMonitor,
      estadoMonitor,
      tieneTeclado,
      tieneMouse,
      usuarioId,
    } = req.query;

    let query = `
            SELECT e.*, 
                   u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
            FROM equipos e
            LEFT JOIN usuarios u ON e.usuarioId = u.id
            WHERE 1=1
        `;
    const params: any[] = [];

    if (tipo) {
      query += " AND e.tipo = ?";
      params.push(tipo);
    }
    if (marca) {
      query += " AND e.marca LIKE ?";
      params.push(`%${marca}%`);
    }
    if (modelo) {
      query += " AND e.modelo LIKE ?";
      params.push(`%${modelo}%`);
    }
    if (oficina) {
      query += " AND e.oficina LIKE ?";
      params.push(`%${oficina}%`);
    }
    if (ip) {
      query += " AND e.ip LIKE ?";
      params.push(`%${ip}%`);
    }
    if (mac) {
      query += " AND e.mac LIKE ?";
      params.push(`%${mac}%`);
    }
    if (estado) {
      query += " AND e.estado = ?";
      params.push(estado);
    }
    if (marcaMonitor) {
      query += " AND e.marcaMonitor LIKE ?";
      params.push(`%${marcaMonitor}%`);
    }
    if (estadoMonitor) {
      query += " AND e.estadoMonitor = ?";
      params.push(estadoMonitor);
    }
    if (tieneTeclado !== undefined) {
      query += " AND e.tieneTeclado = ?";
      params.push(tieneTeclado === "true" ? 1 : 0);
    }
    if (tieneMouse !== undefined) {
      query += " AND e.tieneMouse = ?";
      params.push(tieneMouse === "true" ? 1 : 0);
    }
    if (usuarioId) {
      query += " AND e.usuarioId = ?";
      params.push(usuarioId);
    }

    try {
      const [rows] = await db
        .promise()
        .query<(Equipo & Usuario)[]>(query, params);

      const equipos = rows.map((equipo) => ({
        ...equipo,
        tieneTeclado: equipo.tieneTeclado === 1,
        tieneMouse: equipo.tieneMouse === 1,
        usuario: equipo.usuario_id
          ? {
              id: equipo.usuario_id,
              dni: equipo.dni,
              nombres: equipo.nombres,
              apellidos: equipo.apellidos,
              tipoContrato: equipo.tipoContrato,
            }
          : null,
      }));

      return res.status(200).json({
        data: equipos,
        total: equipos.length,
      });
    } catch (err) {
      console.error("Error al buscar equipos:", err);
      return res.status(500).json({ error: "Error al buscar equipos" });
    }
  }

  // Exportar equipos (incluyendo datos de usuario)
  static async exportarEquipos(req: Request, res: Response): Promise<Response> {
    const query = `
            SELECT 
                e.id, e.tipo, e.marca, e.modelo, e.procesador, e.ram, e.almacenamiento, e.oficina, 
                e.ip, e.mac, e.codigoPatrimonial, e.so, e.officeVersion, e.antivirus, e.estado,
                e.marcaMonitor, e.pulgadasMonitor, e.codigoPatrimonialMonitor, e.estadoMonitor,
                CASE WHEN e.tieneTeclado = 1 THEN 'Sí' ELSE 'No' END AS tieneTeclado,
                CASE WHEN e.tieneMouse = 1 THEN 'Sí' ELSE 'No' END AS tieneMouse,
                u.dni, CONCAT(u.nombres, ' ', u.apellidos) as usuario,
                u.tipoContrato
            FROM equipos e
            LEFT JOIN usuarios u ON e.usuarioId = u.id
            ORDER BY e.id DESC
        `;

    try {
      const [rows] = await db.promise().query<Equipo[]>(query);
      return res.status(200).json({
        message: "Equipos exportados correctamente",
        data: rows,
        total: rows.length,
      });
    } catch (err) {
      console.error("Error al exportar los equipos:", err);
      return res.status(500).json({ error: "Error al exportar los equipos" });
    }
  }
}

export default EquipoController;
