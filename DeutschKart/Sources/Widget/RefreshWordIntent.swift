import AppIntents
import WidgetKit

struct RefreshWordIntent: AppIntent {
    static var title: LocalizedStringResource = "Yenile"
    static var description = IntentDescription("Gemini ile yeni kelime üretir; geçmişe ekler.")

    func perform() async throws -> some IntentResult {
        _ = try await NextWordService.fetchAndCommitNextWord()
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKinds.mainWidget)
        return .result()
    }
}
