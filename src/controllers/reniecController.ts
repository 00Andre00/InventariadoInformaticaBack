import { Request, Response } from 'express';

interface RENIECResponseData {
  numero: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_completo: string;
  codigo_verificacion: string | number;
}

interface RENIECResponse {
  success: boolean;
  data?: RENIECResponseData;
  error?: string;
}

const consultarApiPeru = async (dni: string): Promise<RENIECResponseData | null> => {
  try {
    const RENIEC_TOKEN = process.env.RENIEC_TOKEN;
    
    if (!RENIEC_TOKEN) {
      return null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos máximo

    const response = await fetch('https://apiperu.dev/api/dni', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RENIEC_TOKEN}`
      },
      body: JSON.stringify({ dni }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }

    const responseData: RENIECResponse = await response.json();
    
    if (responseData.success && responseData.data) {
      return responseData.data;
    }
    
    return null;
    
  } catch (error) {
    // Silenciosamente retornar null - el frontend manejará esto
    return null;
  }
};

export class ReniecController {
  static async consultarDNI(req: Request, res: Response): Promise<void> {
    try {
      const { dni } = req.body;
      
      // Validación básica
      if (!dni || !/^\d{8}$/.test(dni)) {
        res.status(400).json({ 
          success: false, 
          error: 'DNI inválido. Debe tener exactamente 8 dígitos.',
          manual: true // Indica que puede continuar manualmente
        });
        return;
      }
      
      // Intentar consultar API
      const apiData = await consultarApiPeru(dni);
      
      if (apiData) {
        // ✅ Éxito - datos encontrados
        res.json({
          success: true,
          data: apiData
        });
      } else {
        // ⚠️ No se encontraron datos o API caída - permitir modo manual
        res.status(200).json({ // 200 OK para que no sea tratado como error crítico
          success: false,
          message: 'No se pudo consultar RENIEC en este momento. Puede continuar ingresando los datos manualmente.',
          manual: true // Flag que indica que puede continuar
        });
      }

    } catch (error: any) {
      // ⚠️ Error inesperado - siempre permitir modo manual
      res.status(200).json({ 
        success: false,
        message: 'Servicio de RENIEC no disponible temporalmente. Complete los datos manualmente.',
        manual: true
      });
    }
  }
}