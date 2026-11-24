// Prueba la tarjeta de membresía en la app real. Google Play y las respuestas de verificación son dobles locales.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PLAYWRIGHT_DIR || '/opt/node-tools/node_modules') + '/');
const { chromium } = require('playwright');
const url = process.env.APP_URL || 'http://localhost:8787';
const productId = 'plus_monthly';
const browser = await chromium.launch();
try {
  for (const platform of ['android', 'twa', 'web']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const errors = [], requests = [];
    let plus = false, verifyStatus = 200, signedIn = true;
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/cdn\.jsdelivr|unpkg\.com/, r => r.abort());
    await page.route('**/api/entitlements', r => r.fulfill({ json: {
      enabled: true, signedIn, plan: plus ? 'plus' : 'free', planVerified: true,
      ai: { remaining: 5, limit: 6 }, ads: { show: false }, photos: {},
      payments: { googlePlay: true, productIds: [productId], accountId: 'b'.repeat(64) }
    } }));
    await page.route('**/api/billing/play/verify', async r => {
      const body = r.request().postDataJSON(); requests.push(body);
      if (verifyStatus === 200) plus = true;
      await r.fulfill({ status: verifyStatus, json: verifyStatus === 200 ? { plan: 'plus' } : { error: 'No se pudo verificar la compra. No se activó Plus.' } });
    });
    await page.addInitScript(({ platform, id }) => {
      for (const key of ['fittforma-welcome-v1','fittforma-tour-v68','fittforma-health-notice-v64']) localStorage.setItem(key, '1');
      window.shopTest = { mode: 'cancel', attempts: [], restored: 0, catalog: true };
      const shop = window.shopTest;
      const receipt = { productIdentifier: id, purchaseState: '1', purchaseToken: 'store-receipt-test' };
      if (platform === 'android') window.Capacitor = { getPlatform: () => 'android', isPluginAvailable: name => name === 'NativePurchases', Plugins: { NativePurchases: {
        isBillingSupported: async () => ({ isBillingSupported: true }),
        getProducts: async () => ({ products: shop.catalog ? [{ planIdentifier: id, identifier: 'mensual', priceString: '$ 199,00',
          offerToken: 'oferta-mensual', subscriptionPeriod: { unit: 2, numberOfUnits: 1 } }] : [] }),
        purchaseProduct: async args => {
          shop.attempts.push(args);
          if (shop.mode === 'cancel') throw Object.assign(new Error('cancel'), { code: 'USER_CANCELED' });
          if (shop.mode === 'pending') throw new Error('Purchase is pending');
          return receipt;
        },
        getUnfinishedTransactions: async () => ({ transactions: shop.interrupted ? [
          { ...receipt, appAccountToken: 'b'.repeat(64) }, { ...receipt, appAccountToken: 'otro-usuario' }
        ] : [] }),
        getPurchases: async () => { shop.restored++; return { purchases: [receipt, { ...receipt, productIdentifier: 'unrelated' }] }; }
      } } };
      if (platform === 'twa') {
        window.getDigitalGoodsService = async () => ({
          getDetails: async () => [{ itemId: id, subscriptionPeriod: 'P1M', price: { currency: 'UYU', value: '199' } }],
          listPurchases: async () => [{ itemId: id, purchaseToken: receipt.purchaseToken }]
        });
        window.PaymentRequest = class {
          constructor(methods) { shop.attempts.push(methods); }
          async show() {
            if (shop.mode === 'cancel') throw new DOMException('cancel', 'AbortError');
            return { details: receipt, complete: async result => { shop.completed = result; } };
          }
        };
      }
    }, { platform, id: productId });
    await page.goto(url);
    await page.click('#planChip');
    const buy = page.locator('#plusBuyGooglePlay'), restore = page.locator('#plusRestore');
    if (platform === 'web') {
      assert.equal(await buy.isVisible(), false); assert.equal(await restore.isVisible(), false);
      assert.equal(await page.locator('#membershipEstimate').isVisible(), false);
    } else {
      await buy.waitFor();
      assert.match(await page.locator('#membershipStorePrice').innerText(), /199/);
      assert.equal(await page.locator('#membershipEstimate').isVisible(), false);
      await buy.click();
      await page.waitForFunction(() => !document.querySelector('#plusBuyGooglePlay').disabled);
      assert.equal(requests.length, 0);
      if (platform === 'android') {
        const [params] = await page.evaluate(() => window.shopTest.attempts);
        assert.equal(params.offerToken, 'oferta-mensual'); assert.equal(params.autoAcknowledgePurchases, false);
        assert.equal(params.appAccountToken, 'b'.repeat(64));
        await page.evaluate(() => { window.shopTest.mode = 'pending'; });
        await buy.click(); await page.getByText('El pago está pendiente en Google Play.', { exact: true }).waitFor();
        assert.equal(requests.length, 0);
      }
      await page.evaluate(() => { window.shopTest.mode = 'buy'; });
      verifyStatus = 503;
      await buy.click(); await page.getByText('Usá Restaurar compra para verificar tu suscripción.', { exact: true }).waitFor();
      assert.equal(plus, false); assert.equal(await buy.isVisible(), true);
      verifyStatus = 200;
      if (platform === 'android') {
        await page.evaluate(async () => { window.shopTest.catalog = false; await window.FittFormaAds.refresh(true); });
        assert.equal(await buy.isVisible(), false);
        await restore.click(); await page.getByText('Suscripción restaurada.', { exact: true }).waitFor();
      } else {
        await buy.click(); await page.getByText('¡Plus activo! Verificado con Google Play.', { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => window.shopTest.completed), 'success');
      }
      assert.equal(requests.length, 2); assert.deepEqual(requests[1], { productId, purchaseToken: 'store-receipt-test' });
      assert.match(await page.locator('#membershipPill').innerText(), /verificado/);
      assert.equal(await buy.isVisible(), false); assert.equal(await restore.isVisible(), true);
      if (platform === 'android') {
        plus = false;
        await page.evaluate(async () => { window.shopTest.interrupted = true; await window.FittFormaAds.refresh(true); });
        assert.equal(requests.length, 3);
        assert.match(await page.locator('#membershipPill').innerText(), /verificado/);
      }
      signedIn = false; plus = false;
      await page.evaluate(() => window.FittFormaAds.refresh(true));
      assert.equal(await restore.isVisible(), false); assert.equal(await buy.isVisible(), false);
    }
    assert.deepEqual(errors, []);
    console.log('PASA', platform);
    await page.close();
  }
} finally { await browser.close(); }
