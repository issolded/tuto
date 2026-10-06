// The curriculum's topic names, in the parent's language. src/lib/gemini.js (BRITISH_CURRICULUM) keeps
// one English `name` per topic and the child screens never show it, so the only place a topic is
// named to anyone is a message to the parent — which has to follow prefs.language like the rest of
// the sentence, or a Turkish parent reads "…Fractions and Decimals konusuna ağırlık vereceğim".
// Keyed by the year-scoped curriculum id; an id missing here falls back to the English name, so a
// topic added to the curriculum reads in English until it is added below (the test in
// scripts/tests/math-review.test.mjs fails until it is).
const T = {
  y1_place_value:     ['Numbers to 100', '100’e kadar sayılar', 'Números hasta el 100'],
  y1_addition:        ['Addition within 20', '20 içinde toplama', 'Sumas hasta el 20'],
  y1_subtraction:     ['Subtraction within 20', '20 içinde çıkarma', 'Restas hasta el 20'],
  y1_fractions:       ['Half and Quarter', 'Yarım ve çeyrek', 'Mitad y cuarto'],
  y1_measurement:     ['Measurement', 'Ölçme', 'Medidas'],
  y1_shapes:          ['Shapes', 'Şekiller', 'Formas'],
  y2_place_value:     ['Numbers to 100', '100’e kadar sayılar', 'Números hasta el 100'],
  y2_addition:        ['Addition within 100', '100 içinde toplama', 'Sumas hasta el 100'],
  y2_subtraction:     ['Subtraction within 100', '100 içinde çıkarma', 'Restas hasta el 100'],
  y2_multiplication:  ['Multiplication: 2, 5 and 10 tables', 'Çarpma: 2, 5 ve 10’un çarpım tabloları', 'Multiplicación: tablas del 2, 5 y 10'],
  y2_division:        ['Division: 2, 5 and 10', 'Bölme: 2, 5 ve 10', 'División: 2, 5 y 10'],
  y2_fractions:       ['Fractions: ½ ⅓ ¼ ¾', 'Kesirler: ½ ⅓ ¼ ¾', 'Fracciones: ½ ⅓ ¼ ¾'],
  y2_money:           ['Money', 'Para', 'Dinero'],
  y2_time:            ['Time', 'Saat ve zaman', 'La hora y el tiempo'],
  y2_statistics:      ['Data and Charts', 'Veri ve grafikler', 'Datos y gráficos'],
  y3_place_value:     ['Numbers to 1000', '1000’e kadar sayılar', 'Números hasta el 1000'],
  y3_addition:        ['Addition up to 3 digits', '3 basamağa kadar toplama', 'Sumas de hasta 3 cifras'],
  y3_subtraction:     ['Subtraction up to 3 digits', '3 basamağa kadar çıkarma', 'Restas de hasta 3 cifras'],
  y3_multiplication:  ['Multiplication: 3, 4 and 8 tables', 'Çarpma: 3, 4 ve 8’in çarpım tabloları', 'Multiplicación: tablas del 3, 4 y 8'],
  y3_division:        ['Division using known tables', 'Bilinen tablolarla bölme', 'División con las tablas conocidas'],
  y3_fractions:       ['Fractions and Tenths', 'Kesirler ve onda birler', 'Fracciones y décimas'],
  y3_measurement:     ['Measurement', 'Ölçme', 'Medidas'],
  y3_time:            ['Time', 'Saat ve zaman', 'La hora y el tiempo'],
  y3_geometry:        ['Shapes and Angles', 'Şekiller ve açılar', 'Formas y ángulos'],
  y3_statistics:      ['Bar Charts and Pictograms', 'Sütun grafikleri ve piktogramlar', 'Gráficos de barras y pictogramas'],
  y4_place_value:     ['Numbers to 10,000', '10.000’e kadar sayılar', 'Números hasta el 10.000'],
  y4_addition:        ['Addition up to 4 digits', '4 basamağa kadar toplama', 'Sumas de hasta 4 cifras'],
  y4_subtraction:     ['Subtraction up to 4 digits', '4 basamağa kadar çıkarma', 'Restas de hasta 4 cifras'],
  y4_multiplication:  ['All times tables to 12×12', '12×12’ye kadar tüm çarpım tabloları', 'Todas las tablas hasta 12×12'],
  y4_division:        ['Division using all tables', 'Tüm tablolarla bölme', 'División con todas las tablas'],
  y4_fractions:       ['Fractions and Decimals', 'Kesirler ve ondalık sayılar', 'Fracciones y decimales'],
  y4_measurement:     ['Area and Perimeter', 'Alan ve çevre', 'Área y perímetro'],
  y4_geometry:        ['Geometry', 'Geometri', 'Geometría'],
  y4_statistics:      ['Data and Time Graphs', 'Veri ve zaman grafikleri', 'Datos y gráficos de tiempo'],
  y5_place_value:     ['Numbers to 1,000,000', '1.000.000’a kadar sayılar', 'Números hasta el 1.000.000'],
  y5_addition:        ['Addition and Subtraction', 'Toplama ve çıkarma', 'Suma y resta'],
  y5_multiplication:  ['Multiplication', 'Çarpma', 'Multiplicación'],
  y5_division:        ['Division', 'Bölme', 'División'],
  y5_fractions:       ['Fractions', 'Kesirler', 'Fracciones'],
  y5_decimals:        ['Decimals and Percentages', 'Ondalık sayılar ve yüzdeler', 'Decimales y porcentajes'],
  y5_geometry:        ['Geometry and Angles', 'Geometri ve açılar', 'Geometría y ángulos'],
  y5_statistics:      ['Statistics', 'İstatistik', 'Estadística'],
  y6_place_value:     ['Numbers to 10,000,000', '10.000.000’a kadar sayılar', 'Números hasta el 10.000.000'],
  y6_multiplication:  ['Long Multiplication and Division', 'Uzun çarpma ve bölme', 'Multiplicación y división largas'],
  y6_fractions:       ['Fractions, Decimals, Percentages', 'Kesirler, ondalık sayılar, yüzdeler', 'Fracciones, decimales, porcentajes'],
  y6_algebra:         ['Algebra', 'Cebir', 'Álgebra'],
  y6_ratio:           ['Ratio and Proportion', 'Oran ve orantı', 'Razón y proporción'],
  y6_geometry:        ['Geometry', 'Geometri', 'Geometría'],
  y6_statistics:      ['Statistics', 'İstatistik', 'Estadística'],
  y7_number:          ['Factors, Multiples and Primes', 'Çarpanlar, katlar ve asal sayılar', 'Factores, múltiplos y primos'],
  y7_negatives:       ['Negative Numbers and Rounding', 'Negatif sayılar ve yuvarlama', 'Números negativos y redondeo'],
  y7_fractions:       ['Fractions, Decimals and Percentages', 'Kesirler, ondalık sayılar ve yüzdeler', 'Fracciones, decimales y porcentajes'],
  y7_algebra:         ['Algebra: Expressions and Equations', 'Cebir: ifadeler ve denklemler', 'Álgebra: expresiones y ecuaciones'],
  y7_sequences:       ['Sequences and Function Machines', 'Diziler ve fonksiyon makineleri', 'Sucesiones y máquinas de funciones'],
  y7_ratio:           ['Ratio, Proportion and Rates', 'Oran, orantı ve hız', 'Razón, proporción y tasas'],
  y7_geometry:        ['Area, Perimeter and Angles', 'Alan, çevre ve açılar', 'Área, perímetro y ángulos'],
  y7_statistics:      ['Averages and Probability', 'Ortalamalar ve olasılık', 'Promedios y probabilidad'],
  y8_number:          ['Indices, Primes and Powers', 'Üsler, asal sayılar ve kuvvetler', 'Índices, primos y potencias'],
  y8_negatives:       ['Negative Numbers and Decimals', 'Negatif sayılar ve ondalık sayılar', 'Números negativos y decimales'],
  y8_fractions:       ['Fractions, Decimals and Percentages', 'Kesirler, ondalık sayılar ve yüzdeler', 'Fracciones, decimales y porcentajes'],
  y8_algebra:         ['Algebra: Brackets and Equations', 'Cebir: parantezler ve denklemler', 'Álgebra: paréntesis y ecuaciones'],
  y8_sequences:       ['Sequences and Straight-line Graphs', 'Diziler ve doğru grafikleri', 'Sucesiones y gráficos de rectas'],
  y8_ratio:           ['Ratio, Proportion and Rates', 'Oran, orantı ve hız', 'Razón, proporción y tasas'],
  y8_geometry:        ['Volume, Circles and Angles', 'Hacim, daireler ve açılar', 'Volumen, círculos y ángulos'],
  y8_statistics:      ['Statistics and Probability', 'İstatistik ve olasılık', 'Estadística y probabilidad'],
}

export const TOPIC_IDS = Object.keys(T)

// The topic's name for a message in `lang` ('en' | 'tr' | 'es'). Falls back to the name the caller
// holds (the English curriculum name stored with the row), then to the id.
export function localTopicName(id, fallback, lang) {
  const row = T[id]
  if (!row) return fallback || id || ''
  return lang === 'tr' ? row[1] : lang === 'es' ? row[2] : row[0]
}
