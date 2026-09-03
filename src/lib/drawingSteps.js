// What the child is told to draw at each step, per language.
//
// These used to be one English array per drawing, inside DrawingsScreen, and they had drifted
// badly away from the pictures they describe. An audit of every folder against its step images
// found:
//
//   * 14 of 24 drawings had no descriptions at all — the child saw pictures and no words
//   * house had 15 descriptions for 8 pictures, landscape 16 for 6, princess 29 for 6, cat 8
//     for 9. The extras are from earlier, longer versions of those drawings, so from some
//     point onward every description described a different picture than the one on screen.
//     That is why house step 4 said "two windows" when the picture has one, and why
//     caterpillar's step 5 described something drawn several steps earlier.
//
// A description that does not match its picture is worse than none: a six-year-old trusts the
// words over what they see. So a drawing appears here only once its steps have been checked
// against the images one by one, and DRAWINGS_AUDITED records which those are — anything else
// shows pictures alone, as it did before, rather than confident nonsense.
//
// Adding a language: another field beside en/tr, same as src/lib/i18n.js.

export const DRAWING_STEPS = {
  // Audited against drawings/robot/*.webp. The old step 5 was removed: the ear knobs and knee
  // circles drawn in step 4 vanished in it and came back in step 6, so it belonged to a
  // different version of this robot. Remaining steps renumbered 1-6.
  robot: {
    en: [
      'Draw a rectangle for the head.',
      'Add a square below it for the body.',
      'Add a short neck, curved arms with round hands, and two legs with feet.',
      'Put an antenna on top, two big round eyes, and little ears on each side.',
      'Draw a screen and two buttons on the chest, then add fingers and bolts.',
      'Colour the eyes in, draw a line across the screen, and add joint lines to the arms and legs.',
    ],
    tr: [
      'Kafa için bir dikdörtgen çiz.',
      'Altına gövde için bir kare ekle.',
      'Kısa bir boyun, yuvarlak elli kavisli kollar ve ayaklı iki bacak ekle.',
      'Tepesine anten, iki büyük yuvarlak göz ve iki yanına küçük kulak koy.',
      'Göğsüne bir ekran ve iki düğme çiz, sonra parmakları ve vidaları ekle.',
      'Gözleri boya, ekranın üstüne bir çizgi çek, kollara ve bacaklara eklem çizgileri ekle.',
    ],
  },
  // Audited against drawings/house/*.webp. The old list had 15 lines for these 8 pictures;
  // its "two windows" belonged to a version of this house that had two. This one has one.
  // Audited against drawings/caterpillar/*.webp. The count matched before, which is why this
  // one looked fine and was not: step 3 is the antennae, not what the old line claimed, and
  // the old step 5 described the eyes, drawn in step 4.
  caterpillar: {
    en: [
      'Draw a big circle for the head.',
      'Add three more circles behind it, each a little smaller.',
      'Give it two curly antennae on top.',
      'Draw two big eyes with shiny pupils, and a small eyebrow above each.',
      'Add a happy smile.',
      'Join the body circles into segments and add little looping legs underneath.',
      'Draw wavy stripes across each segment.',
      'Put a big leaf under the caterpillar and a flower beside it.',
    ],
    tr: [
      'Kafa için büyük bir daire çiz.',
      'Arkasına gittikçe küçülen üç daire daha ekle.',
      'Tepesine iki tane kıvrık anten çiz.',
      'Parlak bebekli iki büyük göz çiz, her birinin üstüne de küçük bir kaş.',
      'Güler yüzlü bir gülümseme ekle.',
      'Gövde dairelerini halkalara bağla, altına da küçük ilmek bacaklar ekle.',
      'Her halkanın üstüne dalgalı çizgiler çiz.',
      'Tırtılın altına kocaman bir yaprak, yanına da bir çiçek koy.',
    ],
  },
  // Audited against drawings/mountains/*.webp. This one had no descriptions at all.
  // Step 5 loses the snow caps drawn in step 3 and gets them back in step 6 — a flaw in the
  // source art. Unlike robot's step 5 it still teaches something (the bare trunk), so it
  // stays, and the wording does not mention snow there.
  mountains: {
    en: [
      'Draw a long line across the middle for the ground.',
      'Draw two big triangles above it for the mountains, overlapping a little.',
      'Add a zigzag line near each peak for the snow.',
      'Draw a winding path coming towards you from between the mountains.',
      'On the left, draw a tree trunk with a few bare branches.',
      'Give that tree a big bumpy crown of leaves.',
      'Draw a second leafy tree on the right side.',
      'Shade the mountainsides, the trees and the path to finish.',
    ],
    tr: [
      'Ortadan boydan boya bir çizgi çekerek yeri çiz.',
      'Üstüne dağlar için birbirine biraz giren iki büyük üçgen çiz.',
      'Her zirvenin altına kar için zikzak bir çizgi ekle.',
      'Dağların arasından sana doğru gelen kıvrımlı bir yol çiz.',
      'Sol tarafa birkaç çıplak dallı bir ağaç gövdesi çiz.',
      'O ağaca kabarık, yuvarlak bir yaprak tepesi ver.',
      'Sağ tarafa yapraklı ikinci bir ağaç çiz.',
      'Dağ yamaçlarını, ağaçları ve yolu gölgeleyerek bitir.',
    ],
  },
  // Audited against drawings/anime-face/*.webp — nine steps, not ten: that folder also holds
  // an icon.webp, which the first count mistook for a step.
  'anime-face': {
    en: [
      'Draw a circle for the skull, with a line down the middle and a small mark below for the chin.',
      'Draw the jaw down to that mark, and two lines for the neck.',
      'Smooth the whole head into one outline, add an ear on the left, and a guide line across for the eyes.',
      'Draw sharp eyebrows, the outline of both eyes, a small nose and a smiling mouth.',
      'Draw a big circle inside each eye for the iris.',
      'Add the other ear on the right so both match.',
      'Fill in the pupils and leave a white dot in each for the shine.',
      'Draw the fringe: pointed strands of hair falling over the forehead.',
      'Add the rest of the spiky hair all around, then shade the face and eyes.',
    ],
    tr: [
      'Kafatası için bir daire çiz, ortasından bir çizgi geçir, altına da çene için küçük bir işaret koy.',
      'Çeneyi o işarete kadar indir, boyun için iki çizgi çek.',
      'Bütün kafayı tek bir hatta yumuşat, soluna bir kulak ekle, gözler için de enine bir yardım çizgisi çiz.',
      'Keskin kaşlar, iki gözün dış hattı, küçük bir burun ve gülümseyen bir ağız çiz.',
      'Her gözün içine iris için büyük bir daire çiz.',
      'Sağa da öbür kulağı ekle, ikisi eşit olsun.',
      'Göz bebeklerini doldur, her birinde parıltı için beyaz bir nokta bırak.',
      'Kâkülü çiz: alnına düşen sivri saç tutamları.',
      'Çevresine diken diken saçın kalanını ekle, sonra yüzü ve gözleri gölgele.',
    ],
  },
  // Audited against drawings/train/*.webp. Four steps, and each one carries a lot — this is
  // the shortest sequence in the set.
  train: {
    en: [
      'Draw a long rectangle for the engine, sitting on a base, with two small wheels and one big wheel.',
      'Add a tall chimney on the left, and the cab wall and roof on the right.',
      'Round off the front of the boiler, put a window in the cab, add a smoke cloud, a wedge at the front, a rod across the wheels, and a wagon behind.',
      'Shade the whole engine and draw the rails underneath.',
    ],
    tr: [
      'Lokomotif için bir kaide üstünde uzun bir dikdörtgen çiz; iki küçük, bir büyük tekerlek koy.',
      'Soluna uzun bir baca, sağına da kabinin duvarını ve çatısını ekle.',
      'Kazanın önünü yuvarlat, kabine pencere koy, bir duman bulutu, önüne bir takoz, tekerleklerin üstüne bir kol ve arkasına bir vagon ekle.',
      'Bütün lokomotifi gölgele ve altına rayları çiz.',
    ],
  },
  // Audited against drawings/map/*.webp.
  map: {
    en: [
      'Draw a wobbly island shape, with a few tiny rocks in the sea around it.',
      'Put three mountain peaks inside it, and a lake just below them.',
      'Wind a river down from the lake to the coast, and add bushy trees on each side.',
      'Add a castle, a little village, and shade the mountains with snow on top.',
      'Draw waves in the sea, a sailing boat and a sea serpent, then a dotted trail with bridges over the river.',
    ],
    tr: [
      'Dalgalı kenarlı bir ada çiz, çevresindeki denize de birkaç küçük kaya koy.',
      'İçine üç dağ zirvesi, hemen altlarına da bir göl çiz.',
      'Gölden kıyıya kıvrıla kıvrıla bir nehir indir, iki yanına da çalı gibi ağaçlar ekle.',
      'Bir kale ve küçük bir köy ekle, dağları gölgele, tepelerine kar koy.',
      'Denize dalgalar, bir yelkenli ve bir deniz yılanı çiz; sonra nehrin üstünden köprülü, noktalı bir patika geçir.',
    ],
  },
  // Audited against drawings/dolphin/*.webp.
  dolphin: {
    en: [
      'Draw one big curve, arching up like a rainbow — that is the back.',
      'Bring a second curve underneath to close the body, ending in a pointed snout on the right.',
      'Draw a long side flipper under the middle of the body.',
      'Add the fin on top of the back, and a forked tail at the other end.',
      'Draw a big eye with a shine in it, an eyebrow, a smiling mouth, and a small second flipper.',
      'Go over all your lines to make them dark and smooth.',
    ],
    tr: [
      'Gökkuşağı gibi yukarı kıvrılan büyük bir yay çiz — bu sırtı.',
      'Altından ikinci bir yay geçirip gövdeyi kapat, sağ ucu sivri bir burun olsun.',
      'Gövdenin ortasının altına uzun bir yan yüzgeç çiz.',
      'Sırtının üstüne yüzgeci, öbür ucuna da çatal kuyruğu ekle.',
      'Parıltılı büyük bir göz, bir kaş, gülümseyen bir ağız ve küçük bir ikinci yüzgeç çiz.',
      'Bütün çizgilerin üstünden geçip koyu ve düzgün hâle getir.',
    ],
  },
  // Audited against drawings/fish/*.webp.
  fish: {
    en: [
      'Draw a big oval lying on its side for the body.',
      'Add a triangle tail on the left, pinched in the middle.',
      'Draw a curved line near the front for the head, and a small circle for the eye.',
      'Put a pointed fin on top of the back, and give the fish a smile.',
      'Add a fin on the side of the body and another underneath.',
      'Draw rows of curved scales, and a few bubbles floating up beside it.',
    ],
    tr: [
      'Gövde için yan yatmış büyük bir oval çiz.',
      'Soluna ortası içeri girmiş üçgen bir kuyruk ekle.',
      'Ön tarafa baş için kavisli bir çizgi, göz için de küçük bir daire çiz.',
      'Sırtının üstüne sivri bir yüzgeç koy ve balığa bir gülümseme ver.',
      'Gövdenin yanına bir yüzgeç, altına da bir tane daha ekle.',
      'Sıra sıra kavisli pullar çiz, yanına da yukarı süzülen birkaç kabarcık koy.',
    ],
  },
  // Audited against drawings/master/*.webp. Five steps for a whole standing figure, so each
  // one is a big jump — this is the hardest drawing in the set and the wording says what to
  // block in rather than pretending it is easy.
  master: {
    en: [
      'Draw a head with a pointed chin, a guide line down the middle and one across, then the neck and the collar.',
      'Draw sharp narrow eyes under strong eyebrows, and a small mouth.',
      'Drape a wide cloak from the shoulders, flaring out, with the body showing below it.',
      'Add the arms — one hand on the hip, the other down by a sword — a belt, and the legs.',
      'Draw long flowing hair, then shade the cloak and trousers with lots of fine lines.',
    ],
    tr: [
      'Sivri çeneli bir kafa çiz, ortasından ve enine yardım çizgileri geçir, sonra boynu ve yakayı ekle.',
      'Kalın kaşların altına keskin, ince gözler ve küçük bir ağız çiz.',
      'Omuzlardan aşağı yayılan geniş bir pelerin çiz, altından gövde görünsün.',
      'Kolları ekle — bir el belde, öbürü aşağıda kılıcın yanında — bir kemer ve bacaklar.',
      'Uzun, savrulan saçları çiz, sonra pelerini ve pantolonu bol ince çizgiyle gölgele.',
    ],
  },
  // Audited against drawings/axolotl/*.webp.
  axolotl: {
    en: [
      'Draw a big wide circle for the head, and a rounder body just below it.',
      'Add two little arms out to the sides and two short legs underneath.',
      'Draw two big oval eyes, filled in dark, with two white dots in each.',
      'Add a wide open smile.',
      'Draw three feathery frills on each side of the head, and a long flat tail curving to the left.',
      'Go over all the outlines to make them dark and smooth.',
    ],
    tr: [
      'Kafa için büyük ve geniş bir daire, hemen altına da daha yuvarlak bir gövde çiz.',
      'İki yanına küçük kollar, altına da iki kısa bacak ekle.',
      'İçi koyu doldurulmuş iki büyük oval göz çiz, her birine iki beyaz nokta koy.',
      'Kocaman, açık bir gülümseme ekle.',
      'Kafasının iki yanına üçer tüylü solungaç, sola doğru kıvrılan uzun ve yassı bir kuyruk çiz.',
      'Bütün dış çizgilerin üstünden geçip koyu ve düzgün hâle getir.',
    ],
  },
  // Audited against drawings/panda/*.webp.
  panda: {
    en: [
      'Draw a big circle for the head, and a rounder, wider one below for the body.',
      'Draw two large oval eye patches, a small triangle nose and a curved mouth under it.',
      'Add two round ears on top, and an arm curving down each side.',
      'Draw the two legs at the bottom, and a small round tail on the right.',
      'Fill in the eye patches, ears, arms and legs dark, leaving the eyes white with a dot.',
      'Add short fur strokes all round the edges, and a soft shadow on the ground.',
    ],
    tr: [
      'Kafa için büyük bir daire, altına da gövde için daha yuvarlak ve geniş bir tane çiz.',
      'İki büyük oval göz lekesi, küçük bir üçgen burun ve altına kavisli bir ağız çiz.',
      'Üstüne iki yuvarlak kulak, iki yanına da aşağı kıvrılan birer kol ekle.',
      'Aşağıya iki bacağı, sağ tarafına da küçük yuvarlak bir kuyruk çiz.',
      'Göz lekelerini, kulakları, kolları ve bacakları koyu doldur; gözler beyaz kalsın, içine birer nokta koy.',
      'Kenarlarına kısa kürk çizgileri, yere de yumuşak bir gölge ekle.',
    ],
  },
  // Audited against drawings/tiger/*.webp. Step 1 is a guide skeleton and step 2 is the whole
  // clean outline — a very big jump, so the wording for step 2 says to draw over the guides
  // rather than starting again.
  tiger: {
    en: [
      'Sketch guides lightly: a big oval for the body, a circle for the head, and straight lines for the four legs.',
      'Draw the real outline over your guides — back, chest, legs and tail — and the face with two eyes and a nose.',
      'Add the paws with claws, the ears, and a ruff of fur around the cheeks.',
      'Draw fur strokes along the back, chest and legs, and shade around the eyes.',
      'Add the stripes: curved bands down the back and sides, thinner ones on the legs and tail.',
      'Deepen the stripes and fur, and put a shadow on the ground under the tiger.',
    ],
    tr: [
      'Önce hafifçe yardım şekilleri çiz: gövde için büyük bir oval, kafa için bir daire, dört bacak için düz çizgiler.',
      'Yardım çizgilerinin üstünden gerçek hattı çiz — sırt, göğüs, bacaklar ve kuyruk — sonra iki gözlü, burunlu yüzü.',
      'Pençeleri tırnaklarıyla, kulakları ve yanaklardaki kabarık tüyleri ekle.',
      'Sırt, göğüs ve bacaklar boyunca tüy çizgileri çiz, gözlerin çevresini gölgele.',
      'Çizgileri ekle: sırt ve yanlarda kavisli bantlar, bacak ve kuyrukta daha incelerini.',
      'Çizgileri ve tüyleri koyulaştır, kaplanın altına yere bir gölge koy.',
    ],
  },
  // Audited against drawings/horse/*.webp. Steps 5 and 6 are nearly identical — the last one
  // only deepens the shading — so the wording does not promise a new feature there.
  horse: {
    en: [
      'Sketch guides lightly: an oval for the body, a rounder shape behind for the haunch, and lines for the neck and legs.',
      'Draw the outline over your guides — head, arched neck, back and rump — with one front leg lifted.',
      'Shape the legs properly, with a bend at each knee and a hoof at the end.',
      'Clean up the outline and add the eye, the nostril and the ears.',
      'Draw the flowing mane along the neck and a long tail behind.',
      'Shade under the belly, the neck and the legs to make the horse look round.',
    ],
    tr: [
      'Önce hafif yardım şekilleri çiz: gövde için bir oval, arkasına sağrı için daha yuvarlak bir şekil, boyun ve bacaklar için çizgiler.',
      'Yardım çizgilerinin üstünden hattı çiz — baş, kemerli boyun, sırt ve sağrı — ön bacaklardan biri havada olsun.',
      'Bacaklara doğru biçimi ver: her dizde bir kıvrım, ucunda bir toynak.',
      'Dış hattı temizle, gözü, burun deliğini ve kulakları ekle.',
      'Boyun boyunca savrulan yeleyi ve arkaya uzun bir kuyruk çiz.',
      'Karnın altını, boynu ve bacakları gölgele ki at yuvarlak dursun.',
    ],
  },
  // Audited against drawings/bee/*.webp. Note the head is the RIGHT circle, not the left —
  // the body is drawn first and the head overlaps it.
  bee: {
    en: [
      'Draw a circle for the head.',
      'Draw a bigger circle behind it, to the left, for the body.',
      'Give the bee two curly antennae with a little ball on each tip.',
      'Draw two tall oval eyes and colour the middles in.',
      'Add a big smile.',
      'Draw two wings above the body, a pointed sting at the back, and four little legs.',
      'Add veins in the wings and thick stripes across the body — buzz, done!',
    ],
    tr: [
      'Kafa için bir daire çiz.',
      'Solunda, arkasına gövde için daha büyük bir daire çiz.',
      'Arıya uçlarında birer topçuk olan iki kıvrık anten ver.',
      'İki uzun oval göz çiz, ortalarını boya.',
      'Kocaman bir gülümseme ekle.',
      'Gövdenin üstüne iki kanat, arkasına sivri bir iğne ve dört küçük bacak çiz.',
      'Kanatlara damarlar, gövdeye de kalın şeritler ekle — vızz, bitti!',
    ],
  },
  // Audited against drawings/owl/*.webp. The ear tufts only appear in the last picture, so
  // nothing before step 8 mentions them.
  owl: {
    en: [
      'Draw a circle for the head, a long oval body below it, and a wing shape across the front.',
      'Add two round eyes.',
      'Draw a heart shape around the eyes for the face, and a small pointed beak.',
      'Add two legs with toes at the bottom, and the tail behind.',
      'Draw the pupils and a shine in each eye, and shape the wing.',
      'Add rows of feathers on the wing and small marks on the chest.',
      'Cover the whole owl in short feather strokes.',
      'Add pointed ear tufts on top and darken the feathers all over.',
    ],
    tr: [
      'Kafa için bir daire, altına uzun oval bir gövde, önüne de bir kanat şekli çiz.',
      'İki yuvarlak göz ekle.',
      'Gözlerin çevresine yüz için bir kalp şekli, ortasına küçük sivri bir gaga çiz.',
      'Aşağıya parmaklı iki bacak, arkaya da kuyruğu ekle.',
      'Göz bebeklerini ve her gözdeki parıltıyı çiz, kanada biçim ver.',
      'Kanada sıra sıra tüyler, göğsüne küçük benekler ekle.',
      'Baykuşun her yerini kısa tüy çizgileriyle kapla.',
      'Tepesine sivri kulak püskülleri ekle ve tüyleri iyice koyulaştır.',
    ],
  },
  // Audited against drawings/cat/*.webp — eight steps, not nine: icon.webp is not a step.
  cat: {
    en: [
      'Draw a wide oval for the head.',
      'Add a rounded body below it, wider at the bottom.',
      'Put two pointed ears on top of the head.',
      'Draw two circles for the eyes.',
      'Fill the eyes in dark, leaving a white dot in each.',
      'Add a little triangle nose, a curvy mouth, and two lines at the front for the legs.',
      'Draw long whiskers on both sides, front paws, and a curling tail on the right.',
      'Add stripes and short fur strokes all over — your cat is done!',
    ],
    tr: [
      'Kafa için geniş bir oval çiz.',
      'Altına aşağı doğru genişleyen yuvarlak bir gövde ekle.',
      'Kafasının üstüne iki sivri kulak koy.',
      'Gözler için iki daire çiz.',
      'Gözleri koyu doldur, her birinde beyaz bir nokta bırak.',
      'Küçük bir üçgen burun, kıvrımlı bir ağız ve önüne bacaklar için iki çizgi ekle.',
      'İki yana uzun bıyıklar, ön patiler ve sağa kıvrılan bir kuyruk çiz.',
      'Her yerine çizgiler ve kısa tüyler ekle — kedin hazır!',
    ],
  },
  // Audited against drawings/dog/*.webp.
  dog: {
    en: [
      'Draw a big round head.',
      'Add a rounded body below it, wider at the bottom.',
      'Draw two floppy ears hanging down each side of the head.',
      'Add two circles for the eyes, a rounded nose, and a curvy mouth.',
      'Colour the eyes in dark, leaving a white dot in each.',
      'Draw the front legs coming down the body, with little paws and toes.',
      'Add a wagging tail on the right, with a few lines to show it moving, and a tongue.',
      'Draw round spots on the ears, face and body — all done!',
    ],
    tr: [
      'Büyük ve yuvarlak bir kafa çiz.',
      'Altına aşağı doğru genişleyen yuvarlak bir gövde ekle.',
      'Kafasının iki yanına sarkan iki kulak çiz.',
      'Gözler için iki daire, yuvarlak bir burun ve kıvrımlı bir ağız ekle.',
      'Gözleri koyu doldur, her birinde beyaz bir nokta bırak.',
      'Gövdeden aşağı inen ön bacakları, küçük patileri ve parmakları çiz.',
      'Sağına sallanan bir kuyruk çiz, hareketini gösteren birkaç çizgi ve bir dil ekle.',
      'Kulaklarına, yüzüne ve gövdesine yuvarlak benekler çiz — bitti!',
    ],
  },
  // Audited against drawings/landscape/*.webp. The old list had 16 lines for these 6 pictures.
  landscape: {
    en: [
      'Draw one long curve across the page for the top of the hill.',
      'Add three fir trees standing on the left side of the hill.',
      'Draw a wide path winding from the bottom of the page up over the hill.',
      'Put a little house with a roof and a chimney on the right.',
      'Add a sun with rays, some clouds, and a door and window on the house.',
      'Shade the hill and the trees, add roof tiles, smoke from the chimney and ripples on the path.',
    ],
    tr: [
      'Tepenin sırtı için sayfayı boydan boya geçen tek bir kavis çiz.',
      'Tepenin sol yanına yan yana üç çam ağacı ekle.',
      'Sayfanın altından tepeye doğru kıvrılan geniş bir yol çiz.',
      'Sağ tarafa çatısı ve bacası olan küçük bir ev koy.',
      'Işınlı bir güneş, birkaç bulut, eve de bir kapı ve pencere ekle.',
      'Tepeyi ve ağaçları gölgele; çatıya kiremit, bacaya duman, yola da dalgalar ekle.',
    ],
  },
  // Audited against drawings/princess/*.webp. The old list had 29 lines for these 6 pictures —
  // by far the worst drift in the set.
  princess: {
    en: [
      'Draw a head with a pointed chin, a line down the middle and one across, then the neck and a V-shaped collar.',
      'Draw big eyes with long lashes on the guide line, curved eyebrows, and a small nose and mouth.',
      'Add an ear each side, then the shoulders with puffed sleeves and the top of the dress.',
      'Draw long hair falling down both sides, the arms coming down, and the hands together in front.',
      'Add the waist, then a wide skirt with a frilly hem, and put waves in the hair.',
      'Draw strands through the hair, shade the sleeves and skirt, and finish the face.',
    ],
    tr: [
      'Sivri çeneli bir kafa çiz, ortasından ve enine birer çizgi geçir, sonra boynu ve V yakayı ekle.',
      'Yardım çizgisinin üstüne uzun kirpikli büyük gözler, kavisli kaşlar, küçük bir burun ve ağız çiz.',
      'İki yanına birer kulak, sonra omuzları, kabarık kolları ve elbisenin üstünü ekle.',
      'İki yandan aşağı dökülen uzun saçları, aşağı inen kolları ve önde birleşen elleri çiz.',
      'Beli çiz, altına fırfırlı geniş bir etek ekle, saçlara da dalga ver.',
      'Saçın içine teller çiz, kolları ve eteği gölgele, yüzü tamamla.',
    ],
  },
  // Audited against drawings/tough-girl/*.webp. Steps 3 and 4 are deliberately blocky — the
  // arms and skirt are plain shapes at that stage, not clothes yet.
  'tough-girl': {
    en: [
      'Draw an oval head, two round buns on top, and a small ear on each side.',
      'Add a guide line down the middle, then angry slanted eyebrows, two round eyes and a straight cross mouth.',
      'Block in the body with simple shapes: a rectangle for the top, triangles for the arms out to the sides, and a wide skirt.',
      'Add two straight legs and a boot on each foot.',
      'Turn the shapes into clothes — a vest top, hands on the hips, laced boots — and draw the fringe and hair.',
      'Add pleats to the skirt, laces to the boots, and shade the hair, top and legs.',
    ],
    tr: [
      'Oval bir kafa, tepesine iki yuvarlak topuz, iki yanına da birer küçük kulak çiz.',
      'Ortasından bir yardım çizgisi geçir, sonra kızgın çapraz kaşlar, iki yuvarlak göz ve dümdüz bir ağız çiz.',
      'Gövdeyi basit şekillerle kur: üst için bir dikdörtgen, iki yana açılan kollar için üçgenler, altına geniş bir etek.',
      'İki düz bacak ve her ayağa birer bot ekle.',
      'Şekilleri kıyafete çevir — askılı bir üst, bele dayalı eller, bağcıklı botlar — sonra kâkülü ve saçı çiz.',
      'Eteğe pileler, botlara bağcıklar ekle; saçı, üstü ve bacakları gölgele.',
    ],
  },
  house: {
    en: [
      'Draw a big square for the walls.',
      'Put a wide triangle on top for the roof.',
      'Add a chimney on the right side of the roof, and a tall rectangle for the door.',
      'Draw one square window to the right of the door.',
      'Cover the roof in rows of tiles, and let some smoke curl out of the chimney.',
      'Split the window into four panes and add curtains, then a round door handle.',
      'Draw a picket fence across the front of the house.',
      'Shade the roof, the door and the chimney bricks, and add bushes in the garden.',
    ],
    tr: [
      'Duvarlar için büyük bir kare çiz.',
      'Üstüne çatı için geniş bir üçgen koy.',
      'Çatının sağına baca, eve de kapı için uzun bir dikdörtgen ekle.',
      'Kapının sağına bir tane kare pencere çiz.',
      'Çatıyı sıra sıra kiremitlerle kapla, bacadan da dumanlar çıksın.',
      'Pencereyi dört bölmeye ayır, perdelerini ekle, sonra yuvarlak bir kapı kolu çiz.',
      'Evin önüne boydan boya bir çit çiz.',
      'Çatıyı, kapıyı ve bacanın tuğlalarını gölgele, bahçeye çalılar ekle.',
    ],
  },

  // ── The September 2026 batch ────────────────────────────────────────────────
  // Built by server/scripts/prepare_drawing_set.py, which lists per set exactly
  // which raw panels were kept. Four sets dropped a panel that went BACKWARDS
  // (see that file); the wording below follows the panels that shipped, not the
  // raw folder's numbering.

  car: {
    en: [
      'Draw the car body as one long rounded shape, then the roof, the windscreen and a side window on top.',
      'Add two round wheels under curved arches, and a bumper across the front.',
      'Draw two round headlights, the door line with its handle, a wing mirror, and the slots under the bumper.',
      'Put spokes in the wheels, add the small lights on the bumper, and draw the seats showing through the windows.',
      'Shade the sides of the car, add a badge on the bonnet, and put a shadow on the ground underneath.',
    ],
    tr: [
      'Arabanın gövdesini tek bir uzun yuvarlak şekil olarak çiz; üstüne çatıyı, ön camı ve yan camı ekle.',
      'Kavisli çamurlukların altına iki yuvarlak tekerlek, önüne de bir tampon çiz.',
      'İki yuvarlak far, kolu ile birlikte kapı çizgisi, bir yan ayna, tamponun altına da ızgara çizgileri çiz.',
      'Tekerleklere jant kollarını koy, tampona küçük lambaları ekle, camların arkasından görünen koltukları çiz.',
      'Arabanın yanlarını gölgele, kaputuna bir arma koy, altına da yere düşen gölgeyi çiz.',
    ],
  },

  airplane: {
    en: [
      'Draw one long oval, tilted, for the plane’s body.',
      'Add a wing going up on the left, a bigger wing coming towards you on the right, and the tail fin with a small tailplane.',
      'Draw the round engine and a three-blade propeller at the nose, and a bubble canopy on top.',
      'Add the landing wheels: two under the body and a small one under the far wing.',
      'Draw the panel lines on the wings and tail, the rings around the engine, and shade the propeller and wheels.',
      'Put a few clouds around the plane and a hill below it, then shade the body.',
    ],
    tr: [
      'Uçağın gövdesi için eğik duran uzun bir oval çiz.',
      'Sola yukarı giden bir kanat, sağa sana doğru gelen daha büyük bir kanat, bir de kuyruk ile küçük kuyruk kanadını ekle.',
      'Burnuna yuvarlak motoru ve üç kanatlı pervaneyi çiz, üstüne de kabin camını koy.',
      'İniş tekerleklerini ekle: gövdenin altına iki tane, uzaktaki kanadın altına küçük bir tane.',
      'Kanatlardaki ve kuyruktaki panel çizgilerini, motorun etrafındaki halkaları çiz; pervaneyi ve tekerlekleri gölgele.',
      'Uçağın çevresine birkaç bulut, altına da bir tepe çiz; sonra gövdeyi gölgele.',
    ],
  },

  ship: {
    en: [
      'Draw the hull: a wide curved shape like a deep bowl.',
      'Draw the deck line along the top and two short posts standing on it.',
      'Add three tall masts with a lookout basket, a long pole pointing out of the front, and thin rigging ropes.',
      'Hang the square sails on the masts and a triangle sail at the front.',
      'Draw the raised cabin at the back with its windows, a row of round portholes, an anchor, and the plank lines on the hull.',
      'Add wavy sea lines around the ship, a sun in the sky, and shade the sails.',
    ],
    tr: [
      'Gövdeyi çiz: derin bir kâse gibi geniş ve kavisli bir şekil.',
      'Üst tarafa boydan boya güverte çizgisini, üstüne de iki kısa direk çiz.',
      'Üç uzun direk ve tepesine gözcü sepeti, önden dışarı uzanan uzun bir gönder, bir de ince halatlar ekle.',
      'Direklere kare yelkenleri, öne de üçgen yelkeni as.',
      'Arkadaki yüksek kamarayı pencereleriyle çiz; bir sıra yuvarlak lomboz, bir çapa ve gövdedeki tahta çizgilerini ekle.',
      'Geminin çevresine dalgalı deniz çizgileri, gökyüzüne bir güneş çiz; yelkenleri gölgele.',
    ],
  },

  'big-ben': {
    en: [
      'Draw a tall narrow rectangle for the tower, and a wide flat one under it for the base.',
      'Run a line down the middle so you can see two sides, add the wider clock box near the top with a square panel on each face, then a sloping roof and a pointed spire.',
      'Draw a big circle inside each square for the clock faces, and little spikes at the corners.',
      'Add the numbers and hands to the clocks, rows of small arches above and below them, and long straight window lines down the tower.',
      'Draw the columns under the spire, and cover the roof and the walls with fine lines.',
      'Shade the right-hand face of the tower and darken the base so it looks solid.',
      'Go over the whole tower with a darker pencil, leaving the clock faces pale.',
    ],
    tr: [
      'Kule için uzun ve dar bir dikdörtgen, altına da taban için geniş ve yassı bir dikdörtgen çiz.',
      'Ortasından bir çizgi indir ki iki yüzü görünsün; üst tarafa her yüzünde kare bir pano olan daha geniş saat kutusunu, üstüne de eğimli çatıyı ve sivri külahı ekle.',
      'Her karenin içine saat için büyük bir daire çiz, köşelere de küçük sivri uçlar koy.',
      'Saatlere rakamları ve akrep ile yelkovanı, altlarına ve üstlerine küçük kemer sıralarını, kuleye de uzun düz pencere çizgilerini ekle.',
      'Külahın altındaki sütunları çiz, çatıyı ve duvarları ince çizgilerle kapla.',
      'Kulenin sağ yüzünü gölgele, tabanı koyulaştır ki sağlam dursun.',
      'Bütün kulenin üstünden daha koyu bir kalemle geç; saat kadranlarını açık bırak.',
    ],
  },

  'galata-tower': {
    en: [
      'Draw a tall rectangle for the tower and a wide flat base under it.',
      'Curve the lines across it so it looks round, then add two rings near the top and a narrower level above them.',
      'Put a tall pointed cone on top for the roof.',
      'Draw the arched windows all around the balcony, the railing above them, small windows on the wall below, and a few brick lines.',
      'Cover the roof with tile lines and the wall with stone blocks, and add the little posts along the railing.',
      'Shade the left side of the tower and under the balcony, and darken the base.',
      'Press harder for the darkest shadows and leave the sunny side pale.',
    ],
    tr: [
      'Kule için uzun bir dikdörtgen, altına da geniş ve yassı bir taban çiz.',
      'Üstündeki çizgileri kavisli yap ki yuvarlak dursun; üst tarafa iki halka, onların üstüne de daha dar bir kat ekle.',
      'Tepesine çatı için uzun ve sivri bir külah koy.',
      'Balkonun çevresine kemerli pencereleri, üstlerine korkuluğu, aşağıdaki duvara küçük pencereleri ve birkaç tuğla çizgisini çiz.',
      'Çatıyı kiremit çizgileriyle, duvarı taş bloklarla kapla; korkuluğa da küçük direkleri ekle.',
      'Kulenin sol yanını ve balkonun altını gölgele, tabanı koyulaştır.',
      'En koyu gölgeler için kaleme daha çok bastır, güneş alan yüzü açık bırak.',
    ],
  },

  globe: {
    en: [
      'Draw one big circle for the Earth.',
      'Draw the big lands inside it: Asia and Australia on the left, the Americas down the right.',
      'Add the icy land along the bottom and scatter the tiny islands across the ocean.',
      'Draw little waves on the sea, a ring around the planet, stars all around, and a small satellite on the left.',
    ],
    tr: [
      'Dünya için kocaman bir daire çiz.',
      'İçine büyük kıtaları çiz: solda Asya ve Avustralya, sağ boyunca Amerika kıtaları.',
      'Alt kenara buzlu kıtayı ekle, okyanusa da minik adaları serpiştir.',
      'Denize küçük dalgalar, gezegenin çevresine bir halka, etrafına yıldızlar, sola da küçük bir uydu çiz.',
    ],
  },

  'adventure-map': {
    en: [
      'Draw a wobbly island shape with a second line following it all the way round.',
      'Draw a row of mountains across the top and a patch of pointy trees on the right.',
      'Wind a river down from the mountains and put a small castle beside it.',
      'Add an empty banner at the top for the name, a second little wood, tufts of grass, and waves in the sea around the island.',
    ],
    tr: [
      'Kıvrımlı bir ada şekli çiz, çevresini boydan boya ikinci bir çizgiyle takip et.',
      'Üst tarafa sıra dağları, sağ tarafa da sivri ağaçlardan bir orman çiz.',
      'Dağlardan aşağı kıvrılan bir nehir çiz, yanına da küçük bir kale koy.',
      'Üste isim için boş bir şerit, ikinci bir küçük orman, çimen tutamları, adanın çevresine de deniz dalgaları ekle.',
    ],
  },

  'bike-hero': {
    en: [
      'Draw a circle for the head, a curved back below it, and two big wheels with the bike frame between them.',
      'Add a helmet, a t-shirt, the arms reaching to the handlebars, and the legs bent down to the pedal.',
      'Draw the face — eyes, nose and a smile — the hair under the helmet, and a big cape flying out behind.',
      'Fill both wheels with spokes, and add the pedal and the chain wheel.',
      'Put a badge on the cape, add speed lines in the wheels, then clouds and the ground behind.',
    ],
    tr: [
      'Kafa için bir daire, altına kavisli bir sırt, aralarında bisiklet iskeleti duran iki büyük tekerlek çiz.',
      'Bir kask, bir tişört, gidona uzanan kollar ve pedala inen bükük bacaklar ekle.',
      'Yüzü çiz — gözler, burun, gülümseme —, kaskın altından çıkan saçları ve arkada uçuşan büyük pelerini ekle.',
      'İki tekerleği de tellerle doldur, pedalı ve zincir dişlisini ekle.',
      'Pelerine bir arma koy, tekerleklere hız çizgileri, arkasına da bulutları ve yeri çiz.',
    ],
  },

  'girl-reading': {
    en: [
      'Draw a circle for the head.',
      'Add two big eyes with eyebrows above them, a tiny nose and a small smile.',
      'Draw the wavy hair all around the head, then the neck and shoulders.',
      'Draw an open book in front of her, with both hands holding its edges.',
      'Add her crossed legs and bare feet sitting under the book.',
      'Draw a wooden bench behind her and tufts of grass along the ground.',
    ],
    tr: [
      'Kafa için bir daire çiz.',
      'İki büyük göz ve üstlerine kaşları, minik bir burun ve küçük bir gülümseme ekle.',
      'Kafanın çevresine dalgalı saçları çiz, sonra boynu ve omuzları ekle.',
      'Önüne açık bir kitap çiz, kenarlarından tutan iki eli de ekle.',
      'Kitabın altında bağdaş kurmuş bacaklarını ve çıplak ayaklarını çiz.',
      'Arkasına tahta bir bank, yere de çimen tutamları çiz.',
    ],
  },

  // Step 4 has a pot of pencils on the table that the finished drawing does not:
  // the source panels swapped the props around. The picture still teaches the
  // table legs, so it stays, and the wording leaves the pot out.
  'desk-boy': {
    en: [
      'Draw a circle for the head, a curved shoulder under it, and a big flat rectangle for the table top.',
      'Add the chair back behind him, both arms resting on the table, and a pencil in his hand.',
      'Draw his hair and face, the collar of his t-shirt, and the sheet of paper under his hands.',
      'Give the table four legs, and draw his legs and shoes underneath it.',
      'Add a desk lamp, a window behind him, floorboards under the table, and the little drawing on his paper.',
    ],
    tr: [
      'Kafa için bir daire, altına kavisli bir omuz, bir de masa tablası için büyük yassı bir dikdörtgen çiz.',
      'Arkasına sandalyenin sırtını, masaya dayalı iki kolunu, eline de bir kalem ekle.',
      'Saçını ve yüzünü, tişörtünün yakasını, ellerinin altına da kâğıdı çiz.',
      'Masaya dört ayak yap, altına da çocuğun bacaklarını ve ayakkabılarını çiz.',
      'Bir masa lambası, arkasına bir pencere, masanın altına döşeme tahtaları, kâğıdına da çizdiği küçük resmi ekle.',
    ],
  },

  'forest-explorer': {
    en: [
      'Draw a circle for the head, a short neck, and a triangle under it for the body.',
      'Add a wide round hat on top, with the hair falling out from under it.',
      'Draw the shirt with its sleeves, the shorts, the boots, and a bag on a strap across the chest.',
      'Draw the face under the hat: two big eyes, eyebrows, a small nose and a smile.',
      'Draw two tall tree trunks behind, one on each side.',
      'Fill the ground with bushes and leafy plants, and start shading the clothes.',
      'Shade the whole forest darker behind, so she stands out in front of it.',
    ],
    tr: [
      'Kafa için bir daire, kısa bir boyun, altına da gövde için bir üçgen çiz.',
      'Üstüne geniş ve yuvarlak bir şapka koy, altından dökülen saçları ekle.',
      'Kollarıyla birlikte gömleği, şortu, çizmeleri, bir de göğsünden geçen askılı çantayı çiz.',
      'Şapkanın altına yüzü çiz: iki büyük göz, kaşlar, küçük bir burun ve bir gülümseme.',
      'Arkasına, iki yana birer uzun ağaç gövdesi çiz.',
      'Yeri çalılarla ve yapraklı bitkilerle doldur, kıyafetleri gölgelemeye başla.',
      'Arkadaki ormanın tamamını koyulaştır ki o önde belirginleşsin.',
    ],
  },
}

// Only these are known to match their pictures. The rest are waiting on the same
// image-by-image pass; until then they render without text.
export const DRAWINGS_AUDITED = new Set(Object.keys(DRAWING_STEPS))

export function stepsFor(drawingKey, lang) {
  const entry = DRAWING_STEPS[drawingKey]
  if (!entry) return null
  return entry[lang] ?? entry.en ?? null
}

export function stepTip(drawingKey, stepIndex, lang) {
  const steps = stepsFor(drawingKey, lang)
  return steps?.[stepIndex] ?? null
}
