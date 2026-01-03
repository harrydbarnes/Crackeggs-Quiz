from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 480, 'height': 800}) # Mobile viewport
        page = context.new_page()

        # Load the app
        page.goto("http://localhost:8000/index.html")

        # --- Verify Button Corner Radius ---
        # 1. Intro Screen
        page.wait_for_selector("#intro-btn")
        intro_btn = page.locator("#intro-btn")

        # Verify initial text
        expect(intro_btn).to_have_text("Click me")

        # Check border-radius
        radius = intro_btn.evaluate("el => getComputedStyle(el).borderRadius")
        print(f"Intro Button Border Radius: {radius}")
        assert radius == "16px", f"Expected 16px border-radius, got {radius}"

        # Click to reveal "Let's Play"
        intro_btn.click()
        time.sleep(1) # Wait for animation
        expect(intro_btn).to_have_text("Let's Play")
        intro_btn.click()

        # 2. Menu Step 1 (Mode Selection)
        page.wait_for_selector("#next-btn")
        next_btn = page.locator("#next-btn")

        # Check border-radius for Next button
        radius_next = next_btn.evaluate("el => getComputedStyle(el).borderRadius")
        print(f"Next Button Border Radius: {radius_next}")
        assert radius_next == "16px", f"Expected 16px border-radius, got {radius_next}"

        # Take screenshot of buttons
        page.screenshot(path="verification/step1_buttons.png")

        # --- Verify Auto-Focus on Player Name Entry ---
        # Select Solo Mode (default) and click Next
        page.locator("#mode-solo").click()
        next_btn.click()

        # 3. Menu Step 2 (Player Name)
        # Wait for the view to transition
        page.wait_for_selector("#solo-name-input")

        # Check if input is focused
        # We need to wait a bit because of the setTimeout(..., 500)
        time.sleep(1.0)

        is_focused = page.evaluate("document.activeElement.id === 'solo-name-input'")
        print(f"Is Name Input Focused? {is_focused}")

        # Take screenshot of name entry
        page.screenshot(path="verification/step2_name_focus.png")

        assert is_focused, "Player name input should be focused automatically"

        print("Verification Successful!")
        browser.close()

if __name__ == "__main__":
    run()
