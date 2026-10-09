/* Independent local sandbox: no API endpoint, no automatic connection.
   The frozen settings and request guard prevent shared-data access. */
window.JASON_CONFIG = Object.freeze({
 sandbox: true,
 apiBase: '',
 imageBase: '../../OrderSheet/img',
 autoConnect: false,
 sharedOnly: false,
 workspaceName: 'union-cosmetic-jason2-sandbox',
 legacyProducts: '',
 logisticsFile: ''
});
