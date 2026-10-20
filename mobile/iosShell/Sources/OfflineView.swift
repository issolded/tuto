import UIKit

/// Shown when the site can't be reached. It retries by itself as soon as the
/// network comes back (WebViewController watches the path).
final class OfflineView: UIView {
    var onRetry: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor(named: "Paper") ?? .white

        let mascot = UIImageView(image: UIImage(named: "Mascot"))
        mascot.contentMode = .scaleAspectFit
        mascot.heightAnchor.constraint(equalToConstant: 140).isActive = true

        let title = UILabel()
        title.text = ShellText.offlineTitle
        title.font = .systemFont(ofSize: 24, weight: .heavy).rounded
        title.textAlignment = .center
        title.numberOfLines = 0

        let body = UILabel()
        body.text = ShellText.offlineBody
        body.font = .systemFont(ofSize: 17, weight: .medium).rounded
        body.textColor = .secondaryLabel
        body.textAlignment = .center
        body.numberOfLines = 0

        var button = UIButton.Configuration.filled()
        button.title = ShellText.retry
        button.cornerStyle = .capsule
        button.baseBackgroundColor = UIColor(red: 0.30, green: 0.59, blue: 1.0, alpha: 1)   // --blue
        button.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 28, bottom: 14, trailing: 28)
        let retry = UIButton(configuration: button, primaryAction: UIAction { [weak self] _ in self?.onRetry?() })

        let stack = UIStackView(arrangedSubviews: [mascot, title, body, retry])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 14
        stack.setCustomSpacing(28, after: body)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: safeAreaLayoutGuide.centerYAnchor),
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: layoutMarginsGuide.trailingAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }
}

private extension UIFont {
    var rounded: UIFont {
        guard let descriptor = fontDescriptor.withDesign(.rounded) else { return self }
        return UIFont(descriptor: descriptor, size: pointSize)
    }
}
