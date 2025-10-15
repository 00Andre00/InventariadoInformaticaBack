import { Request, Response } from 'express';
import db from '../config/db';
import PDFDocument from 'pdfkit';
import { RowDataPacket } from 'mysql2';

export class ReporteController {
    // Generar reporte de cambios
    static async generarReporteCambio(req: Request, res: Response): Promise<void> {
        const { tipo, id } = req.params;

        try {
            let datos: any = {};

            if (tipo === 'equipo') {
                const [equipo] = await db.promise().query<RowDataPacket[]>(
                    `SELECT e.*, 
                            CONCAT(u.nombres, ' ', u.apellidos) as usuario_actual,
                            u.dni, u.oficina,
                            e.historial_duenos
                     FROM equipos e
                     LEFT JOIN usuarios u ON e.usuarioId = u.id
                     WHERE e.id = ?`,
                    [id]
                );
                datos = equipo[0];
            } else if (tipo === 'impresora') {
                const [impresora] = await db.promise().query<RowDataPacket[]>(
                    `SELECT i.*, 
                            CONCAT(u.nombres, ' ', u.apellidos) as usuario_actual,
                            u.dni, u.oficina,
                            i.historial_duenos
                     FROM impresoras i
                     LEFT JOIN usuarios u ON i.usuarioId = u.id
                     WHERE i.id = ?`,
                    [id]
                );
                datos = impresora[0];
            }

            if (!datos) {
                res.status(404).json({ error: `${tipo} no encontrado` });
                return;
            }

            // Crear PDF
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=reporte-${tipo}-${id}.pdf`);
            
            doc.pipe(res);

            // Contenido del PDF
            doc.fontSize(20).text('REPORTE DE CAMBIO', 100, 100);
            doc.fontSize(12).text(`Tipo: ${tipo.toUpperCase()}`, 100, 150);
            doc.text(`ID: ${id}`, 100, 170);
            doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, 100, 190);
            doc.text(`Hora: ${new Date().toLocaleTimeString('es-PE')}`, 100, 210);
            
            let yPosition = 250;

            if (tipo === 'equipo' && datos) {
                doc.text(`Equipo: ${datos.marca} ${datos.modelo}`, 100, yPosition);
                yPosition += 20;
                doc.text(`Código Patrimonial: ${datos.codigoPatrimonial || 'N/A'}`, 100, yPosition);
                yPosition += 20;
                doc.text(`Usuario Actual: ${datos.usuario_actual || 'No asignado'}`, 100, yPosition);
                yPosition += 20;
                doc.text(`Estado: ${datos.estado}`, 100, yPosition);
                yPosition += 20;
                doc.text(`IP: ${datos.ip}`, 100, yPosition);
                yPosition += 20;
                doc.text(`MAC: ${datos.mac}`, 100, yPosition);
                yPosition += 20;
                doc.text(`Procesador: ${datos.procesador}`, 100, yPosition);
                yPosition += 20;
                doc.text(`RAM: ${datos.ram}`, 100, yPosition);
                yPosition += 20;
                doc.text(`Almacenamiento: ${datos.almacenamiento}`, 100, yPosition);
                yPosition += 20;
                
                // Historial
                if (datos.historial_duenos) {
                    yPosition += 20;
                    doc.text('HISTORIAL:', 100, yPosition);
                    yPosition += 20;
                    
                    const historial = datos.historial_duenos.split('|').filter((item: string) => item.trim());
                    historial.forEach((item: string, index: number) => {
                        if (yPosition > 700) {
                            doc.addPage();
                            yPosition = 100;
                        }
                        doc.text(`${index + 1}. ${item.trim()}`, 120, yPosition);
                        yPosition += 15;
                    });
                }
            } else if (tipo === 'impresora' && datos) {
                doc.text(`Impresora: ${datos.modelo}`, 100, yPosition);
                yPosition += 20;
                doc.text(`Código Patrimonial: ${datos.codigoPatrimonial || 'N/A'}`, 100, yPosition);
                yPosition += 20;
                doc.text(`Usuario Actual: ${datos.usuario_actual || 'No asignado'}`, 100, yPosition);
                yPosition += 20;
                doc.text(`Estado: ${datos.estado}`, 100, yPosition);
                yPosition += 20;
                doc.text(`IP: ${datos.ip}`, 100, yPosition);
                yPosition += 20;
                doc.text(`MAC: ${datos.mac}`, 100, yPosition);
                yPosition += 20;
                
                // Historial
                if (datos.historial_duenos) {
                    yPosition += 20;
                    doc.text('HISTORIAL:', 100, yPosition);
                    yPosition += 20;
                    
                    const historial = datos.historial_duenos.split('|').filter((item: string) => item.trim());
                    historial.forEach((item: string, index: number) => {
                        if (yPosition > 700) {
                            doc.addPage();
                            yPosition = 100;
                        }
                        doc.text(`${index + 1}. ${item.trim()}`, 120, yPosition);
                        yPosition += 15;
                    });
                }
            }

            doc.end();
        } catch (err) {
            console.error('Error al generar reporte:', err);
            res.status(500).json({ error: 'Error al generar reporte' });
        }
    }

    // Generar reporte de usuario
    static async generarReporteUsuario(req: Request, res: Response): Promise<void> {
        const { id } = req.params;

        try {
            const [usuario] = await db.promise().query<RowDataPacket[]>(
                'SELECT * FROM usuarios WHERE id = ?',
                [id]
            );

            if (usuario.length === 0) {
                res.status(404).json({ error: 'Usuario no encontrado' });
                return;
            }

            const [equipos] = await db.promise().query<RowDataPacket[]>(
                `SELECT tipo, marca, modelo, codigoPatrimonial, estado, estado_especial, historial_duenos 
                 FROM equipos WHERE usuarioId = ?`,
                [id]
            );

            const [impresoras] = await db.promise().query<RowDataPacket[]>(
                `SELECT modelo, codigoPatrimonial, estado, estado_especial, historial_duenos 
                 FROM impresoras WHERE usuarioId = ?`,
                [id]
            );

            // Crear PDF
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=reporte-usuario-${id}.pdf`);
            
            doc.pipe(res);

            // Contenido del PDF
            const usuarioData = usuario[0];
            let yPosition = 100;
            
            doc.fontSize(20).text('REPORTE DE USUARIO', 100, yPosition);
            yPosition += 60;
            
            doc.fontSize(12).text(`Nombre: ${usuarioData.nombres} ${usuarioData.apellidos}`, 100, yPosition);
            yPosition += 20;
            doc.text(`DNI: ${usuarioData.dni}`, 100, yPosition);
            yPosition += 20;
            doc.text(`Oficina: ${usuarioData.oficina}`, 100, yPosition);
            yPosition += 20;
            doc.text(`Tipo Contrato: ${usuarioData.tipoContrato}`, 100, yPosition);
            yPosition += 20;
            doc.text(`Fecha de Registro: ${new Date(usuarioData.createdAt).toLocaleDateString('es-PE')}`, 100, yPosition);
            yPosition += 40;

            // Equipos asignados
            doc.text('EQUIPOS ASIGNADOS:', 100, yPosition);
            yPosition += 30;

            if (equipos.length === 0) {
                doc.text('No tiene equipos asignados', 120, yPosition);
                yPosition += 20;
            } else {
                equipos.forEach((equipo, index) => {
                    if (yPosition > 700) {
                        doc.addPage();
                        yPosition = 100;
                    }
                    
                    doc.text(`${index + 1}. ${equipo.tipo} ${equipo.marca} ${equipo.modelo}`, 120, yPosition);
                    yPosition += 15;
                    doc.text(`   Código: ${equipo.codigoPatrimonial} - Estado: ${equipo.estado} - Situación: ${equipo.estado_especial}`, 120, yPosition);
                    yPosition += 20;
                    
                    // Mostrar historial si existe
                    if (equipo.historial_duenos) {
                        const historial = equipo.historial_duenos.split('|').filter((item: string) => item.trim());
                        if (historial.length > 0) {
                            doc.text(`   Historial:`, 120, yPosition);
                            yPosition += 15;
                            historial.forEach((item: string, histIndex: number) => {
                                if (yPosition > 700) {
                                    doc.addPage();
                                    yPosition = 100;
                                }
                                doc.text(`     ${histIndex + 1}. ${item.trim()}`, 140, yPosition);
                                yPosition += 15;
                            });
                        }
                    }
                    yPosition += 10;
                });
            }

            // Impresoras asignadas
            yPosition += 20;
            doc.text('IMPRESORAS ASIGNADAS:', 100, yPosition);
            yPosition += 30;

            if (impresoras.length === 0) {
                doc.text('No tiene impresoras asignadas', 120, yPosition);
            } else {
                impresoras.forEach((impresora, index) => {
                    if (yPosition > 700) {
                        doc.addPage();
                        yPosition = 100;
                    }
                    
                    doc.text(`${index + 1}. ${impresora.modelo}`, 120, yPosition);
                    yPosition += 15;
                    doc.text(`   Código: ${impresora.codigoPatrimonial} - Estado: ${impresora.estado} - Situación: ${impresora.estado_especial}`, 120, yPosition);
                    yPosition += 20;
                    
                    // Mostrar historial si existe
                    if (impresora.historial_duenos) {
                        const historial = impresora.historial_duenos.split('|').filter((item: string) => item.trim());
                        if (historial.length > 0) {
                            doc.text(`   Historial:`, 120, yPosition);
                            yPosition += 15;
                            historial.forEach((item: string, histIndex: number) => {
                                if (yPosition > 700) {
                                    doc.addPage();
                                    yPosition = 100;
                                }
                                doc.text(`     ${histIndex + 1}. ${item.trim()}`, 140, yPosition);
                                yPosition += 15;
                            });
                        }
                    }
                    yPosition += 10;
                });
            }

            doc.end();
        } catch (err) {
            console.error('Error al generar reporte de usuario:', err);
            res.status(500).json({ error: 'Error al generar reporte de usuario' });
        }
    }
}