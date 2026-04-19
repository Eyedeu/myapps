import Foundation
import Security

public enum APIKeychainError: Error, LocalizedError {
    case missingAccessGroup
    case unexpectedStatus(OSStatus)

    public var errorDescription: String? {
        switch self {
        case .missingAccessGroup:
            return "Keychain erişim grubu bulunamadı."
        case .unexpectedStatus(let code):
            return "Keychain hatası: \(code)"
        }
    }
}

public enum APIKeychain {
    private static let service = "com.deutschkart.gemini"
    private static let account = "api_key"

    private static var accessGroup: String? {
        let value = Bundle.main.object(forInfoDictionaryKey: "KeychainAccessGroup") as? String
        return value?.isEmpty == false ? value : nil
    }

    public static func saveAPIKey(_ key: String) throws {
        guard let group = accessGroup else { throw APIKeychainError.missingAccessGroup }
        try deleteAPIKey()

        let data = Data(key.utf8)
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            kSecValueData as String: data
        ]
        query[kSecAttrAccessGroup as String] = group

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw APIKeychainError.unexpectedStatus(status) }
    }

    public static func readAPIKey() -> String? {
        guard let group = accessGroup else { return nil }

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        query[kSecAttrAccessGroup as String] = group

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public static func deleteAPIKey() throws {
        guard let group = accessGroup else { throw APIKeychainError.missingAccessGroup }

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        query[kSecAttrAccessGroup as String] = group

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw APIKeychainError.unexpectedStatus(status)
        }
    }
}
