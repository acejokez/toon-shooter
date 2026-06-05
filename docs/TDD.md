# Technical Design Document (TDD): "Toon Shooter"

**Companion to:** [`docs/prd.md`](./prd.md)
**Asset manifest:** [`assets.json`](../assets.json) · **Visual reference:** [`public/map/concept.png`](../public/map/concept.png)
**Engine:** Three.js (WebGL) · low-poly glTF pipeline · desktop web
**Status:** Design baseline for implementation. Optimized for *minimal rework* and *fast time-to-playable*.

---

## 0. How to read this document

This TDD turns the PRD into concrete engineering decisions. Every section answers one of:
*what we build, how the pieces talk, and in what order.* The guiding principle is:

> **Build a vertical slice first, then widen.** A running player on a scrolling ground with one
> obstacle and one enemy — fully wired (input → physics → collision → animation → UI) — is worth
> more than every feature half-built. Sections 9–10 sequence the work to hit a playable loop on day one.

Key constraints that drive the rest of the design:

1. **Treadmill world** — the player never actually moves on X; the world scrolls past. This bounds all
   coordinates, eliminates floating-point drift on long runs, and makes spawning/pooling trivial.
2. **Characters are pre-animated** (verified in the glTF). We use a skeletal animation state machine,
   not procedural motion.
3. **2D gameplay on a 3D stage** — all gameplay logic is 2D (X horizontal, Y vertical, collisions are
   AABB). The third dimension exists only for the toon look (camera angle, parallax depth).
4. **DOM for UI, WebGL for the world** — the HUD/shop/inventory (concept.png right panel) is HTML/CSS
   overlaid on the canvas. Far faster to build and style than in-canvas UI.

---

## 1. Technology Stack & Tooling

| Concern | Decision | Rationale |
|---|---|---|
| Renderer | **Three.js r0.160+** (ES modules) | Matches asset pipeline + skill guidance. |
| Module loading | **Vite** dev server + build | Instant HMR, bundles for prod, resolves `three` / `three/addons`. Node is installed. |
| Language | **Vanilla JS (ES2022 modules)** + JSDoc types | No framework tax; JSDoc gives editor type-safety without a TS build step. Add `tsc --checkJs` later if desired. |
| 3D models | **glTF** (`assets.json` → `gltf` field) | Native Three.js format; embedded animations. |
| Model cloning | **`SkeletonUtils.clone`** (`three/addons/utils/SkeletonUtils.js`) | **Critical:** `Object3D.clone()` breaks skinned meshes. Always clone animated characters via SkeletonUtils. |
| UI | **HTML/CSS DOM overlay** | The dashboard, HP/AP bars, shop, inventory are 2D UI. DOM is faster to build/iterate than canvas UI. |
| State persistence | **`localStorage`** (JSON blob) | Meta-progression (currency, upgrades, perks) survives reloads. No backend needed. |
| Audio (later) | **Howler.js** or native `Audio` | Deferred to post-slice. |
| Tests | **Vitest** (logic) + **Playwright** (E2E/visual) | See §11. Use the `playwright-testing` skill for canvas/WebGL determinism. |

### 1.1 Project bootstrap (one-time)

```
npm create vite@latest . -- --template vanilla    # if scaffolding fresh; keep existing /public
npm install three
npm install -D vitest @playwright/test
```

`public/` already holds assets — Vite serves `public/` at the web root, so `assets.json`'s
`/assets/Toon Shooter/...` paths resolve **unchanged**. Do not move the asset folder.

> ⚠️ The asset folder is named **`Toon Shooter`** (with a space). URLs must be encoded
> (`/assets/Toon%20Shooter/...`) **or** referenced through the loader helper in §4 which encodes for you.
> Recommended: keep the literal path in `assets.json` and let the loader `encodeURI()` it.

---

## 2. Architecture Overview

A lightweight **module + manager** architecture (entity-component flavored, but not a full ECS — that
would be over-engineering for a single-lane runner). One `Game` orchestrator owns the systems; systems
own pools of entities.

```
                     ┌─────────────────────────────────────────────┐
                     │                  Game (FSM)                  │
                     │  states: LOADING→MENU→PLAYING→PAUSED→OVER    │
                     │  owns: clock, fixed-step accumulator         │
                     └───────────────┬─────────────────────────────┘
                                     │ update(dt)
        ┌───────────────┬────────────┼─────────────┬────────────────┬───────────────┐
        ▼               ▼            ▼             ▼                ▼               ▼
   InputController   Player    SpawnDirector   World/Scroll   CollisionSystem    HUD/UI
   (keyboard/mouse) (FSM+anim) (difficulty)   (parallax,      (AABB broadphase)  (DOM)
        │               │            │          ground)            │               ▲
        │               │            ▼             │                │               │
        │               │      ObstacleManager ────┤                │               │
        │               │      EnemyManager   ─────┤                │               │
        │               │      PickupManager  ─────┤                │               │
        │               └────▶ ProjectileManager ──┘                │               │
        │                            (object pools)                 │               │
        └──────────────────────────── events ──────────────────────┴───────────────┘
                          (score, damage, pickup, death → UI + meta)

   AssetManager (preloads + caches glTF, clones via SkeletonUtils)  ← used by all spawners
   SaveManager  (localStorage: currency, upgrades, perks)           ← used by Menu/Shop + run rewards
```

**Data flow per frame (PLAYING):**
`Input → Player intent → fixed-step physics (gravity/jump) → world scroll → spawn director →
move pooled entities → collisions → resolve (damage/pickup/kill) → animation mixers → UI sync → render.`

### 2.1 Directory layout

```
src/
  main.js                 # entry: boot Game, mount canvas + UI
  Game.js                 # state machine, fixed-step loop, system wiring
  config/
    constants.js          # CONFIG: speeds, gravity, lane Y, pool sizes (single source of truth)
    assets.js             # ASSET_KEYS → manifest lookup helpers
    weapons.js            # weapon table (damage, fireRate, apCost, projSpeed, model)
    spawnPatterns.js      # hand-authored obstacle/enemy chunks
  core/
    AssetManager.js       # GLTFLoader cache + SkeletonUtils clone
    InputController.js    # key/mouse state + edge events
    ObjectPool.js         # generic pool (from skill game-patterns)
    SaveManager.js        # localStorage load/save/migrate
    events.js             # tiny EventBus (pub/sub)
  world/
    Stage.js              # scene, camera, lights, renderer, resize
    Ground.js             # scrolling ground strip(s)
    Parallax.js           # background depth layers (trees, structures)
  entities/
    Player.js             # movement FSM, hitbox, weapon mount, anim state
    Enemy.js              # ground combatant behavior
    Hazmat.js             # elevated sniper behavior
    Projectile.js         # bullet (player + enemy variants)
    Obstacle.js           # trap/mine/wall/barrier wrappers
    Pickup.js             # health + scrap
  systems/
    SpawnDirector.js      # difficulty curve → emits spawn requests
    CollisionSystem.js    # AABB tests, dispatches hit events
    ScoreSystem.js        # distance, streak, currency this-run
  ui/
    Hud.js                # HP/AP/distance/streak (in-run, left overlay)
    ShopPanel.js          # upgrades/weapons (right panel, menu state)
    Menu.js               # start / game-over screens
    styles.css            # Pip-Boy green theme
  util/
    math.js, aabb.js
public/assets/...         # unchanged glTF pack
public/map/concept.png    # visual reference
```

---

## 3. World Model, Coordinates & Camera

### 3.1 Coordinate system (the contract every module obeys)

| Axis | Meaning | Range |
|---|---|---|
| **+X** | screen-right; projectile travel; "forward" | gameplay band ≈ `[-12, +14]` world units |
| **+Y** | up; jump arc; ground at `Y=0` | `[0, ~6]` |
| **+Z** | toward camera (depth) | gameplay plane fixed at `Z=0`; parallax at `Z<0` |

- **Player anchor X is fixed** (e.g. `PLAYER_X = -4`). The player only changes **Y** (jump) and
  **hitbox height** (crouch). It never translates on X.
- **World scrolls left:** every obstacle/enemy/pickup/ground tile does `position.x -= scrollSpeed * dt`.
- **Despawn** when `x < DESPAWN_X` (≈ `-14`); **spawn** at `SPAWN_X` (≈ `+14`, just off-screen right).
- **Distance travelled** (PRD "TRAVELLED: 354m") = `∫ scrollSpeed dt`, scaled to meters. Pure derived value.

### 3.2 Scale normalization

Low-poly packs ship at inconsistent scales. On load, **normalize each character to a target world
height** (e.g. player ≈ 2 units) by measuring its bounding box and applying a uniform scale. Props are
normalized to a reference (e.g. `BrickWall_1` ≈ 2 units tall so a jump clears it). This is done **once at
load** and baked into the cached prototype. (Pattern: `normalizeModel()` from the skill game-patterns ref.)

### 3.3 Camera & facing

- **Perspective camera, locked side-view** (per concept.png's slight depth), not OrbitControls.
  Start: `fov 45`, `position (PLAYER_X+2, 3, 14)`, `lookAt(PLAYER_X+2, 1.5, 0)`. Tune to frame the band.
- **Alternative:** Orthographic for pixel-true 2D. Default to **perspective** for the toon look; the
  camera module exposes both so we can switch with one flag if depth causes aim/collision confusion.
- glTF models face **−Z** by default. Rotate **+90° about Y** so the player faces **+X** (right);
  enemies rotate **−90°** to face **−X** (left). (Pattern from skill `normalizeModel(faceDirection)`.)

### 3.4 The split-viewport (concept.png)

16:9 frame. **Gameplay canvas occupies the left ~70%; the dashboard is a right-side DOM panel ~30%.**
Implement as a CSS grid: `grid-template-columns: 1fr 360px`. The Three.js canvas resizes to its grid
cell (not `window.innerWidth`) — the resize handler must read the **canvas container** size. The bottom
control strip (`SPACE: JUMP | CTRL: SNEAK | MOUSE1: ATTACK`) is a DOM footer.

---

## 4. Asset Pipeline & Loading

### 4.1 Manifest-driven loading

`assets.json` is the source of truth. `config/assets.js` exposes:

```js
import manifest from '../../assets.json';
const flat = indexByName(manifest);              // { Character_Soldier: {gltf, fbx, ...}, ... }
export const gltfUrl = (name) => encodeURI(flat[name].gltf);   // handles the space in "Toon Shooter"
```

### 4.2 AssetManager (load once, clone many)

- Use **one** `GLTFLoader`. Preload the **slice set** before `PLAYING` (loading screen):
  `Character_Soldier`, `Character_Enemy`, `Character_Hazmat`, the 3 starting guns, and the props the
  spawn patterns reference (`BearTrap_Open`, `Landmine`, `BrickWall_1`, `Barrier_Large`, `Health`,
  plus a few parallax props: `Structure_1`, `Tree_*`).
- **Cache the loaded `gltf`** keyed by name. Spawners request **clones**:
  - **Animated characters →** `SkeletonUtils.clone(gltf.scene)` (preserves skinning). Animations come
    from the shared `gltf.animations` array; each instance gets its own `AnimationMixer`.
  - **Static props →** `gltf.scene.clone()` is fine, but **share geometry/material** (don't deep-clone
    meshes) to keep draw calls/memory low. For high-count identical props consider `InstancedMesh` later.
- Provide `getCharacter(name)` → `{ root, mixer, actions }` and `getProp(name)` → `Object3D`.

### 4.3 Materials & lighting

Pack uses simple toon/standard materials + one `Fence` texture. Lighting per skill:
`AmbientLight(0.5)` + one `DirectionalLight` key from upper-front. Shadows **off for the slice**
(perf + complexity); enable a single shadow-casting directional light only if needed for grounding.

---

## 5. Entity Designs

### 5.1 Player (`entities/Player.js`) — the most important class

**Movement model: kinematic, fixed-step, deterministic.** Not physics-engine driven (Cannon is
overkill for one-axis jumping and would add nondeterminism). Manual gravity:

```
state: GROUNDED | JUMPING | CROUCHING | HIT | DEAD
y, vy
on jump (SPACE, edge-triggered, only if GROUNDED):
    vy = JUMP_VELOCITY; state = JUMPING
each fixed step:
    vy -= GRAVITY * h; y += vy * h
    if y <= 0: y = 0; vy = 0; if was JUMPING → GROUNDED (play Jump_Land)
crouch (CTRL held): hitbox height ×0.5, play slide pose; release restores
```

- **Ground check** is trivial (`y <= 0`) given the flat lane — no raycast needed, but expose a
  `isGrounded` flag (PRD §2.1) to gate jumps and prevent infinite air-jumps.
- **Hitbox** = AABB stored separately from the mesh (`{x,y,w,h}`), centered on the player. Crouch sets
  `h *= 0.5` and lowers center so the player passes under overhead props (PRD `Barrier_Large` overhead).
- **Weapon mount:** an `Object3D` child bone/anchor on the right hand; the active gun model is attached
  there. Swapping weapons (keys 1–3) swaps the attached model + the active `weapon` stats.
- **Animation state machine** (crossfade, from skill game-patterns):
  | Condition | Clip |
  |---|---|
  | grounded, not shooting | `Run` (or `Run_Gun` when armed) |
  | grounded, firing | `Run_Shoot` |
  | rising/falling | `Jump` / `Jump_Idle` |
  | just landed | `Jump_Land` (one-shot) |
  | crouching | slide pose (reuse `Idle`/`Run` scaled, or closest clip) |
  | hp ≤ 0 | `Death` (one-shot, clamp) |
  Shooting is a **transient layer**: fire briefly biases to `*_Shoot` then returns.

### 5.2 Enemy (`Character_Enemy`) — ground combatant

Spawns at `SPAWN_X`, moves left at `scrollSpeed + enemyClosingSpeed`. Periodically fires a left-traveling
projectile (enemy bullet pool). Dies on player projectile hit (`Death` clip, then despawn after clip).
Awards scrap + streak on kill.

### 5.3 Hazmat (`Character_Hazmat`) — elevated sniper

Instantiated **on platform props** (`Structure_1`) per PRD. Fires **downward-diagonal** projectiles at
the player's current position. Higher HP/threat. Same death/reward flow.

### 5.4 Projectiles (`entities/Projectile.js`) — pooled

One pool, two teams (`PLAYER` / `ENEMY`). Travel along a velocity vector (`+X` for player, computed
direction for enemies). Despawn off-screen or on hit. **Player projectiles can detonate `Landmine` /
`ExplodingBarrel`** (PRD strategic detonation) — treated as a projectile-vs-obstacle collision that
triggers an AoE.

### 5.5 Obstacles (`entities/Obstacle.js`) — pooled, data-driven

Single class parameterized by `type`; behavior table:

| Type (asset) | Collision effect | Player counter-play |
|---|---|---|
| `BearTrap_Open` | −HP, **break streak** | Jump over |
| `Landmine` | Detonate on touch **or** projectile → AoE −HP | Jump / shoot early |
| `BrickWall_1`, `Barrier_Large` | Block passage (solid) | Jump onto/over top AABB |
| `ExplodingBarrel` | Chain AoE when shot | Strategic detonation |
| (overhead variant) | Blocks upper band | **Crouch** under |

### 5.6 Pickups (`entities/Pickup.js`) — pooled

`Health` (+3 HP units, PRD §2.2) and `Scrap` (currency). Bob/rotate for readability (skill animation
patterns). Collected on AABB overlap → event → UI + run wallet.

---

## 6. Systems

### 6.1 SpawnDirector — controlled randomness, not chaos

**Chunk-based spawning** beats per-frame random rolls for fairness and testability:
- `config/spawnPatterns.js` defines hand-authored **chunks** (e.g. `["trap", gap, "wall", gap,
  "enemy+health"]`) that are guaranteed *fair* (always a valid jump/crouch/shoot solution).
- The director picks chunks weighted by **difficulty**, which ramps with distance: increase
  `scrollSpeed`, enemy density, and Hazmat frequency over time.
- All spawns go through **pools** (no `new` in the loop — see anti-patterns).

### 6.2 CollisionSystem — AABB, single lane

- Everything is an axis-aligned box on `Z=0`. Broadphase is trivial (single lane, few dozen entities):
  test player AABB vs each active obstacle/pickup/enemy-bullet; test player-bullets vs enemies/obstacles.
- Emits typed events (`player:hit`, `enemy:killed`, `pickup:health`, `pickup:scrap`,
  `mine:detonate`) on the EventBus. Resolution lives in listeners (Player, ScoreSystem, UI) — keeps the
  collision code pure and unit-testable.
- **Crouch correctness:** the player AABB used here is the *current* (possibly halved) box, so ducking
  genuinely avoids overhead hits.

### 6.3 ScoreSystem

Distance (meters), **streak kills** (reset by `BearTrap_Open` / taking damage per PRD), and
**this-run currency**. On death, run currency is committed to `SaveManager`.

### 6.4 Weapons (`config/weapons.js`)

Data table the Player reads; meta-upgrades mutate copies of these at run start:

```js
{ Pistol:  { damage, fireRate, apCost, projSpeed, model:'Pistol' },
  Shotgun: { damage, fireRate, apCost, projSpeed, pellets, spread, model:'Shotgun' },
  SMG:     { damage, fireRate, apCost, projSpeed, model:'SMG' }, ... }
```

`MOUSE1` fires the active weapon if `AP/ammo` available and `now - lastShot ≥ 1/fireRate`. Keys `1-3`
swap the active slot (3 pre-selected weapons from the loadout). **AP** regenerates slowly or per pickup
(tunable in `constants.js`).

---

## 7. Game Loop & Timing

**Fixed-timestep physics, variable-rate render** — guarantees identical jump arcs and collisions
regardless of frame rate (essential for fairness and for deterministic tests):

```js
const FIXED = 1/120;                 // physics step
let acc = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);   // clamp tab-away spikes
  if (state === PLAYING) {
    acc += dt;
    while (acc >= FIXED) { stepPhysics(FIXED); acc -= FIXED; }  // player, scroll, projectiles, collisions
  }
  mixers.forEach(m => m.update(dt));   // animation can run on render dt
  updateScreenEffects(dt);             // shake/flash/zoom (skill patterns)
  syncUI();
  renderer.render(scene, camera);      // via setAnimationLoop
}
```

- **Game FSM:** `LOADING → MENU → PLAYING ⇄ PAUSED → GAME_OVER → MENU`. Mixers keep updating in MENU
  (idle anims); physics only advances in PLAYING.
- **Juice** (use skill patterns, cheap and high-impact): camera shake on hits/explosions, screen flash
  on damage/near-miss, squash-&-stretch on jump/land, slow-mo on kill streaks.

---

## 8. UI / Meta-Progression / Persistence

### 8.1 In-run HUD (left overlay, DOM) — concept.png

HP bar, AP bar, `TRAVELLED: ###m`, `STREAK KILLS: ##`, active-weapon indicator. Updated from
events/`syncUI()`, not rebuilt each frame. Pip-Boy green theme in `ui/styles.css`.

### 8.2 Shop / Upgrades / Inventory (right panel, MENU state)

Weapon list, selected-weapon upgrade (damage/fire-rate/etc.), character (Scavenger/Hazmat) and
perks (concept.png). Spending currency mutates the persisted upgrade record.

### 8.3 SaveManager (localStorage)

```jsonc
{ "version": 1, "currency": 0,
  "upgrades": { "Pistol": { "damageLvl": 0, "fireRateLvl": 0 } },
  "perks": { "rad_resist": false, ... },
  "loadout": ["Pistol","Shotgun","SMG"],
  "best": { "distance": 0, "streak": 0 } }
```

Load on boot; write on shop purchase and on run end. Include a `version` for forward-compatible
migrations. Wrap in try/catch (private-mode / quota).

---

## 9. Implementation Plan (sequenced to de-risk early)

> Each milestone ends in something **runnable**. Don't start N+1 until N is visibly working.

**M0 — Skeleton (½ day).** Vite boots; `Stage.js` renders an empty scene with the fixed side camera,
lights, and a static ground plane. Resize handler ties canvas to the left grid cell. *Done = green frame.*

**M1 — Player on a treadmill (1 day).** Load `Character_Soldier` via AssetManager (SkeletonUtils clone),
normalize scale, face +X, play `Run`. Implement `Ground` scroll + parallax stub. Input + jump physics
(fixed-step) + `Jump`/`Jump_Land`. Crouch + hitbox shrink. *Done = a character running and jumping over a scrolling world.* **This is the vertical-slice spine.**

**M2 — One obstacle, one collision (½ day).** `Obstacle` pool + `CollisionSystem` AABB. Spawn a
`BrickWall_1`; jumping clears it, hitting it costs HP. Wire `Hud` HP. *Done = first real fail state.*

**M3 — Shooting & one enemy (1 day).** `Projectile` pool, weapon table, `MOUSE1` fire + `Run_Shoot`.
`Enemy` spawns, advances, dies on hit (`Death`), drops scrap. Enemy bullets damage player. *Done = combat loop.*

**M4 — Full hazard + pickup set (1 day).** `BearTrap_Open` (streak break), `Landmine`/`ExplodingBarrel`
(touch + shoot detonation), `Barrier_Large` overhead (crouch), `Health` pickup, `Hazmat` sniper on
`Structure_1`. *Done = PRD §2.2 interactions complete.*

**M5 — SpawnDirector + difficulty (½ day).** Chunk patterns, distance-based ramp, score/streak/distance
systems. *Done = a real endless run.*

**M6 — Meta-progression (1 day).** Menu, ShopPanel, SaveManager, weapon swap (1–3), upgrades/perks
applied at run start. *Done = the full PRD loop (run → spend → stronger run).*

**M7 — Juice & polish (ongoing).** Shake/flash/slow-mo/squash, parallax depth, audio, tuning pass.

*Critical path: M0→M1→M2→M3. Hitting M3 means the core is proven and the rest is content + UI.*

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Skinned-mesh clones break** (T-pose / no anim) | High | Mandatory `SkeletonUtils.clone`; per-instance `AnimationMixer`. Verify in M1. |
| Asset path has a **space** (`Toon Shooter`) | Med | `encodeURI()` in the loader helper; never hand-concatenate. |
| **Inconsistent model scales/origins** | Med | Normalize to target height + recenter at load (§3.2); add a debug `AxesHelper`/box overlay toggle. |
| Animation **clip names differ from expectation** | Med | Use partial-match `findAnimation()`; we verified names: `Run, Run_Gun, Run_Shoot, Jump, Jump_Idle, Jump_Land, Idle, Idle_Shoot, Walk, Walk_Shoot, Death`. |
| **Frame-rate-dependent physics** (unfair jumps) | High | Fixed-timestep accumulator (§7); clamp `dt`. |
| **GC stalls** from per-frame allocation | Med | Object pools for all spawned entities + reused vector temporaries. |
| **2D-on-3D aim/collision confusion** (perspective depth) | Med | Lock everything to `Z=0` for gameplay; collisions are pure 2D AABB; ortho-camera fallback flag. |
| Draw calls from many props | Low/Med | Share geometry/material on static clones; `InstancedMesh` for repeated parallax if needed. |
| **Canvas sizing** to grid cell (not window) | Low | Resize observer on the canvas container, not `window`. |
| localStorage unavailable/full | Low | try/catch; in-memory fallback; versioned schema. |

---

## 11. Testing & Verification Strategy

Use the **`playwright-testing`** skill (built for canvas/WebGL + deterministic input + screenshots).

- **Unit (Vitest):** pure logic — AABB intersection, jump-arc integration over fixed steps, difficulty
  curve, weapon fire-rate gating, SaveManager (de)serialization + migration, score/streak rules.
- **Deterministic harness:** expose `window.__game` with `seed`, `stepFrames(n)`, and state getters so
  Playwright can drive exact frames and assert positions/HP/score without timing flake. Seed all RNG.
- **E2E/visual (Playwright):** boot → loading completes → player visible; scripted input (jump clears
  wall, crouch passes overhead, shot kills enemy); screenshot key states; assert HUD text
  (`TRAVELLED`, HP, `STREAK`). Compare against `concept.png` framing for layout regressions.
- **Manual:** use the `verify` / `run` skills to launch the dev server and eyeball feel.

---

## 12. Asset → Gameplay Binding (authoritative mapping)

From `assets.json` (74 items). Slice uses the starred ★ set; the rest is content backlog.

| Gameplay role | glTF asset(s) | Notes |
|---|---|---|
| ★ Player | `Character_Soldier` | Animated; weapon-mounted. |
| ★ Ground enemy | `Character_Enemy` | Animated; left-moving, shoots. |
| ★ Sniper | `Character_Hazmat` | On `Structure_1`; diagonal-down fire. |
| ★ Starting guns | `Pistol`, `Shotgun`, `SMG` | Loadout slots 1–3. |
| Gun backlog | `AK, Revolver, Revolver_Small, ShortCannon, RocketLauncher, GrenadeLauncher, Sniper, Sniper_2, Knife_1/2, Shovel, Grenade, FireGrenade` | Unlockables / upgrades. |
| ★ Trap (streak-break) | `BearTrap_Open` | `BearTrap_Closed` = post-trigger swap. |
| ★ Mine | `Landmine` | Touch or shot detonation. |
| ★ Explosive prop | `ExplodingBarrel` (+`_Spilled`), `GasTank`, `GasCan` | Chain AoE. |
| ★ Solid wall | `BrickWall_1` (`_2`), `Barrier_Large`, `Barrier_Fixed/Single/Trash` | Jump over/onto. |
| ★ Health pickup | `Health` | +3 HP. |
| Other pickups | `Key` | Future (locked content/doors). |
| ★ Platform | `Structure_1` (`_2/3/4`), `WaterTank_Platform` | Hazmat perches. |
| ★ Parallax / set-dressing | `Tree_1..4`, `StreetLight`, `Sign`, `Debris_*`, `CardboardBoxes_*`, `Crate`, `Pallet*`, `Container_*`, `Tank`, `Debris_BrokenCar`, `Pipes`, `Fence*`, `MetalFence`, `TrafficCone`, `Sofa*`, `WoodPlanks`, `SackTrench*`, `TrashContainer*`, `WaterTank_Floor` | Non-colliding depth layers (or decorative cover). |

Scrap/currency has **no dedicated mesh** → use a small prop (`Key`-style) or a procedural emissive
coin/billboard. Decide in M3; doesn't block earlier milestones.

---

## 13. Tuning Constants (single source — `config/constants.js`)

Centralize every magic number so balancing is one file. Initial guesses (tune in playtests):

```js
export const CONFIG = {
  PLAYER_X: -4, GROUND_Y: 0, SPAWN_X: 14, DESPAWN_X: -14,
  SCROLL_SPEED_START: 6, SCROLL_SPEED_MAX: 14, SCROLL_RAMP_PER_M: 0.01,
  GRAVITY: 38, JUMP_VELOCITY: 13,           // tuned so a jump clears a ~2u wall
  CROUCH_HITBOX_SCALE: 0.5,
  PLAYER_HP: 30, HEALTH_PICKUP: 3,          // "3 grid units" (PRD)
  AP_MAX: 8, AP_REGEN_PER_S: 1,
  POOL: { projectiles: 64, obstacles: 24, enemies: 12, pickups: 16 },
  FIXED_STEP: 1/120, MAX_DT: 0.1,
  METERS_PER_UNIT: 1,
};
```

---

### TL;DR for implementers

1. Scaffold Vite + three; keep `public/assets` untouched (encode the space in URLs).
2. Build **M1 first**: treadmill world + animated player (SkeletonUtils clone + mixer FSM) + jump/crouch.
3. Everything gameplay is **2D AABB at Z=0**; the world scrolls, the player only moves in Y.
4. **Fixed-timestep** physics; **object pools** for all spawns; **DOM** for UI; **localStorage** for meta.
5. Drive features through the **EventBus**; keep collision pure and unit-tested.
6. Follow the milestone order — the critical path to "fun" is M0→M3.
```
