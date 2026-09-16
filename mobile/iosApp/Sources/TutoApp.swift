import SwiftUI

@main struct TutoApp: App {
    @StateObject private var store = Store()
    var body: some Scene { WindowGroup { RootView().environmentObject(store).preferredColorScheme(.light) } }
}
struct Palette {
    let paper: Color; let accent: Color; let action: Color; let pastel: Color
    static let morph = Palette(paper: Color(red: 1, green: 0.97, blue: 0.91), accent: Color(red: 0.32, green: 0.15, blue: 0.81), action: Color(red: 0.91, green: 0.33, blue: 0.31), pastel: Color(red: 0.9, green: 0.86, blue: 1))
    static let classic = Palette(paper: Color(red: 0.96, green: 0.94, blue: 1), accent: Color(red: 0.25, green: 0.55, blue: 0.77), action: .orange, pastel: Color(red: 0.83, green: 0.93, blue: 1))
}
struct RootView: View {
    @EnvironmentObject var s: Store
    var p: Palette { s.morph ? .morph : .classic }
    var body: some View {
        GeometryReader { geometry in
            let wide = geometry.size.width >= 840
            HStack(spacing: 0) {
                if wide { VStack(alignment: .leading, spacing: 22) {
                    Text("tuto").font(.system(size: 42, weight: .black, design: .rounded))
                    Text(s.morph ? "/ Morph Studio" : "/ Classic")
                    navigation(vertical: true)
                    Spacer()
                    Mascot(morph: s.morph).frame(height: 150)
                    Text(s.text("Küçük adımlar. Büyük fikirler.", "Small steps. Big ideas."))
                }.padding(24).frame(width: 200).frame(maxHeight: .infinity).background(p.pastel) }
                VStack(spacing: 0) {
                    HStack {
                        if s.practice || s.page != .home {
                            Button { s.practice = false; s.page = .home } label: { Label(s.text("Ana sayfa", "Home"), systemImage: "arrow.left") }.accessibilityIdentifier("home")
                        } else { Text("tuto").font(.largeTitle.bold()) }
                        Spacer()
                        Button { s.practice = false; s.page = .gems } label: { Text("◆ \(s.state.balance)").bold().padding(12).background(p.pastel, in: Capsule()) }.accessibilityIdentifier("balance")
                    }.padding(.horizontal, 24).padding(.vertical, 12)
                    Text(s.text("ÖNİZLEME · Bu cihazdaki örnek çalışmalar ve Gem’ler", "PREVIEW · Sample practice and Gems on this device")).font(.caption).foregroundStyle(.secondary).padding(.horizontal)
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            if s.practice { practice(wide: wide) }
                            else { switch s.page {
                                case .home: home(wide: wide)
                                case .gems: gems
                                case .screen: screen
                                case .style: style
                            } }
                        }.padding(24).frame(maxWidth: 1160).frame(maxWidth: .infinity)
                    }
                    if !wide { navigation(vertical: false).padding(8).background(.white) }
                }
            }.background(p.paper).foregroundStyle(Color(red: 0.1, green: 0.08, blue: 0.25)).tint(p.accent)
        }
    }
    private func label(_ page: Page) -> String {
        switch page { case .home: return s.text("Keşfet", "Discover"); case .gems: return s.text("Gem’ler", "Gems"); case .screen: return s.text("Ekran", "Screen"); case .style: return s.text("Stilim", "My style") }
    }
    private func icon(_ page: Page) -> String {
        switch page { case .home: return "house.fill"; case .gems: return "diamond.fill"; case .screen: return "clock"; case .style: return "paintpalette.fill" }
    }
    @ViewBuilder private func navigation(vertical: Bool) -> some View {
        let layout = vertical ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12)) : AnyLayout(HStackLayout(spacing: 4))
        layout {
            ForEach(Page.allCases, id: \.self) { page in
                Button { s.practice = false; s.page = page } label: {
                    VStack(spacing: 5) { Image(systemName: icon(page)); Text(label(page)).font(.caption.bold()) }.frame(maxWidth: .infinity).frame(minHeight: 48)
                }.accessibilityIdentifier("nav-\(page.rawValue)")
            }
        }
    }
    private func card<Content: View>(_ color: Color = .white, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 16, content: content).frame(maxWidth: .infinity, alignment: .leading).padding(24).background(color, in: RoundedRectangle(cornerRadius: 28))
    }
    private func action(_ title: String, id: String, enabled: Bool = true, perform: @escaping () -> Void) -> some View {
        Button(action: perform) { Text(title).font(.headline).frame(maxWidth: .infinity).frame(minHeight: 52) }.buttonStyle(.borderedProminent).tint(p.action).disabled(!enabled).accessibilityIdentifier(id)
    }
    @ViewBuilder private func home(wide: Bool) -> some View {
        let layout = wide ? AnyLayout(HStackLayout(alignment: .top, spacing: 24)) : AnyLayout(VStackLayout(spacing: 20))
        layout {
            card(p.pastel.opacity(0.7)) {
                Text(s.text("Bugünü keşfet,\n\(s.name)!", "Make today\nyours, \(s.name)!")).font(.system(size: wide ? 40 : 32, weight: .black, design: .rounded))
                Text(s.text("Şekiller, sayılar ve büyük fikirler.", "Shapes, numbers and big ideas."))
                Mascot(morph: s.morph).frame(height: wide ? 250 : 180)
                Text(s.text("Öğren. Kazan. Birlikte planla.", "Learn. Earn. Plan together.")).bold()
            }
            VStack(spacing: 18) {
                card(Color.blue.opacity(0.1)) {
                    Text(s.text("123  Matematik", "123  Maths playground")).font(.title2.bold())
                    Text(s.text("20 içinde toplama ve çıkarma · 5 soru", "Addition and subtraction within 20 · 5 questions"))
                    action(s.text("Hadi başlayalım →", "Let's explore →"), id: "start-math") { s.start("MATH") }
                }
                card(Color.yellow.opacity(0.25)) {
                    Text(s.text("● ▲ ■  Örüntü oyunu", "● ▲ ■  Pattern play")).font(.title2.bold())
                    Text(s.text("Tekrar eden şekilleri keşfet · 5 soru", "Discover repeating shapes · 5 questions"))
                    action(s.text("Şekilleri keşfet →", "Play with shapes →"), id: "start-patterns") { s.start("PATTERNS") }
                }
                if s.state.session != nil {
                    Button(s.text("Son çalışmama dön", "Return to my practice")) { s.practice = true }.frame(minHeight: 48).accessibilityIdentifier("resume")
                }
            }.frame(maxWidth: .infinity)
        }
        card {
            Text(s.text("Bir sonraki küçük hedefin", "Your next little goal")).font(.title3.bold())
            Text(s.text("20 Gem → aileyle planlanan 15 dakika oyun isteği", "20 Gems → request 15 minutes of play with your family"))
            ProgressView(value: min(Double(s.state.balance) / 20, 1))
        }
    }
    @ViewBuilder private func practice(wide: Bool) -> some View {
        if let session = s.state.session {
            if session.finished && s.state.feedback == nil {
                card(p.pastel) {
                    Mascot(morph: s.morph).frame(height: 180)
                    Text(s.text("Bir keşif daha tamam!", "Another discovery complete!")).font(.largeTitle.bold()).accessibilityIdentifier("result")
                    Text("\(session.correctCount) / \(session.questions.count)").font(.system(size: 48, weight: .black))
                    Text(s.text("\(session.independentCount) soruyu yardımsız çözdün.", "You solved \(session.independentCount) questions independently."))
                    Text(s.text("Tamamladığın için +10 önizleme Gem’i", "+10 preview Gems for completing practice"))
                    action(s.text("Ana sayfaya dön", "Back to home"), id: "finish-home") { s.practice = false; s.page = .home }
                }
            } else if let q = s.state.question {
                let number = session.attempts.count + (s.state.feedback == nil ? 1 : 0)
                Text("\(number) / \(session.questions.count)").font(.headline).accessibilityIdentifier("question-number")
                ProgressView(value: Double(session.attempts.count), total: Double(session.questions.count))
                card {
                    Text(q.prompt).font(.system(size: wide ? 36 : 28, weight: .bold, design: .rounded))
                    if !q.shapes.isEmpty {
                        HStack { ForEach(Array(q.shapes.enumerated()), id: \.offset) { _, shape in ShapeTile(kind: shape).frame(maxWidth: .infinity).frame(height: wide ? 70 : 38) }; Text("?").font(.largeTitle.bold()) }.accessibilityElement(children: .combine)
                    }
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: wide ? 4 : 2), spacing: 14) {
                    ForEach(q.choices.indices, id: \.self) { i in
                        Button { s.select(i) } label: {
                            VStack { if !q.shapes.isEmpty { ShapeTile(kind: i).frame(height: 44).accessibilityHidden(true) }; Text(q.choices[i]).font(.title3.bold()) }.frame(maxWidth: .infinity).frame(minHeight: 94).padding(6).background(s.state.selected == i ? p.pastel : .white, in: RoundedRectangle(cornerRadius: 22)).overlay(RoundedRectangle(cornerRadius: 22).stroke(s.state.selected == i ? p.accent : .clear, lineWidth: 3))
                        }.disabled(s.state.feedback != nil).accessibilityIdentifier("answer-\(i)")
                    }
                }
                if let correct = s.state.feedback {
                    card(correct ? .green.opacity(0.15) : .orange.opacity(0.15)) {
                        Text(correct ? s.text("Harika, buldun!", "You found it!") : s.text("Birlikte öğreniyoruz. Cevap: \(q.choices[q.answer])", "We're learning together. Answer: \(q.choices[q.answer])")).font(.headline)
                        action(s.text("Devam →", "Continue →"), id: "next") { s.next() }
                    }
                } else {
                    action(s.text("Kontrol et", "Check"), id: "check", enabled: s.state.selected != nil) { s.check() }
                    Button(s.text("Bir ipucu göster", "Show me a hint")) { s.hint() }.frame(minHeight: 48).accessibilityIdentifier("hint")
                    if s.state.helped { card(p.pastel) { Text(q.hint).font(.title3) } }
                }
            }
        }
    }
    private var gems: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(s.text("Emeklerin burada", "Your efforts, collected")).font(.largeTitle.bold())
            card(p.pastel) {
                Text("◆ \(s.state.balance)").font(.system(size: 48, weight: .black))
                Text(s.text("Bu Gem’ler canlı hesabına aktarılmaz.", "Preview Gems are separate from your live account."))
                action(s.text("20 Gem ile 15 dakika iste", "Request 15 minutes for 20 Gems"), id: "redeem", enabled: s.state.balance >= 20) { s.redeem() }
                Text(s.text("Örnek istek cihazda kalır; ebeveyne gönderilmez ve uygulama kilidini açmaz.", "Sample requests stay on this device; they are not sent to a parent and do not unlock apps."))
                if let notice = s.notice { Text(notice).bold() }
            }
            ForEach(s.state.entries.reversed()) { e in
                card { HStack { VStack(alignment: .leading) {
                    Text(e.label == "MATH" ? s.text("Matematik", "Maths") : e.label == "PATTERNS" ? s.text("Örüntüler", "Patterns") : s.text("Oyun süresi isteği", "Play-time request"))
                    Text(Date(timeIntervalSince1970: Double(e.timestamp) / 1000), style: .date).font(.caption).foregroundStyle(.secondary)
                }; Spacer(); Text("\(e.gems > 0 ? "+" : "")\(e.gems) ◆").bold() } }
            }
        }
    }
    private var screen: some View {
        card {
            Text(s.text("Ekran zamanı", "Screen time")).font(.largeTitle.bold())
            Image(systemName: "hourglass").font(.system(size: 48)).foregroundStyle(p.accent)
            Text(s.text("Ebeveyninle birlikte planla", "Plan together with your parent")).font(.title2.bold())
            Text(s.text("Bu iOS önizlemesi kullanım süresini okumaz veya uygulamaları engellemez. Gem ile kaydedilen oyun istekleri yalnızca örnektir.", "This iOS preview does not read usage time or block apps. Play-time requests recorded with Gems are samples only."))
            Text(s.text("Apple Screen Time ve ebeveyn onayı bağlantısı sonraki aşamada geliştirilecek.", "Apple Screen Time and parent approval integration are planned for a later stage."))
        }
    }
    private var style: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(s.text("Senin Tuto’n, senin stilin", "Your Tuto, your style")).font(.largeTitle.bold())
            ForEach([false, true], id: \.self) { morph in
                Button { s.morph = morph } label: {
                    HStack { Mascot(morph: morph).frame(width: 72, height: 100); Text(morph ? "Morph Studio" : s.text("Klasik", "Classic")).font(.title2.bold()); Spacer(); Image(systemName: s.morph == morph ? "checkmark.circle.fill" : "circle") }.padding(16).frame(maxWidth: .infinity).background(.white, in: RoundedRectangle(cornerRadius: 24))
                }.accessibilityIdentifier(morph ? "theme-morph" : "theme-classic").accessibilityValue(s.morph == morph ? "selected" : "")
            }
            card {
                TextField(s.text("Adın", "Your name"), text: $s.name).textFieldStyle(.roundedBorder).accessibilityIdentifier("name")
                Toggle("Türkçe / English", isOn: $s.turkish).accessibilityIdentifier("language")
                Text(s.text("Tema seçimin ilerlemeni değiştirmez.", "Changing your theme keeps your progress."))
            }
        }
    }
}
struct ShapeTile: View {
    let kind: Int
    var body: some View {
        GeometryReader { g in
            let side = min(g.size.width, g.size.height)
            ZStack {
                switch kind % 4 {
                case 0: Circle().fill(.red)
                case 1: Polygon(sides: 3).fill(.blue)
                case 2: RoundedRectangle(cornerRadius: 4).fill(.yellow)
                default: Polygon(sides: 5).fill(.purple)
                }
            }.frame(width: side, height: side).frame(maxWidth: .infinity, maxHeight: .infinity)
        }.accessibilityLabel(["●", "▲", "■", "⬟"][kind % 4])
    }
}
struct Polygon: Shape {
    let sides: Int
    func path(in rect: CGRect) -> Path {
        Path { path in
            for i in 0..<sides {
                let angle = Double(i) * 2 * .pi / Double(sides) - .pi / 2
                let point = CGPoint(x: rect.midX + cos(angle) * rect.width / 2, y: rect.midY + sin(angle) * rect.height / 2)
                if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
            }
            path.closeSubpath()
        }
    }
}
struct Mascot: View {
    let morph: Bool
    var body: some View {
        GeometryReader { g in
            let size = min(g.size.width, g.size.height)
            ZStack {
                RoundedRectangle(cornerRadius: morph ? 30 : 50).fill(LinearGradient(colors: [morph ? .blue : .cyan, .indigo], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 116, height: 128)
                Capsule().fill(.blue).frame(width: 12, height: 45).rotationEffect(.degrees(20)).offset(x: 49, y: -72)
                Circle().fill(.blue).frame(width: 26, height: 26).offset(x: 58, y: -94)
                HStack(spacing: 12) { eye; eye }.offset(y: -10)
                Capsule().fill(.indigo).frame(width: 29, height: 16).overlay(Capsule().fill(.pink).frame(width: 16, height: 7).offset(y: 4)).offset(y: 32)
                Circle().fill(.yellow).frame(width: 23, height: 23).offset(x: -60, y: 37)
                Circle().fill(.yellow).frame(width: 23, height: 23).offset(x: 59, y: 25)
                RoundedRectangle(cornerRadius: 8).fill(.yellow).frame(width: 35, height: 37).offset(x: -81, y: 74)
                RoundedRectangle(cornerRadius: 8).fill(.red.opacity(0.7)).frame(width: 35, height: 37).offset(x: 81, y: 74)
            }.frame(width: 220, height: 220).scaleEffect(size / 220).frame(width: g.size.width, height: g.size.height)
        }.accessibilityLabel("Tuto")
    }
    private var eye: some View { Ellipse().fill(.white).frame(width: 32, height: 43).overlay(Ellipse().fill(.black).frame(width: 16, height: 25).overlay(Circle().fill(.white).frame(width: 6).offset(x: 3, y: -5))) }
}
