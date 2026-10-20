import SwiftUI
import TutoCore

struct PreviewState: Codable {
    struct Entry: Codable, Identifiable { let id: String; let label: String; let gems: Int; let timestamp: Int64 }
    struct Question: Codable { let id: String; let prompt: String; let choices: [String]; let answer: Int; let hint: String; let shapes: [Int] }
    struct Attempt: Codable { let selected: Int; let helped: Bool }
    struct Session: Codable { let id: String; let subject: String; let finished: Bool; let correctCount: Int; let independentCount: Int; let questions: [Question]; let attempts: [Attempt] }
    let balance: Int
    let selected: Int?
    let helped: Bool
    let feedback: Bool?
    let entries: [Entry]
    let session: Session?
    var question: Question? {
        guard let s = session else { return nil }
        let i = s.attempts.count - (feedback == nil ? 0 : 1)
        return s.questions.indices.contains(i) ? s.questions[i] : nil
    }
}
enum Page: String, CaseIterable { case home, gems, screen, style }
@MainActor final class Store: ObservableObject {
    @Published var state: PreviewState
    @Published var page: Page = .home
    @Published var practice = false
    @Published var notice: String?
    @Published var morph: Bool { didSet { defaults.set(morph, forKey: "morph") } }
    @Published var turkish: Bool { didSet { defaults.set(turkish, forKey: "turkish") } }
    @Published var name: String { didSet { defaults.set(String(name.prefix(30)), forKey: "name") } }
    private let defaults: UserDefaults
    private let engine: PreviewBridge
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-reset") { defaults.removePersistentDomain(forName: Bundle.main.bundleIdentifier!) }
        morph = defaults.object(forKey: "morph") as? Bool ?? true
        turkish = defaults.object(forKey: "turkish") as? Bool ?? true
        name = defaults.string(forKey: "name") ?? "Alex"
        let raw = defaults.string(forKey: "practice-v1") ?? ""
        if !raw.isEmpty { defaults.set(raw, forKey: "practice-backup") }
        engine = PreviewBridge(snapshot: raw)
        state = try! JSONDecoder().decode(PreviewState.self, from: Data(engine.snapshot().utf8))
    }
    func text(_ tr: String, _ en: String) -> String { turkish ? tr : en }
    private func save() {
        let raw = engine.snapshot()
        state = try! JSONDecoder().decode(PreviewState.self, from: Data(raw.utf8))
        defaults.set(raw, forKey: "practice-v1")
    }
    func start(_ subject: String) { engine.start(id: UUID().uuidString, subject: subject, seed: Int32.random(in: 0...Int32.max), turkish: turkish); save(); practice = true }
    func select(_ index: Int) { engine.select(index: Int32(index)); save() }
    func hint() { engine.hint(); save() }
    func check() { engine.check(timestamp: Int64(Date().timeIntervalSince1970 * 1000)); save() }
    func next() { engine.next(); save() }
    func redeem() {
        guard state.balance >= 20 else { return }
        engine.redeem(id: UUID().uuidString, timestamp: Int64(Date().timeIntervalSince1970 * 1000)); save()
        notice = text("15 dakikalık örnek istek kaydedildi. Ebeveyne gönderilmedi.", "A sample 15-minute request was saved. It was not sent to a parent.")
    }
}
