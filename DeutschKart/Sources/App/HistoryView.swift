import SwiftUI

struct HistoryView: View {
    @State private var groups: [(level: CEFRLevel, words: [HistoryWord])] = []

    private var visibleGroups: [(level: CEFRLevel, words: [HistoryWord])] {
        groups.filter { !$0.words.isEmpty }
    }

    var body: some View {
        NavigationStack {
            Group {
                if visibleGroups.isEmpty {
                    ContentUnavailableView(
                        "Kayıt yok",
                        systemImage: "tray",
                        description: Text("Widget veya Kart sekmesinden gelen her kelime burada; seviye ve Almanca alfaya göre sıralı.")
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(visibleGroups, id: \.level) { group in
                            Section {
                                ForEach(group.words) { word in
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(word.de).font(.headline)
                                        Text("Türkçe: \(word.tr)").font(.subheadline).foregroundStyle(.secondary)
                                        Text(word.example).font(.footnote).italic()
                                    }
                                    .padding(.vertical, 4)
                                }
                            } header: {
                                Text(group.level.rawValue).font(.subheadline.weight(.semibold))
                            }
                        }
                    }
                }
            }
            .navigationTitle("Geçmiş")
            .onAppear(perform: reload)
            .refreshable { reload() }
        }
    }

    private func reload() {
        groups = WordDiskStore.historyGroupedAlphabetically()
    }
}

#Preview {
    HistoryView()
}
