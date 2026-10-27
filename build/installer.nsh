; Al instalar, el usuario elige el idioma del instalador (inglés o español).
; Esa misma elección se guarda en language.txt para que Vinilify arranque en ese idioma
; (lo lee installerLanguage() en src/main.js la primera vez que se abre).
!macro customInstall
  FileOpen $0 "$INSTDIR\language.txt" w
  ; 1034 = español (LANG_SPANISH); cualquier otro idioma queda en inglés.
  StrCmp $LANGUAGE "1034" 0 +3
    FileWrite $0 "es"
    Goto +2
  FileWrite $0 "en"
  FileClose $0
!macroend
