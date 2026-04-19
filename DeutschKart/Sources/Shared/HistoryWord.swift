import Foundation

public struct HistoryWord: Codable, Equatable, Sendable, Identifiable {
    public let id: UUID
    public let de: String
    public let tr: String
    public let example: String
    public let level: CEFRLevel
    public let shownAt: Date

    public init(id: UUID = UUID(), de: String, tr: String, example: String, level: CEFRLevel, shownAt: Date = Date()) {
        self.id = id
        self.de = de
        self.tr = tr
        self.example = example
        self.level = level
        self.shownAt = shownAt
    }

    public static func normalizedHeadword(_ de: String) -> String {
        de.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
