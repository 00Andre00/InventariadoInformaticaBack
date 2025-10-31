import { Request, Response } from "express";
import db from "../config/db";
import PDFDocument from "pdfkit";
import { RowDataPacket } from "mysql2";
import { HistorialHelper } from "../utils/historialHelper";

export class ReporteController {
  static async generarReporteUsuario(
    req: Request,
    res: Response
  ): Promise<void> {
    const { id } = req.params;

    try {
      console.log(`Generando reporte para usuario ID: ${id}`);

      const [usuario] = await db
        .promise()
        .query<RowDataPacket[]>("SELECT * FROM usuarios WHERE id = ?", [id]);

      if (usuario.length === 0) {
        console.log("Usuario no encontrado");
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      const usuarioData = usuario[0];
      console.log(`Usuario encontrado: ${usuarioData.nombres}`);

      // 1. EQUIPOS ACTUALMENTE ASIGNADOS con fecha de asignación
      const [equiposActuales] = await db.promise().query<RowDataPacket[]>(
        `SELECT e.*,
                (SELECT hc.createdAt 
                 FROM historial_cambios hc 
                 WHERE hc.activo_id = e.id 
                 AND hc.tipo_activo = 'equipo'
                 AND (hc.accion = 'asignacion' OR hc.accion = 'asignado' OR hc.accion LIKE '%asign%')
                 ORDER BY hc.createdAt DESC LIMIT 1) as fecha_asignacion
         FROM equipos e 
         WHERE e.usuarioId = ? AND e.estado_especial = 'asignado'
         ORDER BY e.id`,
        [id]
      );

      // 2. IMPRESORAS ACTUALMENTE ASIGNADAS con fecha de asignación
      const [impresorasActuales] = await db.promise().query<RowDataPacket[]>(
        `SELECT i.*,
                (SELECT hc.createdAt 
                 FROM historial_cambios hc 
                 WHERE hc.activo_id = i.id 
                 AND hc.tipo_activo = 'impresora'
                 AND (hc.accion = 'asignacion' OR hc.accion = 'asignada' OR hc.accion LIKE '%asign%')
                 ORDER BY hc.createdAt DESC LIMIT 1) as fecha_asignacion
         FROM impresoras i 
         WHERE i.usuarioId = ? AND i.estado_especial = 'asignado'
         ORDER BY i.id`,
        [id]
      );

// 3. HISTÓRICO DE EQUIPOS (equipos que el usuario tuvo pero NO tiene actualmente)
const [historicoEquipos] = await db.promise().query<RowDataPacket[]>(
  `SELECT e.*,
          (SELECT hc.createdAt FROM historial_cambios hc 
           WHERE hc.activo_id = e.id AND hc.tipo_activo = 'equipo' 
           AND (hc.accion = 'asignacion' OR hc.accion = 'asignado' OR hc.accion LIKE '%asign%' OR hc.accion = 'reasignacion')
           ORDER BY hc.createdAt DESC LIMIT 1) as fecha_asignacion,
          (SELECT hc.createdAt FROM historial_cambios hc 
           WHERE hc.activo_id = e.id AND hc.tipo_activo = 'equipo' 
           AND (hc.accion = 'revision' OR hc.accion = 'baja' OR hc.accion = 'enviado_a_revision' OR hc.accion = 'dado_de_baja' OR hc.accion = 'desasignacion' OR hc.accion = 'reasignacion') 
           ORDER BY hc.createdAt DESC LIMIT 1) as fecha_desasignacion
   FROM equipos e 
   WHERE e.id IN (
     SELECT DISTINCT activo_id FROM historial_cambios 
     WHERE tipo_activo = 'equipo' 
     AND (detalles LIKE ? OR detalles LIKE ? OR detalles LIKE ? OR accion LIKE '%asign%' OR accion = 'reasignacion')
   )
   AND e.id NOT IN (
     SELECT id FROM equipos WHERE usuarioId = ? AND estado_especial = 'asignado'
   )
   ORDER BY fecha_desasignacion DESC, fecha_asignacion DESC`,
  [
    `%${usuarioData.nombres}%`,
    `%${usuarioData.apellidos}%`,
    `%${usuarioData.nombres} ${usuarioData.apellidos}%`,
    id,
  ]
);

// 4. HISTÓRICO DE IMPRESORAS (impresoras que el usuario tuvo pero NO tiene actualmente)
const [historicoImpresoras] = await db.promise().query<RowDataPacket[]>(
  `SELECT i.*,
          (SELECT hc.createdAt FROM historial_cambios hc 
           WHERE hc.activo_id = i.id AND hc.tipo_activo = 'impresora' 
           AND (hc.accion = 'asignacion' OR hc.accion = 'asignada' OR hc.accion LIKE '%asign%' OR hc.accion = 'reasignacion')
           ORDER BY hc.createdAt DESC LIMIT 1) as fecha_asignacion,
          (SELECT hc.createdAt FROM historial_cambios hc 
           WHERE hc.activo_id = i.id AND hc.tipo_activo = 'impresora' 
           AND (hc.accion = 'revision' OR hc.accion = 'baja' OR hc.accion = 'enviado_a_revision' OR hc.accion = 'dada_de_baja' OR hc.accion = 'desasignacion' OR hc.accion = 'reasignacion') 
           ORDER BY hc.createdAt DESC LIMIT 1) as fecha_desasignacion
   FROM impresoras i 
   WHERE i.id IN (
     SELECT DISTINCT activo_id FROM historial_cambios 
     WHERE tipo_activo = 'impresora' 
     AND (detalles LIKE ? OR detalles LIKE ? OR detalles LIKE ? OR accion LIKE '%asign%' OR accion = 'reasignacion')
   )
   AND i.id NOT IN (
     SELECT id FROM impresoras WHERE usuarioId = ? AND estado_especial = 'asignado'
   )
   ORDER BY fecha_desasignacion DESC, fecha_asignacion DESC`,
  [
    `%${usuarioData.nombres}%`,
    `%${usuarioData.apellidos}%`,
    `%${usuarioData.nombres} ${usuarioData.apellidos}%`,
    id,
  ]
);

      console.log("=== DEBUG REPORTE ===");
      console.log("Usuario:", usuarioData.nombres, usuarioData.apellidos);
      console.log("Equipos actuales:", equiposActuales.length);
      equiposActuales.forEach((eq, i) => {
        console.log(`Equipo ${i}:`, {
          id: eq.id,
          codigo: eq.codigoPatrimonial,
          fecha_asignacion: eq.fecha_asignacion,
          tieneFecha: !!eq.fecha_asignacion,
        });
      });

      console.log("Impresoras actuales:", impresorasActuales.length);
      impresorasActuales.forEach((imp, i) => {
        console.log(`Impresora ${i}:`, {
          id: imp.id,
          codigo: imp.codigoPatrimonial,
          fecha_asignacion: imp.fecha_asignacion,
          tieneFecha: !!imp.fecha_asignacion,
        });
      });

      console.log("Histórico equipos:", historicoEquipos.length);
      historicoEquipos.forEach((eq, i) => {
        console.log(`Histórico equipo ${i}:`, {
          id: eq.id,
          codigo: eq.codigoPatrimonial,
          fecha_asignacion: eq.fecha_asignacion,
          fecha_desasignacion: eq.fecha_desasignacion,
        });
      });

      console.log("Histórico impresoras:", historicoImpresoras.length);
      historicoImpresoras.forEach((imp, i) => {
        console.log(`Histórico impresora ${i}:`, {
          id: imp.id,
          codigo: imp.codigoPatrimonial,
          fecha_asignacion: imp.fecha_asignacion,
          fecha_desasignacion: imp.fecha_desasignacion,
        });
      });
      console.log("=== FIN DEBUG ===");

      // Debug para ver qué hay en el historial
      const [historialDebug] = await db.promise().query<RowDataPacket[]>(
        `SELECT tipo_activo, activo_id, accion, detalles, createdAt 
         FROM historial_cambios 
         WHERE tipo_activo IN ('equipo', 'impresora') 
         AND (accion LIKE '%asign%' OR accion = 'revision' OR accion = 'baja' OR accion = 'desasignacion')
         ORDER BY createdAt DESC LIMIT 10`
      );
      console.log("Últimos 10 registros de historial:", historialDebug);

      console.log(
        `Datos obtenidos - Equipos actuales: ${equiposActuales.length}, ` +
          `Impresoras actuales: ${impresorasActuales.length}, ` +
          `Histórico equipos: ${historicoEquipos.length}, ` +
          `Histórico impresoras: ${historicoImpresoras.length}`
      );

      console.log(
        "IDs de equipos encontrados en histórico:",
        historicoEquipos.map((e) => e.id)
      );
      console.log(
        "IDs de impresoras encontrados en histórico:",
        historicoImpresoras.map((i) => i.id)
      );

      // Debug para ver qué registros encuentra para cada equipo histórico
      for (const equipo of historicoEquipos) {
        const [asignaciones] = await db.promise().query<RowDataPacket[]>(
          `SELECT accion, createdAt, detalles FROM historial_cambios 
           WHERE activo_id = ? AND tipo_activo = 'equipo' 
           AND (accion LIKE '%asign%' OR accion = 'desasignacion')
           ORDER BY createdAt DESC`,
          [equipo.id]
        );
        console.log(
          `Registros de asignación para equipo ${equipo.id}:`,
          asignaciones
        );
      }

      // Debug específico para cada equipo histórico
      historicoEquipos.forEach((eq, i) => {
        console.log(`Histórico equipo ${i} (ID: ${eq.id}):`, {
          fecha_asignacion: eq.fecha_asignacion,
          fecha_desasignacion: eq.fecha_desasignacion,
          estado_especial: eq.estado_especial,
          usuarioId: eq.usuarioId,
        });
      });

      console.log(
        "Impresoras con usuarioId:",
        impresorasActuales.map((i) => ({
          id: i.id,
          usuarioId: i.usuarioId,
          estado_especial: i.estado_especial,
        }))
      );

      console.log("Búsquedas:", [
        `%${usuarioData.nombres}%`,
        `%${usuarioData.nombres} ${usuarioData.apellidos}%`,
      ]);

      // Crear PDF
      const doc = new PDFDocument({
        margin: 50,
        bufferPages: true,
      });

      // Configurar headers ANTES de empezar a escribir
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=reporte-usuario-${usuarioData.dni}.pdf`
      );

      doc.pipe(res);

      try {
        // Header
        doc
          .fillColor("#1f2937")
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("SISTEMA DE INVENTARIO - REPORTE DE USUARIO", 50, 50);

        doc
          .fillColor("#6b7280")
          .fontSize(12)
          .font("Helvetica")
          .text(`Generado: ${new Date().toLocaleString("es-PE")}`, 50, 80);

        // Línea separadora
        doc
          .moveTo(50, 100)
          .lineTo(550, 100)
          .strokeColor("#e5e7eb")
          .lineWidth(1)
          .stroke();

        let yPosition = 130;

        // 1. INFORMACIÓN DEL USUARIO
        doc
          .fillColor("#1f2937")
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("INFORMACIÓN DEL USUARIO", 50, yPosition);
        yPosition += 30;

        ReporteController.agregarTablaUsuario(doc, usuarioData, yPosition);
        yPosition += 120;

        // 2. EQUIPOS ACTUALMENTE ASIGNADOS
        if (equiposActuales.length > 0) {
          if (yPosition > 600) {
            doc.addPage();
            yPosition = 50;
          }

          doc
            .fillColor("#1f2937")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("EQUIPOS ACTUALMENTE ASIGNADOS", 50, yPosition);
          yPosition += 25;

          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .font("Helvetica")
            .text(
              "Equipos que el usuario tiene asignados actualmente:",
              50,
              yPosition
            );
          yPosition += 20;

          ReporteController.agregarTablaEquiposActuales(
            doc,
            equiposActuales,
            yPosition
          );
          yPosition += equiposActuales.length * 20 + 40;
        } else {
          doc
            .fillColor("#6b7280")
            .fontSize(12)
            .font("Helvetica")
            .text(
              "El usuario no tiene equipos asignados actualmente.",
              50,
              yPosition
            );
          yPosition += 30;
        }

        // 3. IMPRESORAS ACTUALMENTE ASIGNADAS
        if (impresorasActuales.length > 0) {
          if (yPosition > 600) {
            doc.addPage();
            yPosition = 50;
          }

          doc
            .fillColor("#1f2937")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("IMPRESORAS ACTUALMENTE ASIGNADAS", 50, yPosition);
          yPosition += 25;

          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .font("Helvetica")
            .text(
              "Impresoras que el usuario tiene asignadas actualmente:",
              50,
              yPosition
            );
          yPosition += 20;

          ReporteController.agregarTablaImpresorasActuales(
            doc,
            impresorasActuales,
            yPosition
          );
          yPosition += impresorasActuales.length * 20 + 40;
        } else {
          doc
            .fillColor("#6b7280")
            .fontSize(12)
            .font("Helvetica")
            .text(
              "El usuario no tiene impresoras asignadas actualmente.",
              50,
              yPosition
            );
          yPosition += 30;
        }

        // 4. HISTÓRICO DE EQUIPOS
        if (historicoEquipos.length > 0) {
          if (yPosition > 600) {
            doc.addPage();
            yPosition = 50;
          }

          doc
            .fillColor("#1f2937")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("HISTÓRICO DE EQUIPOS", 50, yPosition);
          yPosition += 25;

          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .font("Helvetica")
            .text(
              "Equipos que el usuario tuvo asignados anteriormente:",
              50,
              yPosition
            );
          yPosition += 20;

          ReporteController.agregarTablaHistoricoEquipos(
            doc,
            historicoEquipos,
            yPosition
          );
          yPosition += historicoEquipos.length * 25 + 40;
        }

        // 5. HISTÓRICO DE IMPRESORAS
        if (historicoImpresoras.length > 0) {
          if (yPosition > 600) {
            doc.addPage();
            yPosition = 50;
          }

          doc
            .fillColor("#1f2937")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("HISTÓRICO DE IMPRESORAS", 50, yPosition);
          yPosition += 25;

          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .font("Helvetica")
            .text(
              "Impresoras que el usuario tuvo asignadas anteriormente:",
              50,
              yPosition
            );
          yPosition += 20;

          ReporteController.agregarTablaHistoricoImpresoras(
            doc,
            historicoImpresoras,
            yPosition
          );
        }

        console.log("PDF generado exitosamente");
        doc.end();
      } catch (pdfError: any) {
        console.error("Error al generar PDF:", pdfError);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Error al generar el PDF",
            details: pdfError?.message || "Error desconocido en PDF",
          });
        }
        return;
      }
    } catch (err: any) {
      console.error("Error completo al generar reporte de usuario:", err);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Error al generar reporte de usuario",
          details: err?.message || "Error desconocido",
        });
      }
    }
  }

  // Métodos auxiliares para tablas (se mantienen igual)
  private static agregarTablaUsuario(
    doc: PDFKit.PDFDocument,
    usuario: any,
    yPosition: number
  ): void {
    const rows = [
      ["Nombres:", usuario.nombres],
      ["Apellidos:", usuario.apellidos],
      ["DNI:", usuario.dni],
      ["Oficina:", usuario.oficina],
      ["Tipo de Contrato:", usuario.tipoContrato],
      [
        "Fecha de Registro:",
        new Date(usuario.createdAt).toLocaleDateString("es-PE"),
      ],
    ];

    ReporteController.agregarTablaDatos(doc, rows, yPosition);
  }

  private static getColorPorAccion(accion: string): string {
    const colores: { [key: string]: string } = {
      asignacion: "#059669", // verde
      asignado: "#059669", // verde
      desasignacion: "#dc2626", // rojo
      revision: "#d97706", // amarillo/naranja
      reparar: "#2563eb", // azul
      baja: "#dc2626", // rojo
      disponible: "#059669", // verde
      actualizacion: "#7c3aed", // morado
      traslado: "#7c3aed", // morado
    };
    return colores[accion?.toLowerCase()] || "#374151"; // gris por defecto
  }

  private static agregarTablaEquiposActuales(
    doc: PDFKit.PDFDocument,
    equipos: any[],
    startY: number
  ): void {
    let y = startY;

    // Header
    doc
      .fillColor("#1f2937")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("COD. PAT.", 50, y);
    doc.text("EQUIPO", 120, y);
    doc.text("FECHA ASIGNACIÓN", 250, y);
    doc.text("ESTADO", 400, y);

    y += 12;

    // Línea separadora
    doc
      .moveTo(50, y)
      .lineTo(550, y)
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .stroke();

    y += 8;

    // Filas
    equipos.forEach((equipo) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor("#374151")
        .fontSize(8)
        .font("Helvetica")
        .text(equipo.codigoPatrimonial || "Sin código", 50, y, { width: 65 });

      doc.text(`${equipo.tipo} ${equipo.marca} ${equipo.modelo}`, 120, y, {
        width: 120,
      });

      const fechaAsignacion = equipo.fecha_asignacion
        ? new Date(equipo.fecha_asignacion).toLocaleDateString("es-PE")
        : "Fecha no registrada";
      doc.text(fechaAsignacion, 250, y, { width: 100 });

      const estadoColor = ReporteController.getColorPorEstado(equipo.estado);
      doc
        .fillColor(estadoColor)
        .text(equipo.estado || "Activo", 400, y, { width: 80 });

      y += 20;
    });
  }

  private static agregarTablaImpresorasActuales(
    doc: PDFKit.PDFDocument,
    impresoras: any[],
    startY: number
  ): void {
    let y = startY;

    // Header
    doc
      .fillColor("#1f2937")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("COD. PAT.", 50, y);
    doc.text("MODELO", 120, y);
    doc.text("FECHA ASIGNACIÓN", 250, y);
    doc.text("ESTADO", 400, y);

    y += 12;

    // Línea separadora
    doc
      .moveTo(50, y)
      .lineTo(550, y)
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .stroke();

    y += 8;

    // Filas
    impresoras.forEach((impresora) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor("#374151")
        .fontSize(8)
        .font("Helvetica")
        .text(impresora.codigoPatrimonial || "Sin código", 50, y, {
          width: 65,
        });

      doc.text(impresora.modelo, 120, y, { width: 120 });

      const fechaAsignacion = impresora.fecha_asignacion
        ? new Date(impresora.fecha_asignacion).toLocaleDateString("es-PE")
        : "Fecha no registrada";
      doc.text(fechaAsignacion, 250, y, { width: 100 });

      const estadoColor = ReporteController.getColorPorEstado(impresora.estado);
      doc
        .fillColor(estadoColor)
        .text(impresora.estado || "Activo", 400, y, { width: 80 });

      y += 20;
    });
  }

  private static agregarTablaHistoricoEquipos(
    doc: PDFKit.PDFDocument,
    equipos: any[],
    startY: number
  ): void {
    let y = startY;

    // Header
    doc
      .fillColor("#1f2937")
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("CÓDIGO", 50, y);
    doc.text("EQUIPO", 90, y);
    doc.text("FECHA ASIGNACIÓN", 200, y);
    doc.text("FECHA DESASIGNACIÓN", 320, y);
    doc.text("SITUACIÓN ACTUAL", 450, y);

    y += 10;

    // Línea separadora
    doc
      .moveTo(50, y)
      .lineTo(550, y)
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .stroke();

    y += 8;

    // Filas
    equipos.forEach((equipo) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor("#374151")
        .fontSize(7)
        .font("Helvetica")
        .text(equipo.codigoPatrimonial || "Sin código", 50, y, { width: 35 });

      doc.text(`${equipo.tipo} ${equipo.marca} ${equipo.modelo}`, 90, y, {
        width: 100,
      });

      const fechaAsignacion = equipo.fecha_asignacion
        ? new Date(equipo.fecha_asignacion).toLocaleDateString("es-PE")
        : "No registrada";
      doc.text(fechaAsignacion, 200, y, { width: 90 });

      const fechaDesasignacion = equipo.fecha_desasignacion
        ? new Date(equipo.fecha_desasignacion).toLocaleDateString("es-PE")
        : "No registrada";
      doc.text(fechaDesasignacion, 320, y, { width: 90 });

      const situacionColor = ReporteController.getColorPorSituacion(
        equipo.estado_especial
      );
      doc
        .fillColor(situacionColor)
        .text(equipo.estado_especial || "Disponible", 450, y, { width: 70 });

      y += 25;
    });
  }

  private static agregarTablaHistoricoImpresoras(
    doc: PDFKit.PDFDocument,
    impresoras: any[],
    startY: number
  ): void {
    let y = startY;

    // Header
    doc
      .fillColor("#1f2937")
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("CÓDIGO", 50, y);
    doc.text("MODELO", 90, y);
    doc.text("FECHA ASIGNACIÓN", 200, y);
    doc.text("FECHA DESASIGNACIÓN", 320, y);
    doc.text("SITUACIÓN ACTUAL", 450, y);

    y += 10;

    // Línea separadora
    doc
      .moveTo(50, y)
      .lineTo(550, y)
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .stroke();

    y += 8;

    // Filas
    impresoras.forEach((impresora) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor("#374151")
        .fontSize(7)
        .font("Helvetica")
        .text(impresora.codigoPatrimonial || "Sin código", 50, y, {
          width: 35,
        });

      doc.text(impresora.modelo, 90, y, { width: 100 });

      const fechaAsignacion = impresora.fecha_asignacion
        ? new Date(impresora.fecha_asignacion).toLocaleDateString("es-PE")
        : "No registrada";
      doc.text(fechaAsignacion, 200, y, { width: 90 });

      const fechaDesasignacion = impresora.fecha_desasignacion
        ? new Date(impresora.fecha_desasignacion).toLocaleDateString("es-PE")
        : "No registrada";
      doc.text(fechaDesasignacion, 320, y, { width: 90 });

      const situacionColor = ReporteController.getColorPorSituacion(
        impresora.estado_especial
      );
      doc
        .fillColor(situacionColor)
        .text(impresora.estado_especial || "Disponible", 450, y, { width: 70 });

      y += 25;
    });
  }

  private static agregarTablaDatos(
    doc: PDFKit.PDFDocument,
    rows: string[][],
    startY: number
  ): void {
    let y = startY;

    rows.forEach(([label, value]) => {
      doc
        .fillColor("#374151")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(label, 50, y);

      doc
        .fillColor("#6b7280")
        .fontSize(10)
        .font("Helvetica")
        .text(value || "N/A", 150, y);

      y += 15;
    });
  }

  private static getColorPorSituacion(situacion: string): string {
    const colores: { [key: string]: string } = {
      asignado: "#059669", // verde
      disponible: "#2563eb", // azul
      revision: "#d97706", // amarillo/naranja
      baja: "#dc2626", // rojo
    };
    return colores[situacion?.toLowerCase()] || "#374151"; // gris por defecto
  }

  private static getColorPorEstado(estado: string): string {
    const colores: { [key: string]: string } = {
      bueno: "#059669", // verde
      regular: "#d97706", // amarillo/naranja
      malo: "#dc2626", // rojo
      activo: "#059669", // verde
      inactivo: "#6b7280", // gris
      mantenimiento: "#d97706", // amarillo/naranja
    };
    return colores[estado?.toLowerCase()] || "#374151"; // gris por defecto
  }

  static async generarReporteEquipo(
    req: Request,
    res: Response
  ): Promise<void> {
    const { id } = req.params;

    try {
      console.log(`Generando reporte para equipo ID: ${id}`);

      // 1. Obtener información del equipo
      const [equipo] = await db.promise().query<RowDataPacket[]>(
        `SELECT e.*, 
                    u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
             FROM equipos e
             LEFT JOIN usuarios u ON e.usuarioId = u.id
             WHERE e.id = ?`,
        [id]
      );

      if (equipo.length === 0) {
        console.log("Equipo no encontrado");
        res.status(404).json({ error: "Equipo no encontrado" });
        return;
      }

      const equipoData = equipo[0];
      console.log(
        `Equipo encontrado: ${equipoData.marca} ${equipoData.modelo}`
      );

      // 2. Obtener historial completo del equipo (SIN información de usuarios_sistema)
      const [historialEquipo] = await db.promise().query<RowDataPacket[]>(
        `SELECT hc.*
             FROM historial_cambios hc
             WHERE hc.tipo_activo = 'equipo' AND hc.activo_id = ?
             ORDER BY hc.createdAt DESC`,
        [id]
      );

      console.log(`Historial encontrado: ${historialEquipo.length} registros`);

      // 3. Obtener usuarios que han tenido este equipo (extraer de los detalles del historial)
      const usuariosHistoricos = new Map();

      historialEquipo.forEach((registro) => {
        try {
          const detalles = JSON.parse(registro.detalles);

          // Buscar información del usuario en los detalles
          if (
            detalles.next?.usuarioId &&
            detalles.next.usuarioId !== detalles.prev?.usuarioId
          ) {
            const usuarioId = detalles.next.usuarioId;
            const nombresCompletos =
              detalles.nota?.match(/Asignado a (.+?)$/)?.[1] ||
              `Usuario ${usuarioId}`;

            usuariosHistoricos.set(usuarioId, {
              usuarioId: usuarioId,
              nombres: nombresCompletos,
              fechaAsignacion: registro.createdAt,
              accion: registro.accion,
            });
          }

          // También capturar desasignaciones
          if (detalles.prev?.usuarioId && !detalles.next?.usuarioId) {
            const usuarioId = detalles.prev.usuarioId;
            usuariosHistoricos.set(usuarioId, {
              usuarioId: usuarioId,
              nombres: `Usuario ${usuarioId}`,
              fechaAsignacion: registro.createdAt,
              accion: "desasignacion",
            });
          }
        } catch (error) {
          console.error("Error al parsear detalles:", error);
        }
      });

      // 4. Obtener información completa de los usuarios históricos
      interface UsuarioHistorico {
        usuarioId: number;
        nombres: string;
        apellidos: string;
        dni: string;
        oficina: string;
        fechaAsignacion: string;
        accion: string;
      }

      const usuariosInfo: UsuarioHistorico[] = [];
      for (const [usuarioId, info] of usuariosHistoricos) {
        if (info.accion !== "desasignacion") {
          // Solo los que fueron asignados
          const [usuario] = await db
            .promise()
            .query<RowDataPacket[]>(
              "SELECT nombres, apellidos, dni, oficina FROM usuarios WHERE id = ?",
              [usuarioId]
            );
          if (usuario.length > 0) {
            usuariosInfo.push({
              ...info,
              nombres: usuario[0].nombres,
              apellidos: usuario[0].apellidos,
              dni: usuario[0].dni,
              oficina: usuario[0].oficina,
              fechaAsignacion: info.fechaAsignacion,
            });
          }
        }
      }

      // 5. Obtener estados históricos del equipo (revisión, disponible, etc.)
      interface EstadoHistorico {
        fecha: string;
        accion: string;
        estadoAnterior?: string;
        estadoNuevo?: string;
        nota: string;
      }

      const estadosHistoricos: EstadoHistorico[] = [];
      historialEquipo.forEach((registro) => {
        try {
          const detalles = JSON.parse(registro.detalles);
          if (
            detalles.prev?.estado_especial ||
            detalles.next?.estado_especial
          ) {
            estadosHistoricos.push({
              fecha: registro.createdAt,
              accion: registro.accion,
              estadoAnterior: detalles.prev?.estado_especial,
              estadoNuevo: detalles.next?.estado_especial,
              nota: detalles.nota || "Cambio de estado",
            });
          }
        } catch (error) {
          console.error("Error al procesar estado histórico:", error);
        }
      });

      // Crear PDF
      const doc = new PDFDocument({
        margin: 50,
        bufferPages: true,
      });

      // Configurar headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=reporte-equipo-${
          equipoData.codigoPatrimonial || equipoData.id
        }.pdf`
      );

      doc.pipe(res);

      try {
        // Header
        doc
          .fillColor("#1f2937")
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("SISTEMA DE INVENTARIO - REPORTE DE EQUIPO", 50, 50);

        doc
          .fillColor("#6b7280")
          .fontSize(12)
          .font("Helvetica")
          .text(`Generado: ${new Date().toLocaleString("es-PE")}`, 50, 80);

        // Línea separadora
        doc
          .moveTo(50, 100)
          .lineTo(550, 100)
          .strokeColor("#e5e7eb")
          .lineWidth(1)
          .stroke();

        let yPosition = 130;

        // 1. INFORMACIÓN DEL EQUIPO
        doc
          .fillColor("#1f2937")
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("INFORMACIÓN DEL EQUIPO", 50, yPosition);
        yPosition += 30;

        const infoEquipo = [
          ["Código Patrimonial:", equipoData.codigoPatrimonial || "N/A"],
          ["Tipo:", equipoData.tipo],
          ["Marca:", equipoData.marca],
          ["Modelo:", equipoData.modelo],
          ["Procesador:", equipoData.procesador],
          ["RAM:", equipoData.ram],
          ["Almacenamiento:", equipoData.almacenamiento],
          ["Oficina:", equipoData.oficina],
          ["IP:", equipoData.ip],
          ["MAC:", equipoData.mac],
          ["Sistema Operativo:", equipoData.so || "N/A"],
          ["Estado del Equipo:", equipoData.estado],
          // ["Estado Especial:", equipoData.estado_especial || "N/A"],
          [
            "Usuario Actual:",
            equipoData.usuario_id
              ? `${equipoData.nombres} ${equipoData.apellidos} (${equipoData.dni})`
              : "Sin asignar",
          ],
        ];

        infoEquipo.forEach(([label, value]) => {
          doc
            .fillColor("#374151")
            .fontSize(10)
            .font("Helvetica-Bold")
            .text(label, 50, yPosition);

          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .font("Helvetica")
            .text(value || "N/A", 180, yPosition);

          yPosition += 15;
        });

        yPosition += 20;

        // 2. INFORMACIÓN DEL MONITOR
        if (equipoData.marcaMonitor) {
          if (yPosition > 600) {
            doc.addPage();
            yPosition = 50;
          }

          doc
            .fillColor("#1f2937")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("INFORMACIÓN DEL MONITOR", 50, yPosition);
          yPosition += 25;

          const infoMonitor = [
            ["Marca:", equipoData.marcaMonitor],
            ["Pulgadas:", equipoData.pulgadasMonitor],
            [
              "Código Patrimonial:",
              equipoData.codigoPatrimonialMonitor || "N/A",
            ],
            ["Estado:", equipoData.estadoMonitor],
          ];

          infoMonitor.forEach(([label, value]) => {
            doc
              .fillColor("#374151")
              .fontSize(10)
              .font("Helvetica-Bold")
              .text(label, 50, yPosition);

            doc
              .fillColor("#6b7280")
              .fontSize(10)
              .font("Helvetica")
              .text(value || "N/A", 180, yPosition);

            yPosition += 15;
          });

          yPosition += 20;
        }

        // 3. HISTORIAL COMBINADO (Usuarios + Estados)
        if (historialEquipo.length > 0) {
          if (yPosition > 600) {
            doc.addPage();
            yPosition = 50;
          }

          doc
            .fillColor("#1f2937")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("HISTORIAL COMPLETO DEL EQUIPO", 50, yPosition);
          yPosition += 25;

          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .font("Helvetica")
            .text(
              "Registro completo de asignaciones, estados y cambios:",
              50,
              yPosition
            );
          yPosition += 20;

          // Header de la tabla - CAMBIAR "ACCIÓN" por "ESTADO TÉCNICO"
          doc
            .fillColor("#1f2937")
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("FECHA", 50, yPosition);
          doc.text("ESTADO TÉCNICO", 100, yPosition); // ← Cambiado aquí
          doc.text("USUARIO/ESTADO", 200, yPosition);
          doc.text("DETALLES", 350, yPosition);
          doc.text("SITUACIÓN", 480, yPosition);

          yPosition += 10;

          // Línea separadora del header
          doc
            .moveTo(50, yPosition)
            .lineTo(550, yPosition)
            .strokeColor("#e5e7eb")
            .lineWidth(0.5)
            .stroke();

          yPosition += 8;

          // Filas del historial
          // Filas del historial - VERSIÓN CORREGIDA
          historialEquipo.forEach((registro, index) => {
            if (yPosition > 750) {
              doc.addPage();
              yPosition = 50;

              // Header de la tabla en nueva página
              doc
                .fillColor("#1f2937")
                .fontSize(8)
                .font("Helvetica-Bold")
                .text("FECHA", 50, yPosition);
              doc.text("ESTADO TÉCNICO", 100, yPosition);
              doc.text("USUARIO/ESTADO", 200, yPosition);
              doc.text("DETALLES", 350, yPosition);
              doc.text("SITUACIÓN", 480, yPosition);

              yPosition += 10;
              doc
                .moveTo(50, yPosition)
                .lineTo(550, yPosition)
                .strokeColor("#e5e7eb")
                .lineWidth(0.5)
                .stroke();
              yPosition += 8;
            }

            try {
              const fecha = new Date(registro.createdAt).toLocaleDateString(
                "es-PE"
              );

              // Fecha
              doc
                .fillColor("#374151")
                .fontSize(7)
                .font("Helvetica")
                .text(fecha, 50, yPosition, { width: 45 });

              // Estado Técnico y Situación - CORREGIDO (usando equipoData)
              let estadoTecnico = equipoData.estado || "N/A";
              let situacion = equipoData.estado_especial || "N/A";
              let usuarioEstado = "Sin cambios";
              let accionTexto = registro.accion;

              if (registro.detalles) {
                try {
                  const detalles = JSON.parse(registro.detalles);

                  // Estado Técnico - MEJORADO: Si hay cambio en el historial, usar ese valor
                  estadoTecnico =
                    detalles.next?.estado ||
                    detalles.prev?.estado ||
                    estadoTecnico;

                  // Situación - MEJORADO: Si hay cambio en el historial, usar ese valor
                  situacion =
                    detalles.next?.estado_especial ||
                    detalles.prev?.estado_especial ||
                    situacion;

           // Usuario/Estado - VERSIÓN MEJORADA (igual que impresoras)
if (detalles.next?.estado_especial === "revision") {
  usuarioEstado = "REVISIÓN";
} else if (detalles.next?.estado_especial === "baja") {
  usuarioEstado = "BAJA";
} else if (detalles.next?.estado_especial === "disponible") {
  usuarioEstado = "DISPONIBLE";
} else if (
  detalles.next?.usuarioId &&
  detalles.prev?.usuarioId !== detalles.next?.usuarioId
) {
  const usuarioId = detalles.next.usuarioId;
  const usuarioInfo = usuariosInfo.find(
    (u) => u.usuarioId === usuarioId
  );
  usuarioEstado = usuarioInfo
    ? `${usuarioInfo.nombres} ${usuarioInfo.apellidos}`
    : `Usuario ${usuarioId}`;
} else if (
  !detalles.next?.usuarioId &&
  detalles.prev?.usuarioId
) {
  usuarioEstado = "SIN USUARIO";
} else if (detalles.next?.estado_especial) {
  usuarioEstado = detalles.next.estado_especial.toUpperCase();
} else if (detalles.prev?.estado_especial) {
  usuarioEstado = detalles.prev.estado_especial.toUpperCase();
} else {
  usuarioEstado = situacion.toUpperCase(); // ← Esto mostrará "DISPONIBLE", "REVISIÓN", etc.
}
                } catch (parseError) {
                  console.error(
                    "Error parseando detalles de impresora:",
                    parseError
                  );
                  accionTexto = "Información de cambio";
                }
              }

              // Estado Técnico con color
              const estadoColor =
                ReporteController.getColorPorEstado(estadoTecnico);
              doc
                .fillColor(estadoColor)
                .fontSize(7)
                .font("Helvetica-Bold")
                .text(estadoTecnico.toUpperCase(), 100, yPosition, {
                  width: 90,
                });

              // Usuario/Estado
              doc
                .fillColor("#374151")
                .fontSize(7)
                .font("Helvetica")
                .text(usuarioEstado, 200, yPosition, { width: 140 });

              // Detalles
              doc
                .fillColor("#6b7280")
                .fontSize(6)
                .font("Helvetica")
                .text(accionTexto, 350, yPosition, { width: 120 });
              // Situación con color
              const situacionColor =
                ReporteController.getColorPorSituacion(situacion);
              doc
                .fillColor(situacionColor)
                .fontSize(7)
                .font("Helvetica-Bold")
                .text(situacion.toUpperCase(), 480, yPosition, { width: 60 });

              yPosition += 20;

              // Línea separadora entre registros
              if (index < historialEquipo.length - 1) {
                doc
                  .moveTo(50, yPosition - 5)
                  .lineTo(550, yPosition - 5)
                  .strokeColor("#f3f4f6")
                  .lineWidth(0.3)
                  .stroke();
              }
            } catch (error) {
              console.error(
                "Error crítico procesando registro de historial:",
                error
              );

              // Manejo de error MEJORADO
              const fecha = new Date(registro.createdAt).toLocaleDateString(
                "es-PE"
              );

              doc
                .fillColor("#374151")
                .fontSize(7)
                .font("Helvetica")
                .text(fecha, 50, yPosition, { width: 45 });

              doc
                .fillColor("#dc2626")
                .fontSize(7)
                .font("Helvetica-Bold")
                .text("ERROR", 100, yPosition, { width: 90 });

              doc
                .fillColor("#6b7280")
                .fontSize(7)
                .font("Helvetica")
                .text("Datos corruptos", 200, yPosition, { width: 140 });

              doc
                .fillColor("#6b7280")
                .fontSize(6)
                .font("Helvetica")
                .text("Registro con formato incorrecto", 350, yPosition, {
                  width: 120,
                });

              doc
                .fillColor("#6b7280")
                .fontSize(7)
                .font("Helvetica")
                .text("N/A", 480, yPosition, { width: 60 });

              yPosition += 20;
            }
          });

          yPosition += 20;
        }

        console.log("PDF de equipo generado exitosamente");
        doc.end();
      } catch (pdfError: any) {
        console.error("Error al generar PDF:", pdfError);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Error al generar el PDF",
            details: pdfError?.message || "Error desconocido en PDF",
          });
        }
        return;
      }
    } catch (err: any) {
      console.error("Error completo al generar reporte de equipo:", err);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Error al generar reporte de equipo",
          details: err?.message || "Error desconocido",
        });
      }
    }
  }

  //Impresoras
  static async generarReporteImpresora(
    req: Request,
    res: Response
  ): Promise<void> {
    const { id } = req.params;

    try {
      console.log(`Generando reporte para impresora ID: ${id}`);

      // 1. Obtener información de la impresora
      const [impresora] = await db.promise().query<RowDataPacket[]>(
        `SELECT i.*, u.id as usuario_id, u.dni, u.nombres, u.apellidos, u.tipoContrato
       FROM impresoras i
       LEFT JOIN usuarios u ON i.usuarioId = u.id
       WHERE i.id = ?`,
        [id]
      );

      if (impresora.length === 0) {
        res.status(404).json({ error: "Impresora no encontrada" });
        return;
      }

      const impresoraData = impresora[0];

      // 2. Obtener historial completo
      const [historialImpresora] = await db.promise().query<RowDataPacket[]>(
        `SELECT hc.*
       FROM historial_cambios hc
       WHERE hc.tipo_activo = 'impresora' AND hc.activo_id = ?
       ORDER BY hc.createdAt DESC`,
        [id]
      );

      // 3. Obtener usuarios que han tenido esta impresora
      const usuariosHistoricos = new Map();

      historialImpresora.forEach((registro) => {
        try {
          const detalles = JSON.parse(registro.detalles);

          // Buscar información del usuario en los detalles
          if (
            detalles.next?.usuarioId &&
            detalles.next.usuarioId !== detalles.prev?.usuarioId
          ) {
            const usuarioId = detalles.next.usuarioId;
            const nombresCompletos =
              detalles.nota?.match(/Asignado a (.+?)$/)?.[1] ||
              `Usuario ${usuarioId}`;

            usuariosHistoricos.set(usuarioId, {
              usuarioId: usuarioId,
              nombres: nombresCompletos,
              fechaAsignacion: registro.createdAt,
              accion: registro.accion,
            });
          }

          // También capturar desasignaciones
          if (detalles.prev?.usuarioId && !detalles.next?.usuarioId) {
            const usuarioId = detalles.prev.usuarioId;
            usuariosHistoricos.set(usuarioId, {
              usuarioId: usuarioId,
              nombres: `Usuario ${usuarioId}`,
              fechaAsignacion: registro.createdAt,
              accion: "desasignacion",
            });
          }
        } catch (error) {
          console.error("Error al parsear detalles:", error);
        }
      });

      // 4. Obtener información completa de los usuarios históricos
      interface UsuarioHistorico {
        usuarioId: number;
        nombres: string;
        apellidos: string;
        dni: string;
        oficina: string;
        fechaAsignacion: string;
        accion: string;
      }

      const usuariosInfo: UsuarioHistorico[] = [];
      for (const [usuarioId, info] of usuariosHistoricos) {
        if (info.accion !== "desasignacion") {
          const [usuario] = await db
            .promise()
            .query<RowDataPacket[]>(
              "SELECT nombres, apellidos, dni, oficina FROM usuarios WHERE id = ?",
              [usuarioId]
            );
          if (usuario.length > 0) {
            usuariosInfo.push({
              ...info,
              nombres: usuario[0].nombres,
              apellidos: usuario[0].apellidos,
              dni: usuario[0].dni,
              oficina: usuario[0].oficina,
              fechaAsignacion: info.fechaAsignacion,
            });
          }
        }
      }

      // Crear PDF
      const doc = new PDFDocument({
        margin: 50,
        bufferPages: true,
      });

      // Configurar headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=reporte-impresora-${
          impresoraData.codigoPatrimonial || impresoraData.id
        }.pdf`
      );

      doc.pipe(res);

      try {
        // Header
        doc
          .fillColor("#1f2937")
          .fontSize(18)
          .font("Helvetica-Bold")
          .text("SISTEMA DE INVENTARIO - REPORTE DE IMPRESORA", 50, 50);

        doc
          .fillColor("#6b7280")
          .fontSize(12)
          .font("Helvetica")
          .text(`Generado: ${new Date().toLocaleString("es-PE")}`, 50, 80);

        // Línea separadora
        doc
          .moveTo(50, 100)
          .lineTo(550, 100)
          .strokeColor("#e5e7eb")
          .lineWidth(1)
          .stroke();

        let yPosition = 130;

        // 1. INFORMACIÓN DE LA IMPRESORA
        doc
          .fillColor("#1f2937")
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("INFORMACIÓN DE LA IMPRESORA", 50, yPosition);
        yPosition += 30;

        const infoImpresora = [
          ["Código Patrimonial:", impresoraData.codigoPatrimonial || "N/A"],
          ["Modelo:", impresoraData.modelo || "N/A"],
          ["IP:", impresoraData.ip || "N/A"],
          ["MAC:", impresoraData.mac || "N/A"],
          ["Oficina:", impresoraData.oficina || "N/A"],
          ["Estado Técnico:", impresoraData.estado || "N/A"],
          // ["Estado Especial:", impresoraData.estado_especial || "N/A"],
          [
            "Usuario Actual:",
            impresoraData.usuario_id
              ? `${impresoraData.nombres} ${impresoraData.apellidos} (${impresoraData.dni})`
              : "Sin asignar",
          ],
        ];

        infoImpresora.forEach(([label, value]) => {
          doc
            .fillColor("#374151")
            .fontSize(10)
            .font("Helvetica-Bold")
            .text(label, 50, yPosition);

          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .font("Helvetica")
            .text(value || "N/A", 180, yPosition);

          yPosition += 15;
        });

        yPosition += 20;

        // 2. HISTORIAL COMBINADO (Mismo formato que equipos)
        if (historialImpresora.length > 0) {
          if (yPosition > 600) {
            doc.addPage();
            yPosition = 50;
          }

          doc
            .fillColor("#1f2937")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text("HISTORIAL COMPLETO DE LA IMPRESORA", 50, yPosition);
          yPosition += 25;

          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .font("Helvetica")
            .text(
              "Registro completo de asignaciones, estados y cambios:",
              50,
              yPosition
            );
          yPosition += 20;

          // Header de la tabla - Mismo formato que equipos
          doc
            .fillColor("#1f2937")
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("FECHA", 50, yPosition);
          doc.text("ESTADO TÉCNICO", 100, yPosition);
          doc.text("USUARIO/ESTADO", 200, yPosition);
          doc.text("ACCIÓN", 350, yPosition);
          doc.text("SITUACIÓN", 480, yPosition);

          yPosition += 10;

          // Línea separadora del header
          doc
            .moveTo(50, yPosition)
            .lineTo(550, yPosition)
            .strokeColor("#e5e7eb")
            .lineWidth(0.5)
            .stroke();

          yPosition += 8;

          // Filas del historial - Mismo formato que equipos
          historialImpresora.forEach((registro, index) => {
            if (yPosition > 750) {
              doc.addPage();
              yPosition = 50;

              // Header de la tabla en nueva página
              doc
                .fillColor("#1f2937")
                .fontSize(8)
                .font("Helvetica-Bold")
                .text("FECHA", 50, yPosition);
              doc.text("ESTADO TÉCNICO", 100, yPosition);
              doc.text("USUARIO/ESTADO", 200, yPosition);
              doc.text("ACCIÓN", 350, yPosition);
              doc.text("SITUACIÓN", 480, yPosition);

              yPosition += 10;
              doc
                .moveTo(50, yPosition)
                .lineTo(550, yPosition)
                .strokeColor("#e5e7eb")
                .lineWidth(0.5)
                .stroke();
              yPosition += 8;
            }

            try {
              const fecha = new Date(registro.createdAt).toLocaleDateString(
                "es-PE"
              );

              // Fecha
              doc
                .fillColor("#374151")
                .fontSize(7)
                .font("Helvetica")
                .text(fecha, 50, yPosition, { width: 45 });

            // Estado Técnico y Situación - VERSIÓN MEJORADA CON DEBUG
let estadoTecnico = impresoraData.estado || "N/A";
let situacion = impresoraData.estado_especial || "N/A";
let usuarioEstado = "Sin cambios";
let accionTexto = registro.accion;

if (registro.detalles) {
  try {
    const detalles = JSON.parse(registro.detalles);
    
    // DEBUG - Solo para revisiones para no saturar
    if (registro.accion === 'revision') {
      console.log('🔍 DEBUG REVISIÓN - Detalles:', detalles);
    }
    
    // Estado Técnico - BUSCAR MÁS EXHAUSTIVAMENTE
    if (detalles.next && detalles.next.estado && detalles.next.estado !== "N/A") {
      estadoTecnico = detalles.next.estado;
    } else if (detalles.prev && detalles.prev.estado && detalles.prev.estado !== "N/A") {
      estadoTecnico = detalles.prev.estado;
    }
    
    // Situación
    if (detalles.next && detalles.next.estado_especial) {
      situacion = detalles.next.estado_especial;
    } else if (detalles.prev && detalles.prev.estado_especial) {
      situacion = detalles.prev.estado_especial;
    }

    // Usuario/Estado - VERSIÓN CORREGIDA
    if (detalles.next?.estado_especial === "revision") {
      usuarioEstado = "REVISIÓN";
    } else if (detalles.next?.estado_especial === "baja") {
      usuarioEstado = "BAJA";
    } else if (detalles.next?.estado_especial === "disponible") {
      usuarioEstado = "DISPONIBLE";
    } else if (
      detalles.next?.usuarioId &&
      detalles.prev?.usuarioId !== detalles.next?.usuarioId
    ) {
      const usuarioId = detalles.next.usuarioId;
      const usuarioInfo = usuariosInfo.find(
        (u) => u.usuarioId === usuarioId
      );
      usuarioEstado = usuarioInfo
        ? `${usuarioInfo.nombres} ${usuarioInfo.apellidos}`
        : `Usuario ${usuarioId}`;
    } else if (
      !detalles.next?.usuarioId &&
      detalles.prev?.usuarioId
    ) {
      usuarioEstado = "SIN USUARIO";
    } else if (detalles.next?.estado_especial) {
      usuarioEstado = detalles.next.estado_especial.toUpperCase();
    } else {
      usuarioEstado = "SIN CAMBIOS";
    }

    // Mejorar texto de acción
    if (detalles.nota) {
      accionTexto = detalles.nota;
    } else if (detalles.motivo) {
      accionTexto = detalles.motivo;
    }
  } catch (parseError) {
    console.error(
      "Error parseando detalles de impresora:",
      parseError
    );
    accionTexto = "Información de cambio";
  }
}

              // Estado Técnico con color
              const estadoColor =
                ReporteController.getColorPorEstado(estadoTecnico);
              doc
                .fillColor(estadoColor)
                .fontSize(7)
                .font("Helvetica-Bold")
                .text(estadoTecnico.toUpperCase(), 100, yPosition, {
                  width: 90,
                });

              // Usuario/Estado
              doc
                .fillColor("#374151")
                .fontSize(7)
                .font("Helvetica")
                .text(usuarioEstado, 200, yPosition, { width: 140 });

              // Acción/Detalles
              const accionColor = ReporteController.getColorPorAccion(
                registro.accion
              );
              doc
                .fillColor(accionColor)
                .fontSize(6)
                .font("Helvetica-Bold")
                .text(accionTexto, 350, yPosition, { width: 120 });

              // Situación con color
              const situacionColor =
                ReporteController.getColorPorSituacion(situacion);
              doc
                .fillColor(situacionColor)
                .fontSize(7)
                .font("Helvetica-Bold")
                .text(situacion.toUpperCase(), 480, yPosition, { width: 60 });

              yPosition += 20;

              // Línea separadora entre registros
              if (index < historialImpresora.length - 1) {
                doc
                  .moveTo(50, yPosition - 5)
                  .lineTo(550, yPosition - 5)
                  .strokeColor("#f3f4f6")
                  .lineWidth(0.3)
                  .stroke();
              }
            } catch (error) {
              console.error(
                "Error crítico procesando registro de historial:",
                error
              );

              // Manejo de error MEJORADO
              const fecha = new Date(registro.createdAt).toLocaleDateString(
                "es-PE"
              );

              doc
                .fillColor("#374151")
                .fontSize(7)
                .font("Helvetica")
                .text(fecha, 50, yPosition, { width: 45 });

              doc
                .fillColor("#dc2626")
                .fontSize(7)
                .font("Helvetica-Bold")
                .text("ERROR", 100, yPosition, { width: 90 });

              doc
                .fillColor("#6b7280")
                .fontSize(7)
                .font("Helvetica")
                .text("Datos corruptos", 200, yPosition, { width: 140 });

              doc
                .fillColor("#6b7280")
                .fontSize(6)
                .font("Helvetica")
                .text("Registro con formato incorrecto", 350, yPosition, {
                  width: 120,
                });

              doc
                .fillColor("#6b7280")
                .fontSize(7)
                .font("Helvetica")
                .text("N/A", 480, yPosition, { width: 60 });

              yPosition += 20;
            }
          });

          yPosition += 20;
        }

        console.log("PDF de impresora generado exitosamente");
        doc.end();
      } catch (pdfError: any) {
        console.error("Error al generar PDF:", pdfError);
        if (!res.headersSent) {
          res.status(500).json({
            error: "Error al generar el PDF",
            details: pdfError?.message || "Error desconocido en PDF",
          });
        }
        return;
      }
    } catch (err: any) {
      console.error("Error completo al generar reporte de impresora:", err);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Error al generar reporte de impresora",
          details: err?.message || "Error desconocido",
        });
      }
    }
  }
}
