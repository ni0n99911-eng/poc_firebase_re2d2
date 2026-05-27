const { exec } = require('child_process');
const server = exec('npx vite dev', { cwd: '.' });
server.stdout.on('data', console.log);
server.stderr.on('data', console.error);
setTimeout(async () => {
   try {
       const res = await fetch('http://localhost:5173/src/routes/app/location/+page.svelte');
       console.log("FETCH RESULT:", res.status, res.headers.get('content-type'));
       console.log(await res.text());
   } catch(e) {
       console.log("Fetch failed", e);
   }
   process.exit(0);
}, 8000);
