// React-PDF monthly Wirkungsbericht.
// Editorial 1-pager: title, tenant, 5 KPI bullets, top questions, sparkline, footer.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Polyline,
  Line,
  Circle,
  Rect,
} from "@react-pdf/renderer";

export type MonthlyReportData = {
  tenantName: string;
  monthLabel: string; // "Mai 2026"
  generatedAt: string; // "16.05.2026"

  totalConversations: number;
  estimatedTimeSavedHours: number;
  estimatedMoneySavedEur: number;
  outsideHoursCount: number;
  totalLeadsFromChat: number;

  topQuestions: Array<{ question: string; count: number }>; // top 3 used
  topUnansweredQuestions?: Array<{ question: string; count: number }>;
  dailyBreakdown: Array<{ date: string; count: number }>;
};

// Corporate palette extracted from fusionaryai.de (Framer site):
// ink #0f0f0e · primärgrün #1a5c3a · secondary grün #2d7a52 · off-white #fafaf8
// border #e8e6e0 · greenSoft #e2ede8. Schwarz/weiß/off-white + Dunkelgrün.
const colors = {
  ink: "#0f0f0e",
  subtle: "#4a4a47",
  muted: "#888780",
  border: "#e8e6e0",
  green: "#1a5c3a",       // brand primärgrün (fusionaryai.de)
  greenSecondary: "#2d7a52",
  greenSoft: "#e2ede8",
  amber: "#85500b",
  amberSoft: "#faf3e6",
  amberBorder: "#ecdcc0",
  page: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: "40 44 38 44",
    backgroundColor: colors.page,
    color: colors.ink,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 14,
    marginBottom: 22,
  },
  brand: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.ink,
    letterSpacing: 1.4,
  },
  brandSub: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 3,
    letterSpacing: 0.6,
  },
  meta: {
    textAlign: "right",
    fontSize: 9,
    color: colors.muted,
  },
  titleEyebrow: {
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: "Times-Italic",
    color: colors.ink,
    marginBottom: 4,
    lineHeight: 1.15,
  },
  forTenant: {
    fontSize: 12,
    color: colors.subtle,
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 8,
    color: colors.green,
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  bulletBand: {
    backgroundColor: colors.greenSoft,
    borderRadius: 6,
    padding: "18 20 14 20",
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 9,
  },
  bulletMark: {
    width: 14,
    color: colors.green,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  bulletNumber: {
    fontFamily: "Helvetica-Bold",
    color: colors.ink,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: colors.ink,
    lineHeight: 1.4,
  },
  twoCol: {
    flexDirection: "row",
    gap: 28,
    marginTop: 26,
  },
  col: {
    flex: 1,
  },
  topQRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  topQText: {
    flex: 1,
    fontSize: 10,
    color: colors.subtle,
    paddingRight: 8,
  },
  topQCount: {
    fontFamily: "Helvetica-Bold",
    color: colors.ink,
    fontSize: 10,
  },
  chartCaption: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 6,
  },
  unansweredBand: {
    marginTop: 24,
    backgroundColor: colors.amberSoft,
    borderWidth: 0.5,
    borderColor: colors.amberBorder,
    borderRadius: 6,
    padding: "16 20 14 20",
  },
  unansweredHeading: {
    fontSize: 8,
    color: colors.amber,
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  unansweredIntro: {
    fontSize: 10,
    color: colors.subtle,
    lineHeight: 1.4,
    marginBottom: 10,
  },
  unansweredRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.amberBorder,
  },
  unansweredText: {
    flex: 1,
    fontSize: 10,
    color: colors.ink,
    paddingRight: 8,
  },
  unansweredCount: {
    fontFamily: "Helvetica-Bold",
    color: colors.amber,
    fontSize: 10,
  },
  unansweredHint: {
    fontSize: 9,
    color: colors.amber,
    marginTop: 8,
    fontFamily: "Helvetica-Oblique",
  },
  closing: {
    marginTop: 26,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closingTitle: {
    fontSize: 14,
    fontFamily: "Times-Italic",
    color: colors.green,
    marginBottom: 4,
  },
  closingBody: {
    fontSize: 10,
    color: colors.subtle,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: colors.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    letterSpacing: 0.4,
  },
});

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n));
}
function fmtHours(n: number): string {
  if (n < 1) return `${Math.round(n * 60)} Minuten`;
  return `${n.toFixed(1).replace(".", ",")} Stunden`;
}
function fmtEur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function Sparkline({
  data,
  width = 220,
  height = 56,
}: {
  data: Array<{ date: string; count: number }>;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return (
      <View>
        <Svg width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill="#fafaf8" />
        </Svg>
      </View>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  const stepX = width / (data.length - 1);
  const points = data
    .map((d, i) => {
      const x = i * stepX;
      const y = height - (d.count / max) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // last-point indicator
  const lastIdx = data.length - 1;
  const lastX = lastIdx * stepX;
  const lastY = height - (data[lastIdx].count / max) * (height - 8) - 4;

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} strokeWidth={0.5} stroke={colors.border} />
        <Polyline points={points} stroke={colors.green} strokeWidth={1.9} fill="none" />
        <Circle cx={lastX} cy={lastY} r={2.8} fill={colors.green} />
      </Svg>
    </View>
  );
}

export function MonthlyReport({ data }: { data: MonthlyReportData }) {
  const top3 = data.topQuestions.slice(0, 3);
  const unanswered = (data.topUnansweredQuestions ?? []).slice(0, 5);
  const maxDay = data.dailyBreakdown.reduce(
    (acc, d) => (d.count > acc.count ? d : acc),
    { date: "", count: 0 }
  );
  const maxDayLabel = maxDay.date
    ? new Date(maxDay.date).toLocaleDateString("de-DE", { day: "2-digit", month: "long" })
    : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>FUSIONARY AI</Text>
            <Text style={styles.brandSub}>Digitale Assistenz, die wirkt.</Text>
          </View>
          <View style={styles.meta}>
            <Text>Wirkungsbericht</Text>
            <Text>{data.monthLabel}</Text>
            <Text style={{ marginTop: 2 }}>Erstellt am {data.generatedAt}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.titleEyebrow}>WIRKUNGSBERICHT</Text>
        <Text style={styles.title}>Was Ihr digitaler Assistent geleistet hat.</Text>
        <Text style={styles.forTenant}>für {data.tenantName} · {data.monthLabel}</Text>

        {/* Bullets */}
        <Text style={styles.sectionHeading}>Im Überblick</Text>

        <View style={styles.bulletBand}>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletMark}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bulletNumber}>{fmtNumber(data.totalConversations)}</Text>
              {" Kundenanfragen automatisch bearbeitet."}
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletMark}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bulletNumber}>{fmtHours(data.estimatedTimeSavedHours)}</Text>
              {" Arbeitszeit für Ihr Team eingespart."}
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletMark}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bulletNumber}>{fmtEur(data.estimatedMoneySavedEur)}</Text>
              {" Personalkosten reduziert."}
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletMark}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bulletNumber}>{fmtNumber(data.outsideHoursCount)}</Text>
              {" Anfragen außerhalb Ihrer Öffnungszeiten beantwortet."}
            </Text>
          </View>
          <View style={[styles.bulletRow, { marginBottom: 0 }]}>
            <Text style={styles.bulletMark}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bulletNumber}>{fmtNumber(data.totalLeadsFromChat)}</Text>
              {" qualifizierte Leads in Ihr System eingespielt."}
            </Text>
          </View>
        </View>

        {/* Two columns: top questions + sparkline */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionHeading}>Häufigste Anliegen</Text>
            {top3.length === 0 ? (
              <Text style={{ fontSize: 10, color: colors.muted }}>
                In diesem Zeitraum noch keine Daten.
              </Text>
            ) : (
              top3.map((q, i) => (
                <View key={i} style={styles.topQRow}>
                  <Text style={styles.topQText}>
                    {i + 1}. {q.question.length > 56 ? q.question.slice(0, 54) + "…" : q.question}
                  </Text>
                  <Text style={styles.topQCount}>{q.count}×</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionHeading}>Tagesverlauf</Text>
            <Sparkline data={data.dailyBreakdown} />
            <Text style={styles.chartCaption}>
              {maxDayLabel
                ? `Spitzentag: ${maxDayLabel} mit ${maxDay.count} Anfragen`
                : "Verlauf der täglichen Anfragen"}
            </Text>
          </View>
        </View>

        {/* Unanswered questions — incentive to update the KB */}
        {unanswered.length > 0 && (
          <View style={styles.unansweredBand} wrap={false}>
            <Text style={styles.unansweredHeading}>Diese Fragen konnten wir noch nicht beantworten</Text>
            <Text style={styles.unansweredIntro}>
              Bei diesen Anliegen fehlten Ihrem Assistenten die Informationen. Wenn Sie diese
              Themen in Ihrer Wissensdatenbank ergänzen, beantwortet der Bot sie ab sofort
              automatisch — und fängt noch mehr Anfragen für Sie ab.
            </Text>
            {unanswered.map((q, i) => (
              <View key={i} style={styles.unansweredRow}>
                <Text style={styles.unansweredText}>
                  {q.question.length > 64 ? q.question.slice(0, 62) + "…" : q.question}
                </Text>
                <Text style={styles.unansweredCount}>{q.count}×</Text>
              </View>
            ))}
            <Text style={styles.unansweredHint}>
              → Tipp: Ergänzen Sie diese Themen unter „Wissensbasis" in Ihrem Dashboard.
            </Text>
          </View>
        )}

        {/* Closing */}
        <View style={styles.closing}>
          <Text style={styles.closingTitle}>Vielen Dank für Ihr Vertrauen.</Text>
          <Text style={styles.closingBody}>
            Ihr digitaler Assistent arbeitet still und zuverlässig im Hintergrund — Tag und Nacht.
            Wir freuen uns, Sie mit Fusionary AI dabei zu unterstützen, mehr Zeit für das zu haben,
            worauf es ankommt: Ihre Kundinnen und Kunden.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Fusionary AI</Text>
          <Text>info@fusionaryai.de · fusionaryai.de</Text>
        </View>
      </Page>
    </Document>
  );
}
