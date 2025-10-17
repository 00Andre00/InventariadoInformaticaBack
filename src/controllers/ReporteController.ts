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

      // 3. HISTÓRICO DE EQUIPOS (solo las que NO están asignadas actualmente)
      const [historicoEquipos] = await db.promise().query<RowDataPacket[]>(
        `SELECT e.*,
                (SELECT hc.createdAt FROM historial_cambios hc 
                 WHERE hc.activo_id = e.id AND hc.tipo_activo = 'equipo' 
                 AND (hc.accion = 'asignacion' OR hc.accion = 'asignado' OR hc.accion LIKE '%asign%')
                 ORDER BY hc.createdAt DESC LIMIT 1) as fecha_asignacion,
                (SELECT hc.createdAt FROM historial_cambios hc 
                 WHERE hc.activo_id = e.id AND hc.tipo_activo = 'equipo' 
                 AND (hc.accion = 'revision' OR hc.accion = 'baja' OR hc.accion = 'enviado_a_revision' OR hc.accion = 'dado_de_baja' OR hc.accion = 'desasignacion') 
                 ORDER BY hc.createdAt DESC LIMIT 1) as fecha_desasignacion
         FROM equipos e 
         WHERE e.id IN (
           SELECT DISTINCT activo_id FROM historial_cambios 
           WHERE tipo_activo = 'equipo' 
           AND (detalles LIKE ? OR detalles LIKE ? OR accion LIKE '%asign%')
         )
         AND (e.usuarioId != ? OR e.usuarioId IS NULL)
         AND e.estado_especial != 'asignado'
         ORDER BY fecha_desasignacion DESC, fecha_asignacion DESC`,
        [`%${usuarioData.nombres}%`, `%${usuarioData.nombres} ${usuarioData.apellidos}%`, id]
      );

      // 4. HISTÓRICO DE IMPRESORAS (solo las que NO están asignadas actualmente)
      const [historicoImpresoras] = await db.promise().query<RowDataPacket[]>(
        `SELECT i.*,
                (SELECT hc.createdAt FROM historial_cambios hc 
                 WHERE hc.activo_id = i.id AND hc.tipo_activo = 'impresora' 
                 AND (hc.accion = 'asignacion' OR hc.accion = 'asignada' OR hc.accion LIKE '%asign%')
                 ORDER BY hc.createdAt DESC LIMIT 1) as fecha_asignacion,
                (SELECT hc.createdAt FROM historial_cambios hc 
                 WHERE hc.activo_id = i.id AND hc.tipo_activo = 'impresora' 
                 AND (hc.accion = 'revision' OR hc.accion = 'baja' OR hc.accion = 'enviado_a_revision' OR hc.accion = 'dada_de_baja' OR hc.accion = 'desasignacion') 
                 ORDER BY hc.createdAt DESC LIMIT 1) as fecha_desasignacion
         FROM impresoras i 
         WHERE i.id IN (
           SELECT DISTINCT activo_id FROM historial_cambios 
           WHERE tipo_activo = 'impresora' 
           AND (detalles LIKE ? OR detalles LIKE ? OR accion LIKE '%asign%')
         )
         AND (i.usuarioId != ? OR i.usuarioId IS NULL)
         AND i.estado_especial != 'asignado'
         ORDER BY fecha_desasignacion DESC, fecha_asignacion DESC`,
        [`%${usuarioData.nombres}%`, `%${usuarioData.nombres} ${usuarioData.apellidos}%`, id]
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

      console.log('IDs de equipos encontrados en histórico:', historicoEquipos.map(e => e.id));
      console.log('IDs de impresoras encontrados en histórico:', historicoImpresoras.map(i => i.id));

      // Debug para ver qué registros encuentra para cada equipo histórico
      for (const equipo of historicoEquipos) {
        const [asignaciones] = await db.promise().query<RowDataPacket[]>(
          `SELECT accion, createdAt, detalles FROM historial_cambios 
           WHERE activo_id = ? AND tipo_activo = 'equipo' 
           AND (accion LIKE '%asign%' OR accion = 'desasignacion')
           ORDER BY createdAt DESC`,
          [equipo.id]
        );
        console.log(`Registros de asignación para equipo ${equipo.id}:`, asignaciones);
      }

      // Debug específico para cada equipo histórico
      historicoEquipos.forEach((eq, i) => {
        console.log(`Histórico equipo ${i} (ID: ${eq.id}):`, {
          fecha_asignacion: eq.fecha_asignacion,
          fecha_desasignacion: eq.fecha_desasignacion,
          estado_especial: eq.estado_especial,
          usuarioId: eq.usuarioId
        });
      });

      console.log('Impresoras con usuarioId:', impresorasActuales.map(i => ({
        id: i.id, 
        usuarioId: i.usuarioId,
        estado_especial: i.estado_especial
      })));

      console.log('Búsquedas:', [
        `%${usuarioData.nombres}%`, 
        `%${usuarioData.nombres} ${usuarioData.apellidos}%`
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

        // Footer en todas las páginas
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc
            .fillColor("#6b7280")
            .fontSize(10)
            .text(`Página ${i + 1} de ${totalPages}`, 50, 800, {
              align: "center",
              width: 500,
            });
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
}