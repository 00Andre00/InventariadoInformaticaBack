import { Request, Response } from "express";
import db from "../config/db";
import PDFDocument from "pdfkit";
import { RowDataPacket } from "mysql2";
import { HistorialHelper } from "../utils/historialHelper";

export class ReporteController {
  
  // MÉTODO MEJORADO PARA VERIFICAR ESPACIO EN PÁGINA
private static necesitaNuevaPagina(
  doc: PDFKit.PDFDocument, 
  yPosition: number, 
  espacioNecesario: number = 30
): number {
  // Si no hay suficiente espacio para el contenido siguiente
  if (yPosition + espacioNecesario > 720) {
    doc.addPage();
    return 80; // Posición inicial en nueva página (más espacio para el header si es necesario)
  }
  return yPosition;
}

  // MÉTODO PARA AGREGAR HEADER DE TABLA EN NUEVA PÁGINA
  private static agregarHeaderTablaGeneral(doc: PDFKit.PDFDocument, y: number): void {
    doc.fillColor("#1f2937").fontSize(8).font("Helvetica-Bold")
       .text("COD. PAT.", 50, y)
       .text("EQUIPO", 100, y)
       .text("IP", 180, y)
       .text("MAC", 230, y)
       .text("USUARIO/ESTADO", 300, y)
       .text("OFICINA", 450, y)
       .text("SITUACIÓN", 520, y);

    y += 10;
    doc.moveTo(50, y).lineTo(580, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  }

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

   // 3. HISTÓRICO DE EQUIPOS - VERSIÓN SIMPLE
const [historicoEquipos] = await db.promise().query<RowDataPacket[]>(
  `SELECT DISTINCT e.*,
    (SELECT hc.createdAt FROM historial_cambios hc 
     WHERE hc.activo_id = e.id AND hc.tipo_activo = 'equipo' 
     AND (hc.accion = 'asignacion' OR hc.accion = 'asignado' OR hc.accion = 'reasignacion')
     AND hc.detalles LIKE CONCAT('%"usuarioId":', ?, '%')
     ORDER BY hc.createdAt DESC LIMIT 1) as fecha_asignacion,
    (SELECT hc.createdAt FROM historial_cambios hc 
     WHERE hc.activo_id = e.id AND hc.tipo_activo = 'equipo' 
     AND hc.accion IN ('revision', 'baja', 'enviado_a_revision', 'dado_de_baja', 'desasignacion', 'reasignacion')
     ORDER BY hc.createdAt DESC LIMIT 1) as fecha_desasignacion
FROM equipos e 
INNER JOIN historial_cambios hc ON hc.activo_id = e.id AND hc.tipo_activo = 'equipo'
WHERE hc.detalles LIKE CONCAT('%"usuarioId":', ?, '%')
AND e.id NOT IN (
  SELECT id FROM equipos WHERE usuarioId = ? AND estado_especial = 'asignado'
)
ORDER BY fecha_desasignacion DESC, fecha_asignacion DESC`,
  [id, id, id]
);

  // 4. HISTÓRICO DE IMPRESORAS - VERSIÓN ROBUSTA
const [historicoImpresoras] = await db.promise().query<RowDataPacket[]>(
  `SELECT DISTINCT i.*,
    (SELECT hc.createdAt FROM historial_cambios hc 
     WHERE hc.activo_id = i.id AND hc.tipo_activo = 'impresora' 
     AND hc.detalles REGEXP CONCAT('"usuarioId"[[:space:]]*:[[:space:]]*', ?)
     ORDER BY hc.createdAt DESC LIMIT 1) as fecha_asignacion,
    (SELECT hc.createdAt FROM historial_cambios hc 
     WHERE hc.activo_id = i.id AND hc.tipo_activo = 'impresora' 
     AND (hc.accion IN ('revision', 'baja', 'enviado_a_revision', 'dada_de_baja', 'desasignacion', 'reasignacion'))
     ORDER BY hc.createdAt DESC LIMIT 1) as fecha_desasignacion
FROM impresoras i 
WHERE EXISTS (
  SELECT 1 FROM historial_cambios hc
  WHERE hc.tipo_activo = 'impresora' 
  AND hc.activo_id = i.id
  AND (
    hc.detalles REGEXP CONCAT('"next"[^}]*"usuarioId"[[:space:]]*:[[:space:]]*', ?)
    OR (hc.detalles REGEXP CONCAT('"prev"[^}]*"usuarioId"[[:space:]]*:[[:space:]]*', ?)
        AND hc.accion IN ('desasignacion', 'reasignacion'))
  )
)
AND i.id NOT IN (
  SELECT id FROM impresoras WHERE usuarioId = ? AND estado_especial = 'asignado'
)
ORDER BY fecha_desasignacion DESC, fecha_asignacion DESC`,
  [id, id, id, id]
);

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
        yPosition = ReporteController.necesitaNuevaPagina(doc, yPosition, 10);
        doc
          .fillColor("#1f2937")
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("INFORMACIÓN DEL USUARIO", 50, yPosition);
        yPosition += 30;

        ReporteController.agregarTablaUsuario(doc, usuarioData, yPosition);
        yPosition += 120;

        // 2. EQUIPOS ACTUALMENTE ASIGNADOS - VERSIÓN MEJORADA
        if (equiposActuales.length > 0) {
          yPosition = ReporteController.necesitaNuevaPagina(doc, yPosition, equiposActuales.length + 5);
          
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

          yPosition = ReporteController.agregarTablaEquiposActualesMejorado(doc, equiposActuales, yPosition);
        } else {
          yPosition = ReporteController.necesitaNuevaPagina(doc, yPosition, 3);
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

        // 3. IMPRESORAS ACTUALMENTE ASIGNADAS - VERSIÓN MEJORADA
        if (impresorasActuales.length > 0) {
          yPosition = ReporteController.necesitaNuevaPagina(doc, yPosition, impresorasActuales.length + 5);

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

          yPosition = ReporteController.agregarTablaImpresorasActualesMejorado(doc, impresorasActuales, yPosition);
        } else {
          yPosition = ReporteController.necesitaNuevaPagina(doc, yPosition, 3);
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

        // 4. HISTÓRICO DE EQUIPOS - VERSIÓN MEJORADA
        if (historicoEquipos.length > 0) {
          yPosition = ReporteController.necesitaNuevaPagina(doc, yPosition, historicoEquipos.length + 5);

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

          yPosition = ReporteController.agregarTablaHistoricoEquiposMejorado(doc, historicoEquipos, yPosition);
        }

        // 5. HISTÓRICO DE IMPRESORAS - VERSIÓN MEJORADA
        if (historicoImpresoras.length > 0) {
          yPosition = ReporteController.necesitaNuevaPagina(doc, yPosition, historicoImpresoras.length + 5);

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

          ReporteController.agregarTablaHistoricoImpresorasMejorado(doc, historicoImpresoras, yPosition);
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

  // MÉTODOS MEJORADOS PARA TABLAS CON CONTROL DE PÁGINAS
private static agregarTablaEquiposActualesMejorado(
  doc: PDFKit.PDFDocument,
  equipos: any[],
  startY: number
): number {
  let y = startY;

    // Header
    y = ReporteController.necesitaNuevaPagina(doc, y, 60);
  ReporteController.agregarHeaderEquiposActuales(doc, y);
  y += 25;

    // Filas
    equipos.forEach((equipo, index) => {
    // Verificar espacio ANTES de escribir
    y = ReporteController.necesitaNuevaPagina(doc, y, 25);
    
    // Si acabamos de crear una nueva página, redibujar header
    if (y < 100) {
      ReporteController.agregarHeaderEquiposActuales(doc, y);
      y += 25;
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

      // Línea separadora entre filas
      if (index < equipos.length - 1) {
      doc.moveTo(50, y - 5).lineTo(550, y - 5)
         .strokeColor("#f3f4f6").lineWidth(0.3).stroke();
    }
  });

    return y + 20;
  }

  private static agregarHeaderEquiposActuales(doc: PDFKit.PDFDocument, y: number): void {
    doc.fillColor("#1f2937").fontSize(9).font("Helvetica-Bold")
       .text("COD. PAT.", 50, y)
       .text("EQUIPO", 120, y)
       .text("FECHA ASIGNACIÓN", 250, y)
       .text("ESTADO", 400, y);

    y += 12;
    doc.moveTo(50, y).lineTo(550, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  }

  private static agregarTablaImpresorasActualesMejorado(
  doc: PDFKit.PDFDocument,
  impresoras: any[],
  startY: number
): number {
  let y = startY;

    // Header
    y = ReporteController.necesitaNuevaPagina(doc, y, 60);
  ReporteController.agregarHeaderImpresorasActuales(doc, y);
  y += 25;

    // Filas
    impresoras.forEach((impresora, index) => {
    // Verificar espacio ANTES de escribir
    y = ReporteController.necesitaNuevaPagina(doc, y, 25);
    
    // Si acabamos de crear una nueva página, redibujar header
    if (y < 100) {
      ReporteController.agregarHeaderImpresorasActuales(doc, y);
      y += 25;
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

    // Línea separadora entre filas
    if (index < impresoras.length - 1) {
      doc.moveTo(50, y - 5).lineTo(550, y - 5)
         .strokeColor("#f3f4f6").lineWidth(0.3).stroke();
    }
  });

    return y + 20;
  }

  private static agregarHeaderImpresorasActuales(doc: PDFKit.PDFDocument, y: number): void {
    doc.fillColor("#1f2937").fontSize(9).font("Helvetica-Bold")
       .text("COD. PAT.", 50, y)
       .text("MODELO", 120, y)
       .text("FECHA ASIGNACIÓN", 250, y)
       .text("ESTADO", 400, y);

    y += 12;
    doc.moveTo(50, y).lineTo(550, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  }

private static agregarTablaHistoricoEquiposMejorado(
  doc: PDFKit.PDFDocument,
  equipos: any[],
  startY: number
): number {
  let y = startY;

    // Header
     y = ReporteController.necesitaNuevaPagina(doc, y, 60);
  ReporteController.agregarHeaderHistoricoEquipos(doc, y);
  y += 25;

    // Filas
    equipos.forEach((equipo, index) => {
    // Verificar espacio ANTES de escribir
    y = ReporteController.necesitaNuevaPagina(doc, y, 30);
    
    // Si acabamos de crear una nueva página, redibujar header
    if (y < 100) {
      ReporteController.agregarHeaderHistoricoEquipos(doc, y);
      y += 25;
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

      // Línea separadora entre filas
     if (index < equipos.length - 1) {
      doc.moveTo(50, y - 10).lineTo(550, y - 10)
         .strokeColor("#f3f4f6").lineWidth(0.3).stroke();
    }
  });

  return y + 20;
}

  private static agregarHeaderHistoricoEquipos(doc: PDFKit.PDFDocument, y: number): void {
    doc.fillColor("#1f2937").fontSize(8).font("Helvetica-Bold")
       .text("CÓDIGO", 50, y)
       .text("EQUIPO", 90, y)
       .text("FECHA ASIGNACIÓN", 200, y)
       .text("FECHA DESASIGNACIÓN", 320, y)
       .text("SITUACIÓN ACTUAL", 450, y);

    y += 10;
    doc.moveTo(50, y).lineTo(550, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  }

 private static agregarTablaHistoricoImpresorasMejorado(
  doc: PDFKit.PDFDocument,
  impresoras: any[],
  startY: number
): number {
  let y = startY;

    // Header
     y = ReporteController.necesitaNuevaPagina(doc, y, 60);
  ReporteController.agregarHeaderHistoricoImpresoras(doc, y);
  y += 25;

    // Filas
   impresoras.forEach((impresora, index) => {
    // Verificar espacio ANTES de escribir
    y = ReporteController.necesitaNuevaPagina(doc, y, 30);
    
    // Si acabamos de crear una nueva página, redibujar header
    if (y < 100) {
      ReporteController.agregarHeaderHistoricoImpresoras(doc, y);
      y += 25;
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

      // Línea separadora entre filas
    if (index < impresoras.length - 1) {
      doc.moveTo(50, y - 10).lineTo(550, y - 10)
         .strokeColor("#f3f4f6").lineWidth(0.3).stroke();
    }
  });

  return y + 20;
}

  private static agregarHeaderHistoricoImpresoras(doc: PDFKit.PDFDocument, y: number): void {
    doc.fillColor("#1f2937").fontSize(8).font("Helvetica-Bold")
       .text("CÓDIGO", 50, y)
       .text("MODELO", 90, y)
       .text("FECHA ASIGNACIÓN", 200, y)
       .text("FECHA DESASIGNACIÓN", 320, y)
       .text("SITUACIÓN ACTUAL", 450, y);

    y += 10;
    doc.moveTo(50, y).lineTo(550, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  }

// REPORTE GENERAL DE EQUIPOS - VERSIÓN CON AJUSTES DE ANCHOS
static async generarReporteGeneralEquipos(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("Generando reporte general de equipos - PAGINACIÓN CORREGIDA");

    const [equipos] = await db.promise().query<RowDataPacket[]>(
      `SELECT e.*, 
              u.nombres as usuario_nombres, 
              u.apellidos as usuario_apellidos,
              u.dni as usuario_dni,
              u.oficina as usuario_oficina
       FROM equipos e
       LEFT JOIN usuarios u ON e.usuarioId = u.id
       ORDER BY e.estado_especial, e.oficina, e.tipo`
    );

  const doc = new PDFDocument({
      margin: 50,
      bufferPages: true,
      size: 'A4',
      layout: 'landscape'
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-general-equipos-${new Date().toISOString().split('T')[0]}.pdf`
    );

    doc.pipe(res);

    // Header
    doc
      .fillColor("#1f2937")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("SISTEMA DE INVENTARIO - REPORTE GENERAL DE EQUIPOS", 50, 50);

    doc
      .fillColor("#6b7280")
      .fontSize(10)
      .font("Helvetica")
      .text(`Generado: ${new Date().toLocaleString("es-PE")}`, 50, 75)
      .text(`Total de equipos: ${equipos.length}`, 50, 90);

    doc
      .moveTo(50, 110)
      .lineTo(780, 110)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();

    let yPosition = 130;

    if (equipos.length > 0) {
      // DEFINIR POSICIONES Y ANCHOS CON AJUSTES
      const columnas = {
        codPat: { x: 50, width: 55 },
        equipo: { x: 110, width: 75 }, // REDUCIDO: 90px → 75px
        ip: { x: 190, width: 70 },     // Ajustada posición
        mac: { x: 265, width: 85 },    // Ajustada posición
        usuario: { x: 355, width: 80 }, // REDUCIDO: 90px → 80px
        oficina: { x: 440, width: 70 }, // Ajustada posición
        situacion: { x: 515, width: 55 }, // Ajustada posición
        monitor: { x: 575, width: 70 }, // REDUCIDO: 80px → 70px
        codMonitor: { x: 650, width: 60 },
        estadoMonitor: { x: 715, width: 70 } // AUMENTADO: 60px → 70px
      };

      // Calcular el fin de la línea (mismo tamaño que la línea del header principal)
      const finLinea = 780; // Mismo que la línea del header principal

      // HEADER CON NUEVOS ANCHOS
      const dibujarHeader = (y: number) => {
        doc.fillColor("#1f2937").fontSize(7).font("Helvetica-Bold")
           .text("COD. PAT.", columnas.codPat.x, y, { width: columnas.codPat.width })
           .text("EQUIPO", columnas.equipo.x, y, { width: columnas.equipo.width })
           .text("IP", columnas.ip.x, y, { width: columnas.ip.width })
           .text("MAC", columnas.mac.x, y, { width: columnas.mac.width })
           .text("USUARIO", columnas.usuario.x, y, { width: columnas.usuario.width })
           .text("OFICINA", columnas.oficina.x, y, { width: columnas.oficina.width })
           .text("SITUACIÓN", columnas.situacion.x, y, { width: columnas.situacion.width })
           .text("MONITOR", columnas.monitor.x, y, { width: columnas.monitor.width })
           .text("COD. MONITOR", columnas.codMonitor.x, y, { width: columnas.codMonitor.width })
           .text("EST. MONITOR", columnas.estadoMonitor.x, y, { width: columnas.estadoMonitor.width });

        y += 12;
        // LÍNEA DEL MISMO TAMAÑO QUE EL HEADER PRINCIPAL
        doc.moveTo(50, y).lineTo(finLinea, y).strokeColor("#e5e7eb").lineWidth(0.8).stroke();
        
        return y + 15;
      };

      // Header inicial
      yPosition = dibujarHeader(yPosition);

      equipos.forEach((equipo, index) => {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
          yPosition = dibujarHeader(yPosition);
        }

        doc.fillColor("#374151").fontSize(7).font("Helvetica");

        // Código Patrimonial del EQUIPO
        doc.text(equipo.codigoPatrimonial || "Sin código", columnas.codPat.x, yPosition, { 
          width: columnas.codPat.width 
        });

        // Equipo - MÁS COMPACTO
        const textoEquipo = `${equipo.tipo || ''} ${equipo.marca || ''}`.trim();
        doc.text(textoEquipo, columnas.equipo.x, yPosition, { 
          width: columnas.equipo.width 
        });

        // IP
        doc.text(equipo.ip || "N/A", columnas.ip.x, yPosition, { 
          width: columnas.ip.width 
        });

        // MAC
        doc.text(equipo.mac || "N/A", columnas.mac.x, yPosition, { 
          width: columnas.mac.width 
        });

        // Usuario - MÁS COMPACTO
        let usuarioTexto = "";
        if (equipo.usuario_nombres && equipo.usuario_apellidos) {
          const primerNombre = equipo.usuario_nombres.split(' ')[0];
          const primerApellido = equipo.usuario_apellidos.split(' ')[0];
          // Si es muy largo, usar formato más compacto
          if ((primerNombre + primerApellido).length > 12) {
            usuarioTexto = `${primerNombre.substring(0, 1)}. ${primerApellido}`;
          } else {
            usuarioTexto = `${primerNombre} ${primerApellido}`;
          }
        } else {
          usuarioTexto = "S/ASIGNAR";
        }
        doc.text(usuarioTexto, columnas.usuario.x, yPosition, { 
          width: columnas.usuario.width 
        });

        // Oficina
        doc.text(equipo.oficina || "N/A", columnas.oficina.x, yPosition, { 
          width: columnas.oficina.width 
        });

        // Situación con color
        const situacion = equipo.estado_especial || "disponible";
        const situacionColor = ReporteController.getColorPorSituacion(situacion);
        doc
          .fillColor(situacionColor)
          .fontSize(7)
          .font("Helvetica-Bold")
          .text(situacion.toUpperCase(), columnas.situacion.x, yPosition, { 
            width: columnas.situacion.width 
          });

        // Resetear color
        doc.fillColor("#374151").fontSize(7).font("Helvetica");

        // Información del MONITOR - MÁS COMPACTO
        const textoMonitor = equipo.marcaMonitor 
          ? `${equipo.marcaMonitor} ${equipo.pulgadasMonitor || ''}"`.trim()
          : "Sin monitor";
        doc.text(textoMonitor, columnas.monitor.x, yPosition, { 
          width: columnas.monitor.width 
        });

        // Código Patrimonial del MONITOR
        doc.text(equipo.codigoPatrimonialMonitor || "N/A", columnas.codMonitor.x, yPosition, { 
          width: columnas.codMonitor.width 
        });

        // Estado del Monitor con color - MÁS ESPACIO
        const estadoMonitor = equipo.estadoMonitor || "N/A";
        const estadoMonitorColor = ReporteController.getColorPorEstado(estadoMonitor);
        doc
          .fillColor(estadoMonitorColor)
          .fontSize(7)
          .font("Helvetica-Bold")
          .text(estadoMonitor.toUpperCase(), columnas.estadoMonitor.x, yPosition, { 
            width: columnas.estadoMonitor.width 
          });

        yPosition += 22;

        // Línea separadora sutil - MISMO TAMAÑO QUE HEADER
        if (index < equipos.length - 1) {
          doc.moveTo(50, yPosition - 5).lineTo(finLinea, yPosition - 5)
             .strokeColor("#f3f4f6").lineWidth(0.3).stroke();
        }
      });
    } else {
      doc
        .fillColor("#6b7280")
        .fontSize(12)
        .font("Helvetica")
        .text("No se encontraron equipos en el sistema.", 50, yPosition);
    }

    console.log("PDF de reporte general CON AJUSTES DE ANCHOS generado exitosamente");
    doc.end();
  } catch (err: any) {
    console.error("Error al generar reporte general de equipos:", err);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Error al generar reporte general de equipos",
        details: err?.message || "Error desconocido",
      });
    }
  }
}



  // Métodos auxiliares existentes (se mantienen igual)
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
      asignacion: "#059669",
      asignado: "#059669",
      desasignacion: "#dc2626",
      revision: "#d97706",
      reparar: "#2563eb",
      baja: "#dc2626",
      disponible: "#059669",
      actualizacion: "#7c3aed",
      traslado: "#7c3aed",
    };
    return colores[accion?.toLowerCase()] || "#374151";
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
      asignado: "#059669",
      disponible: "#2563eb",
      revision: "#d97706",
      baja: "#dc2626",
    };
    return colores[situacion?.toLowerCase()] || "#374151";
  }

  private static getColorPorEstado(estado: string): string {
    const colores: { [key: string]: string } = {
      bueno: "#059669",
      regular: "#d97706",
      malo: "#dc2626",
      activo: "#059669",
      inactivo: "#6b7280",
      mantenimiento: "#d97706",
    };
    return colores[estado?.toLowerCase()] || "#374151";
  }

// REPORTE GENERAL DE USUARIOS - VERSIÓN CORREGIDA
static async generarReporteGeneralUsuarios(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("Generando reporte general de usuarios - VERSIÓN CORREGIDA");

    // 1. Obtener todos los usuarios
    const [usuarios] = await db.promise().query<RowDataPacket[]>(
      `SELECT * FROM usuarios 
       ORDER BY oficina, apellidos, nombres`
    );

    // 2. Obtener equipos asignados a todos los usuarios
    const [equiposAsignados] = await db.promise().query<RowDataPacket[]>(
      `SELECT e.*, u.id as usuario_id, u.nombres, u.apellidos, u.oficina
       FROM equipos e
       INNER JOIN usuarios u ON e.usuarioId = u.id
       WHERE e.estado_especial = 'asignado'
       ORDER BY u.id, e.tipo`
    );

    // 3. Obtener impresoras asignadas a todos los usuarios
    const [impresorasAsignadas] = await db.promise().query<RowDataPacket[]>(
      `SELECT i.*, u.id as usuario_id, u.nombres, u.apellidos, u.oficina
       FROM impresoras i
       INNER JOIN usuarios u ON i.usuarioId = u.id
       WHERE i.estado_especial = 'asignado'
       ORDER BY u.id`
    );

    console.log(`Usuarios encontrados: ${usuarios.length}`);
    console.log(`Equipos asignados: ${equiposAsignados.length}`);
    console.log(`Impresoras asignadas: ${impresorasAsignadas.length}`);

    // Crear PDF
    const doc = new PDFDocument({
      margin: 50,
      bufferPages: true,
    });

    // Configurar headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-usuarios-${new Date().toISOString().split('T')[0]}.pdf`
    );

    doc.pipe(res);

    // FUNCIÓN PARA AGREGAR HEADER
    const agregarHeader = (doc: PDFKit.PDFDocument, yStart: number = 50): number => {
      doc
        .fillColor("#1f2937")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("SISTEMA DE INVENTARIO - REPORTE GENERAL DE USUARIOS", 50, yStart);

      doc
        .fillColor("#6b7280")
        .fontSize(10)
        .font("Helvetica")
        .text(`Generado: ${new Date().toLocaleString("es-PE")}`, 50, yStart + 25);

      // LÍNEA SEPARADORA DEL HEADER (se mantiene)
      doc
        .moveTo(50, yStart + 40)
        .lineTo(550, yStart + 40)
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .stroke();

      return yStart + 60;
    };

    // Agregar header inicial
    let yPosition = agregarHeader(doc, 50);

    // Agrupar por oficina
    interface UsuarioConActivos {
      id: number;
      nombres: string;
      apellidos: string;
      dni: string;
      oficina: string;
      tipoContrato: string;
      equipos: RowDataPacket[];
      impresoras: RowDataPacket[];
      totalActivos: number;
    }

    const usuariosConActivos: UsuarioConActivos[] = usuarios.map((usuario: any) => {
      const equiposUsuario = equiposAsignados.filter((e: any) => e.usuario_id === usuario.id);
      const impresorasUsuario = impresorasAsignadas.filter((i: any) => i.usuario_id === usuario.id);
      
      return {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        dni: usuario.dni,
        oficina: usuario.oficina,
        tipoContrato: usuario.tipoContrato,
        equipos: equiposUsuario,
        impresoras: impresorasUsuario,
        totalActivos: equiposUsuario.length + impresorasUsuario.length
      };
    });

    // Agrupar usuarios por oficina
    const usuariosPorOficina: { [oficina: string]: UsuarioConActivos[] } = {};
    usuariosConActivos.forEach(usuario => {
      if (!usuariosPorOficina[usuario.oficina]) {
        usuariosPorOficina[usuario.oficina] = [];
      }
      usuariosPorOficina[usuario.oficina].push(usuario);
    });

    // Obtener las claves de las oficinas para verificar el último elemento
    const oficinasKeys = Object.keys(usuariosPorOficina);

    // GENERAR CONTENIDO
    for (const [indexOficina, oficina] of oficinasKeys.entries()) {
      const usuariosOficina = usuariosPorOficina[oficina];

      // Verificar si necesitamos nueva página para la oficina
      if (yPosition > 700) {
        doc.addPage();
        yPosition = agregarHeader(doc, 50);
      }

      // TÍTULO DE OFICINA
      doc
        .fillColor("#374151")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(`OFICINA: ${oficina}`, 50, yPosition);

      yPosition += 25;

      // USUARIOS DE LA OFICINA
      for (const [indexUsuario, usuario] of usuariosOficina.entries()) {
        // Verificar espacio para el usuario completo
        const espacioUsuario = 50 + (Math.max(usuario.equipos.length, usuario.impresoras.length) * 12);
        if (yPosition + espacioUsuario > 750) {
          doc.addPage();
          yPosition = agregarHeader(doc, 50);
        }

        // INFORMACIÓN DEL USUARIO
        doc
          .fillColor("#1f2937")
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(`${usuario.nombres} ${usuario.apellidos}`, 50, yPosition);

        doc
          .fillColor("#6b7280")
          .fontSize(9)
          .font("Helvetica")
          .text(`DNI: ${usuario.dni} | Contrato: ${usuario.tipoContrato} | Activos: ${usuario.totalActivos}`, 50, yPosition + 15);

        yPosition += 30;

        // TABLA DE EQUIPOS (sin líneas de separación internas)
        if (usuario.equipos.length > 0) {
          doc
            .fillColor("#1f2937")
            .fontSize(9)
            .font("Helvetica-Bold")
            .text("EQUIPOS ASIGNADOS:", 60, yPosition);

          yPosition += 15;

          // Header de la tabla (sin línea separadora)
          doc
            .fillColor("#1f2937")
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("COD. PAT.", 60, yPosition)
            .text("EQUIPO", 120, yPosition)
            .text("ESPECIFICACIONES", 250, yPosition)
            .text("ESTADO", 450, yPosition);

          yPosition += 12;

          // Filas de equipos (sin líneas separadoras)
          usuario.equipos.forEach((equipo: any) => {
            if (yPosition > 730) {
              doc.addPage();
              yPosition = agregarHeader(doc, 50);
            }

            // Código patrimonial
            doc
              .fillColor("#374151")
              .fontSize(7)
              .font("Helvetica")
              .text(equipo.codigoPatrimonial || "Sin código", 60, yPosition, { width: 55 });

            // Equipo
            const textoEquipo = `${equipo.tipo} ${equipo.marca} ${equipo.modelo}`.trim();
            doc
              .fillColor("#374151")
              .fontSize(7)
              .font("Helvetica")
              .text(textoEquipo, 120, yPosition, { width: 125 });

            // Especificaciones
            const especificaciones = `${equipo.procesador || ''} | ${equipo.ram || ''} | ${equipo.almacenamiento || ''}`.replace(/\s*\|\s*\|\s*/g, '|').replace(/^\||\|$/g, '');
            doc
              .fillColor("#6b7280")
              .fontSize(6)
              .font("Helvetica")
              .text(especificaciones || "N/A", 250, yPosition, { width: 195 });

            // Estado con color
            const estadoColor = ReporteController.getColorPorEstado(equipo.estado);
            doc
              .fillColor(estadoColor)
              .fontSize(7)
              .font("Helvetica-Bold")
              .text(equipo.estado?.toUpperCase() || "ACTIVO", 450, yPosition, { width: 60 });

            yPosition += 10;
          });

          yPosition += 8;
        }

        // TABLA DE IMPRESORAS (sin líneas de separación internas)
        if (usuario.impresoras.length > 0) {
          doc
            .fillColor("#1f2937")
            .fontSize(9)
            .font("Helvetica-Bold")
            .text("IMPRESORAS ASIGNADAS:", 60, yPosition);

          yPosition += 15;

          // Header de la tabla (sin línea separadora)
          doc
            .fillColor("#1f2937")
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("COD. PAT.", 60, yPosition)
            .text("MODELO", 120, yPosition)
            .text("CONECTIVIDAD", 250, yPosition)
            .text("ESTADO", 450, yPosition);

          yPosition += 12;

          // Filas de impresoras (sin líneas separadoras)
          usuario.impresoras.forEach((impresora: any) => {
            if (yPosition > 730) {
              doc.addPage();
              yPosition = agregarHeader(doc, 50);
            }

            // Código patrimonial
            doc
              .fillColor("#374151")
              .fontSize(7)
              .font("Helvetica")
              .text(impresora.codigoPatrimonial || "Sin código", 60, yPosition, { width: 55 });

            // Modelo
            doc
              .fillColor("#374151")
              .fontSize(7)
              .font("Helvetica")
              .text(impresora.modelo, 120, yPosition, { width: 125 });

            // Conectividad
            const conectividad = `${impresora.ip || 'Sin IP'} | ${impresora.mac || 'Sin MAC'}`;
            doc
              .fillColor("#6b7280")
              .fontSize(6)
              .font("Helvetica")
              .text(conectividad, 250, yPosition, { width: 195 });

            // Estado con color
            const estadoColor = ReporteController.getColorPorEstado(impresora.estado);
            doc
              .fillColor(estadoColor)
              .fontSize(7)
              .font("Helvetica-Bold")
              .text(impresora.estado?.toUpperCase() || "ACTIVA", 450, yPosition, { width: 60 });

            yPosition += 10;
          });

          yPosition += 8;
        }

        // USUARIO SIN ACTIVOS
        if (usuario.totalActivos === 0) {
          doc
            .fillColor("#dc2626")
            .fontSize(9)
            .font("Helvetica-Bold")
            .text("• SIN EQUIPOS NI IMPRESORAS ASIGNADAS", 60, yPosition);
          
          yPosition += 20;
        }

        // LÍNEA SEPARADORA ENTRE USUARIOS - CORREGIDA
        // Dibujar línea después de CADA usuario excepto el último usuario de la última oficina
        const esUltimoUsuario = indexUsuario === usuariosOficina.length - 1;
        const esUltimaOficina = indexOficina === oficinasKeys.length - 1;
        
        if (!(esUltimoUsuario && esUltimaOficina)) {
          doc
            .moveTo(50, yPosition)
            .lineTo(550, yPosition)
            .strokeColor("#f3f4f6")
            .lineWidth(1)
            .stroke();

          yPosition += 15;
        }
      }

      // Espacio entre oficinas
      yPosition += 10;
    }

    console.log("PDF de reporte general de usuarios generado exitosamente");
    doc.end();

  } catch (err: any) {
    console.error("Error al generar reporte general de usuarios:", err);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Error al generar reporte general de usuarios",
        details: err?.message || "Error desconocido",
      });
    }
  }
}

// REPORTE GENERAL DE IMPRESORAS - VERSIÓN CORREGIDA
static async generarReporteGeneralImpresoras(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("Generando reporte general de impresoras");

    // Obtener todas las impresoras con información de usuario
    const [impresoras] = await db.promise().query<RowDataPacket[]>(
      `SELECT i.*, 
                u.nombres as usuario_nombres, 
                u.apellidos as usuario_apellidos,
                u.dni as usuario_dni,
                u.oficina as usuario_oficina
         FROM impresoras i
         LEFT JOIN usuarios u ON i.usuarioId = u.id
         ORDER BY i.estado_especial, i.oficina, i.modelo`
    );

    console.log(`Impresoras encontradas: ${impresoras.length}`);

    // Crear PDF en formato landscape
    const doc = new PDFDocument({
      margin: 50,
      bufferPages: true,
      size: 'A4',
      layout: 'landscape'
    });

    // Configurar headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-general-impresoras-${new Date().toISOString().split('T')[0]}.pdf`
    );

    doc.pipe(res);

    // Header
    doc
      .fillColor("#1f2937")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("SISTEMA DE INVENTARIO - REPORTE GENERAL DE IMPRESORAS", 50, 50);

    doc
      .fillColor("#6b7280")
      .fontSize(10)
      .font("Helvetica")
      .text(`Generado: ${new Date().toLocaleString("es-PE")}`, 50, 75)
      .text(`Total de impresoras: ${impresoras.length}`, 50, 90);

    // Línea separadora
    doc
      .moveTo(50, 110)
      .lineTo(780, 110)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();

    let yPosition = 130;

    // Tabla de impresoras
    if (impresoras.length > 0) {
      // Header de la tabla con anchos optimizados - SIN UBICACIÓN
      doc.fillColor("#1f2937").fontSize(8).font("Helvetica-Bold")
         .text("COD. PAT.", 50, yPosition, { width: 70 }) // ✅ MÁS ANCHO (70px)
         .text("MODELO", 125, yPosition, { width: 100 }) // ✅ AJUSTADO
         .text("IP", 230, yPosition, { width: 80 }) // ✅ MÁS ANCHO
         .text("MAC", 315, yPosition, { width: 100 }) // ✅ MÁS ANCHO
         .text("USUARIO/ESTADO", 420, yPosition, { width: 150 }) // ✅ MÁS ANCHO
         .text("OFICINA", 575, yPosition, { width: 80 }) // ✅ MÁS ANCHO
         .text("SITUACIÓN", 660, yPosition, { width: 60 }); // ✅ AJUSTADO

      yPosition += 10;
      doc.moveTo(50, yPosition).lineTo(725, yPosition).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      yPosition += 20;

      // Filas de impresoras
      impresoras.forEach((impresora, index) => {
        // Verificar si necesita nueva página
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
          
          // Header de la tabla en nueva página
          doc.fillColor("#1f2937").fontSize(8).font("Helvetica-Bold")
             .text("COD. PAT.", 50, yPosition, { width: 70 })
             .text("MODELO", 125, yPosition, { width: 100 })
             .text("IP", 230, yPosition, { width: 80 })
             .text("MAC", 315, yPosition, { width: 100 })
             .text("USUARIO/ESTADO", 420, yPosition, { width: 150 })
             .text("OFICINA", 575, yPosition, { width: 80 })
             .text("SITUACIÓN", 660, yPosition, { width: 60 });

          yPosition += 10;
          doc.moveTo(50, yPosition).lineTo(725, yPosition).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
          yPosition += 20;
        }

        // Código Patrimonial - CON MÁS ESPACIO
        doc
          .fillColor("#374151")
          .fontSize(7)
          .font("Helvetica")
          .text(impresora.codigoPatrimonial || "Sin código", 50, yPosition, { width: 70 });

        // Modelo
        doc.text(impresora.modelo || "N/A", 125, yPosition, { width: 100 });

        // IP - CON MÁS ANCHO
        doc.text(impresora.ip || "N/A", 230, yPosition, { width: 80 });

        // MAC - CON MÁS ANCHO
        doc.text(impresora.mac || "N/A", 315, yPosition, { width: 100 });

        // Usuario/Estado - CON MÁS ANCHO
        let usuarioEstado = "";
        if (impresora.usuario_nombres && impresora.usuario_apellidos) {
          usuarioEstado = `${impresora.usuario_nombres} ${impresora.usuario_apellidos}`;
        } else {
          usuarioEstado = impresora.estado_especial ? impresora.estado_especial.toUpperCase() : "DISPONIBLE";
        }
        doc.text(usuarioEstado, 420, yPosition, { width: 150 });

        // Oficina - CON MÁS ANCHO
        doc.text(impresora.oficina || "N/A", 575, yPosition, { width: 80 });

        // Situación con color
        const situacion = impresora.estado_especial || "disponible";
        const situacionColor = ReporteController.getColorPorSituacion(situacion);
        doc
          .fillColor(situacionColor)
          .fontSize(7)
          .font("Helvetica-Bold")
          .text(situacion.toUpperCase(), 660, yPosition, { width: 60 });

        yPosition += 20;

        // Línea separadora entre filas (sutil)
        if (index < impresoras.length - 1) {
          doc.moveTo(50, yPosition - 5).lineTo(725, yPosition - 5)
             .strokeColor("#f3f4f6").lineWidth(0.3).stroke();
        }
      });
    } else {
      doc
        .fillColor("#6b7280")
        .fontSize(12)
        .font("Helvetica")
        .text("No se encontraron impresoras en el sistema.", 50, yPosition);
    }

    console.log("PDF de reporte general de impresoras generado exitosamente");
    doc.end();
  } catch (err: any) {
    console.error("Error al generar reporte general de impresoras:", err);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Error al generar reporte general de impresoras",
        details: err?.message || "Error desconocido",
      });
    }
  }
}


static async generarReporteEquipo(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    console.log(`Generando reporte para equipo ID: ${id}`);

    // Consulta SQL CORREGIDA - sin JOIN con monitores
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
    console.log(`Equipo encontrado: ${equipoData.marca} ${equipoData.modelo}`);

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

      // 2. INFORMACIÓN DEL MONITOR - VERSIÓN CORREGIDA (usando campos de equipos)
      if (equipoData.marcaMonitor) {
        if (yPosition > 600) {
          doc.addPage();
          yPosition = 50;
        }

        doc
          .fillColor("#1f2937")
          .fontSize(16)
          .font("Helvetica-Bold")
          .text("INFORMACIÓN DEL MONITOR ASOCIADO", 50, yPosition);
        yPosition += 25;

        const infoMonitor = [
          ["Marca:", equipoData.marcaMonitor],
          ["Pulgadas:", equipoData.pulgadasMonitor ? `${equipoData.pulgadasMonitor}"` : "N/A"],
          ["Código Patrimonial:", equipoData.codigoPatrimonialMonitor || "N/A"],
          ["Estado:", equipoData.estadoMonitor || "N/A"],
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
        doc.text("ESTADO TÉCNICO", 100, yPosition);
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

        // Filas del historial - VERSIÓN MEJORADA
        historialEquipo.forEach((registro, index) => {
          // Verificar ANTES de escribir si necesita nueva página
          if (yPosition > 700) {
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
            const fecha = new Date(registro.createdAt).toLocaleDateString("es-PE");

            // Fecha
            doc
              .fillColor("#374151")
              .fontSize(7)
              .font("Helvetica")
              .text(fecha, 50, yPosition, { width: 45 });

            // Estado Técnico y Situación
            let estadoTecnico = equipoData.estado || "N/A";
            let situacion = equipoData.estado_especial || "N/A";
            let usuarioEstado = "Sin cambios";
            let accionTexto = registro.accion;

            if (registro.detalles) {
              try {
                const detalles = JSON.parse(registro.detalles);

                estadoTecnico = detalles.next?.estado || detalles.prev?.estado || estadoTecnico;
                situacion = detalles.next?.estado_especial || detalles.prev?.estado_especial || situacion;

                if (detalles.next?.estado_especial === "revision") {
                  usuarioEstado = "REVISIÓN";
                } else if (detalles.next?.estado_especial === "baja") {
                  usuarioEstado = "BAJA";
                } else if (detalles.next?.estado_especial === "disponible") {
                  usuarioEstado = "DISPONIBLE";
                } else if (detalles.next?.usuarioId && detalles.prev?.usuarioId !== detalles.next?.usuarioId) {
                  const usuarioId = detalles.next.usuarioId;
                  const usuarioInfo = usuariosInfo.find((u) => u.usuarioId === usuarioId);
                  usuarioEstado = usuarioInfo ? `${usuarioInfo.nombres} ${usuarioInfo.apellidos}` : `Usuario ${usuarioId}`;
                } else if (!detalles.next?.usuarioId && detalles.prev?.usuarioId) {
                  usuarioEstado = "SIN USUARIO";
                } else if (detalles.next?.estado_especial) {
                  usuarioEstado = detalles.next.estado_especial.toUpperCase();
                } else if (detalles.prev?.estado_especial) {
                  usuarioEstado = detalles.prev.estado_especial.toUpperCase();
                } else {
                  usuarioEstado = situacion.toUpperCase();
                }
              } catch (parseError) {
                accionTexto = "Información de cambio";
              }
            }

            // Estado Técnico con color
            const estadoColor = ReporteController.getColorPorEstado(estadoTecnico);
            doc
              .fillColor(estadoColor)
              .fontSize(7)
              .font("Helvetica-Bold")
              .text(estadoTecnico.toUpperCase(), 100, yPosition, { width: 90 });

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
            const situacionColor = ReporteController.getColorPorSituacion(situacion);
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
            console.error("Error crítico procesando registro de historial:", error);
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
          ["IP:", impresoraData.ip ||"N/A"],
          ["MAC:", impresoraData.mac || "N/A"],
          ["Oficina:", impresoraData.oficina || "N/A"],
          ["Estado Técnico:", impresoraData.estado || "N/A"],
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