// Rules the deployment files must keep, checked on every change (CI runs this; so can you:
// `node infra/check.mjs`). The schema check (kubeconform) says a file is valid Kubernetes;
// this says it still does what docs/DEPLOYMENT.md promises.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
/** The file without its comments, so a rule is never satisfied by a sentence about it. */
const spec = (path) =>
  read(path)
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

const problems = [];
const must = (ok, message) => {
  if (!ok) problems.push(message);
};

const web = spec('k8s/base/web-deployment.yaml');
const hpa = spec('k8s/base/web-hpa.yaml');
const worker = spec('k8s/base/worker-deployment.yaml');
const compose = spec('docker/compose.yml');
const workerSource = read('../apps/worker/src/index.ts');

// The autoscaler owns the number of web pods. A `replicas` line in the Deployment would set
// it back on every `kubectl apply`, in the middle of a busy hour.
must(
  !/^ {2}replicas:/m.test(web),
  'web-deployment.yaml: remove `replicas` — the autoscaler owns it, and every apply would reset it',
);
must(/minReplicas: [2-9]/.test(hpa), 'web-hpa.yaml: at least 2 web pods, so one can be replaced');

// Scale on CPU only. Memory does not fall when pods are added, so a memory target near a
// pod's resting use pins the deployment at its maximum.
must(/name: cpu/.test(hpa), 'web-hpa.yaml: scale on CPU');
must(!/name: memory/.test(hpa), 'web-hpa.yaml: do not scale on memory (it never scales back)');

// Probes: liveness must not depend on the database; readiness must.
must(
  /livenessProbe:\s+httpGet:\s+path: \/api\/health/.test(web),
  'web-deployment.yaml: liveness probe on /api/health',
);
must(
  /readinessProbe:\s+httpGet:\s+path: \/api\/ready/.test(web),
  'web-deployment.yaml: readiness probe on /api/ready',
);
must(/maxUnavailable: 0/.test(web), 'web-deployment.yaml: never fewer pods during a rollout');

// A worker that hangs sends no email and nobody can confirm an address: it must be noticed.
must(
  /process\.env\.WORKER_HEARTBEAT_FILE/.test(workerSource),
  'apps/worker/src/index.ts: the worker touches the file named by WORKER_HEARTBEAT_FILE',
);
must(
  !/tmpdir\(\)/.test(workerSource),
  'apps/worker/src/index.ts: no file with a guessable name in the shared temp folder',
);
/** The file a deployment tells the worker to touch, which its own check must then read. */
const beatFile = (text) => /WORKER_HEARTBEAT_FILE[\s\S]{0,40}?(\/[\w./-]+)/.exec(text)?.[1];
const probed = (text) => {
  const file = beatFile(text);
  return Boolean(file) && text.split(file).length > 2;
};
must(
  /livenessProbe:/.test(worker) && probed(worker),
  'worker-deployment.yaml: WORKER_HEARTBEAT_FILE set, and a liveness probe that reads that file',
);
must(
  /worker:[\s\S]*healthcheck:/.test(compose) && probed(compose),
  'compose.yml: WORKER_HEARTBEAT_FILE set on the worker, and a healthcheck that reads that file',
);

// Secrets never live in the kustomization.
must(
  !/secret\.example\.yaml/.test(spec('k8s/base/kustomization.yaml')),
  'kustomization.yaml: the example Secret must not be applied',
);

if (problems.length) {
  console.error(`Deployment files: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('Deployment files: all rules hold');
