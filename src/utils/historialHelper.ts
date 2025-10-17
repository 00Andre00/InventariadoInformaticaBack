import db from '../config/db';
import { Request } from 'express';

export class HistorialHelper {
  static async registrarCambio(
    tipoActivo: 'equipo' | 'impresora',
    activoId: number,
    accion: string,
    detalles: any,
    usuarioSistemaId: number
  ): Promise<void> {
    try {
      await db.promise().query(
        `INSERT INTO historial_cambios 
         (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
         VALUES (?, ?, ?, ?, ?)`,
        [tipoActivo, activoId, accion, JSON.stringify(detalles), usuarioSistemaId]
      );
      console.log(`Historial registrado: ${tipoActivo} ${activoId} - ${accion}`);
    } catch (error) {
      console.error('Error al registrar historial:', error);
      throw error;
    }
  }

  // Método para obtener el usuario del sistema del request
  static obtenerUsuarioSistemaId(req: Request): number {
    const user = (req as any).user;
    return user?.id || 1; // Fallback al admin si no está disponible
  }
}