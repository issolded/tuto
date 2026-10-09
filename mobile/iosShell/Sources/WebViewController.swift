import AuthenticationServices
import Network
import UIKit
import WebKit

/// Loads the live web app. Everything that ships with a Vercel deploy (screens,
/// questions, the src/lib engine) reaches this app without an App Store release;
/// only what lives in this folder needs one.
final class WebViewController: UIViewController {
    private let site: URL
    private var webView: WKWebView!
    private let offline = OfflineView()
    private let splash = SplashView()
    private var failedURL: URL?
    private let monitor = NWPathMonitor()
    private var authSession: ASWebAuthenticationSession?
    private let edges = EdgeColorBridge()
    private let bottomStrip = UIView()

    init(site: URL) {
        self.site = site
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    deinit { monitor.cancel() }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        let paper = UIColor(named: "Paper") ?? .white
        view.backgroundColor = paper

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()   // keeps localStorage + the Supabase session between launches
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // The web app can tell it is inside the shell from "TutoShell/<version>" (src/lib/nativeShell.js).
        let os = ProcessInfo.processInfo.operatingSystemVersion.majorVersion
        config.applicationNameForUserAgent = "Version/\(os).0 Mobile/15E148 Safari/604.1 TutoShell/\(Shell.version)"
        config.userContentController.addUserScript(
            WKUserScript(source: Self.noZoomScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController.add(HapticBridge(), name: HapticBridge.name)
        config.userContentController.addUserScript(
            WKUserScript(source: EdgeColors.script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController.add(edges, name: EdgeColors.name)

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false   // a stray edge swipe would leave a session mid-question
        webView.isOpaque = false
        webView.backgroundColor = paper
        webView.scrollView.backgroundColor = paper
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }   // Safari → Develop → Simulator
        #endif

        // The page does not use viewport-fit=cover, so the shell keeps it inside the safe
        // area and paints the strips behind the status bar / home indicator in the page's colour.
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: guide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: guide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: guide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: guide.trailingAnchor),
        ])
        // The view's own colour fills the top strip (and the side strips in landscape);
        // a separate view fills the strip behind the home indicator.
        bottomStrip.backgroundColor = paper
        bottomStrip.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottomStrip)
        NSLayoutConstraint.activate([
            bottomStrip.topAnchor.constraint(equalTo: guide.bottomAnchor),
            bottomStrip.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            bottomStrip.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomStrip.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        edges.onChange = { [weak self] top, bottom in
            self?.view.backgroundColor = top
            self?.bottomStrip.backgroundColor = bottom
        }

        offline.translatesAutoresizingMaskIntoConstraints = false
        offline.isHidden = true
        offline.onRetry = { [weak self] in self?.retry() }
        view.addSubview(offline)
        NSLayoutConstraint.activate([
            offline.topAnchor.constraint(equalTo: view.topAnchor),
            offline.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            offline.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offline.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        splash.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(splash)
        NSLayoutConstraint.activate([
            splash.topAnchor.constraint(equalTo: view.topAnchor),
            splash.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            splash.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splash.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            DispatchQueue.main.async {
                guard let self, !self.offline.isHidden else { return }
                self.retry()
            }
        }
        monitor.start(queue: .global(qos: .utility))

        webView.load(URLRequest(url: site))
    }

    private func retry() {
        webView.load(URLRequest(url: failedURL ?? site))
    }

    private func isSite(_ url: URL) -> Bool {
        url.host == site.host && url.port == site.port
    }

    private static let offlineCodes: Set<Int> = [
        NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorTimedOut,
        NSURLErrorCannotFindHost, NSURLErrorCannotConnectToHost, NSURLErrorDNSLookupFailed,
        NSURLErrorInternationalRoamingOff, NSURLErrorDataNotAllowed,
    ]

    private func handle(_ error: Error) {
        let error = error as NSError
        if error.domain == NSURLErrorDomain, error.code == NSURLErrorCancelled { return }
        guard error.domain == NSURLErrorDomain, Self.offlineCodes.contains(error.code) else {
            splash.dismiss()   // some other failure: show what WebKit shows rather than a mascot forever
            return
        }
        splash.dismiss(now: true)
        let failing = error.userInfo[NSURLErrorFailingURLErrorKey] as? URL
        failedURL = failing.flatMap { isSite($0) ? $0 : nil } ?? webView.url ?? site
        offline.isHidden = false
    }

    /// Children may pinch by accident; the page's own viewport allows zoom.
    private static let noZoomScript = """
    (function () {
      var m = document.querySelector('meta[name=viewport]');
      if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
      m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    })();
    """
}

// MARK: - Navigation

extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, let scheme = url.scheme?.lowercased() else {
            return decisionHandler(.cancel)
        }
        switch scheme {
        case "about", "data", "blob":
            return decisionHandler(.allow)
        case "http", "https":
            break
        default:   // tg:, mailto:, tel: …
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        if url.path.hasSuffix("/auth/v1/authorize") {
            decisionHandler(.cancel)
            startOAuth(url)
            return
        }
        let mainFrame = action.targetFrame?.isMainFrame ?? true
        if !mainFrame || isSite(url) { return decisionHandler(.allow) }
        UIApplication.shared.open(url)   // other sites open in Safari, not inside the child's app
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        offline.isHidden = true
        splash.dismiss()
        failedURL = nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handle(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handle(error)
    }

    /// iOS kills the web process under memory pressure and leaves a blank view behind.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if webView.url == nil { webView.load(URLRequest(url: site)) } else { webView.reload() }
    }
}

// MARK: - Google sign-in

extension WebViewController: ASWebAuthenticationPresentationContextProviding {
    /// Google refuses OAuth inside embedded web views, so the authorize URL Supabase
    /// navigates to goes through the system sheet. The web app sets redirectTo to
    /// app.tuto.mobile://auth/<path>; the tokens come back in the fragment (implicit
    /// flow) and are handed to the page at the same path, where supabase-js reads them.
    private func startOAuth(_ url: URL) {
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: Shell.callbackScheme) { [weak self] callback, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.authSession = nil
                guard let callback, let target = self.siteURL(forCallback: callback) else { return }
                self.webView.load(URLRequest(url: target))
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = true   // no "wants to use supabase.co" prompt; the web view keeps the session
        authSession = session
        session.start()
    }

    private func siteURL(forCallback callback: URL) -> URL? {
        guard callback.host == "auth",
              let back = URLComponents(url: callback, resolvingAgainstBaseURL: false),
              var target = URLComponents(url: site, resolvingAgainstBaseURL: false) else { return nil }
        target.path = callback.path.isEmpty ? "/" : callback.path
        target.percentEncodedQuery = back.percentEncodedQuery
        target.percentEncodedFragment = back.percentEncodedFragment
        return target.url
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        view.window ?? ASPresentationAnchor()
    }
}

// MARK: - window.open and JS dialogs

extension WebViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if isSite(url) { webView.load(action.request) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    // Without these WKWebView drops window.alert/confirm/prompt silently.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: ShellText.ok, style: .default) { _ in completionHandler() })
        presentDialog(alert, otherwise: completionHandler)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: ShellText.cancel, style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: ShellText.ok, style: .default) { _ in completionHandler(true) })
        presentDialog(alert) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: ShellText.cancel, style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: ShellText.ok, style: .default) { [weak alert] _ in
            completionHandler(alert?.textFields?.first?.text)
        })
        presentDialog(alert) { completionHandler(nil) }
    }

    /// WebKit requires every completion handler to run exactly once, even when the alert can't be shown.
    private func presentDialog(_ alert: UIAlertController, otherwise fallback: @escaping () -> Void) {
        guard presentedViewController == nil, view.window != nil else { return fallback() }
        present(alert, animated: true)
    }
}
