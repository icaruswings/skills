import { spawn } from 'node:child_process';

export function runProcess(command, args, { cwd, input, timeoutMs = 120_000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', failure;
    const stop = reason => {
      failure = reason;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
    };
    const timer = setTimeout(() => stop(new Error('Model call timed out; usage may be unknown')), timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 8_000_000) stop(new Error('Output limit exceeded')); });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stdin.on('error', () => {});
    child.on('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code, failure: failure?.message }); });
    child.stdin.end(input);
  });
}
