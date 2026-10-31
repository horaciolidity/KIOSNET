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

export interface MPUserInfo {
  id: number;
  nickname: string;
  email: string;
}

export const MP_DIRECT_LINKS = {
  credentials: 'https://www.mercadopago.com/developers/panel/app',
  storesAndPos: 'https://www.mercadopago.com/business/stores-and-pos',
};

// Helper to make API requests with CORS fallback if needed
async function mpRequest(method: 'GET' | 'POST' | 'PUT', url: string, token: string, data?: any) {
  try {
    const res = await axios({
      method,
      url,
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json'
      },
      data
    });
    return res.data;
  } catch (err: any) {
    // If blocked by CORS or network, attempt with allorigins proxy
    if (err.message?.includes('Network Error') || !err.response) {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const res = await axios({
          method,
          url: proxyUrl,
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            'Content-Type': 'application/json'
          },
          data
        });
        return res.data;
      } catch (proxyErr) {
        throw err;
      }
    }
    throw err;
  }
}

export class MercadoPagoService {
  /**
   * Valida el Access Token y obtiene los datos del comerciante (User ID y Nickname).
   */
  static async validateTokenAndGetInfo(token: string): Promise<{ success: boolean; data?: MPUserInfo; message: string }> {
    if (!token || !token.trim()) {
      return { success: false, message: 'El Access Token no puede estar vacío.' };
    }

    try {
      const data = await mpRequest('GET', 'https://api.mercadopago.com/users/me', token);
      return {
        success: true,
        data: {
          id: data.id,
          nickname: data.nickname || data.email || 'Comercio',
          email: data.email || ''
        },
        message: `¡Conexión exitosa! Identificado como: ${data.nickname || data.email || data.id}`
      };
    } catch (err: any) {
      console.error('Error validando token Mercado Pago:', err);
      const msg = err.response?.data?.message || err.message || 'Error al conectar con Mercado Pago. Verifique que el Access Token sea correcto.';
      return { success: false, message: msg };
    }
  }

  /**
   * Obtiene la lista de Cajas / Locales configuradas en Mercado Pago para la cuenta.
   */
  static async getPosList(token: string): Promise<{ success: boolean; posList: MPPos[]; message?: string }> {
    if (!token || !token.trim()) {
      return { success: false, posList: [], message: 'Token requerido' };
    }

    try {
      const data = await mpRequest('GET', 'https://api.mercadopago.com/pos', token);
      const results = (data.results || []) as MPPos[];
      return {
        success: true,
        posList: results
      };
    } catch (err: any) {
      console.error('Error obteniendo cajas de Mercado Pago:', err);
      return {
        success: false,
        posList: [],
        message: err.response?.data?.message || err.message || 'No se pudieron obtener las cajas registradas.'
      };
    }
  }

  /**
   * Envía la orden directamente a la Caja física integrada (QR impreso en mostrador).
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
      const res = await mpRequest('POST', endpoint, token, body);
      return {
        success: true,
        qrData: res.qr_data,
        message: 'Orden enviada a la caja con éxito.'
      };
    } catch (err: any) {
      console.warn('Error enviando orden in-store a MP (probando fallback):', err);
      // Retornar fallback para que el POS también genere la preferencia digital
      return {
        success: false,
        message: err.response?.data?.message || 'No se pudo vincular con la caja física.'
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

      const res = await mpRequest('POST', endpoint, token, body);
      const initPoint = res.init_point || res.sandbox_init_point;

      return {
        success: true,
        initPoint,
        qrData: initPoint
      };
    } catch (err: any) {
      console.error('Error creando preferencia MP:', err);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Error al generar preferencia de Mercado Pago.'
      };
    }
  }

  /**
   * Consulta si el pago de una orden/venta fue aprobado por el cliente.
   */
  static async checkPaymentApproved(token: string, saleId: string): Promise<boolean> {
    try {
      const targetUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${saleId}`;
      const data = await mpRequest('GET', targetUrl, token);
      const approvedPayment = data.results?.find((p: any) => p.status === 'approved');
      return !!approvedPayment;
    } catch (err) {
      return false;
    }
  }
}
