/* Jason 2.0 shares the exact API and image directory used by the original Jason.
   There is no second products.json or logistics.json in this application. */
window.JASON_CONFIG = {
 apiBase: 'https://union-cosmetic.filipluchesi.workers.dev',
 imageBase: 'https://feela-cz.github.io/Union-Cosmetic/OrderSheet/img',
 autoConnect: location.protocol === 'https:' && location.hostname === 'feela-cz.github.io',
 sharedOnly: true,
 workspaceName: 'union-cosmetic-jason2',
 legacyProducts: '../OrderSheet/products.json',
 logisticsFile: '../JSON%20edit%20GUI/logistics.json'
};
