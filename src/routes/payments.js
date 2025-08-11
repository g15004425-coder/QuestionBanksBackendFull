import { Router } from 'express';
import { createHostedPayment, paymentSuccess, paymentFail, paymentCancel } from '../controllers/payment.controller.js';

export const paymentsRouter = Router();

paymentsRouter.post('/create-hosted-payment', createHostedPayment);
paymentsRouter.get('/success', paymentSuccess);
paymentsRouter.get('/fail', paymentFail);
paymentsRouter.get('/cancel', paymentCancel);
