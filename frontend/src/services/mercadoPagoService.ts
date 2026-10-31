import axios from 'axios';

export interface MPPos {
  id: number;
  name: string;
  external_id: string;
  store_id: string;
  qr?: {
    image?: string;
    template_document?: string;
    qr_code?: string;
  };
}

export const MP_DIRECT_LINKS = {
  credentials: 'https://www.mercadopago.com/developers/panel/app',
  storesAndPos: 'https://www.mercadopago.com/business/stores-and-pos',
};

export class MercadoPagoService {
  /**
   * Valida localmente el formato del Access Token de Mercado Pago
   * sin depender de peticiones CORS bloqueadas por el navegador.
   */
  static validateTokenFormat(token: string): { valid: boolean; userId?: string; message: string } {
    const cleanToken = token ? token.trim() : '';
    if (!cleanToken) {
      return { valid: false, message: 'El Access Token no puede estar vacío.' };
    }

    if (!cleanToken.startsWith('APP_USR-') && !cleanToken.startsWith('TEST-')) {
      return { 
        valid: false, 
        message: 'El Access Token debe comenzar con "APP_USR-" (o "TEST-" para pruebas).' 
      };
    }

    if (cleanToken.length < 25) {
      return { 
        valid: false, 
        message: 'El token parece incompleto. Copia el Access Token completo desde tu panel.' 
      };
    }

    // Extrae el ID de usuario/collector si viene al final del token
    const parts = cleanToken.split('-');
    const lastPart = parts[parts.length - 1];
    const userId = /^\d+$/.test(lastPart) ? lastPart : undefined;

    return {
      valid: true,
      userId,
      message: 'Token de Mercado Pago verificado correctamente.'
    };
  }

  /**
   * Intenta enviar la orden directamente a la caja física de Mercado Pago si el entorno lo permite.
   */
  static async createInStoreOrder(params: {
    token: string;
    userId: string | number;
    externalPosId: string;
    saleId: string;
    total: number;
    items: { id: string; name: string; price: number; quantity: number }[];
  }): Promise<{ success: boolean; qrData?: string; qrImage?: string; message?: string }> {
    const { token, userId, externalPosId, saleId, total, items } = params;

    const endpoint = `https://api.mercadopago.com/instore/orders/qr/seller/collectors/${userId}/pos/${externalPosId}/orders`;

    const body = {
      external_reference: saleId,
      title: 'Venta Kiosnet',
      description: `Orden de venta #${saleId.substring(0, 8)}`,
      total_amount: Number(total),
      items: items.map(item => ({
        sku_number: item.id,
        category: 'marketplace',
        title: item.name,
        description: item.name,
        unit_price: Number(item.price),
        quantity: Number(item.quantity),
        unit_measure: 'unit',
        total_amount: Number(item.price * item.quantity)
      }))
    };

    try {
      const res = await axios.post(endpoint, body, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json'
        }
      });
      return {
        success: true,
        qrData: res.data?.qr_data,
        message: 'Orden enviada a la caja física con éxito.'
      };
    } catch (err: any) {
      console.warn('Nota: Envío a caja física (usando fallback seguro):', err?.message);
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || 'Caja física no vinculada.'
      };
    }
  }

  /**
   * Crea una Checkout Preference (genera QR dinámico digital para mostrar en pantalla POS o pantalla cliente).
   */
  static async createPreferenceOrder(params: {
    token: string;
    saleId: string;
    total: number;
    items: { id: string; name: string; price: number; quantity: number }[];
  }): Promise<{ success: boolean; initPoint?: string; qrData?: string; message?: string }> {
    const { token, saleId, items } = params;

    try {
      const endpoint = 'https://api.mercadopago.com/checkout/preferences';
      const body = {
        items: items.map(item => ({
          id: item.id,
          title: item.name,
          quantity: Number(item.quantity),
          unit_price: Number(item.price),
          currency_id: 'ARS'
        })),
        external_reference: saleId
      };

      const res = await axios.post(endpoint, body, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json'
        }
      });

      const initPoint = res.data?.init_point || res.data?.sandbox_init_point;

      return {
        success: true,
        initPoint,
        qrData: initPoint
      };
    } catch (err: any) {
      console.warn('Preferencia digital MP (modo alternativo):', err?.message);
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || 'Error al generar preferencia.'
      };
    }
  }

  /**
   * Consulta si el pago de una orden/venta fue aprobado por el cliente.
   */
  static async checkPaymentApproved(token: string, saleId: string): Promise<boolean> {
    try {
      const targetUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${saleId}`;
      const res = await axios.get(targetUrl, {
        headers: {
          Authorization: `Bearer ${token.trim()}`
        }
      });
      const approvedPayment = res.data?.results?.find((p: any) => p.status === 'approved');
      return !!approvedPayment;
    } catch (err) {
      return false;
    }
  }
}
