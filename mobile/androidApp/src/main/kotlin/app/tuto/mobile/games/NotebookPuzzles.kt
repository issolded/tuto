package app.tuto.mobile.games

import kotlin.random.Random

object NotebookPuzzles {
 data class Sudoku(val size:Int,val box:Int,val given:List<Int>,val solution:List<Int>)
 fun sudoku(advanced:Boolean,random:Random=Random.Default):Sudoku {
  val size=if(advanced)9 else 4;val box=if(advanced)3 else 2
  val puzzle=if(advanced)"530070000600195000098000060800060003400803001700020006060000280000419005000080079"else"1204041001404001"
  val solved=if(advanced)"534678912672195348198342567859761423426853791713924856961537284287419635345286179"else"1234341221434321"
  val digits=(1..size).shuffled(random)
  fun map(c:Char)=if(c=='0')0 else digits[c.digitToInt()-1]
  return Sudoku(size,box,puzzle.map(::map),solved.map(::map))
 }
 data class Maze(val size:Int,val open:Set<Int>,val start:Int,val goal:Int)
 fun maze(random:Random=Random.Default):Maze {
  val n=11;val opened=mutableSetOf(n+1)
  fun carve(x:Int,y:Int){for((dx,dy)in listOf(2 to 0,-2 to 0,0 to 2,0 to -2).shuffled(random)){val nx=x+dx;val ny=y+dy;val k=ny*n+nx;if(nx in 1 until n-1&&ny in 1 until n-1&&k !in opened){opened.add((y+dy/2)*n+x+dx/2);opened.add(k);carve(nx,ny)}}}
  carve(1,1);return Maze(n,opened,n+1,(n-2)*n+n-2)
 }
 data class WordGrid(val size:Int,val letters:List<Char>,val words:List<String>)
 fun wordGrid(random:Random=Random.Default):WordGrid {
  val n=7;val words=listOf("CAT","DOG","MOON","STAR","BIRD");val cells=MutableList(n*n){('A'..'Z').random(random)}
  val paths=listOf(listOf(0,1,2),listOf(14,21,28),listOf(3,11,19,27),listOf(6,12,18,24),listOf(35,36,37,38))
  val mirror=random.nextBoolean()
  words.zip(paths).forEach{(word,path)->path.forEachIndexed{i,index->val cell=if(mirror)(index/n)*n+(n-1-index%n)else index;cells[cell]=word[i]}}
  return WordGrid(n,cells,words)
 }
 fun line(start:Int,end:Int,size:Int):List<Int>{
  if(size<=0||start !in 0 until size*size||end !in 0 until size*size)return emptyList()
  val x=start%size;val y=start/size;val dx=end%size-x;val dy=end/size-y
  if(dx!=0&&dy!=0&&kotlin.math.abs(dx)!=kotlin.math.abs(dy))return emptyList()
  val steps=maxOf(kotlin.math.abs(dx),kotlin.math.abs(dy));if(steps==0)return listOf(start)
  return (0..steps).map{(y+dy/steps*it)*size+x+dx/steps*it}
 }
 data class WordSelection(val found:Set<String> = emptySet(),val marked:Set<Int> = emptySet())
 fun select(grid:WordGrid,state:WordSelection,start:Int,end:Int):WordSelection {
  val path=line(start,end,grid.size);if(path.isEmpty())return state
  val word=path.map{grid.letters[it]}.joinToString("")
  val match=grid.words.firstOrNull{it==word||it==word.reversed()}?:return state
  return WordSelection(state.found+match,state.marked+path)
 }
}
