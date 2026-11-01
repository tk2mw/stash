; electron-builder includes this in the installer (nsis.include defaults to build/installer.nsh).
; stash brings everything it needs with it; the one thing it can't bring is Windows 10: Electron won't open on 7 or 8,
; so say it there instead of installing an app that does nothing. 64-bit is checked by electron-builder itself.
!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "stash needs Windows 10 or 11 (64-bit)."
    Quit
  ${EndIf}
!macroend
