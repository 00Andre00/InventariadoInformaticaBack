import { Request, Response } from "express";
import db from "../config/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { HistorialHelper } from "../utils/historialHelper";

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
  // Enviar equipo a revisión
  static async enviarARevision(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { motivo } = req.body || {};
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      // 1. Obtener estado anterior
      const [equipoAnterior] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM equipos WHERE id = ?",
        [id]
      );

      if (equipoAnterior.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      const equipoPrev = equipoAnterior[0];

      // 2. Actualizar equipo
      const [result] = await conn.query<ResultSetHeader>(
        "UPDATE equipos SET estado_especial = ?, usuarioId = NULL WHERE id = ?",
        ["revision", id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      // 3. Registrar en historial
      const detalles = {
        prev: {
          usuarioId: equipoPrev.usuarioId,
          estado_especial: equipoPrev.estado_especial,
        },
        next: {
          usuarioId: null,
          estado_especial: "revision",
        },
        motivo: motivo || "Enviado a revisión técnica",
      };

      await HistorialHelper.registrarCambio(
        "equipo",
        parseInt(id),
        "revision",
        detalles,
        usuarioSistemaId
      );

      await conn.commit();

      return res
        .status(200)
        .json({ message: "Equipo enviado a revisión correctamente" });
    } catch (err) {
      await conn.rollback();
      console.error("Error al enviar equipo a revisión:", err);
      return res
        .status(500)
        .json({ error: "Error al enviar equipo a revisión" });
    } finally {
      conn.release();
    }
  }

  // Dar de baja equipo
  static async darDeBajaEquipo(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { motivo } = req.body;

    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      // 1. Obtener estado anterior
      const [equipoAnterior] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM equipos WHERE id = ?",
        [id]
      );

      if (equipoAnterior.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      const equipoPrev = equipoAnterior[0];

      // 2. Actualizar equipo
      const [result] = await conn.query<ResultSetHeader>(
        "UPDATE equipos SET estado_especial = ?, usuarioId = NULL WHERE id = ?",
        ["baja", id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      // 3. Registrar en historial
      const detalles = {
        prev: {
          usuarioId: equipoPrev.usuarioId,
          estado_especial: equipoPrev.estado_especial,
        },
        next: {
          usuarioId: null,
          estado_especial: "baja",
        },
        motivo: motivo || "Dado de baja del sistema",
      };

      await HistorialHelper.registrarCambio(
        "equipo",
        parseInt(id),
        "baja",
        detalles,
        usuarioSistemaId
      );

      await conn.commit();

      return res
        .status(200)
        .json({ message: "Equipo dado de baja correctamente" });
    } catch (err) {
      await conn.rollback();
      console.error("Error al dar de baja equipo:", err);
      return res.status(500).json({ error: "Error al dar de baja equipo" });
    } finally {
      conn.release();
    }
  }

  // Enviar impresora a revisión
  static async enviarImpresoraARevision(
    req: Request,
    res: Response
  ): Promise<Response> {
    const { id } = req.params;
    const { motivo } = req.body || {};
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      // 1. Obtener estado anterior
      const [impresoraAnterior] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM impresoras WHERE id = ?",
        [id]
      );

      if (impresoraAnterior.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Impresora no encontrada" });
      }

      const impresoraPrev = impresoraAnterior[0];

      // 2. Actualizar impresora
      const [result] = await conn.query<ResultSetHeader>(
        "UPDATE impresoras SET estado_especial = ?, usuarioId = NULL WHERE id = ?",
        ["revision", id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Impresora no encontrada" });
      }

      // 3. Registrar en historial
      const detalles = {
        prev: {
          usuarioId: impresoraPrev.usuarioId,
          estado_especial: impresoraPrev.estado_especial,
        },
        next: {
          usuarioId: null,
          estado_especial: "revision",
        },
        motivo: motivo || "Enviada a revisión técnica",
      };

      await HistorialHelper.registrarCambio(
        "impresora",
        parseInt(id),
        "revision",
        detalles,
        usuarioSistemaId
      );

      await conn.commit();

      return res
        .status(200)
        .json({ message: "Impresora enviada a revisión correctamente" });
    } catch (err) {
      await conn.rollback();
      console.error("Error al enviar impresora a revisión:", err);
      return res
        .status(500)
        .json({ error: "Error al enviar impresora a revisión" });
    } finally {
      conn.release();
    }
  }

  // Dar de baja impresora
  static async darDeBajaImpresora(
    req: Request,
    res: Response
  ): Promise<Response> {
    const { id } = req.params;
    const { motivo } = req.body;

    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      // 1. Obtener estado anterior
      const [impresoraAnterior] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM impresoras WHERE id = ?",
        [id]
      );

      if (impresoraAnterior.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Impresora no encontrada" });
      }

      const impresoraPrev = impresoraAnterior[0];

      // 2. Actualizar impresora
      const [result] = await conn.query<ResultSetHeader>(
        "UPDATE impresoras SET estado_especial = ?, usuarioId = NULL WHERE id = ?",
        ["baja", id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Impresora no encontrada" });
      }

      // 3. Registrar en historial
      const detalles = {
        prev: {
          usuarioId: impresoraPrev.usuarioId,
          estado_especial: impresoraPrev.estado_especial,
        },
        next: {
          usuarioId: null,
          estado_especial: "baja",
        },
        motivo: motivo || "Dada de baja del sistema",
      };

      await HistorialHelper.registrarCambio(
        "impresora",
        parseInt(id),
        "baja",
        detalles,
        usuarioSistemaId
      );

      await conn.commit();

      return res
        .status(200)
        .json({ message: "Impresora dada de baja correctamente" });
    } catch (err) {
      await conn.rollback();
      console.error("Error al dar de baja impresora:", err);
      return res.status(500).json({ error: "Error al dar de baja impresora" });
    } finally {
      conn.release();
    }
  }

  // Obtener equipos en revisión
  static async obtenerEquiposRevision(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const [rows] = await db.promise().query<EquipoRevision[]>(
        `SELECT e.*,
                        (SELECT CONCAT(u2.nombres, ' ', u2.apellidos) 
                         FROM historial_cambios hc 
                         LEFT JOIN usuarios u2 ON hc.detalles LIKE CONCAT('%Usuario anterior: ', u2.nombres, ' ', u2.apellidos, '%')
                         WHERE hc.activo_id = e.id AND hc.tipo_activo = 'equipo' AND hc.accion = 'revision'
                         ORDER BY hc.createdAt DESC LIMIT 1) as usuario_anterior
                 FROM equipos e
                 WHERE e.estado_especial = 'revision'
                 ORDER BY e.id DESC`
      );

      return res.status(200).json({
        message: "Equipos en revisión obtenidos correctamente",
        data: rows,
      });
    } catch (err) {
      console.error("Error al obtener equipos en revisión:", err);
      return res
        .status(500)
        .json({ error: "Error al obtener equipos en revisión" });
    }
  }

  // Obtener impresoras en revisión
  static async obtenerImpresorasRevision(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const [rows] = await db.promise().query<ImpresoraRevision[]>(
        `SELECT i.*,
                        (SELECT CONCAT(u2.nombres, ' ', u2.apellidos) 
                         FROM historial_cambios hc 
                         LEFT JOIN usuarios u2 ON hc.detalles LIKE CONCAT('%Usuario anterior: ', u2.nombres, ' ', u2.apellidos, '%')
                         WHERE hc.activo_id = i.id AND hc.tipo_activo = 'impresora' AND hc.accion = 'revision'
                         ORDER BY hc.createdAt DESC LIMIT 1) as usuario_anterior
                 FROM impresoras i
                 WHERE i.estado_especial = 'revision'
                 ORDER BY i.id DESC`
      );

      return res.status(200).json({
        message: "Impresoras en revisión obtenidas correctamente",
        data: rows,
      });
    } catch (err) {
      console.error("Error al obtener impresoras en revisión:", err);
      return res
        .status(500)
        .json({ error: "Error al obtener impresoras en revisión" });
    }
  }

  // Reparar equipo (cambiar a disponible)
  static async repararEquipo(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);

    if (isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    try {
      // Obtener el ID del usuario empleado especial de informática
      const [usuarioInformatica] = await db
        .promise()
        .query<RowDataPacket[]>(
          'SELECT id FROM usuarios WHERE dni = "00000001" LIMIT 1'
        );

      if (usuarioInformatica.length === 0) {
        return res
          .status(404)
          .json({ message: "No se encontró el jefe de informática" });
      }

      const informaticaId = usuarioInformatica[0].id;

      await db.promise().query(
        `UPDATE equipos 
                 SET estado_especial = 'disponible',
                     estado = 'bueno',
                     usuarioId = ?,
                     historial_duenos = CONCAT(IFNULL(historial_duenos, ''), 
                         '| Disponible: ${new Date().toLocaleString(
                           "es-PE"
                         )} - Asignado a Informática')
                 WHERE id = ?`,
        [informaticaId, id]
      );

      // Registrar en historial
      await db.promise().query(
        `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
        [
          "equipo",
          id,
          "reparado",
          "Equipo reparado y marcado como disponible (asignado a Informática)",
          usuarioSistemaId,
        ]
      );

      return res
        .status(200)
        .json({ message: "Equipo marcado como reparado y disponible" });
    } catch (err) {
      console.error("Error al reparar equipo:", err);
      return res.status(500).json({ error: "Error al reparar equipo" });
    }
  }

  // Reparar impresora (cambiar a disponible)
  static async repararImpresora(
    req: Request,
    res: Response
  ): Promise<Response> {
    const { id } = req.params;
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);

    if (isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    try {
      // Obtener el ID del usuario empleado especial de informática
      const [usuarioInformatica] = await db
        .promise()
        .query<RowDataPacket[]>(
          'SELECT id FROM usuarios WHERE dni = "00000001" LIMIT 1'
        );

      if (usuarioInformatica.length === 0) {
        return res
          .status(404)
          .json({ message: "No se encontró el jefe de informática" });
      }

      const informaticaId = usuarioInformatica[0].id;

      await db.promise().query(
        `UPDATE impresoras 
                 SET estado_especial = 'disponible',
                     estado = 'bueno',
                     usuarioId = ?,
                     historial_duenos = CONCAT(IFNULL(historial_duenos, ''), 
                         '| Disponible: ${new Date().toLocaleString(
                           "es-PE"
                         )} - Asignado a Informática')
                 WHERE id = ?`,
        [informaticaId, id]
      );

      // Registrar en historial
      await db.promise().query(
        `INSERT INTO historial_cambios 
                 (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
                 VALUES (?, ?, ?, ?, ?)`,
        [
          "impresora",
          id,
          "reparada",
          "Impresora reparada y marcada como disponible (asignada a Informática)",
          usuarioSistemaId,
        ]
      );

      return res
        .status(200)
        .json({ message: "Impresora marcada como reparada y disponible" });
    } catch (err) {
      console.error("Error al reparar impresora:", err);
      return res.status(500).json({ error: "Error al reparar impresora" });
    }
  }

  // Obtener equipos disponibles
  static async obtenerEquiposDisponibles(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const [rows] = await db.promise().query<EquipoRevision[]>(
        `SELECT * FROM equipos 
                 WHERE estado_especial = 'disponible'
                 ORDER BY id DESC`
      );

      return res.status(200).json({
        message: "Equipos disponibles obtenidos correctamente",
        data: rows,
      });
    } catch (err) {
      console.error("Error al obtener equipos disponibles:", err);
      return res
        .status(500)
        .json({ error: "Error al obtener equipos disponibles" });
    }
  }

  // Obtener impresoras disponibles
  static async obtenerImpresorasDisponibles(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const [rows] = await db.promise().query<ImpresoraRevision[]>(
        `SELECT * FROM impresoras 
                 WHERE estado_especial = 'disponible'
                 ORDER BY id DESC`
      );

      return res.status(200).json({
        message: "Impresoras disponibles obtenidas correctamente",
        data: rows,
      });
    } catch (err) {
      console.error("Error al obtener impresoras disponibles:", err);
      return res
        .status(500)
        .json({ error: "Error al obtener impresoras disponibles" });
    }
  }

  // Obtener fecha de baja desde historial_cambios
  static async obtenerFechaBaja(
    req: Request,
    res: Response
  ): Promise<Response> {
    const { tipo, id } = req.params;

    if (isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    try {
      const [historial] = await db.promise().query<HistorialCambio[]>(
        `SELECT createdAt, accion, detalles 
                 FROM historial_cambios 
                 WHERE tipo_activo = ? AND activo_id = ? AND accion IN ('baja', 'dado_de_baja', 'dada_de_baja')
                 ORDER BY createdAt DESC 
                 LIMIT 1`,
        [tipo, id]
      );

      if (historial.length === 0) {
        return res.status(200).json({
          message: "No se encontró registro de baja",
          fechaBaja: null,
          tieneBaja: false,
        });
      }

      const registroBaja = historial[0];
      const fechaBaja = registroBaja.createdAt;

      return res.status(200).json({
        message: "Fecha de baja obtenida correctamente",
        fechaBaja: fechaBaja,
        fechaBajaLegible: new Date(fechaBaja).toLocaleString("es-PE"),
        tieneBaja: true,
        detalles: registroBaja.detalles,
      });
    } catch (err) {
      console.error("Error al obtener fecha de baja:", err);
      return res.status(500).json({ error: "Error al obtener fecha de baja" });
    }
  }

  // Obtener historial completo de un equipo/impresora
  static async obtenerHistorialCompleto(
    req: Request,
    res: Response
  ): Promise<Response> {
    const { tipo, id } = req.params;

    if (isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
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
        message: "Historial obtenido correctamente",
        data: historial,
      });
    } catch (err) {
      console.error("Error al obtener historial:", err);
      return res.status(500).json({ error: "Error al obtener historial" });
    }
  }
}
