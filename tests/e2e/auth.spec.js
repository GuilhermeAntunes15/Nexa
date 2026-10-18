import {test,expect} from "@playwright/test";
test("login mostra formulário",async({page})=>{await page.goto("/entrar");await expect(page.getByLabel(/e-mail/i)).toBeVisible();await expect(page.getByLabel(/senha/i)).toBeVisible();});
test("usuária deslogada não entra no app",async({page})=>{await page.goto("/app/feed");await expect(page).toHaveURL(/entrar/);});
