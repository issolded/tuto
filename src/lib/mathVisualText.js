// What a question's picture shows, in words, for the SVG's accessible name. An `role="img"` SVG
// hides every <text> inside it, so a two-way table or a pie's key was simply absent for a screen
// reader — the label used to repeat the question and nothing else.
//
// The rule is the structure, never the reading: category names, the key, the scale's range and
// step, which Venn region is shaded — but not the time on the clock, the level in the jug or the
// size of each slice, because those ARE the question. A description that reads the value out
// would turn "read the scale" into "repeat the number". Unknown kinds fall back to the question.
import { say } from './i18n.js'
import { trEk, trDist, dnum } from './mathTemplates.js'

const list = (xs, lang) => {
  const a = xs.map(String)
  if (a.length < 2) return a.join('')
  return `${a.slice(0, -1).join(', ')} ${say(lang, 'and', 've', 'y')} ${a[a.length - 1]}`
}

function describe(v, lang) {
  switch (v.kind) {
    case 'chart': {
      if (v.shape === 'pie') {
        return say(lang,
          `Pie chart cut into ${v.parts} equal parts by dashed lines. Slices: ${list(v.slices.map((s, i) => `${i + 1} ${s.label}`), lang)}.`,
          `Kesik çizgilerle ${v.parts} eşit parçaya bölünmüş daire grafiği. Dilimler: ${list(v.slices.map((s, i) => `${i + 1} ${s.label}`), lang)}.`,
          `Gráfico circular dividido en ${v.parts} partes iguales con líneas discontinuas. Porciones: ${list(v.slices.map((s, i) => `${i + 1} ${s.label}`), lang)}.`)
      }
      if (v.shape === 'bar' || v.shape === 'line') {
        const kind = v.shape === 'bar' ? say(lang, 'Bar chart', 'Sütun grafiği', 'Gráfico de barras') : say(lang, 'Line graph', 'Çizgi grafiği', 'Gráfico de líneas')
        return say(lang,
          `${kind} of ${v.unit} for ${list(v.labels, lang)}. The scale goes up in ${v.step}s.`,
          `${list(v.labels, lang)} için ${v.unit} ${kind.toLowerCase()}. Ölçek ${trDist(v.step)} ${trDist(v.step)} artıyor.`,
          `${kind} de ${v.unit} para ${list(v.labels, lang)}. La escala sube de ${v.step} en ${v.step}.`)
      }
      if (v.shape === 'table') {
        // A table is text already; it only needs to reach the reader. The "?" stays a "?".
        const rows = v.rows.map(r => `${r.label}: ${r.cells.map((c, i) => `${v.cols[i]} ${c ?? '?'}`).join(', ')}`)
        return `${say(lang, 'Table.', 'Tablo.', 'Tabla.')} ${rows.join('. ')}.`
      }
      if (v.shape === 'grid') return say(lang, `A shape on a grid of ${v.cols} by ${v.rows} squares.`, `${v.cols}${trEk(v.cols, 'dat')} ${v.rows} karelik ızgarada bir şekil.`, `Una figura en una cuadrícula de ${v.cols} por ${v.rows} cuadrados.`)
      return null
    }
    case 'venn':
      return say(lang,
        `Venn diagram with two circles: "${v.labels[0]}" and "${v.labels[1]}". The shaded part is ${{ left: 'only in the first circle', right: 'only in the second circle', both: 'where the circles overlap', outside: 'outside both circles' }[v.shade] ?? ''}.`,
        `İki daireli Venn şeması: "${v.labels[0]}" ve "${v.labels[1]}". Boyalı bölge ${{ left: 'yalnız birinci dairenin içi', right: 'yalnız ikinci dairenin içi', both: 'dairelerin kesiştiği yer', outside: 'iki dairenin de dışı' }[v.shade] ?? ''}.`,
        `Diagrama de Venn con dos círculos: «${v.labels[0]}» y «${v.labels[1]}». La parte sombreada está ${{ left: 'solo en el primer círculo', right: 'solo en el segundo círculo', both: 'donde se cruzan los círculos', outside: 'fuera de los dos círculos' }[v.shade] ?? ''}.`)
    case 'carroll': {
      const [r, c] = v.cell ?? []
      return say(lang,
        `Carroll diagram. Columns: "${v.cols.join('", "')}". Rows: "${v.rows.join('", "')}".${v.cell ? ` The marked box is in row "${v.rows[r]}" and column "${v.cols[c]}".` : ''}`,
        `Carroll şeması. Sütunlar: "${v.cols.join('", "')}". Satırlar: "${v.rows.join('", "')}".${v.cell ? ` İşaretli kutu "${v.rows[r]}" satırında, "${v.cols[c]}" sütununda.` : ''}`,
        `Diagrama de Carroll. Columnas: «${v.cols.join('», «')}». Filas: «${v.rows.join('», «')}».${v.cell ? ` La casilla marcada está en la fila «${v.rows[r]}» y la columna «${v.cols[c]}».` : ''}`)
    }
    case 'pictogram':
      return say(lang,
        `Pictogram for ${list(v.rows.map(r => r.label), lang)}. Each ${v.unit} stands for ${v.each}.`,
        `${list(v.rows.map(r => r.label), lang)} için resim grafiği. Her ${v.unit} ${v.each} demek.`,
        `Pictograma de ${list(v.rows.map(r => r.label), lang)}. Cada ${v.unit} vale ${v.each}.`)
    case 'tally':
      return say(lang, `Tally chart for ${list(v.rows.map(r => r.label), lang)}.`, `${list(v.rows.map(r => r.label), lang)} için çetele tablosu.`, `Tabla de conteo de ${list(v.rows.map(r => r.label), lang)}.`)
    case 'clock':
      return say(lang, 'An analogue clock with an hour hand and a minute hand.', 'Akrebi ve yelkovanı olan bir saat.', 'Un reloj de agujas con la aguja de las horas y la de los minutos.')
    case 'scale': {
      // Jugs and thermometers carry only a top and a step; the reading is never said.
      const step = dnum(v.minor, lang)
      if (v.min == null || v.max == null) return say(lang, `A scale; each small mark is ${step}.`, `Bir ölçek; her küçük çizgi ${step}.`, `Una escala; cada marca pequeña vale ${step}.`)
      return say(lang,
        `A scale from ${dnum(v.min, lang)} to ${dnum(v.max, lang)}; each small mark is ${step}.`,
        `${dnum(v.min, lang)}${trEk(v.min, 'abl')} ${dnum(v.max, lang)}${trEk(v.max, 'dat')} bir ölçek; her küçük çizgi ${step}.`,
        `Una escala de ${dnum(v.min, lang)} a ${dnum(v.max, lang)}; cada marca pequeña vale ${step}.`)
    }
    case 'coords':
    case 'plane':
      return say(lang,
        `A coordinate grid with the points ${list(v.points.map(p => p.label), lang)} marked.`,
        `Üzerinde ${list(v.points.map(p => p.label), lang)} noktaları işaretli bir koordinat ızgarası.`,
        `Una cuadrícula de coordenadas con los puntos ${list(v.points.map(p => p.label), lang)} marcados.`)
    case 'spinner':
      return say(lang, `A spinner with ${v.sectors.length} equal parts.`, `${v.sectors.length} eşit parçalı bir çark.`, `Una ruleta con ${v.sectors.length} partes iguales.`)
    case 'route':
      return say(lang, `A road map through ${list(v.towns, lang)}.`, `${list(v.towns, lang)} arasından geçen bir yol haritası.`, `Un mapa de carreteras por ${list(v.towns, lang)}.`)
    default:
      return null
  }
}

export function describeVisual(visual, lang, question) {
  let d = null
  try { d = visual ? describe(visual, lang) : null } catch { d = null }
  if (!d) return question
  return question ? `${question} ${d}` : d
}
