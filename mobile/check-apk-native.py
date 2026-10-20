"""Reject native APKs that cannot load on 16 KiB Android; no third-party dependencies."""
import struct
import sys
import zipfile

apk = sys.argv[1]
checked = 0
with zipfile.ZipFile(apk) as archive, open(apk, "rb") as stream:
    for entry in archive.infolist():
        if not entry.filename.startswith(("lib/arm64-v8a/", "lib/x86_64/")) or not entry.filename.endswith(".so"):
            continue
        data = archive.read(entry)
        assert data[:6] == b"\x7fELF\x02\x01", entry.filename
        offset = struct.unpack_from("<Q", data, 32)[0]
        size, count = struct.unpack_from("<HH", data, 54)
        segments = [struct.unpack_from("<IIQQQQQQ", data, offset + index * size) for index in range(count)]
        for kind, flags, file_offset, address, _, file_size, memory_size, alignment in segments:
            if kind == 1:  # PT_LOAD
                assert alignment >= 16384 and (file_offset - address) % 16384 == 0, (entry.filename, "unaligned LOAD")
            if kind == 0x6474e552:  # PT_GNU_RELRO
                # Some older libraries leave a padding gap rather than extending RELRO.
                # Rounding protection up must never cover subsequent writable content.
                end = address + memory_size
                rounded_end = (end + 16383) // 16384 * 16384
                for segment in segments:
                    if segment[0] == 1 and segment[1] & 2:
                        assert max(end, segment[3]) >= min(rounded_end, segment[3] + segment[6]), (entry.filename, "RELRO overlaps writable data")
        if entry.compress_type == zipfile.ZIP_STORED:
            stream.seek(entry.header_offset)
            name_length, extra_length = struct.unpack_from("<HH", stream.read(30), 26)
            assert (entry.header_offset + 30 + name_length + extra_length) % 16384 == 0, (entry.filename, "unaligned ZIP entry")
        print("16 KiB aligned:", entry.filename)
        checked += 1
assert checked >= 2, "Missing 64-bit native libraries"
print("Native APK validation passed:", checked, "libraries")
