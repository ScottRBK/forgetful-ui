import { expect, test } from '@playwright/test'

test('uses the real Forgetful elephant in the sidebar and browser tab', async ({ page }) => {
  await page.goto('/#/memories')

  const brand = page.locator('img[alt="Forgetful"]')
  await expect(brand).toBeVisible()
  await expect(brand).toHaveAttribute('src', /brand\/forgetful-128\.png/)
  const logo = await brand.evaluate((image: HTMLImageElement) => ({
    complete: image.complete,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }))
  expect(logo).toEqual({ complete: true, width: 128, height: 128 })

  const icons = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')).map((link) => ({
      href: link.href,
      sizes: link.sizes.value,
      type: link.type,
    })),
  )
  expect(icons.map((icon) => icon.href)).toEqual(
    expect.arrayContaining([expect.stringMatching(/brand\/favicon-32\.png$/)]),
  )
  expect(icons.map((icon) => icon.href)).toEqual(
    expect.arrayContaining([expect.stringMatching(/brand\/favicon-64\.png$/)]),
  )
  expect(icons.some((icon) => icon.href.endsWith('favicon.svg'))).toBe(false)

  for (const icon of icons) {
    const response = await page.request.get(icon.href)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('img[alt="Forgetful"]')).toBeVisible()
})
