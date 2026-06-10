import { onRequest } from 'firebase-functions/v2/https';
  const server = import('firebase-frameworks');
  export const ssrdevredsq = onRequest({"region":"us-central1","timeoutSeconds":300,"memory":"512MiB"}, (req, res) => server.then(it => it.handle(req, res)));
  