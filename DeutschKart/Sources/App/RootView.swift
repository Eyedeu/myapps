import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Kart", systemImage: "rectangle.on.rectangle") }
            HistoryView()
                .tabItem { Label("Geçmiş", systemImage: "books.vertical") }
            SettingsView()
                .tabItem { Label("Ayarlar", systemImage: "key") }
        }
    }
}

#Preview {
    RootView()
}
