import UIKit
import WebKit

/// The page stays inside the safe area (it has no viewport-fit=cover), which leaves a
/// strip behind the status bar and one behind the home indicator. This reads the colour
/// the page actually paints at its top and bottom edge — a screen's own background, the
/// parent tab bar — and the shell paints the strips to match, so there is no seam.
enum EdgeColors {
    static let name = "tutoEdges"

    /// Polls rather than hooking routes: screens change their background without navigating
    /// (overlays, result cards). Two elementFromPoint calls every 300 ms cost nothing.
    static let script = """
    (function () {
      function paint(y) {
        var el = document.elementFromPoint(innerWidth / 2, y);
        while (el) {
          var c = getComputedStyle(el).backgroundColor, m = c.match(/[\\d.]+/g);
          if (m && (m.length < 4 || +m[3] > 0.9)) return c;
          el = el.parentElement;
        }
        return getComputedStyle(document.documentElement).backgroundColor;
      }
      var last = '';
      function tick() {
        if (!document.body) return;
        var v = paint(1) + '|' + paint(innerHeight - 1);
        if (v !== last) { last = v; window.webkit.messageHandlers.\(name).postMessage(v); }
      }
      setInterval(tick, 300); tick();
    })();
    """

    /// "rgb(239, 232, 250)" or "rgba(…)" → UIColor.
    static func parse(_ css: String) -> UIColor? {
        let parts = css.split(whereSeparator: { !"0123456789.".contains($0) }).compactMap { Double($0) }
        guard parts.count >= 3 else { return nil }
        return UIColor(red: parts[0] / 255, green: parts[1] / 255, blue: parts[2] / 255, alpha: 1)
    }
}

/// Weak hop so the content controller (which retains its handlers) doesn't retain the page.
final class EdgeColorBridge: NSObject, WKScriptMessageHandler {
    var onChange: ((UIColor, UIColor) -> Void)?

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? String else { return }
        let sides = body.split(separator: "|").map(String.init)
        guard sides.count == 2, let top = EdgeColors.parse(sides[0]), let bottom = EdgeColors.parse(sides[1]) else { return }
        onChange?(top, bottom)
    }
}
