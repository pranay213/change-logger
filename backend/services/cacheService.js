const NodeCache = require('node-cache');

// Standard TTL is 10 minutes
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

class CacheService {
  get(key) {
    return cache.get(key);
  }

  set(key, value, ttl = 600) {
    cache.set(key, value, ttl);
  }

  del(key) {
    cache.del(key);
  }
  
  flush() {
    cache.flushAll();
  }
}

module.exports = new CacheService();
