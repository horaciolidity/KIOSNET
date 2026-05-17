import { Request, Response } from 'express';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import prisma from '../utils/prisma';

// Initialize Mercado Pago Client
const getMpClient = () => {
  const token = process.env.MP_ACCESS_TOKEN || 'TEST-1808000494498328-051717-3bf7b1b369527cf6eb9499ad6f4c39f0-109040375';
  return new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 5000 }
  });
};

export const createMpPreference = async (req: Request, res: Response) => {
  try {
    const { 
      total, 
      customerId, 
      sellerId, 
      items 
    } = req.body;

    // 1. Create a PENDING Sale in the database first to track it
    const pendingSale = await prisma.sale.create({
      data: {
        total,
        subtotal: total,
        discount: 0,
        paymentMethod: 'TRANSFER', // MP counts as card/transfer
        status: 'PENDING',
        customerId: customerId || null,
        sellerId,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            costPrice: item.costPrice
          }))
        }
      }
    });

    // 2. Build Mercado Pago Preference
    const client = getMpClient();
    const preference = new Preference(client);

    // Build public notification URL for webhooks
    const backendUrl = process.env.BACKEND_URL || 'https://kiosnet-webhook.loca.lt'; // local tunnel or default
    const notificationUrl = `${backendUrl}/api/payments/mercadopago/webhook`;

    const mpItems = items.map((item: any) => ({
      id: item.productId,
      title: item.name || 'Producto KIOSNET',
      quantity: Number(item.quantity),
      unit_price: Number(item.price),
      currency_id: 'ARS'
    }));

    const response = await preference.create({
      body: {
        items: mpItems,
        back_urls: {
          success: 'http://localhost:5173/pos?payment=success',
          failure: 'http://localhost:5173/pos?payment=failure',
          pending: 'http://localhost:5173/pos?payment=pending'
        },
        auto_return: 'approved',
        notification_url: notificationUrl,
        external_reference: pendingSale.id // Store our Supabase Sale ID here
      }
    });

    res.json({
      preferenceId: response.id,
      initPoint: response.init_point,
      saleId: pendingSale.id
    });
  } catch (error: any) {
    console.error('Error creating Mercado Pago Preference:', error);
    res.status(500).json({ message: 'Error al iniciar pago con Mercado Pago', error: error.message });
  }
};

export const handleMpWebhook = async (req: Request, res: Response) => {
  try {
    const { action, type, data } = req.body;
    console.log(`Mercado Pago IPN Webhook received: ${type} - ${action}`, req.body);

    // Standard MP webhook payment ID extraction
    let paymentId = data?.id || req.query.id as string;
    
    if (type === 'payment' || action === 'payment.created' || action === 'payment.updated') {
      if (!paymentId) {
        return res.status(400).json({ message: 'No payment ID found in webhook' });
      }

      const client = getMpClient();
      const payment = new Payment(client);
      
      // Fetch details from Mercado Pago to verify details and protect against fraud
      const paymentInfo = await payment.get({ id: paymentId });
      const saleId = paymentInfo.external_reference;
      
      console.log(`Mercado Pago Payment verified. ID: ${paymentId}, Status: ${paymentInfo.status}, Sale ID: ${saleId}`);

      if (paymentInfo.status === 'approved' && saleId) {
        // Find if sale is still PENDING
        const sale = await prisma.sale.findUnique({
          where: { id: saleId },
          include: { items: true }
        });

        if (sale && sale.status === 'PENDING') {
          await prisma.$transaction(async (tx) => {
            // 1. Update sale to COMPLETED
            await tx.sale.update({
              where: { id: saleId },
              data: { status: 'COMPLETED' }
            });

            // 2. Decrement physical inventory stock
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

            // 3. Register cash movement in active cash register
            const activeRegister = await tx.cashRegister.findFirst({
              where: { userId: sale.sellerId, status: 'OPEN' }
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

    // Always respond with a 200 OK so Mercado Pago knows we received the webhook!
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Error handling Mercado Pago Webhook:', error);
    // Return 200/500 depending on flow. We return 200 to avoid webhook retries on minor issues
    res.status(200).send('OK');
  }
};
