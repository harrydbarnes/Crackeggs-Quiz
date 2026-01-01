from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080")

        # Verify intro page
        print("Verifying Intro Page...")
        page.screenshot(path="verification/1_intro.png")

        # Click "Click me" -> "Let's Play"
        # Wait for "Click me" text
        page.wait_for_selector("#intro-btn")
        btn = page.locator("#intro-btn")
        if btn.inner_text() == "Click me":
             print("Clicking 'Click me'...")
             btn.click()
             # Wait for text change
             page.get_by_role('button', name="Let's Play").wait_for()
             page.screenshot(path="verification/2_intro_transformed.png")

             # Click "Let's Play"
             print("Clicking 'Let's Play'...")
             btn.click()
             page.locator("#next-btn").wait_for() # Wait for the next view's button to be ready

        # Verify Menu Step 1 (Mode)
        print("Verifying Menu Step 1...")
        page.screenshot(path="verification/3_menu_step1.png")

        # Click Solo
        page.locator("#mode-solo").click()
        page.locator("#next-btn").click()
        page.locator("#solo-name-input").wait_for()

        # Verify Menu Step 2 (Name)
        print("Verifying Menu Step 2...")
        # Check default text clearing
        name_input = page.locator("#solo-name-input")
        print(f"Initial value: '{name_input.input_value()}'")

        # Focus to clear
        name_input.focus()
        print(f"After focus value: '{name_input.input_value()}'")

        page.screenshot(path="verification/4_menu_step2.png")

        page.locator("#step2-next-btn").click()
        page.locator("#start-btn").wait_for()

        # Verify Menu Step 3 (Settings)
        print("Verifying Menu Step 3...")
        page.screenshot(path="verification/5_menu_step3.png")

        # Check new button name "Let's Quiz!"
        start_btn = page.locator("#start-btn")
        print(f"Start button text: {start_btn.inner_text()}")

        # Start Game -> Countdown
        start_btn.click()

        # Capture countdown (it's 3 seconds, so catch one of them)
        page.locator("#countdown-overlay").wait_for()
        page.screenshot(path="verification/6_countdown.png")

        # Wait for game
        page.locator(".card").wait_for()
        page.screenshot(path="verification/7_game.png")

        # Verify Mute Button in Top Bar
        page.locator("#mute-btn").wait_for()
        print("Mute button found.")
        page.screenshot(path="verification/8_game_with_topbar.png")

        browser.close()

if __name__ == "__main__":
    verify_changes()
