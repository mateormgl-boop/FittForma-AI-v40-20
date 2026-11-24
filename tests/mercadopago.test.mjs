import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createMonetization, monetizationConfigFromEnv, verifyMercadoPagoWebhookSignature } from '../backend/monetization.mjs';

const SECRET = 'unit-test-secret';
const CONFIG = {
  MONETIZATION_ENABLED: 'true',
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

test('Mercado Pago: no activa Plus al crear el checkout y verifica el estado remoto antes de concederlo', async () => {
  const userId = '11111111-2222-3333-4444-555555555555';
  const token = 'mock-supabase-session-token-123456789012';
  const subId = '1234567890123456';
  const references = new Map();
  let writes = [];
  let externalReference = '';
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: userId, email: 'user@example.com' }), { status: 200 });
    if (u.includes('/rest/v1/community_memberships?')) return new Response('[]', { status: 200 });
    if (u.endsWith('/rest/v1/rpc/monetization_mp_link_subscription')) {
      const x = JSON.parse(init.body); externalReference = x.p_external_reference;
      references.set(x.p_subscription_id, { userId: x.p_user_id, externalReference });
      return new Response('true', { status: 200 });
    }
    if (u.endsWith('/rest/v1/rpc/monetization_mp_get_subscription')) {
      const x = JSON.parse(init.body), found = references.get(x.p_subscription_id);
      return new Response(JSON.stringify(found ? [{ user_id: found.userId, external_reference: found.externalReference }] : []), { status: 200 });
    }
    if (u.endsWith('/rest/v1/rpc/monetization_set_membership')) {
      writes.push(JSON.parse(init.body)); return new Response('true', { status: 200 });
    }
    if (u === 'https://api.mercadopago.com/preapproval' && init.method === 'POST') {
      return new Response(JSON.stringify({ id: subId, external_reference: externalReference, init_point: 'https://www.mercadopago.com.uy/subscriptions/checkout?preapproval_id=' + subId }), { status: 201 });
    }
    if (u.endsWith('/preapproval/' + subId)) {
      return new Response(JSON.stringify({ id: subId, external_reference: externalReference, status: 'authorized' }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  const env = {
    ...CONFIG,
    SUPABASE_URL: 'https://demo.supabase.co',
    SUPABASE_ANON_KEY: 'public-anon-test-key',
    SUPABASE_SERVICE_ROLE_KEY: 'server-side-test-key'
  };
  const monetization = createMonetization({ env, fetchImpl });
  const req = { headers: { authorization: 'Bearer ' + token } };
  const checkout = await monetization.createMercadoPagoSubscription(req);
  assert.equal(checkout.status, 201);
  assert.equal(writes.length, 0, 'checkout pendiente no activa Plus');
  const verified = await monetization.verifyMercadoPagoSubscription(req, { subscriptionId: subId });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.plan, 'plus');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].p_user_id, userId);
  assert.equal(writes[0].p_source, 'mercadopago');
});
