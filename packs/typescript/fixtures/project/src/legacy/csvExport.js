const { logger } = require('../shared/logger');

function toCsv(orders) {
  const header = 'id,status';
  const rows = orders.map((o) => `${o.id},${o.status}`);
  logger.info(`exported ${rows.length} orders`);
  return [header, ...rows].join('\n');
}

module.exports = { toCsv };
