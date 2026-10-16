/* FittForma AI v33.0 — propuesta de membresía.
 * No contiene credenciales ni activa cobros.
 * Nunca conceder Pro por una bandera local: el estado futuro deberá verificarse en servidor
 * mediante el proveedor de pagos y una identidad de usuario autenticada.
 */
window.FittFormaMembershipConfig = Object.freeze({
  paymentsEnabled: false,
  provider: 'not-configured',
  proposedPrice: { amount: 5.99, currency: 'USD', interval: 'month', final: false },
  freeDailyAiQuestions: 6,
  proBenefits: ['ad-free', 'higher-ai-allowance', 'advanced-personalization', 'advanced-progress', 'advanced-nutrition']
});
