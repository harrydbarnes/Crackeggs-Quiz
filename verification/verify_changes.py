from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Load the app
        page.goto("http://localhost:8080")

        # Wait for app to be ready
        page.wait_for_selector("#app")

        # If we are in menu (state persisted), reset
        if page.locator("h1").count() > 0:
            print("We are likely in menu or game. Resetting storage...")
            # localStorage.clear() cannot be called directly if strict CSP prevents eval?
            # Wait, page.evaluate executes in page context. CSP might block it.
            # But usually Playwright bypasses CSP for evaluate.
            # The error above was "Refused to evaluate a string as JavaScript".
            # That was likely wait_for_function using a string.

            try:
                page.evaluate("localStorage.clear()")
                page.reload()
                page.wait_for_selector("#app")
            except Exception as e:
                print("Failed to clear local storage via evaluate due to CSP?")
                print(e)
                # Manually click back if possible or proceed

        # Click through intro
        # Use selector that definitely exists in intro
        intro_btn = page.locator("#intro-btn")
        if intro_btn.is_visible():
             # We might need to wait for clickability if there are transitions
             intro_btn.click()
        else:
             print("Intro btn not visible? Content:")
             print(page.inner_html("#app"))

        # Wait for "Let's Play" text change
        # Instead of wait_for_function string, use locator assertion or polling
        try:
            # wait for text to be Let's Play
            page.locator("#intro-btn").get_by_text("Let's Play").wait_for(timeout=5000)
            page.locator("#intro-btn").click()
        except Exception as e:
            print("Failed waiting for Let's Play text")
            print(e)

            # If it failed, maybe we are already on Let's Play?
            if page.locator("#intro-btn", has_text="Let's Play").is_visible():
                 page.locator("#intro-btn").click()
            else:
                 pass

        # Step 1: Mode
        try:
            page.get_by_role("button", name="Next").click(timeout=5000)
        except:
            # Maybe we are already past it?
            print("Could not find Next button for Step 1")
            pass

        # Step 2: Name input - verify persistence (Test part 2)
        try:
            page.get_by_label("What should we call you?").fill("TestPlayer")
        except:
             print("Could not find name input. Dumping content:")
             print(page.inner_html("#app"))
             return

        # We need to ensure the oninput event fired and saved state.
        # Force a small wait.
        # We need to ensure the onchange event fires to save the state.
        # Blurring the input is more reliable than a fixed timeout.
        page.get_by_label("What should we call you?").blur()

        page.reload()

        # Verify persistence after reload
        # We need to navigate back to step 2.
        # Check if we are at intro again
        if page.locator("#intro-btn").is_visible():
            page.locator("#intro-btn").click()
            # Wait for animation
            page.wait_for_timeout(1000)
            page.locator("#intro-btn").click()
            page.get_by_role("button", name="Next").click()

        input_value = page.get_by_label("What should we call you?").input_value()
        print(f"Persisted Name: {input_value}")
        if input_value != "TestPlayer":
            print("FAILED: Name not persisted")

        page.screenshot(path="verification/step2_name.png")

        # Step 3: Settings - verify seed logic refactor (ensure no crash/error)
        page.get_by_role("button", name="Next").click()

        # Let's start the game to see the share button.
        page.get_by_role("button", name="Start Game").click()

        # Wait for game to load
        page.wait_for_selector(".card")

        # Verify Share Button exists
        share_btn = page.locator("#share-game-btn")
        if share_btn.count() > 0:
            print("Share button found in Game view")
        else:
            print("Share button NOT found in Game view")

        page.screenshot(path="verification/game_view.png")

        # Finish game to see Results view share button
        page.evaluate("setState({ view: 'results', scores: {'TestPlayer': 100}, players: ['TestPlayer'] })")

        page.wait_for_selector("#share-results-code")
        print("Share button found in Results view")

        page.screenshot(path="verification/results_view.png")

        browser.close()

if __name__ == "__main__":
    verify_changes()
