/* Independent sandbox: data lives in page memory.
   The frozen settings and request guard prevent shared-data access. */
window.JASON_CONFIG = Object.freeze({
 sandbox: true,
 apiBase: '',
 imageBase: '../../OrderSheet/img',
 autoConnect: false,
 sharedOnly: false,
 legacyProducts: '',
 logisticsFile: ''
});
