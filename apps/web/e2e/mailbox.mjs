// A tiny mail catcher for the end-to-end tests: it speaks just enough SMTP for Waypoint's own
// sender and writes each message it receives, one per line, to a file the tests read. Nothing
// is ever delivered anywhere. Listens on 127.0.0.1 only.
import { appendFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';

/** Starts the catcher; resolves once it is listening. */
export function startMailbox({ port, file }) {
  writeFileSync(file, '');
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    let buffer = '';
    let data = null;
    let to = [];
    const reply = (line) => socket.write(`${line}\r\n`);
    reply('220 waypoint-e2e ready');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let end = buffer.indexOf('\r\n');
      while (end !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data !== null) {
          if (line === '.') {
            appendFileSync(file, `${JSON.stringify({ to, raw: data.join('\n') })}\n`);
            data = null;
            to = [];
            reply('250 stored');
          } else data.push(line.startsWith('..') ? line.slice(1) : line);
        } else {
          const verb = line.slice(0, 4).toUpperCase();
          if (verb === 'EHLO' || verb === 'HELO') reply('250 waypoint-e2e');
          else if (verb === 'MAIL') reply('250 ok');
          else if (verb === 'RCPT') {
            const address = /<([^>]+)>/.exec(line)?.[1];
            if (address) to.push(address.toLowerCase());
            reply('250 ok');
          } else if (verb === 'DATA') {
            data = [];
            reply('354 go ahead');
          } else if (verb === 'QUIT') {
            reply('221 bye');
            socket.end();
          } else reply('250 ok');
        }
        end = buffer.indexOf('\r\n');
      }
    });
    socket.on('error', () => undefined);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
