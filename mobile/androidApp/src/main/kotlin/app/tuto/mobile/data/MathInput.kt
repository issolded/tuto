package app.tuto.mobile.data

object MathInput {
    fun next(current: String, key: String): String = when(key) {
        "⌫" -> current.dropLast(1)
        "±" -> if(current.startsWith("-")) current.drop(1) else "-$current"
        "." -> if(current.contains('.')) current else when(current) { "" -> "0."; "-" -> "-0."; else -> "$current." }
        else -> if(key.length == 1 && key[0].isDigit()) (current+key).take(12) else current
    }
    fun valid(current: String): Boolean = current.toDoubleOrNull()?.isFinite() == true
}
