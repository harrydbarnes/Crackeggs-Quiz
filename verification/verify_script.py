from playwright.sync_api import sync_playwright

def verify_changes(headless, url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        page.goto(url)

        # Verify intro page
        print("Verifying Intro Page...")
        page.screenshot(path="verification/1_intro.png")

        # Click "Click me" -> "Let's Play"
        # Wait for "Click me" text
        page.wait_for_selector("#intro-btn")
        btn = page.locator("#intro-btn")

        assert btn.inner_text() == "Click me", "Intro button text mismatch"
        print("Clicking 'Click me'...")
        btn.click()

        # Wait for text change
        let_play_btn = page.get_by_role('button', name="Let's Play")
        let_play_btn.wait_for()
        assert let_play_btn.is_visible(), "Let's Play button not visible"
        page.screenshot(path="verification/2_intro_transformed.png")

        # Click "Let's Play"
        print("Clicking 'Let's Play'...")
        let_play_btn.click()
        page.locator("#next-btn").wait_for()

        # Verify Menu Step 1 (Mode)
        print("Verifying Menu Step 1...")
        page.screenshot(path="verification/3_menu_step1.png")
        assert page.locator("#mode-solo").is_visible(), "Solo mode button missing"

        # Click Solo
        page.locator("#mode-solo").click()
        page.locator("#next-btn").click()
        page.locator("#solo-name-input").wait_for()

        # Verify Menu Step 2 (Name)
        print("Verifying Menu Step 2...")
        # Check default text clearing
        name_input = page.locator("#solo-name-input")
        assert name_input.input_value() == "", f"Expected empty string (placeholder used), got '{name_input.input_value()}'"
        assert name_input.get_attribute("placeholder") == "Player 1", "Placeholder mismatch"

        page.screenshot(path="verification/4_menu_step2.png")

        page.locator("#step2-next-btn").click()
        page.locator("#start-btn").wait_for()

        # Verify Menu Step 3 (Settings)
        print("Verifying Menu Step 3...")
        page.screenshot(path="verification/5_menu_step3.png")

        # Check new button name "Let's Quiz!"
        start_btn = page.locator("#start-btn")
        assert start_btn.inner_text() == "Let's Quiz!", f"Expected 'Let's Quiz!', got '{start_btn.inner_text()}'"

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
