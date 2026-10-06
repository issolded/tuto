package app.tuto.mobile.data

object PlaceValue {
    fun digits(n:Int, places:List<Int>) = places.associateWith { n/it%10 }
    fun exchange(counts:Map<Int,Int>, place:Int, up:Boolean):Map<Int,Int> {
        val destination=if(up) place*10 else place/10
        if(destination !in counts || counts.getValue(place)<if(up)10 else 1) return counts
        return counts + (place to (counts.getValue(place)-if(up)10 else 1)) + (destination to (counts.getValue(destination)+if(up)1 else 10))
    }
    fun bestDigit(digits:List<Int>, biggest:Boolean, first:Boolean):Int? {
        val pool=if(first && !biggest) digits.filter { it!=0 } else digits
        return if(biggest)pool.maxOrNull() else pool.minOrNull()
    }
}
