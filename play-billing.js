// Los dos formatos de Android comparten la verificación de recibos en el servidor.
(() => {
  const method = 'https://play.google.com/billing';

  async function connect() {
    const cap = window.Capacitor;
    if (cap?.getPlatform?.() === 'android' && cap.isPluginAvailable?.('NativePurchases')) {
      const billing = cap.Plugins.NativePurchases;
      if (!(await billing.isBillingSupported()).isBillingSupported) return null;
      return {
        async monthlyOffer(ids, accountId) {
          if (!accountId) return null;
          const { products } = await billing.getProducts({ productIdentifiers: ids, productType: 'subs' });
          for (const id of ids) {
            const plan = products.find(p => p.planIdentifier === id && !p.offerId && p.offerToken &&
              p.priceString && p.subscriptionPeriod?.unit === 2 && p.subscriptionPeriod.numberOfUnits === 1 && !p.subscriptionBillingCycles);
            if (!plan) continue;
            return { price: plan.priceString, async buy() {
              try {
                const tx = await billing.purchaseProduct({ productIdentifier: id, productType: 'subs',
                  planIdentifier: plan.identifier, offerToken: plan.offerToken, appAccountToken: accountId,
                  autoAcknowledgePurchases: false });
                return receipt(tx);
              } catch (e) {
                if (e?.message === 'Purchase is pending') return { pending: true, productId: id };
                throw e;
              }
            } };
          }
          return null;
        },
        async unfinished(ids, accountId) {
          const { transactions } = await billing.getUnfinishedTransactions();
          return transactions.filter(tx => tx.appAccountToken === accountId && ids.includes(tx.productIdentifier)).map(receipt);
        },
        async purchases() {
          const { purchases } = await billing.getPurchases({ productType: 'subs' });
          return purchases.map(receipt);
        }
      };
    }
    if (!window.getDigitalGoodsService || !window.PaymentRequest) return null;
    const service = await window.getDigitalGoodsService(method);
    return {
      async monthlyOffer(ids) {
        const details = await service.getDetails(ids);
        for (const id of ids) {
          const plan = details.find(p => p.itemId === id && p.subscriptionPeriod === 'P1M' && p.price);
          if (!plan) continue;
          const price = new Intl.NumberFormat(document.documentElement.lang || 'es', { style: 'currency', currency: plan.price.currency }).format(plan.price.value);
          return { price, async buy() {
            const request = new PaymentRequest([{ supportedMethods: method, data: { sku: id } }], {
              total: { label: 'FittForma AI Plus', amount: plan.price }
            });
            const response = await request.show();
            return { productId: id, purchaseToken: response.details.purchaseToken, complete: result => response.complete(result) };
          } };
        }
        return null;
      },
      async purchases() {
        return (await service.listPurchases()).map(p => ({ productId: p.itemId, purchaseToken: p.purchaseToken }));
      }
    };
  }

  function receipt(tx) {
    return { productId: tx.productIdentifier, purchaseToken: tx.purchaseToken, pending: tx.purchaseState === '2' };
  }
  window.FittFormaPlayBilling = { connect };
})();
