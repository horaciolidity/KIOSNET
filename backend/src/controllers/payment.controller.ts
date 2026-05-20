import { Request, Response } from 'express';
import { request } from 'https';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../utils/prisma';

// Initialize Mercado Pago Client
const getMpClient = () => {
  const token = process.env.MP_ACCESS_TOKEN || 'APP_USR-4849164774633719-051714-00b8cfd0d13fdaf15a8646fe8447a2cc-345296566';
  return new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 5000 }
  });
};

export const createMpPreference = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { 
      total, 
      customerId, 
      sellerId, 
      items 
    } = req.body;

    // 1. Create a PENDING Sale in the database first
    const pendingSale = await prisma.sale.create({
      data: {
        total: Number(total),
        subtotal: Number(total),
        discount: 0,
        paymentMethod: 'TRANSFER', // MP counts as transfer/card
        status: 'PENDING',
        customerId: customerId || null,
        sellerId,
        tenantId,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
            price: Number(item.price),
            costPrice: Number(item.costPrice)
          }))
        }
      }
    });

    // 2. Build Mercado Pago Preference
    const client = getMpClient();
    const preference = new Preference(client);

    const backendUrl = process.env.BACKEND_URL || 'https://kiosnet-webhook.loca.lt';
    const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const mpItems = items.map((item: any) => ({
      id: item.productId,
      title: item.name || 'Producto KIOSNET',
      quantity: Number(item.quantity),
      unit_price: Number(item.price),
      currency_id: 'ARS'
    }));

    const preferenceBody: any = {
      items: mpItems,
      back_urls: {
        success: `${frontendUrl}/pos?payment=success`,
        failure: `${frontendUrl}/pos?payment=failure`,
        pending: `${frontendUrl}/pos?payment=pending`
      },
      notification_url: notificationUrl,
      external_reference: pendingSale.id // Store our Supabase Sale ID
    };

    if (frontendUrl.startsWith('https')) {
      preferenceBody.auto_return = 'approved';
    }

    const response = await preference.create({
      body: preferenceBody
    });

    res.json({
      preferenceId: response.id,
      initPoint: response.init_point,
      saleId: pendingSale.id
    });
  } catch (error: any) {
    console.error('Error creating Mercado Pago Preference:', error);
    const details = error.response?.data || error.cause || null;
    res.status(500).json({ 
      message: 'Error al iniciar pago con Mercado Pago', 
      error: error.message,
      details
    });
  }
};

export const createMpSubscriptionPreference = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { plan } = req.body; // 'STANDARD' or 'PRO'
    if (!plan || (plan !== 'STANDARD' && plan !== 'PRO')) {
      return res.status(400).json({ message: 'Plan no válido. Debe ser STANDARD o PRO.' });
    }

    // Query dynamic pricing from SystemConfig
    const configPrices = await prisma.systemConfig.findMany();
    let price = plan === 'PRO' ? 15730 : 12320;
    configPrices.forEach(cfg => {
      if (plan === 'PRO' && cfg.key === 'price_pro') price = Number(cfg.value) || 15730;
      if (plan === 'STANDARD' && cfg.key === 'price_standard') price = Number(cfg.value) || 12320;
    });

    const title = plan === 'PRO' ? 'Suscripción KIOSNET Pro (Mensual)' : 'Suscripción KIOSNET Estándar (Mensual)';
    const planId = plan === 'PRO' ? 'kiosnet_subscription_pro' : 'kiosnet_subscription_standard';

    const client = getMpClient();
    const preference = new Preference(client);

    const backendUrl = process.env.BACKEND_URL || 'https://kiosnet-webhook.loca.lt';
    const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const preferenceBody: any = {
      items: [
        {
          id: planId,
          title: title,
          quantity: 1,
          unit_price: price,
          currency_id: 'ARS'
        }
      ],
      back_urls: {
        success: `${frontendUrl}/dashboard?sub=success`,
        failure: `${frontendUrl}/dashboard?sub=failure`,
        pending: `${frontendUrl}/dashboard?sub=pending`
      },
      notification_url: notificationUrl,
      external_reference: `sub_${plan}_${tenantId}` // Prefixed with sub_PLAN_ to detect plan on webhook!
    };

    if (frontendUrl.startsWith('https')) {
      preferenceBody.auto_return = 'approved';
    }

    const response = await preference.create({
      body: preferenceBody
    });

    res.json({
      preferenceId: response.id,
      initPoint: response.init_point
    });
  } catch (error: any) {
    console.error('Error creating subscription preference:', error);
    const details = error.response?.data || error.cause || null;
    res.status(500).json({ 
      message: 'Error al iniciar suscripción', 
      error: error.message,
      details
    });
  }
};

export const createMpSubscriptionQrOrder = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: 'No autorizado. Cuenta no identificada.' });
    }

    const { plan } = req.body; // 'STANDARD' or 'PRO'
    if (!plan || (plan !== 'STANDARD' && plan !== 'PRO')) {
      return res.status(400).json({ message: 'Plan no válido. Debe ser STANDARD o PRO.' });
    }

    // Query dynamic pricing from SystemConfig
    const configPrices = await prisma.systemConfig.findMany();
    let price = plan === 'PRO' ? 15730 : 12320;
    configPrices.forEach(cfg => {
      if (plan === 'PRO' && cfg.key === 'price_pro') price = Number(cfg.value) || 15730;
      if (plan === 'STANDARD' && cfg.key === 'price_standard') price = Number(cfg.value) || 12320;
    });

    const title = plan === 'PRO' ? 'Suscripción KIOSNET Pro (Mensual)' : 'Suscripción KIOSNET Estándar (Mensual)';
    const backendUrl = process.env.BACKEND_URL || 'https://kiosnet-webhook.loca.lt';
    const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;

    // Construct order payload for in-store QR/POS API
    const orderBody = {
      external_reference: `sub_${plan}_${tenantId}`,
      title: title,
      description: `Suscripción Kiosnet ${plan} mensual`,
      notification_url: notificationUrl,
      total_amount: price,
      items: [
        {
          sku_number: `sub_${plan}`,
          title: title,
          description: `Suscripción Kiosnet ${plan} mensual`,
          unit_price: price,
          quantity: 1,
          unit_measure: 'unit',
          total_amount: price
        }
      ]
    };

    const postData = JSON.stringify(orderBody);
    const mpToken = process.env.MP_ACCESS_TOKEN || 'APP_USR-4849164774633719-051714-00b8cfd0d13fdaf15a8646fe8447a2cc-345296566';
    const userId = '345296566';
    const externalPosId = 'kiosnetpos01';

    const options = {
      hostname: 'api.mercadopago.com',
      path: `/instore/qr/seller/collectors/${userId}/pos/${externalPosId}/orders`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    await new Promise<void>((resolve, reject) => {
      const apiReq = request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => data += chunk);
        apiRes.on('end', () => {
          if (apiRes.statusCode === 204 || apiRes.statusCode === 200 || apiRes.statusCode === 201) {
            resolve();
          } else {
            console.error('Mercado Pago QR Order API Error:', apiRes.statusCode, data);
            reject(new Error(`Mercado Pago API returned status ${apiRes.statusCode}: ${data}`));
          }
        });
      });

      apiReq.on('error', (e) => reject(e));
      apiReq.write(postData);
      apiReq.end();
    });

    res.json({
      success: true,
      qrImage: 'https://www.mercadopago.com/instore/merchant/qr/132222299/4ce13379bb0c4a7eb715001e25aeda82b3ccf950f24d479badd3bd0426b5f768.png',
      qrCode: '00020101021143540016com.mercadolibre0130https://mpago.la/pos/13222229950150011233098854495204970053030325802AR5910EconoFeria6004CABA63041406'
    });
  } catch (error: any) {
    console.error('Error creating QR order:', error);
    res.status(500).json({ 
      message: 'Error al iniciar pago QR con Mercado Pago', 
      error: error.message
    });
  }
};

export const handleMpWebhook = async (req: Request, res: Response) => {
  try {
    const { action, type, data } = req.body;
    console.log(`Mercado Pago IPN Webhook received: ${type} - ${action}`, req.body);

    let paymentId = data?.id || req.query.id as string;
    
    if (type === 'payment' || action === 'payment.created' || action === 'payment.updated') {
      if (!paymentId) {
        return res.status(400).json({ message: 'No payment ID found in webhook' });
      }

      const client = getMpClient();
      const payment = new Payment(client);
      
      const paymentInfo = await payment.get({ id: paymentId });
      const externalRef = paymentInfo.external_reference;
      
      console.log(`Mercado Pago Payment verified. ID: ${paymentId}, Status: ${paymentInfo.status}, External Ref: ${externalRef}`);

      if (paymentInfo.status === 'approved' && externalRef) {
        if (externalRef.startsWith('sub_')) {
          // 1. Process Subscription Payment
          let tenantId = '';
          let plan = 'STANDARD';
          
          if (externalRef.startsWith('sub_PRO_')) {
            tenantId = externalRef.replace('sub_PRO_', '');
            plan = 'PRO';
          } else if (externalRef.startsWith('sub_STANDARD_')) {
            tenantId = externalRef.replace('sub_STANDARD_', '');
            plan = 'STANDARD';
          } else {
            // Fallback for older subscription references
            tenantId = externalRef.replace('sub_', '');
            plan = 'PRO';
          }
          
          const subExpiresAt = new Date();
          subExpiresAt.setMonth(subExpiresAt.getMonth() + 1);

          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              subActive: true,
              plan: plan,
              subExpiresAt: subExpiresAt
            }
          });

          console.log(`Tenant ${tenantId} subscription set to active (${plan} Plan).`);
        } else {
          // 2. Process Standard Sale Payment
          const saleId = externalRef;
          
          const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { items: true }
          });

          if (sale && sale.status === 'PENDING') {
            await prisma.$transaction(async (tx) => {
              // Mark sale as completed
              await tx.sale.update({
                where: { id: saleId },
                data: { status: 'COMPLETED' }
              });

              // Decrement physical stock
              for (const item of sale.items) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    stock: {
                      decrement: item.quantity
                    }
                  }
                });
              }

              // Register cash movement
              const activeRegister = await tx.cashRegister.findFirst({
                where: { userId: sale.sellerId, status: 'OPEN', tenantId: sale.tenantId }
              });

              if (activeRegister) {
                await tx.cashMovement.create({
                  data: {
                    registerId: activeRegister.id,
                    amount: sale.total,
                    type: 'IN',
                    description: `Venta MP QR #${saleId} [Aprobada]`
                  }
                });
              }
            });

            console.log(`Sale ${saleId} successfully updated to COMPLETED and inventory adjusted.`);
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('Error handling Mercado Pago webhook:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// GET /api/payments/prices
export const getPlanPrices = async (req: Request, res: Response) => {
  try {
    const configPrices = await prisma.systemConfig.findMany();
    
    let priceStandard = 12320;
    let pricePro = 15730;

    configPrices.forEach(cfg => {
      if (cfg.key === 'price_standard') priceStandard = Number(cfg.value) || 12320;
      if (cfg.key === 'price_pro') pricePro = Number(cfg.value) || 15730;
    });

    res.json({
      price_standard: priceStandard,
      price_pro: pricePro
    });
  } catch (error) {
    console.error('Error getting plan prices:', error);
    res.status(500).json({ message: 'Error al obtener los precios de los planes.' });
  }
};
