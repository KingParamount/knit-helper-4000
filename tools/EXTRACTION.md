# How the data in this repo was obtained

Source: three demo installers for Knitware 2.50 (Morningdew Consulting Services, 2005) —
`Basics250Demo.EXE`, `Sweaters250Demo.EXE`, `Skirts250Demo.EXE`.

Nothing here required Windows, Wine, or the Borland Database Engine. All of it ran on Linux.

## The chain

```
Basics250Demo.EXE
  └─ zip SFX (7z x)                          → _SETUP.1, SETUP.PKG, ...
      └─ InstallShield 3 "Z" archive          → too old for `unshield`;
         (unshieldv3, built from                 needed github.com/wfr/unshieldv3
          source — see below)
          ├─ kwd250.exe                       → Delphi PE32
          │   ├─ RT_RCDATA x57                → binary DFM forms  (tools/dfm.py)
          │   ├─ string constants             → option vocabulary, constraint messages
          │   └─ RT_STRING                    → misc
          ├─ SizeStd.DB, Pattd230.DB, ...     → Paradox 5 tables (tools/paradox.py)
          └─ KWDHELP.HLP                      → WinHelp (helpdeco → RTF → striprtf → txt)
```

## Reproducing it

```bash
apt-get install -y p7zip-full cmake build-essential
pip install pefile striprtf --break-system-packages

# 1. unwrap the self-extracting zip
7z x Sweaters250Demo.EXE -osfx

# 2. build unshieldv3 (the bundled `unshield` only handles IS5+; these are IS3 "Z" archives)
curl -sL -o u3.tar.gz https://codeload.github.com/wfr/unshieldv3/tar.gz/refs/heads/master
tar xzf u3.tar.gz && cd unshieldv3-master && mkdir b && cd b && cmake .. && make

# 3. extract the payload
./unshieldv3 extract ../../sfx/_SETUP.1 out/

# 4. Paradox tables → CSV
python3 -c "from paradox import ParadoxTable; ..."   # see tools/paradox.py

# 5. help file → text
curl -sL -o hd.tar.gz https://codeload.github.com/pmachapman/helpdeco/tar.gz/refs/heads/master
tar xzf hd.tar.gz && cd helpdeco-master/gcc && make
./helpdeco KWSHELP.HLP -y          # → KWSHELP.rtf
python3 -c "from striprtf.striprtf import rtf_to_text; ..."
```

## `tools/paradox.py`

Pure-Python Paradox `.DB` reader. No packaged reader survives in current distro repos.
Handles Alpha, Number (double), Short, Long, AutoInc, Date, Logical.

Paradox quirks worth knowing:
- Header: `recordSize` @0x00, `headerSize` @0x02, `numRecords` @0x06, `numFields` @0x21.
  Field type/size pairs start at 0x78; names follow the pointer arrays.
- Numbers are **big-endian** doubles with a sign trick: if the top bit of byte 0 is set,
  clear it (positive); otherwise invert all 8 bytes (negative). All-zero = NULL.
- Data blocks: 6-byte header (`nextBlock`, `prevBlock`, `addDataSize`); record count in
  a block is `addDataSize / recordSize + 1`. Follow the `nextBlock` chain from `firstBlock`.
- Verify your parse: `sum(field sizes) == recordSize`. If it doesn't match, you're misaligned.

## `tools/dfm.py`

Binary DFM (`TPF0`) decompiler for Delphi form resources. Two things that will bite you:

- The filer prefix byte is present only when `(byte & 0xF0) == 0xF0` — **not** when the
  top nibble is merely non-zero. Getting this wrong eats class-name length bytes.
- `vaBinary` must consume its payload, not just read the length.

Note: Knitware's combo boxes are populated at **runtime**, so the DFMs contain no `Items`.
The option vocabulary came from string constants in the binary and from the manual, not
from the forms. The DFMs are still useful for field labels, `Hint` text and layout.

## What was deliberately not extracted

The single-char storage codes (`Shoulder='R'`, `BodyLCode='K'`). They're only needed to
read users' saved `.DB` files, which is an explicit non-goal. Recovering them would mean
either disassembling the `*Change` handlers or black-box testing the app under Wine.
