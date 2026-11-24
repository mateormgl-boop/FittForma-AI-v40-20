import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { monetizationConfigFromEnv, verifyMercadoPagoWebhookSignature } from '../backend/monetization.mjs';

const SECRET = 'unit-test-secret';
const CONFIG = {
  MERCADOPAGO_ENABLED: 'true',
  MERCADOPAGO_ACCESS_TOKEN: 'mock_access_token',
  MERCADOPAGO_WEBHOOK_SECRET: SECRET,
  MERCADOPAGO_PLUS_AMOUNT: '199',
  MERCADOPAGO_CURRENCY_ID: 'UYU',
  PUBLIC_SITE_URL: 'https://fittforma.example'
};

test('Mercado Pago permanece apagado hasta habilitarse y completar la configuración', () => {
  assert.equal(monetizationConfigFromEnv({ ...CONFIG, MERCADOPAGO_ENABLED: 'false' }).mp.enabled, false);
  assert.equal(monetizationConfigFromEnv({ ...CONFIG, MERCADOPAGO_ACCESS_TOKEN: '' }).mp.enabled, false);
  assert.equal(monetizationConfigFromEnv({ ...CONFIG, MERCADOPAGO_WEBHOOK_SECRET: '' }).mp.enabled, false);
  assert.equal(monetizationConfigFromEnv({ ...CONFIG, MERCADOPAGO_PLUS_AMOUNT: '0' }).mp.enabled, false);
  assert.equal(monetizationConfigFromEnv({ ...CONFIG, MERCADOPAGO_CURRENCY_ID: 'EUR' }).mp.enabled, false);
  assert.equal(monetizationConfigFromEnv({ ...CONFIG, PUBLIC_SITE_URL: 'http://example.com' }).mp.enabled, false);
  assert.equal(monetizationConfigFromEnv(CONFIG).mp.enabled, true);
});

test('Mercado Pago valida HMAC y rechaza firmas inválidas', () => {
  const dataId = '1234567890123456', requestId = 'request-123', ts = '1781009491';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
  const signature = `ts=${ts},v1=${v1}`;
  assert.equal(verifyMercadoPagoWebhookSignature({ signature, requestId, dataId, secret: SECRET }), true);
  assert.equal(verifyMercadoPagoWebhookSignature({ signature: signature.replace(v1, '0'.repeat(64)), requestId, dataId, secret: SECRET }), false);
  assert.equal(verifyMercadoPagoWebhookSignature({ signature, requestId: '', dataId, secret: SECRET }), false);
});
