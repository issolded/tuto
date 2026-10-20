package app.tuto.mobile
import app.tuto.mobile.data.PlaceValue
import org.junit.Assert.*
import org.junit.Test
class PlaceValueTest {
    @Test fun borrowingAcrossTwoEmptyColumnsPreservesValue() {
        var c=PlaceValue.digits(100,listOf(100,10,1))
        c=PlaceValue.exchange(c,100,false);c=PlaceValue.exchange(c,10,false)
        assertEquals(mapOf(100 to 0,10 to 9,1 to 10),c)
        assertEquals(100,c.entries.sumOf { it.key*it.value })
    }
    @Test fun carryAndLeadingZeroRulesMatchColumnArithmetic() {
        var c=mapOf(100 to 0,10 to 9,1 to 10)
        c=PlaceValue.exchange(c,1,true);c=PlaceValue.exchange(c,10,true)
        assertEquals(mapOf(100 to 1,10 to 0,1 to 0),c)
        assertEquals(2,PlaceValue.bestDigit(listOf(0,2,7),false,true))
        assertEquals(0,PlaceValue.bestDigit(listOf(0,7),false,false))
    }
}
