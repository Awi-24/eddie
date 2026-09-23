; Eddie NSIS installer hooks — default Markdown file association.

!include "LogicLib.nsh"

!ifndef EzdownFileAssociation_INCLUDED
!define EzdownFileAssociation_INCLUDED

!macro RegisterExtensionCall _EXECUTABLE _EXTENSION _DESCRIPTION
  Push `${_DESCRIPTION}`
  Push `${_EXTENSION}`
  Push `${_EXECUTABLE}`
  Call EzdownRegisterExtension
!macroend

!macro UnRegisterExtensionCall _EXTENSION _DESCRIPTION
  Push `${_DESCRIPTION}`
  Push `${_EXTENSION}`
  Call EzdownUnRegisterExtension
!macroend

!define ezdownRegisterExtension `!insertmacro RegisterExtensionCall`

Function EzdownRegisterExtension
  Exch $R2
  Exch
  Exch $R1
  Exch
  Exch 2
  Exch $R0
  Exch 2
  Push $0
  Push $1

  ReadRegStr $1 HKCR $R1 ""
  StrCmp "$1" "" NoBackup
  StrCmp "$1" "$R0" NoBackup
    WriteRegStr HKCR $R1 "backup_val" "$1"
NoBackup:
  WriteRegStr HKCR $R1 "" "$R0"

  ReadRegStr $0 HKCR $R0 ""
  StrCmp $0 "" 0 Skip
    WriteRegStr HKCR "$R0" "" "$R0"
    WriteRegStr HKCR "$R0\shell" "" "open"
    WriteRegStr HKCR "$R0\DefaultIcon" "" "$R2,0"
Skip:
  WriteRegStr HKCR "$R0\shell\open\command" "" '"$R2" "%1"'

  Pop $1
  Pop $0
  Pop $R2
  Pop $R1
  Pop $R0
FunctionEnd

Function EzdownUnRegisterExtension
  Exch $R1
  Exch
  Exch $R0
  Exch
  Push $0
  Push $1

  ReadRegStr $1 HKCR $R0 ""
  StrCmp $1 $R1 0 NoOwn
  ReadRegStr $1 HKCR $R0 "backup_val"
  StrCmp $1 "" 0 Restore
  DeleteRegKey HKCR $R0
  Goto NoOwn
Restore:
  WriteRegStr HKCR $R0 "" $1
  DeleteRegValue HKCR $R0 "backup_val"
  DeleteRegKey HKCR $R1
NoOwn:
  Pop $1
  Pop $0
  Pop $R1
  Pop $R0
FunctionEnd

Function un.EzdownUnRegisterExtension
  Exch $R1
  Exch
  Exch $R0
  Exch
  Push $0
  Push $1

  ReadRegStr $1 HKCR $R0 ""
  StrCmp $1 $R1 0 NoOwn
  ReadRegStr $1 HKCR $R0 "backup_val"
  StrCmp $1 "" 0 Restore
  DeleteRegKey HKCR $R0
  Goto NoOwn
Restore:
  WriteRegStr HKCR $R0 "" $1
  DeleteRegValue HKCR $R0 "backup_val"
  DeleteRegKey HKCR $R1
NoOwn:
  Pop $1
  Pop $0
  Pop $R1
  Pop $R0
FunctionEnd

!macro UnRegisterExtensionUnCall _EXTENSION _DESCRIPTION
  Push `${_DESCRIPTION}`
  Push `${_EXTENSION}`
  Call un.EzdownUnRegisterExtension
!macroend

!define ezdownUnRegisterExtension `!insertmacro UnRegisterExtensionUnCall`

!macro SetDefaultMarkdownExtensions
  ${ezdownRegisterExtension} "$INSTDIR\${MAINBINARYNAME}.exe" ".md" "ezdown.md"
  ${ezdownRegisterExtension} "$INSTDIR\${MAINBINARYNAME}.exe" ".markdown" "ezdown.markdown"
  ${ezdownRegisterExtension} "$INSTDIR\${MAINBINARYNAME}.exe" ".mdown" "ezdown.mdown"
  ${ezdownRegisterExtension} "$INSTDIR\${MAINBINARYNAME}.exe" ".mkd" "ezdown.mkd"
!macroend

!macro ClearDefaultMarkdownExtensions
  ${ezdownUnRegisterExtension} "ezdown.md" ".md"
  ${ezdownUnRegisterExtension} "ezdown.markdown" ".markdown"
  ${ezdownUnRegisterExtension} "ezdown.mdown" ".mdown"
  ${ezdownUnRegisterExtension} "ezdown.mkd" ".mkd"
!macroend

!endif

; Eddie used to ship as "ez.down" (different product name = different install
; dir and uninstall key). Remove that copy so updating doesn't leave two apps
; installed. Preferences survive: the app identifier is unchanged.
; ponytail: drop this once no 1.0.x "ez.down" installs remain.
!macro NSIS_HOOK_PREINSTALL
  Push $R8
  Push $R9
  ReadRegStr $R8 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\ez.down" "UninstallString"
  ReadRegStr $R9 SHCTX "${MANUKEY}\ez.down" ""
  ${If} $R8 != ""
  ${AndIf} $R9 != ""
    ; _?= runs the uninstaller in place so ExecWait really waits for it.
    ExecWait '$R8 /S _?=$R9'
    Delete "$R9\uninstall.exe"
    RMDir "$R9"
  ${EndIf}
  Pop $R9
  Pop $R8
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $DefaultMdCheckboxState == ${BST_CHECKED}
    !insertmacro SetDefaultMarkdownExtensions
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro ClearDefaultMarkdownExtensions
!macroend
