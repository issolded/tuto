import XCTest
@testable import TutoPreview
@MainActor final class StoreTests: XCTestCase {
    func testHintAndRewardSurviveRestartWithoutDoubleCredit() async throws {
        let defaults = UserDefaults(suiteName: UUID().uuidString)!
        let s = Store(defaults: defaults)
        s.start("MATH"); s.hint()
        let restored = Store(defaults: defaults)
        XCTAssertTrue(restored.state.helped)
        for _ in 0..<5 {
            let answer = try XCTUnwrap(restored.state.question).answer
            restored.select(answer); restored.check(); restored.check(); restored.next()
        }
        XCTAssertEqual(restored.state.balance, 10)
        XCTAssertEqual(restored.state.session?.independentCount, 4)
        let restarted = Store(defaults: defaults)
        restarted.check()
        XCTAssertEqual(restarted.state.balance, 10)
        XCTAssertEqual(restarted.state.entries.count, 1)
        restarted.redeem()
        XCTAssertEqual(restarted.state.balance, 10)
        restarted.morph = false
        XCTAssertFalse(Store(defaults: defaults).morph)
    }
    func testSecondPracticeFundsExactlyOneRequest() async {
        let s = Store(defaults: UserDefaults(suiteName: UUID().uuidString)!)
        for _ in 0..<2 {
            s.start("PATTERNS")
            for _ in 0..<5 { s.select(0); s.check(); s.next() }
        }
        XCTAssertEqual(s.state.balance, 20)
        s.redeem(); s.redeem()
        XCTAssertEqual(s.state.balance, 0)
        XCTAssertEqual(s.state.entries.count, 3)
    }
}
