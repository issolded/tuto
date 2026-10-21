package app.tuto.mobile
import app.tuto.mobile.games.NotebookPuzzles
import org.junit.Test
import org.junit.Assert.*
import kotlin.random.Random

class NotebookPuzzlesTest {
 @Test fun mazesHaveReachableGoalsAndNoOutOfBoundsCells(){repeat(30){seed->val m=NotebookPuzzles.maze(Random(seed));val reached=mutableSetOf(m.start);val q=ArrayDeque<Int>();q.add(m.start);while(q.isNotEmpty()){val p=q.removeFirst();listOf(p-1,p+1,p-m.size,p+m.size).filter{it in m.open&&kotlin.math.abs(it%m.size-p%m.size)+kotlin.math.abs(it/m.size-p/m.size)==1}.forEach{if(reached.add(it))q.add(it)}};assertTrue(reached.contains(m.goal));assertEquals(m.open,reached);assertTrue(m.open.all{it in 0 until m.size*m.size})}}
 @Test fun sudokuHasExactlyOneSolutionAndGivensAgree(){for(advanced in listOf(false,true)){val p=NotebookPuzzles.sudoku(advanced,Random(7));val b=p.given.toMutableList();var solutions=0
  fun solve(){if(solutions>1)return;val i=b.indexOf(0);if(i<0){solutions++;assertEquals(p.solution,b);return};val x=i%p.size;val y=i/p.size
   for(v in 1..p.size){if((0 until p.size).any{b[y*p.size+it]==v||b[it*p.size+x]==v})continue;val bx=x/p.box*p.box;val by=y/p.box*p.box;if((0 until p.box).any{dy->(0 until p.box).any{dx->b[(by+dy)*p.size+bx+dx]==v}})continue;b[i]=v;solve();b[i]=0}
  };solve();assertEquals(1,solutions)
 }}
 @Test fun wordHuntEveryTargetCanBeSelectedAsAStraightLine(){repeat(20){seed->val g=NotebookPuzzles.wordGrid(Random(seed));g.words.forEach{word->assertTrue(word,(g.letters.indices).any{a->g.letters.indices.any{b->NotebookPuzzles.line(a,b,g.size).map{g.letters[it]}.joinToString("")==word}})}}}
 @Test fun wordSelectionCannotWrapAroundRows(){assertTrue(NotebookPuzzles.line(6,7,7).isEmpty());assertEquals(listOf(0,8,16),NotebookPuzzles.line(0,16,7));assertEquals(listOf(2,1,0),NotebookPuzzles.line(2,0,7))}
}
