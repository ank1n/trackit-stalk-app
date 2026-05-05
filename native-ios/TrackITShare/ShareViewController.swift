import UIKit
import Social
import UniformTypeIdentifiers

// MARK: - Share Extension: send selected text / url / image to TrackIT API.
// Uses App Group "group.ru.implica.trackit" to pick up the auth cookie that
// the main app writes into UserDefaults on login.

final class ShareViewController: SLComposeServiceViewController {

    private let appGroup = "group.ru.implica.trackit"
    private let apiBase = "https://trackit.implica.ru"
    private let workspace = "implica"
    // Default project for quick-add from share sheet — Tracy / TRKIT
    private let defaultProjectId = "c74892c9-5131-4804-9b07-41fcd30f3082"

    override func isContentValid() -> Bool {
        return !(contentText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    override func didSelectPost() {
        Task { await postIssue() }
    }

    override func configurationItems() -> [Any]! {
        return []
    }

    private func postIssue() async {
        let title = (contentText ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        var description = ""

        // Enrich description from shared URL, if any
        if let urls = await extractSharedURLs(), !urls.isEmpty {
            description = urls.map { $0.absoluteString }.joined(separator: "\n")
        }

        guard let cookie = sharedCookie() else {
            await showAlert(title: "Ошибка", message: "Нужна авторизация в приложении TrackIT")
            return
        }

        let url = URL(string: "\(apiBase)/api/workspaces/\(workspace)/projects/\(defaultProjectId)/issues/")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(cookie, forHTTPHeaderField: "Cookie")
        let body: [String: Any] = [
            "name": String(title.prefix(200)),
            "description_html": description.isEmpty ? "" : "<p>\(description)</p>",
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (_, response) = try await URLSession.shared.data(for: req)
            if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                extensionContext?.completeRequest(returningItems: nil)
                return
            }
            await showAlert(title: "Ошибка", message: "Не удалось создать задачу")
        } catch {
            await showAlert(title: "Ошибка", message: error.localizedDescription)
        }
    }

    private func sharedCookie() -> String? {
        guard let defaults = UserDefaults(suiteName: appGroup) else { return nil }
        return defaults.string(forKey: "trackit_session_cookie")
    }

    private func extractSharedURLs() async -> [URL]? {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return nil }
        var urls: [URL] = []
        for item in items {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    if let loaded = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil),
                       let url = loaded as? URL {
                        urls.append(url)
                    }
                }
            }
        }
        return urls
    }

    @MainActor
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .cancel) { _ in
            self.cancel()
        })
        present(alert, animated: true)
    }
}
