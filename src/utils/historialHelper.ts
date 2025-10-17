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
      console.log('=== DEBUG HISTORIAL HELPER ===');
      console.log('Insertando en historial:', {
        tipoActivo,
        activoId,
        accion,
        detalles,
        usuarioSistemaId
      });
      
      const query = `
        INSERT INTO historial_cambios 
        (tipo_activo, activo_id, accion, detalles, usuario_sistema_id) 
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const [result] = await db.promise().query(
        query,
        [tipoActivo, activoId, accion, JSON.stringify(detalles), usuarioSistemaId]
      );
      
      console.log(`✅ Historial registrado exitosamente. ID: ${(result as any).insertId}`);
      console.log(`✅ ${tipoActivo} ${activoId} - ${accion}`);
    } catch (error: any) {
      console.error('❌ Error al registrar historial:', error.message);
      throw error;
    }
  }

  // Método para obtener el usuario del sistema del request
  static obtenerUsuarioSistemaId(req: Request): number {
    const user = (req as any).user;
    console.log('=== DEBUG USUARIO SISTEMA ===');
    console.log('User object:', user);
    
    // Si no hay usuario autenticado, usar un valor por defecto para testing
    const userId = user?.id || 1;
    console.log('Usuario sistema ID a usar:', userId);
    return userId;
  }
}