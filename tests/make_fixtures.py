import struct, zipfile, os

ENDOFCHAIN = 0xFFFFFFFE
FREESECT   = 0xFFFFFFFF
FATSECT    = 0xFFFFFFFD

def mp3_bytes(n_frames=200, id3=True):
    """Valid MPEG-1 Layer III frames, 128kbps / 44.1kHz."""
    out = b""
    if id3:
        out += b"ID3\x03\x00\x00\x00\x00\x00\x0a" + b"\x00" * 10
    frame_len = (144 * 128000) // 44100   # 417
    for _ in range(n_frames):
        out += b"\xff\xfb\x90\x00" + b"\x55" * (frame_len - 4)
    return out

def packager(payload, name="voice-memo.mp3", path=rb"C:\Users\sender\voice-memo.mp3"):
    b  = struct.pack("<H", 2)
    b += name.encode() + b"\x00"
    b += path + b"\x00"
    b += struct.pack("<I", 3)
    b += struct.pack("<I", len(path) + 1) + path + b"\x00"
    b += struct.pack("<I", len(payload)) + payload
    return b

def make_cfb(stream_name, payload):
    SEC = 512
    PER = SEC // 4                       # 128 FAT entries per sector
    data_secs = (len(payload) + SEC - 1) // SEC

    # Grow the FAT until it can describe the whole file (incl. itself).
    n_fat = 1
    while n_fat * PER < n_fat + 1 + data_secs:
        n_fat += 1

    dir_sec    = n_fat                   # sectors 0..n_fat-1 are FAT
    first_data = n_fat + 1

    fat = [FREESECT] * (n_fat * PER)
    for i in range(n_fat):
        fat[i] = FATSECT
    fat[dir_sec] = ENDOFCHAIN
    for i in range(data_secs):
        s = first_data + i
        fat[s] = ENDOFCHAIN if i == data_secs - 1 else s + 1
    fat_bytes = b"".join(struct.pack("<I", x) for x in fat)

    # ---- Directory
    def entry(name, etype, start, size, child=FREESECT):
        nm = name.encode("utf-16-le") + b"\x00\x00"
        e  = nm.ljust(64, b"\x00")
        e += struct.pack("<H", len(nm))
        e += struct.pack("<BB", etype, 1)
        e += struct.pack("<III", FREESECT, FREESECT, child)      # sibs + child
        e += b"\x00" * 16                                        # clsid
        e += struct.pack("<I", 0)                                # state
        e += b"\x00" * 16                                        # timestamps
        e += struct.pack("<I", start)
        e += struct.pack("<II", size & 0xFFFFFFFF, size >> 32)
        assert len(e) == 128, len(e)
        return e

    dirsec  = entry("Root Entry", 5, ENDOFCHAIN, 0, child=1)
    dirsec += entry(stream_name, 2, first_data, len(payload))
    dirsec += b"\x00" * 128 * 2
    dirsec  = dirsec.ljust(SEC, b"\x00")

    # ---- Header
    h  = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 16
    h += struct.pack("<HHH", 0x3E, 3, 0xFFFE)
    h += struct.pack("<HH", 9, 6)                 # sector shift, mini shift
    h += b"\x00" * 6
    h += struct.pack("<I", 0)                     # num dir sectors (v3)
    h += struct.pack("<I", n_fat)                 # num FAT sectors
    h += struct.pack("<I", dir_sec)               # first dir sector
    h += struct.pack("<I", 0)                     # txn
    h += struct.pack("<I", 4096)                  # mini cutoff
    h += struct.pack("<I", ENDOFCHAIN)            # first minifat
    h += struct.pack("<I", 0)                     # num minifat
    h += struct.pack("<I", ENDOFCHAIN)            # first difat
    h += struct.pack("<I", 0)                     # num difat
    difat = [i for i in range(n_fat)] + [FREESECT] * (109 - n_fat)
    h += b"".join(struct.pack("<I", x) for x in difat)
    assert len(h) == 512, len(h)

    return h + fat_bytes + dirsec + payload.ljust(data_secs * SEC, b"\x00")


DOC_XML = b'<?xml version="1.0"?><w:document xmlns:w="x"><w:body/></w:document>'

def build_docx(path, ole_stream, wrap_packager, extra_media=None):
    audio = mp3_bytes()
    payload = packager(audio) if wrap_packager else audio
    cfb = make_cfb(ole_stream, payload)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", b"<Types/>")
        z.writestr("_rels/.rels", b"<Relationships/>")
        z.writestr("word/document.xml", DOC_XML)
        z.writestr("word/_rels/document.xml.rels", b"<Relationships/>")
        z.writestr("word/media/image1.emf", b"\x01\x00\x00\x00" + b"\x00" * 900)
        z.writestr("word/embeddings/oleObject1.bin", cfb)
        if extra_media:
            z.writestr("word/media/audio1.mp3", audio)
    return len(audio)

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
os.makedirs("fixtures", exist_ok=True)
n1 = build_docx("fixtures/packaged.docx", "Package", True)
n2 = build_docx("fixtures/ole10.docx", "\x01Ole10Native", True)
n3 = build_docx("fixtures/raw_stream.docx", "CONTENTS", False)
n4 = build_docx("fixtures/plain_media.docx", "Package", True, extra_media=True)

# legacy .doc: a bare compound file
open("fixtures/legacy.doc", "wb").write(make_cfb("Package", packager(mp3_bytes())))

print("expected audio size:", n1)
for f in sorted(os.listdir("fixtures")):
    print(f, os.path.getsize("fixtures/" + f))
