package app.tuto.mobile.data

/** The web provides geometry, Android owns layout and explicit ink. */
object SvgMarkup {
    fun prepare(markup: String): String {
        val root = Regex("<svg\\b[^>]*>").find(markup) ?: return markup
        val clean = root.value.replace(Regex("\\s(?:style|width|height)=\"[^\"]*\""), "")
        return markup.replaceRange(root.range, clean).replace("currentColor", "#14284B")
    }
}
