import { test, expect } from '@playwright/test';

// Longevity: drive a long run and confirm GPU memory stays bounded (no leak
// from parallax wrap / pool churn) and rendering continues.
test('long run stays stable and keeps rendering', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, {
    timeout: 30000,
  });
  await page.evaluate(() => {
    window.__game.setSeed(9);
    window.__game.start();
  });

  // ~40s of physics in chunks, letting RAF render between.
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.__game.stepFrames(600));
    await page.waitForTimeout(120);
  }

  const info = await page.evaluate(() => ({
    calls: window.__game._g.stage.renderer.info.render.calls,
    geometries: window.__game._g.stage.renderer.info.memory.geometries,
    textures: window.__game._g.stage.renderer.info.memory.textures,
    parallax: window.__game._g.parallax.items.length,
  }));
  console.log('LONGRUN', JSON.stringify(info));
  await page.screenshot({ path: 'tests/e2e/__screenshots__/longrun.png' });

  // Memory must stay bounded (the asset set is fixed; pools recycle).
  expect(info.geometries).toBeLessThan(200);
  expect(info.textures).toBeLessThan(80);
  expect(info.calls).toBeGreaterThan(0);
});
