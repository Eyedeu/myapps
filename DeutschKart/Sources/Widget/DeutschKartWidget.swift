import SwiftUI
import WidgetKit

struct DeutschKartEntry: TimelineEntry {
    let date: Date
    let word: HistoryWord?
}

struct DeutschKartProvider: TimelineProvider {
    func placeholder(in context: Context) -> DeutschKartEntry {
        DeutschKartEntry(
            date: Date(),
            word: HistoryWord(de: "die Übung", tr: "alıştırma", example: "Tägliche Übung macht den Meister.", level: .a2)
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (DeutschKartEntry) -> Void) {
        completion(DeutschKartEntry(date: Date(), word: WordDiskStore.loadCurrentWord()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DeutschKartEntry>) -> Void) {
        let entry = DeutschKartEntry(date: Date(), word: WordDiskStore.loadCurrentWord())
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date()) ?? Date().addingTimeInterval(21_600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct DeutschKartWidget: Widget {
    static let kind = WidgetKinds.mainWidget

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: DeutschKartProvider()) { entry in
            DeutschKartWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("DeutschKart")
        .description("Almanca kelime, Türkçe karşılığı ve örnek cümle.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct DeutschKartWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: DeutschKartEntry

    var body: some View {
        switch family {
        case .systemSmall:
            smallLayout
        case .systemMedium:
            mediumLayout
        default:
            mediumLayout
        }
    }

    private var smallLayout: some View {
        Group {
            if let word = entry.word {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Almanca")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Spacer(minLength: 0)
                        Text(word.level.rawValue)
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.quaternary, in: Capsule())
                    }
                    Text(word.de)
                        .font(.headline.weight(.semibold))
                        .minimumScaleFactor(0.75)
                        .lineLimit(2)
                    Divider().opacity(0.35)
                    Text(word.tr)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .minimumScaleFactor(0.8)
                        .lineLimit(2)
                    Spacer(minLength: 0)
                    Button(intent: RefreshWordIntent()) {
                        Label("Yenile", systemImage: "arrow.clockwise")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("DeutschKart")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("Ana uygulamada Gemini API anahtarını kaydedin, sonra Yenile’ye basın.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                    Button(intent: RefreshWordIntent()) {
                        Label("Yenile", systemImage: "arrow.clockwise")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var mediumLayout: some View {
        Group {
            if let word = entry.word {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Kelime kartı")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Spacer(minLength: 0)
                            Text(word.level.rawValue)
                                .font(.caption2.weight(.bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.quaternary, in: Capsule())
                        }
                        Text(word.de)
                            .font(.title3.weight(.bold))
                            .minimumScaleFactor(0.75)
                            .lineLimit(2)
                        Text(word.tr)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.secondary)
                            .minimumScaleFactor(0.85)
                            .lineLimit(2)
                        Spacer(minLength: 0)
                        Button(intent: RefreshWordIntent()) {
                            Label("Yenile", systemImage: "arrow.clockwise")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Örnek")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(word.example)
                            .font(.footnote)
                            .italic()
                            .minimumScaleFactor(0.8)
                            .lineLimit(5)
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    Text("API anahtarı gerekli")
                        .font(.headline)
                    Text("Uygulamayı açın → Ayarlar → Google Gemini API anahtarını girin. Ardından burada Yenile’ye basın.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button(intent: RefreshWordIntent()) {
                        Label("Yenile", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.regular)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

#Preview(as: .systemSmall) {
    DeutschKartWidget()
} timeline: {
    DeutschKartEntry(
        date: .now,
        word: HistoryWord(
            de: "die Entscheidung",
            tr: "karar",
            example: "Das war eine schwierige Entscheidung.",
            level: .b1
        )
    )
}

#Preview(as: .systemMedium) {
    DeutschKartWidget()
} timeline: {
    DeutschKartEntry(
        date: .now,
        word: HistoryWord(
            de: "die Zusammenarbeit",
            tr: "iş birliği",
            example: "Erfolg entsteht oft durch gute Zusammenarbeit.",
            level: .b2
        )
    )
}
