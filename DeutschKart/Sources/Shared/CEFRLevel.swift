import Foundation

public enum CEFRLevel: String, Codable, CaseIterable, Comparable, Sendable {
    case a1 = "A1"
    case a2 = "A2"
    case b1 = "B1"
    case b2 = "B2"
    case c1 = "C1"
    case c2 = "C2"

    public static func parse(_ raw: String) -> CEFRLevel? {
        CEFRLevel(rawValue: raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased())
    }

    public var sortIndex: Int {
        switch self {
        case .a1: return 0
        case .a2: return 1
        case .b1: return 2
        case .b2: return 3
        case .c1: return 4
        case .c2: return 5
        }
    }

    public static func < (lhs: CEFRLevel, rhs: CEFRLevel) -> Bool {
        lhs.sortIndex < rhs.sortIndex
    }
}
