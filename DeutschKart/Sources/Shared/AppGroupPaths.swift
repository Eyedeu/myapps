import Foundation

public enum AppGroupPaths {
    public static let suiteId = "group.com.deutschkart.shared"

    public static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteId)
    }

    public static var currentWordURL: URL? {
        containerURL?.appendingPathComponent("current_word.json", isDirectory: false)
    }

    public static var historyURL: URL? {
        containerURL?.appendingPathComponent("word_history.json", isDirectory: false)
    }
}
