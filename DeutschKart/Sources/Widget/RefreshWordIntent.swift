import AppIntents
import WidgetKit

struct RefreshWordIntent: AppIntent {
    static var title: LocalizedStringResource = "Yenile"
    static var description = IntentDescription("Yapay zekâdan yeni bir Almanca kelime üretir (daha önce gösterilenleri tekrarlamaz).")

    func perform() async throws -> some IntentResult {
        _ = try await NextWordService.fetchAndCommitNextWord()
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKinds.mainWidget)
        return .result()
    }
}
