import Foundation

public enum NextWordService {
    public static func fetchAndCommitNextWord(maxAttempts: Int = 4) async throws -> HistoryWord {
        guard let apiKey = APIKeychain.readAPIKey(), !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw GeminiWordClientError.emptyAPIKey
        }

        var lastError: Error = GeminiWordClientError.invalidPayload

        for _ in 0 ..< maxAttempts {
            let exclude = WordDiskStore.normalizedHeadwordsFromHistory()
            do {
                let word = try await GeminiWordClient.fetchNewWord(apiKey: apiKey, excludeNormalizedGerman: exclude)
                let key = HistoryWord.normalizedHeadword(word.de)
                if exclude.contains(key) { continue }
                do {
                    try WordDiskStore.addWordToHistory(word)
                } catch WordStoreError.duplicate {
                    continue
                }
                try WordDiskStore.saveCurrentWord(word)
                return word
            } catch {
                lastError = error
            }
        }

        throw lastError
    }
}
