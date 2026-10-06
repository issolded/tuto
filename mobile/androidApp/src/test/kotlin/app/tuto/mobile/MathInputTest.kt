package app.tuto.mobile
import app.tuto.mobile.data.MathInput
import org.junit.Assert.*
import org.junit.Test
class MathInputTest {
 @Test fun signedIntegersAndDecimalsCanBeEnteredAndCorrected() {
  var s="";for(k in listOf("±","1","2",".","5")) s=MathInput.next(s,k)
  assertEquals("-12.5",s);assertTrue(MathInput.valid(s));assertEquals("12.5",MathInput.next(s,"±"));assertEquals("-12.",MathInput.next(s,"⌫"));assertEquals(s,MathInput.next(s,"."))
 }
 @Test fun bareSignIsNotAnAnswerAndDecimalCanStartAtZero() {
  assertFalse(MathInput.valid("-"));assertFalse(MathInput.valid(""));assertEquals("-0.",MathInput.next("-","."));assertEquals("0.",MathInput.next("","."));assertEquals("2",MathInput.next("2","NaN"))
 }
}
