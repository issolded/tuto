import UIKit
import WebKit

/// `window.webkit.messageHandlers.tutoHaptic.postMessage(kind)` from the page
/// (`haptic()` in src/lib/nativeShell.js). Holds no reference back to the controller,
/// so registering it on the content controller makes no retain cycle.
final class HapticBridge: NSObject, WKScriptMessageHandler {
    static let name = "tutoHaptic"

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let kind = message.body as? String else { return }
        switch kind {
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "error": UINotificationFeedbackGenerator().notificationOccurred(.error)
        case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "selection": UISelectionFeedbackGenerator().selectionChanged()
        case "light": UIImpactFeedbackGenerator(style: .light).impactOccurred()
        default: break
        }
    }
}
