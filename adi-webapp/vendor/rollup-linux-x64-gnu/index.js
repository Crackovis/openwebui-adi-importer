const crypto = require('node:crypto');

const unsupported = () => {
  throw new Error('rollup native parser is unavailable in this environment');
};

const toBuffer = (input) => {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  return Buffer.from(String(input));
};

const digest = (input, encoding) => crypto.createHash('sha256').update(toBuffer(input)).digest(encoding);

module.exports = {
  parse: unsupported,
  parseAsync: async () => unsupported(),
  xxhashBase64Url: (input) => digest(input, 'base64url'),
  xxhashBase36: (input) => BigInt(`0x${digest(input, 'hex').slice(0, 16)}`).toString(36),
  xxhashBase16: (input) => digest(input, 'hex')
};
