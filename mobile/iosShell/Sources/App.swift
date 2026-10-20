import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        true
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = WebViewController(site: Shell.siteURL)
        window.makeKeyAndVisible()
        self.window = window
    }
}

enum Shell {
    /// Scheme the web app redirects OAuth back to while it runs inside the shell.
    /// Must match `oauthRedirect()` in src/lib/nativeShell.js and be allowed in
    /// Supabase → Authentication → URL Configuration (`app.tuto.mobile://**`).
    static let callbackScheme = "app.tuto.mobile"

    /// Production site from Info.plist (TUTO_WEB_URL in Config/Base.xcconfig).
    /// A launch argument overrides it for local work: `-TutoWebURL http://localhost:5173`.
    static var siteURL: URL {
        if let raw = UserDefaults.standard.string(forKey: "TutoWebURL"), let url = URL(string: raw) { return url }
        let raw = Bundle.main.object(forInfoDictionaryKey: "TutoWebURL") as? String ?? ""
        return URL(string: raw) ?? URL(string: "https://tuto-blue.vercel.app")!
    }

    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
    }
}

/// The handful of native strings the shell shows itself; everything else is the web app.
enum ShellText {
    private static let lang: String = {
        let code = Locale.preferredLanguages.first?.prefix(2).lowercased() ?? "en"
        return ["tr", "es"].contains(code) ? code : "en"
    }()

    private static func say(_ en: String, _ tr: String, _ es: String) -> String {
        switch lang {
        case "tr": return tr
        case "es": return es
        default: return en
        }
    }

    static var offlineTitle: String { say("No internet connection", "İnternet bağlantısı yok", "Sin conexión a internet") }
    static var offlineBody: String {
        say("Tuto will open by itself when you're back online.",
            "Bağlantı gelince Tuto kendiliğinden açılır.",
            "Tuto se abrirá solo cuando vuelva la conexión.")
    }
    static var retry: String { say("Try again", "Tekrar dene", "Reintentar") }
    static var ok: String { say("OK", "Tamam", "Aceptar") }
    static var cancel: String { say("Cancel", "Vazgeç", "Cancelar") }
}
