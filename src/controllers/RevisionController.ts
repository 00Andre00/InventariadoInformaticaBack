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
  ip?: string;
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
    const { motivo } = req.body || {};
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);

    console.log('=== ENVIAR EQUIPO A REVISIÓN ===');
    console.log('ID:', id, 'Motivo:', motivo, 'Usuario ID:', usuarioSistemaId);

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: "ID de equipo inválido" });
    }

    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      // 1. Verificar que el equipo existe
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
        "UPDATE equipos SET estado_especial = 'revision', usuarioId = NULL WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "No se pudo actualizar el equipo" });
      }

      // 3. Registrar en historial - USANDO HISTORIALHELPER (CORREGIDO)
      const detallesHistorial = {
        prev: {
          usuarioId: equipoPrev.usuarioId,
          estado_especial: equipoPrev.estado_especial,
          estado: equipoPrev.estado
        },
        next: {
          usuarioId: null,
          estado_especial: "revision",
          estado: equipoPrev.estado
        },
        motivo: motivo || "Enviado a revisión técnica",
        nota: `Equipo enviado a revisión${motivo ? `: ${motivo}` : ''}`
      };

      // ✅ ESTA ES LA LÍNEA CORREGIDA - Usar HistorialHelper
      await HistorialHelper.registrarCambio(
        "equipo",
        parseInt(id),
        "revision",
        detallesHistorial,
        usuarioSistemaId
      );

      await conn.commit();
      
      console.log('✅ Equipo enviado a revisión exitosamente');
      return res.status(200).json({ 
        message: "Equipo enviado a revisión correctamente"
      });

    } catch (err: any) {
      await conn.rollback();
      console.error('❌ ERROR al enviar equipo a revisión:', err.message);
      
      return res.status(500).json({ 
        error: "Error interno al enviar equipo a revisión",
        details: process.env.NODE_ENV === 'development' ? err.message : 'Error del servidor'
      });
    } finally {
      conn.release();
    }
  }

  // Dar de baja equipo - CORREGIDO
static async darDeBajaEquipo(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    // CORREGIR ESTA LÍNEA:
    const { motivo } = req.body || {}; // ← Agregar || {}
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    console.log('=== DAR DE BAJA EQUIPO ===');
    console.log('ID:', id, 'Motivo:', motivo, 'Body completo:', req.body);

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: "ID de equipo inválido" });
    }

    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      // 1. Verificar que el equipo existe
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
        "UPDATE equipos SET estado_especial = 'baja', usuarioId = NULL WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "No se pudo actualizar el equipo" });
      }

      // 3. Registrar en historial - USANDO HISTORIALHELPER (CORREGIDO)
      const detallesHistorial = {
        prev: {
          usuarioId: equipoPrev.usuarioId,
          estado_especial: equipoPrev.estado_especial,
          estado: equipoPrev.estado
        },
        next: {
          usuarioId: null,
          estado_especial: "baja",
          estado: equipoPrev.estado
        },
        motivo: motivo || "Dado de baja del sistema",
        nota: `Equipo dado de baja${motivo ? `: ${motivo}` : ''}`
      };

      // ✅ ESTA ES LA LÍNEA CORREGIDA - Usar HistorialHelper
      await HistorialHelper.registrarCambio(
        "equipo",
        parseInt(id),
        "baja",
        detallesHistorial,
        usuarioSistemaId
      );

      await conn.commit();
      
      console.log('✅ Equipo dado de baja exitosamente');
      return res.status(200).json({ 
        message: "Equipo dado de baja correctamente"
      });

    } catch (err: any) {
      await conn.rollback();
      console.error('❌ ERROR en dar de baja equipo:', err.message);
      
      return res.status(500).json({ 
        error: "Error interno al dar de baja el equipo",
        details: process.env.NODE_ENV === 'development' ? err.message : 'Error del servidor'
      });
    } finally {
      conn.release();
    }
  }

  // Enviar impresora a revisión - CORREGIDO
  static async enviarImpresoraARevision(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { motivo } = req.body || {};
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);

    console.log('=== ENVIAR IMPRESORA A REVISIÓN ===');
    console.log('ID:', id, 'Motivo:', motivo, 'Usuario ID:', usuarioSistemaId);

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: "ID de impresora inválido" });
    }

    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      // 1. Verificar que la impresora existe
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
        "UPDATE impresoras SET estado_especial = 'revision', usuarioId = NULL WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "No se pudo actualizar la impresora" });
      }

      // 3. Registrar en historial - USANDO HISTORIALHELPER (CORREGIDO)
      const detallesHistorial = {
        prev: {
          usuarioId: impresoraPrev.usuarioId,
          estado_especial: impresoraPrev.estado_especial,
          estado: impresoraPrev.estado
        },
        next: {
          usuarioId: null,
          estado_especial: "revision",
          estado: impresoraPrev.estado
        },
        motivo: motivo || "Enviada a revisión técnica",
        nota: `Impresora enviada a revisión${motivo ? `: ${motivo}` : ''}`
      };

      // ✅ ESTA ES LA LÍNEA CORREGIDA - Usar HistorialHelper
      await HistorialHelper.registrarCambio(
        "impresora",
        parseInt(id),
        "revision",
        detallesHistorial,
        usuarioSistemaId
      );

      await conn.commit();
      
      console.log('✅ Impresora enviada a revisión exitosamente');
      return res.status(200).json({ 
        message: "Impresora enviada a revisión correctamente"
      });

    } catch (err: any) {
      await conn.rollback();
      console.error('❌ ERROR al enviar impresora a revisión:', err.message);
      
      return res.status(500).json({ 
        error: "Error interno al enviar impresora a revisión",
        details: process.env.NODE_ENV === 'development' ? err.message : 'Error del servidor'
      });
    } finally {
      conn.release();
    }
  }

  // Dar de baja impresora - CORREGIDO
static async darDeBajaImpresora(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    // CORREGIR ESTA LÍNEA:
    const { motivo } = req.body || {}; // ← Agregar || {}
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    
    console.log('=== DAR DE BAJA IMPRESORA ===');
    console.log('ID:', id, 'Motivo:', motivo, 'Body completo:', req.body);

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: "ID de impresora inválido" });
    }

    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      // 1. Verificar que la impresora existe
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
        "UPDATE impresoras SET estado_especial = 'baja', usuarioId = NULL WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "No se pudo actualizar la impresora" });
      }

      // 3. Registrar en historial - USANDO HISTORIALHELPER (CORREGIDO)
      const detallesHistorial = {
        prev: {
          usuarioId: impresoraPrev.usuarioId,
          estado_especial: impresoraPrev.estado_especial,
          estado: impresoraPrev.estado
        },
        next: {
          usuarioId: null,
          estado_especial: "baja",
          estado: impresoraPrev.estado
        },
        motivo: motivo || "Dada de baja del sistema",
        nota: `Impresora dada de baja${motivo ? `: ${motivo}` : ''}`
      };

      // ✅ ESTA ES LA LÍNEA CORREGIDA - Usar HistorialHelper
      await HistorialHelper.registrarCambio(
        "impresora",
        parseInt(id),
        "baja",
        detallesHistorial,
        usuarioSistemaId
      );

      await conn.commit();
      
      console.log('✅ Impresora dada de baja exitosamente');
      return res.status(200).json({ 
        message: "Impresora dada de baja correctamente"
      });

    } catch (err: any) {
      await conn.rollback();
      console.error('❌ ERROR en dar de baja impresora:', err.message);
      
      return res.status(500).json({ 
        error: "Error interno al dar de baja la impresora",
        details: process.env.NODE_ENV === 'development' ? err.message : 'Error del servidor'
      });
    } finally {
      conn.release();
    }
  }

  // Obtener equipos en revisión
  static async obtenerEquiposRevision(req: Request, res: Response): Promise<Response> {
    try {
      const [rows] = await db.promise().query<EquipoRevision[]>(
        `SELECT e.*, u.nombres, u.apellidos,
                CONCAT(u.nombres, ' ', u.apellidos) as usuario_anterior
         FROM equipos e
         LEFT JOIN usuarios u ON e.usuarioId = u.id
         WHERE e.estado_especial = 'revision'
         ORDER BY e.id DESC`
      );

      return res.status(200).json({
        message: "Equipos en revisión obtenidos correctamente",
        data: rows,
      });
    } catch (err) {
      console.error("Error al obtener equipos en revisión:", err);
      return res.status(500).json({ error: "Error al obtener equipos en revisión" });
    }
  }

  // Obtener impresoras en revisión
  static async obtenerImpresorasRevision(req: Request, res: Response): Promise<Response> {
    try {
      const [rows] = await db.promise().query<ImpresoraRevision[]>(
        `SELECT i.*, u.nombres, u.apellidos,
                CONCAT(u.nombres, ' ', u.apellidos) as usuario_anterior
         FROM impresoras i
         LEFT JOIN usuarios u ON i.usuarioId = u.id
         WHERE i.estado_especial = 'revision'
         ORDER BY i.id DESC`
      );

      return res.status(200).json({
        message: "Impresoras en revisión obtenidas correctamente",
        data: rows,
      });
    } catch (err) {
      console.error("Error al obtener impresoras en revisión:", err);
      return res.status(500).json({ error: "Error al obtener impresoras en revisión" });
    }
  }

  // Reparar equipo (cambiar a disponible)
  static async repararEquipo(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    const conn = await db.promise().getConnection();

    if (isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    try {
      await conn.beginTransaction();

      const [equipoAnterior] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM equipos WHERE id = ?",
        [id]
      );

      if (equipoAnterior.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      const equipoPrev = equipoAnterior[0];

      const [result] = await conn.query<ResultSetHeader>(
        "UPDATE equipos SET estado_especial = 'disponible', estado = 'bueno', usuarioId = NULL WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      const detalles = {
        prev: {
          estado_especial: equipoPrev.estado_especial,
          usuarioId: equipoPrev.usuarioId,
          estado: equipoPrev.estado
        },
        next: {
          estado_especial: "disponible",
          usuarioId: null,
          estado: "bueno"
        },
        motivo: "Equipo reparado y marcado como disponible"
      };

      await HistorialHelper.registrarCambio(
        "equipo",
        parseInt(id),
        "reparado",
        detalles,
        usuarioSistemaId
      );

      await conn.commit();

      return res.status(200).json({ message: "Equipo marcado como reparado y disponible" });
    } catch (err) {
      await conn.rollback();
      console.error("Error al reparar equipo:", err);
      return res.status(500).json({ error: "Error al reparar equipo" });
    } finally {
      conn.release();
    }
  }

  // Reparar impresora (cambiar a disponible)
  static async repararImpresora(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const usuarioSistemaId = HistorialHelper.obtenerUsuarioSistemaId(req);
    const conn = await db.promise().getConnection();

    if (isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    try {
      await conn.beginTransaction();

      const [impresoraAnterior] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM impresoras WHERE id = ?",
        [id]
      );

      if (impresoraAnterior.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Impresora no encontrada" });
      }

      const impresoraPrev = impresoraAnterior[0];

      const [result] = await conn.query<ResultSetHeader>(
        "UPDATE impresoras SET estado_especial = 'disponible', estado = 'bueno', usuarioId = NULL WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Impresora no encontrada" });
      }

      const detalles = {
        prev: {
          estado_especial: impresoraPrev.estado_especial,
          usuarioId: impresoraPrev.usuarioId,
          estado: impresoraPrev.estado
        },
        next: {
          estado_especial: "disponible",
          usuarioId: null,
          estado: "bueno"
        },
        motivo: "Impresora reparada y marcada como disponible"
      };

      await HistorialHelper.registrarCambio(
        "impresora",
        parseInt(id),
        "reparada",
        detalles,
        usuarioSistemaId
      );

      await conn.commit();

      return res.status(200).json({ message: "Impresora marcada como reparada y disponible" });
    } catch (err) {
      await conn.rollback();
      console.error("Error al reparar impresora:", err);
      return res.status(500).json({ error: "Error al reparar impresora" });
    } finally {
      conn.release();
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
        message: "Equipos disponibles obtenidos correctamente",
        data: rows,
      });
    } catch (err) {
      console.error("Error al obtener equipos disponibles:", err);
      return res.status(500).json({ error: "Error al obtener equipos disponibles" });
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
        message: "Impresoras disponibles obtenidas correctamente",
        data: rows,
      });
    } catch (err) {
      console.error("Error al obtener impresoras disponibles:", err);
      return res.status(500).json({ error: "Error al obtener impresoras disponibles" });
    }
  }

  // Obtener fecha de baja desde historial_cambios
  static async obtenerFechaBaja(req: Request, res: Response): Promise<Response> {
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
  static async obtenerHistorialCompleto(req: Request, res: Response): Promise<Response> {
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