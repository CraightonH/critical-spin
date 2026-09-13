# Critical Spin

**Critical Spin v0.6** is a tiny, dependency-free browser prototype for a **GRPG — Gambling RPG**. Your character build is the slot machine: equipment changes the symbols and odds, then each pull becomes an attack, guard, heal, or jackpot. The portrait mobile cabinet uses a solid, continuous submerged-cylinder reel surface with readable 16px touch copy.

## Play

Open `index.html` directly in a browser, or serve this directory with any static web server:

```sh
python3 -m http.server 8080
```

Choose one of three dealers, then:

- Tap **ATTACK**, `Enter`, or `Space` to pull the three-reel machine. Hold **ATTACK** for two seconds to toggle idle mode; a visible percentage overlay tracks the hold from 0% to 100%. While idle is active, one tap exits idle immediately.
- Click a reel to **HOLD** it between pulls; click again to release it.
- Use mixed weapon, defense, healing, and fire results to survive the counter-hit.
- Charge the dealer's unique **SKILL** by spinning; the skill button or its dealer card uses it when ready.
- Use the left scene rail for Dealer, Odds, and History details; tap the enemy to open its encounter card. Labels remain available through tooltips and assistive text.
- Each live reel stops left-to-right with a snap and spark; each locked drum stays visually fixed while later drums spin, held drums stay still, and combat resolves only after the final stop.
- Beat each encounter and pick one of three upgrades to tune the next table.

Three `7` symbols are the jackpot: normal enemies lose roughly 80% of max vitality; **THE HOUSE** loses 30% and is staggered for two turns. The best encounter reached and the highest gold purse are saved in `localStorage` under `critical-spin-best-v1`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Accessible game structure and interface copy |
| `styles.css` | Responsive dark casino-fantasy visual system; no image assets |
| `game.js` | Combat, weighted reels, sequential reel locks, hold-to-idle, upgrades, and persistence |
| `k8s.yaml` | Optional Kubernetes manifests for a static nginx deployment |

The prototype intentionally has no package manager, build step, external runtime dependency, image asset, API, or server-side state. It is designed to be easy to inspect, fork, and replace with a real game client later.

## Kubernetes

`k8s.yaml` targets the `agents` namespace and mounts the three client files from a ConfigMap into `nginx:alpine`. Its example Ingress uses `critical-spin.example.com`; replace that host and the ingress/certificate settings for your cluster before applying it.

```sh
kubectl apply -f k8s.yaml
```
