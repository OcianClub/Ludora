import compression from 'compression';

export const comprimirConsultas = compression({
  threshold: 1024,
  filter: (req, res) =>
    req.method === 'GET' &&
    res.statusCode === 200 &&
    String(res.getHeader('Content-Type') ?? '').startsWith(
      'application/json'
    ) &&
    compression.filter(req, res),
});
