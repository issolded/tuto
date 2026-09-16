import XCTest
final class PreviewUITests: XCTestCase {
    func testThemesPracticeRotationAndPersistence() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-reset"]; app.launch()
        tap(app.buttons["nav-style"], app)
        tap(app.buttons["theme-classic"], app)
        XCTAssertEqual(app.buttons["theme-classic"].value as? String, "selected")
        tap(app.buttons["theme-morph"], app)
        screenshot("Morph settings")
        tap(app.buttons["home"], app)
        XCUIDevice.shared.orientation = .landscapeLeft
        screenshot("Landscape home")
        XCUIDevice.shared.orientation = .portrait
        tap(app.buttons["start-math"], app)
        for _ in 0..<5 {
            tap(app.buttons["answer-0"], app); tap(app.buttons["check"], app); tap(app.buttons["next"], app)
        }
        XCTAssertTrue(app.staticTexts["result"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["balance"].label.contains("10"))
        screenshot("Practice completed")
        app.terminate(); app.launchArguments = []; app.launch()
        XCTAssertTrue(app.buttons["balance"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["balance"].label.contains("10"))
        tap(app.buttons["nav-style"], app)
        XCTAssertEqual(app.buttons["theme-morph"].value as? String, "selected")
    }
    private func tap(_ element: XCUIElement, _ app: XCUIApplication) {
        XCTAssertTrue(element.waitForExistence(timeout: 10))
        for _ in 0..<5 { if element.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(element.isHittable); element.tap()
    }
    private func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
}
