import SwiftUI
import WidgetKit

struct HomeView: View {
    @State private var current = WordDiskStore.loadCurrentWord()
    @State private var isLoading = false
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Widget ana ekranda kartı gösterir; kelimeler Gemini (\(GeminiWordClient.defaultModelId)) ile üretilir ve yalnızca bir kez geçmişe düşer.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let errorText {
                        Text(errorText)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    if let word = current {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Şu anki kart")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Spacer(minLength: 0)
                                Text(word.level.rawValue)
                                    .font(.caption.weight(.bold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(.quaternary, in: Capsule())
                            }
                            Text(word.de)
                                .font(.title2.weight(.bold))
                            Text(word.tr)
                                .font(.body)
                                .foregroundStyle(.secondary)
                            Text(word.example)
                                .font(.callout)
                                .italic()
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    } else {
                        ContentUnavailableView(
                            "Henüz kelime yok",
                            systemImage: "text.book.closed",
                            description: Text("Ayarlar’dan API anahtarını girin, ardından aşağıdan veya widget’taki Yenile ile ilk kelimeyi üretin.")
                        )
                        .frame(maxWidth: .infinity)
                    }

                    Button {
                        Task { await fetchNext() }
                    } label: {
                        if isLoading {
                            Label("Üretiliyor…", systemImage: "ellipsis.circle")
                        } else {
                            Label("Yeni kelime (yapay zekâ)", systemImage: "sparkles")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading)
                }
                .padding()
            }
            .navigationTitle("DeutschKart")
            .onAppear {
                current = WordDiskStore.loadCurrentWord()
            }
            .refreshable {
                current = WordDiskStore.loadCurrentWord()
            }
        }
    }

    @MainActor
    private func fetchNext() async {
        errorText = nil
        isLoading = true
        defer { isLoading = false }
        do {
            let word = try await NextWordService.fetchAndCommitNextWord()
            current = word
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetKinds.mainWidget)
        } catch {
            errorText = error.localizedDescription
        }
    }
}

#Preview {
    HomeView()
}
