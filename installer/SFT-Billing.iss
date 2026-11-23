; SFT Billing installer. Build: ISCC installer\SFT-Billing.iss
#define AppName "SFT Billing"
#define AppVersion "1.1.0"

[Setup]
AppId={{7C1E4B52-3D0A-4F6B-9A21-5F0B6E3A9D11}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Surfine Technology
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=SFT-Billing-Setup-v1.1
SetupIconFile=app.ico
UninstallDisplayIcon={app}\SFT Billing.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"

[Files]
Source: "dist\SFT Billing\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\SFT Billing.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\SFT Billing.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\SFT Billing.exe"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent
