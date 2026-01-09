; Options Scanner - Inno Setup Script
; This creates a professional Windows installer with GUI
; 
; To build the installer:
; 1. Install Inno Setup from https://jrsoftware.org/isinfo.php
; 2. Open this file in Inno Setup Compiler
; 3. Click Build > Compile
; 4. The installer will be created in the Output folder

#define MyAppName "Options Scanner"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Options Scanner"
#define MyAppURL "http://localhost:8000"
#define MyAppExeName "start-options-scanner.bat"

[Setup]
; Application information
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Installation settings
DefaultDirName={userappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
InfoBeforeFile=README.md
OutputDir=Output
OutputBaseFilename=OptionsScanner-Setup-{#MyAppVersion}
SetupIconFile=
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

; Visual settings
WizardImageFile=
WizardSmallImageFile=

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%nIMPORTANT: Docker Desktop must be installed and running before using this application.%n%nClick Next to continue.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
; Backend files
Source: "..\..\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs
; Frontend files  
Source: "..\..\frontend\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*"
; Docker files
Source: "..\..\Dockerfile"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\docker-compose.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\docker-compose.dev.yml"; DestDir: "{app}"; Flags: ignoreversion
; Documentation
Source: "..\..\*.md"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "README.md"; DestDir: "{app}\docs"; Flags: ignoreversion

[Dirs]
Name: "{app}\data"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\Stop {#MyAppName}"; Filename: "{app}\stop-options-scanner.bat"; WorkingDir: "{app}"
Name: "{group}\View Logs"; Filename: "{app}\view-logs.bat"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autodesktop}\Stop {#MyAppName}"; Filename: "{app}\stop-options-scanner.bat"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; Build Docker images after installation
Filename: "{cmd}"; Parameters: "/c cd /d ""{app}"" && docker-compose build"; Description: "Build Docker images (required, may take a few minutes)"; Flags: runhidden waituntilterminated postinstall; StatusMsg: "Building Docker images..."
; Option to start application
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop containers before uninstall
Filename: "{cmd}"; Parameters: "/c cd /d ""{app}"" && docker-compose down -v"; Flags: runhidden waituntilterminated

[Code]
var
  DockerPage: TWizardPage;
  DockerStatusLabel: TLabel;
  DockerCheckButton: TButton;
  DockerInstallButton: TButton;
  DockerOK: Boolean;

function IsDockerInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd', '/c docker --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function IsDockerRunning: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd', '/c docker info', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

procedure CheckDockerStatus(Sender: TObject);
begin
  if not IsDockerInstalled then
  begin
    DockerStatusLabel.Caption := 'Docker is NOT installed. Please install Docker Desktop first.';
    DockerStatusLabel.Font.Color := clRed;
    DockerOK := False;
    DockerInstallButton.Visible := True;
  end
  else if not IsDockerRunning then
  begin
    DockerStatusLabel.Caption := 'Docker is installed but NOT running. Please start Docker Desktop.';
    DockerStatusLabel.Font.Color := $000080FF; // Orange
    DockerOK := False;
    DockerInstallButton.Visible := False;
  end
  else
  begin
    DockerStatusLabel.Caption := 'Docker is installed and running. You can proceed with the installation.';
    DockerStatusLabel.Font.Color := clGreen;
    DockerOK := True;
    DockerInstallButton.Visible := False;
  end;
end;

procedure OpenDockerDownload(Sender: TObject);
var
  ErrorCode: Integer;
begin
  ShellExec('open', 'https://www.docker.com/products/docker-desktop/', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
end;

procedure InitializeWizard;
begin
  DockerOK := False;
  
  // Create custom page for Docker check
  DockerPage := CreateCustomPage(wpWelcome, 'Docker Desktop Required', 
    'Options Scanner requires Docker Desktop to run. Please ensure Docker is installed and running.');
  
  DockerStatusLabel := TLabel.Create(WizardForm);
  DockerStatusLabel.Parent := DockerPage.Surface;
  DockerStatusLabel.Caption := 'Click "Check Docker Status" to verify Docker is ready.';
  DockerStatusLabel.Font.Size := 10;
  DockerStatusLabel.Left := 0;
  DockerStatusLabel.Top := 20;
  DockerStatusLabel.Width := DockerPage.SurfaceWidth;
  DockerStatusLabel.Height := 60;
  DockerStatusLabel.WordWrap := True;
  
  DockerCheckButton := TButton.Create(WizardForm);
  DockerCheckButton.Parent := DockerPage.Surface;
  DockerCheckButton.Caption := 'Check Docker Status';
  DockerCheckButton.Left := 0;
  DockerCheckButton.Top := 100;
  DockerCheckButton.Width := 150;
  DockerCheckButton.Height := 30;
  DockerCheckButton.OnClick := @CheckDockerStatus;
  
  DockerInstallButton := TButton.Create(WizardForm);
  DockerInstallButton.Parent := DockerPage.Surface;
  DockerInstallButton.Caption := 'Download Docker Desktop';
  DockerInstallButton.Left := 170;
  DockerInstallButton.Top := 100;
  DockerInstallButton.Width := 180;
  DockerInstallButton.Height := 30;
  DockerInstallButton.OnClick := @OpenDockerDownload;
  DockerInstallButton.Visible := False;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  
  if CurPageID = DockerPage.ID then
  begin
    // Check Docker status before proceeding
    CheckDockerStatus(nil);
    if not DockerOK then
    begin
      MsgBox('Docker must be installed and running to continue. Please install/start Docker Desktop and click "Check Docker Status" again.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

[INI]
Filename: "{app}\options-scanner.ini"; Section: "Settings"; Key: "Version"; String: "{#MyAppVersion}"
Filename: "{app}\options-scanner.ini"; Section: "Settings"; Key: "InstallDate"; String: "{code:GetCurrentDate}"

[Code]
function GetCurrentDate(Param: String): String;
begin
  Result := GetDateTimeString('yyyy-mm-dd', '-', ':');
end;
