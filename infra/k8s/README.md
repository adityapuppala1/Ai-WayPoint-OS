# Kubernetes

`base/` is a kustomize base for Waypoint: the web app (with the API), the background worker
and a migration job. The step-by-step guide is in
[docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md#kubernetes).

```bash
kubectl kustomize infra/k8s/base        # see exactly what would be applied
kubectl apply -k infra/k8s/base         # apply it (after creating the Secret)
```

| File | What it is |
| --- | --- |
| `kustomization.yaml` | The list of resources, the namespace, and **your image names and versions** |
| `namespace.yaml` | The `waypoint` namespace, with the "restricted" pod security standard enforced |
| `configmap.yaml` | Settings that are not secret: **your address, contact details, proxy header** |
| `secret.example.yaml` | The names the Secret `waypoint-secrets` needs. An example only: not applied |
| `migrate-job.yaml` | Database migrations and reference data, once per release, before the rollout |
| `web-deployment.yaml` | The web app: non-root, read-only file system, probes on `/api/health` and `/api/ready`, requests and limits |
| `web-service.yaml` | The Service in front of the web pods |
| `web-hpa.yaml` | 2–10 web pods on CPU and memory |
| `web-pdb.yaml` | Node maintenance never takes the last web pod |
| `worker-deployment.yaml`, `worker-pdb.yaml` | The background worker |
| `networkpolicy.yaml` | Only the ingress controller reaches the web pods; nothing reaches the worker |
| `ingress.yaml` | HTTPS in front of the Service (ingress-nginx and cert-manager; **your host name**) |

Not included: Postgres. Use a managed database, or your own operator, with the `vector`
(pgvector) and `pg_trgm` extensions available; the first migration creates them.

Checked with `kubeconform -strict` against Kubernetes 1.29 and 1.31. Not yet run in a
cluster: try it in staging first, and tell us what you had to change.
