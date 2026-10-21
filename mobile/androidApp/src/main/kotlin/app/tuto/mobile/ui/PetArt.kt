package app.tuto.mobile.ui

/** Each species owns its whole silhouette, feet and tail, not just interchangeable ears. */
internal fun petDrawing(kind:Int,color:Int=0):String {
 if(kind<0)return ""
 val shadow="<ellipse cx='61' cy='111' rx='43' ry='4' fill='#E5E3DD' stroke='none'/>"
 val face="<ellipse cx='49' cy='48' rx='2.5' ry='3.5' fill='#202022'/><ellipse cx='69' cy='47' rx='2.5' ry='3.5' fill='#202022'/><path d='M55 58q5-5 10 0l-5 4Z' fill='#202022'/><path d='M60 62q-2 9-9 3m9-3q2 8 9 2' fill='none' stroke-width='1.8'/>"
 val art=when(kind){
  0->"""<path d='M84 97q17-2 14-24 17 21-2 32' fill='none' stroke-width='7'/>
  <path d='M43 66q-21 21-13 39l14 3h37q15-3 10-18L76 65Z'/>
  <path d='m46 83-1 20q-13-1-10 7h18l2-30m12 0 1 23q13-1 10 7H61l-1-30' fill='white'/>
  <path d='M32 37q-15 4-14 27 4 13 16 2m47-31q18 5 17 27-2 13-16 4' fill='#202022'/>
  <path d='M33 36q8-16 28-15 22 0 27 24l-2 14q-2 18-24 18-28 0-31-21Z'/>
  <path d='m36 32 7-7m3 0 7-5m5 1 7 1' fill='none'/>
  $face<path d='M56 69q4 10 8 0' fill='#F29485' stroke-width='1.5'/><path d='M42 77q17 8 36 0' fill='none' stroke='#41B6B5' stroke-width='5'/><circle cx='62' cy='82' r='3' fill='#F4C650'/>"""
  1->"""<path d='M81 102Q110 85 99 61q-8-6-10 1' fill='none' stroke-width='7'/>
  <path d='M46 65q-10 20-12 35-1 10 17 10h27q11-2 7-14L73 65Z'/>
  <path d='m48 86 2 18-5 5m16-24 1 19 7 5M78 92q-10 0-8 12' fill='none' stroke-width='2'/>
  <path d='M31 39 28 15l21 15q12-5 23-1L89 13l-2 28q11 31-23 35-40 2-33-37Z'/>
  <path d='m35 31-1-8 9 7m37-1 4-7-1 12M53 29l2 7m7-8v7m7-5-1 7' fill='none' stroke-width='2'/>
  $face<path d='m40 58-17-3m17 10-18 3m56-10 18-5m-18 12 19 3' fill='none' stroke-width='1.5'/><path d='M46 77h27' stroke='#F29485' stroke-width='4'/>"""
  2->"""<circle cx='87' cy='96' r='10'/>
  <path d='M47 67q-17 10-20 28-2 14 17 15h31q15-2 9-22L70 65Z'/>
  <ellipse cx='39' cy='97' rx='15' ry='13'/><ellipse cx='43' cy='109' rx='17' ry='5'/>
  <path d='M56 83v22q-8 3-3 6h18q5-3-4-6l1-22' fill='white'/>
  <path d='M41 39Q10 9 20 5q10-4 31 28M60 35Q53-7 65 2q12 6 7 35'/>
  <path d='M43 33 26 14m38 14L64 10' fill='none' stroke='#E5D5CC' stroke-width='4'/>
  <path d='M35 40q5-12 24-10 25 0 26 25 0 19-25 20-30-1-28-22Z'/>
  $face<path d='M45 77h29' stroke='#F4C650' stroke-width='4'/><path d='m30 107 1 4m6-5 1 5' stroke-width='1.5'/>"""
  3->"""<path d='M43 99Q12 106 10 71q23-2 33 22Z'/><path d='M10 71q6 1 11 8l-5 8 9 2-5 8Q8 87 10 71' fill='#202022'/>
  <path d='M49 64q-14 16-13 38-1 9 13 9h32q11-2 5-15L73 63Z'/>
  <path d='m53 83-1 22-7 5m20-28 1 22 7 6' fill='none' stroke-width='2'/>
  <path d='M34 39 33 12l21 18 16-1 20-18-1 30 7 10-9 3 5 8-12 8q-16 15-34 0l-15-7 6-9-10-3Z'/>
  <path d='m39 33-1-11 11 11m29-1 7-11-1 15' fill='#202022'/>
  $face<path d='M46 79h30' stroke='#F29485' stroke-width='4'/>"""
  4->"""<ellipse cx='61' cy='88' rx='31' ry='24'/><ellipse cx='35' cy='87' rx='10' ry='19' fill='#202022'/><ellipse cx='86' cy='87' rx='10' ry='19' fill='#202022'/>
  <ellipse cx='42' cy='105' rx='15' ry='12' fill='#202022'/><ellipse cx='79' cy='105' rx='15' ry='12' fill='#202022'/>
  <ellipse cx='42' cy='106' rx='7' ry='6' stroke='none'/><ellipse cx='79' cy='106' rx='7' ry='6' stroke='none'/>
  <circle cx='32' cy='24' r='12' fill='#202022'/><circle cx='86' cy='24' r='12' fill='#202022'/>
  <ellipse cx='60' cy='47' rx='36' ry='29'/><ellipse cx='44' cy='47' rx='11' ry='13' fill='#202022'/><ellipse cx='76' cy='47' rx='11' ry='13' fill='#202022'/>
  <circle cx='47' cy='45' r='3' stroke='none'/><circle cx='73' cy='45' r='3' stroke='none'/><path d='M55 57q5-5 10 0l-5 5Z' fill='#202022'/><path d='M52 64q8 9 16 0' fill='none' stroke-width='2'/><path d='M39 76q20 7 42-1' stroke='#41B6B5' stroke-width='4' fill='none'/>"""
  else->"""<path d='m24 91-9 13h15l7-11m22 0 1 16h14l-2-15m14-2 10 15h11L96 88'/>
  <path d='M29 86q-18 3-24 11l20 1' fill='none'/>
  <path d='M76 79q-1-25 15-31 22-7 23 12 1 20-23 27l-2 11-16-3Z'/>
  <circle cx='99' cy='59' r='2.7' fill='#202022'/><path d='M104 70q-5 5-10 0' stroke-width='2' fill='none'/>
  <path d='M16 90Q16 40 54 43q34 0 33 47-32 14-71 0Z' fill='#8DAB73'/>
  <path d='m41 48-10 18 10 18 24-1 13-18-14-18m-33 19-14 8m24 10-3 13m27-14 7 12m6-30 7 7' fill='none' stroke-width='2.2'/><path d='M16 90q32 14 71 0' fill='none' stroke-width='4'/>"""
 }
 return shadow+"<g fill='${petColors(kind)[color.coerceIn(0,4)]}'>"+art.replace("fill='white'", "fill='${petColors(kind)[color.coerceIn(0,4)]}'")+"</g>"
}
internal fun petColors(kind:Int)=when(kind){
  3->listOf("#FFFFFF","#D8A077","#C8895F","#D5C5AF","#EEE6D9")
  4->listOf("#FFFFFF","#FAF5EB","#EBE7DE","#E5E3DE","#F2E9D9")
  5->listOf("#FFFFFF","#C7D1AE","#B8C7A0","#D4CCAE","#CAD5C5")
  else->listOf("#FFFFFF","#D9C6AC","#AD8E75","#AEB4BA","#E4D9CD")
}
