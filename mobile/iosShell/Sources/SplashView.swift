import UIKit

/// App opening, design_handoff_app_opening (option D): mascot + "tuto" wordmark in a
/// row, bottom-aligned, centred on lilac. The mascot drops in on a spring, the
/// wordmark rises after it, then the splash fades into the site once it has loaded.
///
/// The launch screen is the lilac colour alone, not the lockup: the animation starts
/// from an empty screen, so a lockup on the launch screen would show, vanish and
/// come back.
final class SplashView: UIView {
    private let mascot = UIImageView(image: UIImage(named: "Mascot"))
    private let wordmark = UIImageView(image: UIImage(named: "Wordmark"))
    private let shownAt = Date()
    private var started = false
    private var leaving = false
    private let animated = !UIAccessibility.isReduceMotionEnabled

    /// Mascot spring (1.1 s) or wordmark (0.55 s delay + 0.6 s), whichever ends later.
    private var minimumTime: TimeInterval { animated ? 1.15 : 0.4 }

    private struct Metrics { let mascot: CGSize; let word: CGFloat; let gap: CGFloat; let lift: CGFloat }
    private static let phone = Metrics(mascot: CGSize(width: 78, height: 82), word: 72, gap: 10, lift: 4)
    private static let pad = Metrics(mascot: CGSize(width: 110, height: 116), word: 102, gap: 14, lift: 6)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor(named: "Splash") ?? .white
        for view in [mascot, wordmark] {
            view.contentMode = .scaleAspectFit
            addSubview(view)
        }
        if animated {
            mascot.alpha = 0
            mascot.transform = CGAffineTransform(translationX: 0, y: -40).scaledBy(x: 0.6, y: 0.6)
            wordmark.alpha = 0
            wordmark.transform = CGAffineTransform(translationX: 0, y: 10)
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    override func layoutSubviews() {
        super.layoutSubviews()
        let m = traitCollection.userInterfaceIdiom == .pad ? Self.pad : Self.phone
        let wordSize = wordmark.image.map { CGSize(width: m.word * $0.size.width / $0.size.height, height: m.word) } ?? .zero
        let width = m.mascot.width + m.gap + wordSize.width
        let height = max(m.mascot.height, wordSize.height + m.lift)
        let origin = CGPoint(x: (bounds.width - width) / 2, y: (bounds.height - height) / 2)
        let bottom = origin.y + height
        // Frames are set through bounds/center so the entrance transforms stay intact.
        mascot.bounds = CGRect(origin: .zero, size: m.mascot)
        mascot.center = CGPoint(x: origin.x + m.mascot.width / 2, y: bottom - m.mascot.height / 2)
        wordmark.bounds = CGRect(origin: .zero, size: wordSize)
        wordmark.center = CGPoint(x: origin.x + m.mascot.width + m.gap + wordSize.width / 2,
                                  y: bottom - m.lift - wordSize.height / 2)
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil, animated, !started else { return }
        started = true
        // Mascot: spring with overshoot (design: cubic-bezier(.3,1.5,.5,1), 1.1 s); opaque by 60 %.
        UIView.animate(withDuration: 1.1, delay: 0, usingSpringWithDamping: 0.55, initialSpringVelocity: 0) {
            self.mascot.transform = .identity
        }
        UIView.animate(withDuration: 0.66, delay: 0, options: [.curveEaseOut]) {
            self.mascot.alpha = 1
        }
        UIView.animate(withDuration: 0.6, delay: 0.55, options: [.curveEaseOut]) {
            self.wordmark.transform = .identity
            self.wordmark.alpha = 1
        }
    }

    /// Fades out once the entrance has played; `now` skips the wait (offline screen).
    func dismiss(now: Bool = false) {
        guard !leaving else { return }
        leaving = true
        let wait = now ? 0 : max(0, minimumTime - Date().timeIntervalSince(shownAt))
        UIView.animate(withDuration: now ? 0 : 0.3, delay: wait, options: [.curveEaseOut]) {
            self.alpha = 0
        } completion: { _ in
            self.removeFromSuperview()
        }
    }
}
