import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { download } from '../setup-pi.mts';

test('setup uses curl trust through an HTTP proxy and rejects untrusted TLS, HTTP errors, and plaintext redirects', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-download-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cert = path.join(directory, 'cert.pem'), key = path.join(directory, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  const server = spawn(process.execPath, ['--input-type=module', '-e', `
    import https from 'node:https'; import http from 'node:http'; import net from 'node:net'; import fs from 'node:fs';
    https.createServer({ key: fs.readFileSync(process.argv[1]), cert: fs.readFileSync(process.argv[2]) }, (request, response) => {
      if (request.headers.authorization) { response.writeHead(400); response.end('credential leak'); }
      else if (request.url === '/missing') { response.writeHead(404); response.end('absent'); }
      else if (request.url === '/redirect') { response.writeHead(302, { location: 'http://localhost:9/plaintext' }); response.end(); }
      else { response.end('qualified bytes'); }
    }).listen(0, '127.0.0.1', function () {
      const tlsPort = this.address().port;
      const proxy = http.createServer();
      proxy.on('connect', (request, socket, head) => {
        fs.appendFileSync(process.argv[3], request.url + '\\n');
        const upstream = net.connect(tlsPort, '127.0.0.1', () => {
          socket.write('HTTP/1.1 200 Connection Established\\r\\n\\r\\n');
          upstream.write(head); upstream.pipe(socket); socket.pipe(upstream);
        });
        upstream.on('error', () => socket.destroy());
        socket.on('error', () => upstream.destroy());
      });
      proxy.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ tls: tlsPort, proxy: proxy.address().port })));
    });
  `, key, cert, path.join(directory, 'proxy-requests')], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => server.kill());
  const [output] = await once(server.stdout, 'data');
  const ports = JSON.parse(output.toString());
  const url = 'https://localhost:' + ports.tls;
  const proxyEnvironment = ['https_proxy', 'no_proxy', 'NO_PROXY'].map(name => [name, process.env[name]]);
  t.after(() => { for (const [name, value] of proxyEnvironment) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  process.env.https_proxy = 'http://127.0.0.1:' + ports.proxy;
  process.env.no_proxy = ''; process.env.NO_PROXY = '';
  const previous = process.env.CURL_CA_BUNDLE;
  const oldToken = process.env.GH_TOKEN;
  process.env.GH_TOKEN = 'fixture_token';
  t.after(() => { if (oldToken === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = oldToken; });
  t.after(() => { if (previous === undefined) delete process.env.CURL_CA_BUNDLE; else process.env.CURL_CA_BUNDLE = previous; });
  process.env.CURL_CA_BUNDLE = cert;
  await assert.rejects(fetch(url), /fetch failed/);
  assert.equal((await download(url)).toString(), 'qualified bytes');
  await assert.rejects(download(url + '/missing'), /DOWNLOAD_FAILED: HTTP 404 from localhost/);
  await assert.rejects(download(url + '/redirect'), /DOWNLOAD_FAILED: curl exit 1 from localhost/);
  delete process.env.CURL_CA_BUNDLE;
  await assert.rejects(download(url), /DOWNLOAD_FAILED: curl exit 60 from localhost/);
  await assert.rejects(download('http://localhost:9'), /INVALID_ORIGIN/);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'proxy-requests'), 'utf8').trim().split('\n'), Array(4).fill('localhost:' + ports.tls));
});
