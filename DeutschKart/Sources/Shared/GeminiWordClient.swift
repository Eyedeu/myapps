import Foundation

private struct GeminiGenerateRequest: Encodable {
    struct Part: Encodable {
        let text: String
    }

    struct Content: Encodable {
        let role: String
        let parts: [Part]
    }

    struct SystemInstruction: Encodable {
        let parts: [Part]
    }

    struct GenerationConfig: Encodable {
        let temperature: Double
        let responseMimeType: String
    }

    let systemInstruction: SystemInstruction
    let contents: [Content]
    let generationConfig: GenerationConfig
}

private struct GeminiGenerateResponse: Decodable {
    struct Candidate: Decodable {
        struct Content: Decodable {
            struct Part: Decodable {
                let text: String?
            }

            let parts: [Part]
        }

        let content: Content?
    }

    let candidates: [Candidate]?
}

private struct AIWordPayload: Decodable {
    let de: String
    let tr: String
    let example: String
    let level: String
}

public enum GeminiWordClientError: Error, LocalizedError {
    case emptyAPIKey
    case badResponse(Int)
    case badResponseWithMessage(Int, String)
    case decoding
    case invalidPayload

    public var errorDescription: String? {
        switch self {
        case .emptyAPIKey:
            return "API anahtarı boş."
        case .badResponse(let code):
            return "Gemini API yanıtı: \(code)"
        case .badResponseWithMessage(let code, let message):
            return "Gemini \(code): \(message)"
        case .decoding:
            return "Yanıt çözümlenemedi."
        case .invalidPayload:
            return "Model geçerli JSON üretmedi."
        }
    }
}

public enum GeminiWordClient {
    /// Google AI Studio / Gemini API — diğer uygulamalarınızla uyumlu önizleme modeli.
    public static let defaultModelId = "gemini-3.1-flash-lite-preview"

    private static func endpointURL(modelId: String) -> URL? {
        var c = URLComponents()
        c.scheme = "https"
        c.host = "generativelanguage.googleapis.com"
        c.path = "/v1beta/models/\(modelId):generateContent"
        return c.url
    }

    private static func stripMarkdownJSONFence(_ text: String) -> String {
        var t = text
        if t.hasPrefix("```") {
            t = t.replacingOccurrences(of: "```json", with: "")
            t = t.replacingOccurrences(of: "```", with: "")
        }
        return t.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Bazı yanıtlarda model `{` öncesinde kısa açıklama bırakabiliyor.
    private static func sliceFirstJSONObject(_ text: String) -> String {
        guard let start = text.firstIndex(of: "{"),
              let end = text.lastIndex(of: "}")
        else { return text }
        return String(text[start ... end])
    }

    public static func fetchNewWord(
        apiKey: String,
        excludeNormalizedGerman: Set<String>,
        modelId: String = defaultModelId
    ) async throws -> HistoryWord {
        let trimmed = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw GeminiWordClientError.emptyAPIKey }

        guard let url = endpointURL(modelId: modelId) else {
            throw GeminiWordClientError.decoding
        }

        let excludeSample = excludeNormalizedGerman.sorted().prefix(120).joined(separator: ", ")
        let systemText = """
        Du bist ein deutscher Sprachtrainer. Antworte NUR mit gültigem JSON (kein Markdown) exakt in dieser Form:
        {"de":"...","tr":"...","example":"...","level":"B1"}
        Regeln:
        - "de": genau EIN deutsches Wort oder eine kurze Wendung (max. 4 Wörter), sinnvoll mit Artikel falls Nomen.
        - "tr": türkische Übersetzung/Gegenstück, knapp.
        - "example": EIN natürlicher deutscher Beispielsatz, der "de" sinnvoll verwendet.
        - "level": genau einer von: A1,A2,B1,B2,C1,C2 (CEFR).
        Wiederhole KEINES dieser bereits gezeigten Lemmata (normalisiert kleingeschrieben): \(excludeSample)
        """

        let userText = "Gib mir jetzt genau ein neues JSON-Objekt. Keine Wiederholungen aus der Liste."

        let body = GeminiGenerateRequest(
            systemInstruction: .init(parts: [.init(text: systemText)]),
            contents: [
                .init(role: "user", parts: [.init(text: userText)])
            ],
            generationConfig: .init(temperature: 0.85, responseMimeType: "application/json")
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(trimmed, forHTTPHeaderField: "x-goog-api-key")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw GeminiWordClientError.badResponse(-1) }
        guard (200 ... 299).contains(http.statusCode) else {
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let err = obj["error"] as? [String: Any],
               let msg = err["message"] as? String {
                throw GeminiWordClientError.badResponseWithMessage(http.statusCode, msg)
            }
            throw GeminiWordClientError.badResponse(http.statusCode)
        }

        let decoded = try JSONDecoder().decode(GeminiGenerateResponse.self, from: data)
        let rawText = decoded.candidates?
            .first?
            .content?
            .parts
            .compactMap(\.text)
            .joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        let stripped = Self.sliceFirstJSONObject(Self.stripMarkdownJSONFence(rawText))
        guard let rawJSON = stripped.data(using: .utf8) else {
            throw GeminiWordClientError.decoding
        }

        let payload = try JSONDecoder().decode(AIWordPayload.self, from: rawJSON)
        let de = payload.de.trimmingCharacters(in: .whitespacesAndNewlines)
        let tr = payload.tr.trimmingCharacters(in: .whitespacesAndNewlines)
        let example = payload.example.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let level = CEFRLevel.parse(payload.level), !de.isEmpty, !tr.isEmpty, !example.isEmpty else {
            throw GeminiWordClientError.invalidPayload
        }

        if excludeNormalizedGerman.contains(HistoryWord.normalizedHeadword(de)) {
            throw GeminiWordClientError.invalidPayload
        }

        return HistoryWord(de: de, tr: tr, example: example, level: level, shownAt: Date())
    }
}
