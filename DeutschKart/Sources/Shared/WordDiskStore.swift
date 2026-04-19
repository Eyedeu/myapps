import Foundation

/// Kelime geçmişi ve widget’ın gösterdiği anlık kelime (App Group dosyaları).
public enum WordDiskStore {
    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    private static let lock = NSLock()

    private static func readHistoryFromDisk() -> [HistoryWord] {
        guard let url = AppGroupPaths.historyURL,
              let data = try? Data(contentsOf: url),
              let list = try? decoder.decode([HistoryWord].self, from: data)
        else { return [] }
        return list
    }

    public static func loadHistory() -> [HistoryWord] {
        lock.lock()
        defer { lock.unlock() }
        return readHistoryFromDisk()
    }

    public static func saveHistory(_ words: [HistoryWord]) throws {
        lock.lock()
        defer { lock.unlock() }
        guard let url = AppGroupPaths.historyURL else { throw WordStoreError.noContainer }
        let data = try encoder.encode(words)
        try data.write(to: url, options: [.atomic])
    }

    public static func addWordToHistory(_ word: HistoryWord) throws {
        lock.lock()
        defer { lock.unlock() }
        var list = readHistoryFromDisk()
        let key = HistoryWord.normalizedHeadword(word.de)
        if list.contains(where: { HistoryWord.normalizedHeadword($0.de) == key }) {
            throw WordStoreError.duplicate
        }
        list.append(word)
        guard let url = AppGroupPaths.historyURL else { throw WordStoreError.noContainer }
        let data = try encoder.encode(list)
        try data.write(to: url, options: [.atomic])
    }

    public static func normalizedHeadwordsFromHistory() -> Set<String> {
        lock.lock()
        defer { lock.unlock() }
        Set(readHistoryFromDisk().map { HistoryWord.normalizedHeadword($0.de) })
    }

    private static func readCurrentFromDisk() -> HistoryWord? {
        guard let url = AppGroupPaths.currentWordURL,
              let data = try? Data(contentsOf: url),
              let word = try? decoder.decode(HistoryWord.self, from: data)
        else { return nil }
        return word
    }

    public static func loadCurrentWord() -> HistoryWord? {
        lock.lock()
        defer { lock.unlock() }
        return readCurrentFromDisk()
    }

    public static func saveCurrentWord(_ word: HistoryWord) throws {
        lock.lock()
        defer { lock.unlock() }
        guard let url = AppGroupPaths.currentWordURL else { throw WordStoreError.noContainer }
        let data = try encoder.encode(word)
        try data.write(to: url, options: [.atomic])
    }

    /// Ana uygulama ve widget için: alfabetik (Almanca) sıra, seviye blokları sabit A1→C2.
    public static func historyGroupedAlphabetically() -> [(level: CEFRLevel, words: [HistoryWord])] {
        lock.lock()
        let all = readHistoryFromDisk()
        lock.unlock()

        let grouped = Dictionary(grouping: all, by: \.level)
        return CEFRLevel.allCases.map { level in
            let words = (grouped[level] ?? []).sorted {
                $0.de.localizedCaseInsensitiveCompare($1.de) == .orderedAscending
            }
            return (level, words)
        }
    }
}

public enum WordStoreError: Error, LocalizedError {
    case noContainer
    case duplicate

    public var errorDescription: String? {
        switch self {
        case .noContainer:
            return "App Group konteyneri bulunamadı. İmzalama ve App Group’u kontrol edin."
        case .duplicate:
            return "Bu kelime zaten geçmişte."
        }
    }
}
