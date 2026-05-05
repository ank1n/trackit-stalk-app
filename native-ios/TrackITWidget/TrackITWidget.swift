import WidgetKit
import SwiftUI

// MARK: - Model

struct TrackITIssue: Codable {
    let id: String
    let name: String
    let identifier: String
    let sequenceId: Int
    let priority: String
    let targetDate: String?
}

// MARK: - Timeline Provider

struct Provider: TimelineProvider {
    private let appGroup = "group.ru.implica.trackit"

    func placeholder(in context: Context) -> Entry {
        Entry(date: Date(), issues: sample())
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), issues: readCached()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let entry = Entry(date: Date(), issues: readCached())
        let next = Date().addingTimeInterval(15 * 60) // refresh every 15 min
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    // The main app is expected to refresh this cache via:
    // UserDefaults(suiteName: "group.ru.implica.trackit")?.setValue(jsonData, forKey: "widget_my_tasks")
    // WidgetCenter.shared.reloadTimelines(ofKind: "TrackITMyTasks")
    private func readCached() -> [TrackITIssue] {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: "widget_my_tasks") else {
            return []
        }
        return (try? JSONDecoder().decode([TrackITIssue].self, from: data)) ?? []
    }

    private func sample() -> [TrackITIssue] {
        [
            TrackITIssue(id: "1", name: "Починить кнопку логина", identifier: "TRKIT", sequenceId: 42, priority: "high", targetDate: nil),
            TrackITIssue(id: "2", name: "Review PR #123", identifier: "TRKIT", sequenceId: 43, priority: "medium", targetDate: nil),
        ]
    }
}

struct Entry: TimelineEntry {
    let date: Date
    let issues: [TrackITIssue]
}

// MARK: - View

struct TrackITWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Мои задачи")
                .font(.caption).foregroundColor(.secondary)
                .textCase(.uppercase)
            if entry.issues.isEmpty {
                Spacer()
                Text("Нет задач на сегодня")
                    .font(.footnote).foregroundColor(.secondary)
                Spacer()
            } else {
                ForEach(entry.issues.prefix(4), id: \.id) { issue in
                    Link(destination: URL(string: "trackit://issue/\(issue.id)")!) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(color(for: issue.priority))
                                .frame(width: 6, height: 6)
                            Text("\(issue.identifier)-\(issue.sequenceId)")
                                .font(.caption2).fontWeight(.semibold)
                                .foregroundColor(.secondary)
                            Text(issue.name)
                                .font(.caption).lineLimit(1)
                                .foregroundColor(.primary)
                        }
                    }
                }
            }
        }
        .padding(12)
        .containerBackground(.background, for: .widget)
    }

    private func color(for priority: String) -> Color {
        switch priority {
        case "urgent": return .red
        case "high":   return .orange
        case "medium": return .yellow
        case "low":    return .green
        default:       return .gray
        }
    }
}

// MARK: - Widget declaration

@main
struct TrackITWidget: Widget {
    let kind: String = "TrackITMyTasks"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TrackITWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Мои задачи")
        .description("Активные задачи в TrackIT")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
