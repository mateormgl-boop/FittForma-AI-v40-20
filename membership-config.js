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
  // v48: identificadores PÚBLICOS de la suscripción en Google Play Console (ej. 'fittforma_plus_monthly').
  // Vacío = no se ofrece la compra. El precio lo informa Google Play; nunca se escribe acá.
  googlePlayProductIds: [],
  proBenefits: ['ad-free', 'higher-ai-allowance', 'advanced-personalization', 'advanced-progress', 'advanced-nutrition']
});
