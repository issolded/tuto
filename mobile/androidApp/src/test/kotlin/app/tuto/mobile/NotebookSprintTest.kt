package app.tuto.mobile

import app.tuto.mobile.data.Avatar
import app.tuto.mobile.games.NotebookPuzzles
import app.tuto.mobile.ui.*
import org.junit.Assert.*
import org.junit.Test

class NotebookSprintTest {
 @Test fun avatarRoundTripsAllIndependentChoices(){
  val a=Avatar(hair=9,skin=4,shirt=3,accessory=2,pet=2,face=4,outfit=2,gender=1,nickname="Ada",petName="Bunny",hairColor=4,petColor=3)
  assertEquals(a,Avatar.read(a.json()))
  assertEquals(a.copy(hairColor=2),Avatar.read(a.copy(hairColor=2).json()))
 }
 @Test fun legacyExpressionDoesNotBecomeFacialIdentity(){val a=Avatar.read("""{"face":5,"hair":3,"skin":2,"pet":2,"outfit":2,"nickname":"Ada"}""");assertEquals(0,a.face);assertEquals(3,a.hair);assertEquals(1,a.gender);assertEquals(2,a.skin);assertEquals("Ada",a.nickname)}
 @Test fun eachGenderHasFiveHairstylesAndFiveFaces(){for(gender in 0..1){assertEquals(5,hairOptions(gender).distinct().size);assertEquals(5,hairOptions(gender).map{avatarDrawing(Avatar(hair=it,gender=gender),FoxPose.Welcome)}.distinct().size);assertEquals(5,(0..4).map{avatarDrawing(Avatar(face=it,gender=gender),FoxPose.Welcome)}.distinct().size)}}
 @Test fun allExpressionsAreReusableWithoutChangingIdentity(){val a=Avatar(face=2,hair=9);for(pose in FoxPose.entries){val art=avatarDrawing(a,pose);assertTrue(art.contains("M73 77q5-5 10 0"));assertEquals(2,a.face)}}
 @Test fun petsHaveIndependentSilhouettesAndColors(){assertEquals(6,(0..5).map{petDrawing(it)}.distinct().size);for(kind in 0..5){assertEquals(5,(0..4).map{petDrawing(kind,it)}.distinct().size)}}
 @Test fun wordHuntOverlapReverseWrongAndFinalWord(){
  val g=NotebookPuzzles.WordGrid(3,"CATAXERED".toList(),listOf("CAT","CAR","TED"))
  var state=NotebookPuzzles.WordSelection()
  state=NotebookPuzzles.select(g,state,0,2);assertEquals(setOf(0,1,2),state.marked)
  val wrong=NotebookPuzzles.select(g,state,0,5);assertEquals(state,wrong)
  state=NotebookPuzzles.select(g,state,6,0);assertEquals(setOf("CAT","CAR"),state.found);assertEquals(setOf(0,1,2,3,6),state.marked)
  assertEquals(state,NotebookPuzzles.select(g,state,0,2))
  state=NotebookPuzzles.select(g,state,2,8);assertEquals(g.words.toSet(),state.found);assertTrue(state.marked.containsAll(listOf(0,1,2,3,5,6,8)))
 }
 @Test fun diagonalAndBounds(){val g=NotebookPuzzles.WordGrid(3,"CATAXERED".toList(),listOf("CXD"));assertEquals(setOf("CXD"),NotebookPuzzles.select(g,NotebookPuzzles.WordSelection(),0,8).found);assertTrue(NotebookPuzzles.line(-1,8,3).isEmpty());assertTrue(NotebookPuzzles.line(0,9,3).isEmpty());assertTrue(NotebookPuzzles.line(0,0,0).isEmpty())}
}
