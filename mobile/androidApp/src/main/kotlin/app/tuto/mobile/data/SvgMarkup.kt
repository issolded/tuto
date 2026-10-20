package app.tuto.mobile.data

import java.net.URLDecoder
import java.util.Base64

/** The web provides geometry, Android owns layout and explicit ink. */
object SvgMarkup {
    fun prepare(markup: String): String {
        // AndroidSVG cannot resolve SVG data URLs in <image>. Keep their vectors,
        // viewBox and placement by embedding them as nested SVG viewports instead.
        val expanded = Regex("<image\\b[^>]*?/>", RegexOption.DOT_MATCHES_ALL).replace(markup) { image ->
            val href = Regex("(?:xlink:)?href=\"([^\"]*)\"").find(image.value)
            val uri = href?.groupValues?.get(1).orEmpty()
            if (!uri.startsWith("data:image/svg+xml")) image.value else {
                val payload = uri.substringAfter(',')
                val decoded = if (uri.substringBefore(',').endsWith(";base64")) {
                    String(Base64.getDecoder().decode(payload), Charsets.UTF_8)
                } else URLDecoder.decode(payload.replace("+", "%2B"), "UTF-8")
                val attrs = image.value.replace(href!!.value, "")
                val placement = listOf("x", "y", "width", "height", "transform", "opacity", "preserveAspectRatio")
                    .mapNotNull { name -> Regex("\\s$name=\"[^\"]*\"").find(attrs)?.value }
                    .joinToString("")
                val nestedRoot = Regex("<svg\\b[^>]*>").find(decoded)
                if (nestedRoot == null) image.value else {
                    val nested = nestedRoot.value.replace(Regex("\\s(?:x|y|width|height|style)=(?:\"[^\"]*\"|'[^']*')"), "")
                    decoded.replaceRange(nestedRoot.range, nested.dropLast(1) + placement + ">")
                }
            }
        }
        val root = Regex("<svg\\b[^>]*>").find(expanded) ?: return expanded
        val clean = root.value.replace(Regex("\\s(?:style|width|height)=\"[^\"]*\""), "")
        return expanded.replaceRange(root.range, clean).replace("currentColor", "#14284B")
    }
}
