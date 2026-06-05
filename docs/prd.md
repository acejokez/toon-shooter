# Product Requirement Document (PRD): "Toon Shooter"
**File Context:** Core Specification Document for AI Coding Assistants & Engine Architecture  
**Target Architecture:** Web-based HTML5 2D Side-Runner via Three.js (WebGL)  
**Asset Framework:** Low-poly glTF Pipeline  

---

## 1. Executive Summary & Core Game Loop
"Toon Shooter" is a fast-paced, post-apocalyptic 2D endless side-scrolling runner designed for desktop web browsers. The game utilizes a low-poly 3D asset pipeline rendered on a constrained 2D spatial plane, blending runner physics with arcade shooting mechanics.

### 1.1 The Moment-to-Moment Loop
1. **Automated Sprint:** The player character automatically accelerates horizontally to the right across the screen.
2. **Hazard Mitigation:** The player uses split-second keyboard inputs to jump over floor traps, slide under high-altitude structures, or shoot incoming hostiles.
3. **Currency Ingestion:** The player collects scrap metal drops during live runs.
4. **Meta-Progression Upgrades:** Accumulated currency is spent inside menu layers to permanently increase weapon statistics and unlock perks, increasing survival distances on subsequent runs.

---

## 2. Controls & Core Gameplay Mechanics

### 2.1 Input Mapping Matrix
Implement the following keyboard and mouse event listeners within the primary input controller module:

*   **Jump (`SPACEBAR`):** Launches the player into a physics-driven vertical arc. Requires a standard raycast ground-check variable to prevent infinite airborne jumps.
*   **Sneak/Crouch (`CTRL`):** Instantly scales down the player's collision hit-box height by **50%**. Triggers a low-profile sliding animation to pass underneath overhead props.
*   **Attack/Shoot (`MOUSE1`):** Discharges the active firearm horizontally forward, spawning a projectile entity that travels along the positive X-axis. Consumes Action Points (AP) or ammunition.
*   **Hotkey Weapon Swap (`KEYS 1-3`):** Dynamically switches between three active weapons pre-selected in the workspace interface layout.

### 2.2 Asset-to-Gameplay Interaction Logic
Map the incoming asset pack array to the following strict object definitions:
*   **`Character_Soldier`:** Default player mesh container. Drives core run, jump, slide, and shoot structural states.
*   **`Character_Enemy`:** Ground combatant. Spawns off-screen right, moves dynamically left, and fires a horizontal bullet pool.
*   **`Character_Hazmat`:** Elevated tactical sniper. Instantiates explicitly on platform layers (`Structure_1`), shooting downward diagonally at the player.
*   **`BearTrap_Open`:** Fixed surface trap. Stepping on this instantly deducts player HP and breaks the current active Kill Streak count.
*   **`Landmine`:** Volatile explosive prop. Detonates on player touch OR when struck by a player projectile path (can be detonated strategically to clear near-by targets).
*   **`BrickWall_1` / `Barrier_Large`:** Solid structural obstacles. Block player passage completely; forcing a **Jump** command over or onto their upper bounding box surface.
*   **`Health`:** Pick-up asset. Restores 3 grid units to the active structural UI health display bar.

---

## 3. UI/UX Interface Architecture
Implement a split viewport paradigm matching the design layout specified in `concept.png`. The gameplay arena sits on the left side of a 16:9 frame, with user dashboard nodes and customization options fixed to the right-hand panel.

```text
+-----------------------------------------------------------------------+
|  [PORTRAIT]  STATUS         |   [SHOP]  OR  [UPGRADES]  |  (MINI-MAP) |
|  HP [=======]               |  (Robots)     (Workbench) |  [/\/\*-/\] |
|  AP [====]                  +---------------------------+-------------+
|                                                         | INVENTORY & |
|  TRAVELLED: 354m                                        | UPGRADES    |
|  STREAK KILLS: 12                                       | [Gun 1] [^] |
|                                                         | [Gun 2] [*] |
|   (Main 2D Side-Scrolling Gameplay Arena)               | [Gun 3] [ ] |
|                                                         |             |
|                                                         | CHARACTER   |
|   [Player]  ===> Bullets ===>  [Hazmat Enemy]           | [Scavenger] |
|  =====================================================  | [Hazmat]    |
|   [Trap]             [Mine]             [Barrier]       +-------------+
|                                                         | PERKS       |
|---------------------------------------------------------| [Perk1]     |
| [SPACE]: JUMP  |  [CTRL]: SNEAK  |  [MOUSE1]: ATTACK    | [Perk2]     |
+-----------------------------------------------------------------------+