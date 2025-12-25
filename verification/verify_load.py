
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Open local index.html
        cwd = os.getcwd()
        page.goto(f'file://{cwd}/index.html')

        # Verify title
        assert 'Crackeggs Quiz' in page.title()

        # Take initial screenshot of Intro
        page.screenshot(path='verification/1_intro.png')
        print('Screenshot 1 taken: Intro')

        # Click Intro Button to go to Menu
        page.click('#intro-btn')

        # Wait for the menu to appear by waiting for a specific element
        page.wait_for_selector('#next-btn')

        # Click Next (Intro Step 2)
        if page.locator('#intro-btn').inner_text() == "Let's Play":
             page.click('#intro-btn')

        # Wait for Menu
        page.wait_for_timeout(1000)
        page.screenshot(path='verification/2_menu.png')
        print('Screenshot 2 taken: Menu')

        # Check if questions loaded (indirectly via UI not crashing or showing unexpected state)
        # Note: Since it's local file access, loading might be instant or might be blocked by CORS if not careful,
        # but deferred scripts usually work in file:// protocol on some browsers, though sometimes limited.
        # However, Playwright with file:// is robust.

        # Attempt to start game
        page.click('#next-btn') # To Options
        page.wait_for_timeout(500)

        # In Options, verify Year Slider values are not defaults if loaded
        # Default minDbYear is 2000. Real data has 2021+.
        # We can check the text or attribute.

        page.screenshot(path='verification/3_options.png')
        print('Screenshot 3 taken: Options')

        # Click Start
        page.click('#start-btn')
        page.wait_for_timeout(1000)

        page.screenshot(path='verification/4_game.png')
        print('Screenshot 4 taken: Game')

        browser.close()

if __name__ == '__main__':
    run()
