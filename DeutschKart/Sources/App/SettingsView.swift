import SwiftUI

struct SettingsView: View {
    @State private var apiKeyInput = ""
    @State private var hasSavedKey = false
    @State private var showBanner = false
    @State private var bannerText = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("Gemini API anahtarı", text: $apiKeyInput)
                        .textContentType(.password)
                        .autocorrectionDisabled()
                    Button("Kaydet") { saveKey() }
                        .disabled(apiKeyInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    if hasSavedKey {
                        Button("Anahtarı sil", role: .destructive) { deleteKey() }
                    }
                } header: {
                    Text("Google Gemini")
                } footer: {
                    Text("Model: \(GeminiWordClient.defaultModelId). Anahtar Keychain’de; widget yenilemede de kullanılır.")
                }
                Section {
                    Link("API anahtarı (AI Studio)", destination: URL(string: "https://aistudio.google.com/apikey")!)
                }
            }
            .navigationTitle("Ayarlar")
            .onAppear(perform: loadKeyState)
            .alert("Bilgi", isPresented: $showBanner) {
                Button("Tamam", role: .cancel) {}
            } message: {
                Text(bannerText)
            }
        }
    }

    private func loadKeyState() {
        if let existing = APIKeychain.readAPIKey(), !existing.isEmpty {
            hasSavedKey = true
            apiKeyInput = ""
        } else {
            hasSavedKey = false
        }
    }

    private func saveKey() {
        let trimmed = apiKeyInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try APIKeychain.saveAPIKey(trimmed)
            hasSavedKey = true
            apiKeyInput = ""
            bannerText = "Kaydedildi."
            showBanner = true
        } catch {
            bannerText = error.localizedDescription
            showBanner = true
        }
    }

    private func deleteKey() {
        do {
            try APIKeychain.deleteAPIKey()
            hasSavedKey = false
            apiKeyInput = ""
            bannerText = "Silindi."
            showBanner = true
        } catch {
            bannerText = error.localizedDescription
            showBanner = true
        }
    }
}

#Preview {
    SettingsView()
}
