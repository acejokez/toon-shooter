import { test, expect } from '@playwright/test';

// Deterministic boot + core-loop smoke test (TDD §11).
test('boots, starts a run, and the loop advances', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  // Wait for assets to preload and the harness to be installed in MENU.
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, {
    timeout: 30000,
  });

  // Start a run and drive deterministic frames.
  await page.evaluate(() => {
    window.__game.setSeed(12345);
    window.__game.start();
  });
  expect(await page.evaluate(() => window.__game.state)).toBe('playing');

  // Step ~2s of fixed physics; distance must accrue.
  await page.evaluate(() => window.__game.stepFrames(240));
  const score = await page.evaluate(() => window.__game.getScore());
  expect(score.meters).toBeGreaterThan(0);

  // Jump leaves the ground.
  await page.evaluate(() => {
    window.__game.input.queueJump();
    window.__game.stepFrames(10);
  });
  const player = await page.evaluate(() => window.__game.getPlayer());
  expect(player.y).toBeGreaterThan(0);

  // Firing spawns a player projectile.
  await page.evaluate(() => {
    window.__game.input.setFiring(true);
    window.__game.stepFrames(5);
    window.__game.input.setFiring(false);
  });
  const counts = await page.evaluate(() => window.__game.counts());
  expect(counts.projectiles).toBeGreaterThan(0);

  await page.screenshot({ path: 'tests/e2e/__screenshots__/playing.png' });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('player lands on top of a platform (one-way collision)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, {
    timeout: 30000,
  });
  await page.evaluate(() => {
    window.__game.setSeed(3);
    window.__game.start();
  });
  const probe = await page.evaluate(() => window.__game.landingProbe());
  expect(probe.grounded).toBe(true);
  expect(probe.onPlatform).toBe(true);
  expect(probe.y).toBeCloseTo(1.1, 1); // rests on the platform top, not the floor
});

test('a passive run takes damage and ends in game over', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, {
    timeout: 30000,
  });

  await page.evaluate(() => {
    window.__game.setSeed(7);
    window.__game.start();
  });

  // Drive many fixed steps without dodging; the player runs into hazards.
  const startHp = await page.evaluate(() => window.__game.getPlayer().hp);
  await page.evaluate(() => {
    // Step up to ~60s of physics or until dead.
    for (let i = 0; i < 7200; i++) {
      window.__game.stepFrames(1);
      if (window.__game.getPlayer().hp <= 0) break;
    }
  });

  const player = await page.evaluate(() => window.__game.getPlayer());
  expect(player.hp).toBeLessThan(startHp); // hazards dealt damage
  expect(player.hp).toBe(0); // and eventually killed
  expect(player.state).toBe('dead');

  await page.screenshot({ path: 'tests/e2e/__screenshots__/dead.png' });
  expect(errors, errors.join('\n')).toEqual([]);
});
